import { Request, Response } from 'express';
import { scheduleDunningEmails, queueEmailNow, getDunningQueue } from '../queue/dunningQueue';
import { listEmailLogs, updateEmailStatus, markEmailOpened, markEmailClicked } from '../db/emailLogs';
import { findInvoiceById } from '../db/invoices';
import * as SecurityDB from '../db/security';
import { SendGridWebhookEvent, DunningEmailType } from '../types/email';
import { logError, logInfo, logWarn } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';
import crypto from 'crypto';
import { redisClient } from '../config/redis';

const LOG_MODULE = 'emailController';

// In-memory cache for email previews (stores key: "invoiceId:emailType" → preview data)
const emailPreviewCache = new Map<string, { subject: string; body: string; tone: string }>();

// Helper to cache preview in memory + Redis
async function cacheEmailPreview(
  invoiceId: string,
  emailType: string,
  preview: { subject: string; body: string; tone: string }
): Promise<void> {
  const key = `${invoiceId}:${emailType}`;
  emailPreviewCache.set(key, preview);

  try {
    await redisClient.setEx(`email_preview:${key}`, 3600, JSON.stringify(preview)); // 1 hour TTL
  } catch (err) {
    logWarn(LOG_MODULE, 'cacheEmailPreview', 'Redis cache failed', { invoiceId, emailType });
  }
}

async function getCachedEmailPreview(
  invoiceId: string,
  emailType: string
): Promise<{ subject: string; body: string; tone: string } | null> {
  const key = `${invoiceId}:${emailType}`;

  // Memory cache first (fastest)
  const cached = emailPreviewCache.get(key);
  if (cached) {
    logInfo(LOG_MODULE, 'getCachedEmailPreview', 'Cache hit (memory)', { invoiceId, emailType });
    return cached;
  }

  // Redis cache (persists across restarts)
  try {
    const redisData = await redisClient.get(`email_preview:${key}`);
    if (redisData) {
      const preview = JSON.parse(redisData);
      emailPreviewCache.set(key, preview); // Warm memory cache
      logInfo(LOG_MODULE, 'getCachedEmailPreview', 'Cache hit (redis)', { invoiceId, emailType });
      return preview;
    }
  } catch (err) {
    logWarn(LOG_MODULE, 'getCachedEmailPreview', 'Redis lookup failed', { invoiceId, emailType });
  }

  return null;
}

/**
 * Schedule all dunning emails for an invoice
 * POST /api/email/schedule
 */
export const scheduleInvoiceEmails = async (req: Request, res: Response): Promise<void> => {
  const handler = 'scheduleInvoiceEmails';
  const companyId = (req as any).companyId;

  try {
    const { invoiceId } = req.body;

    if (!invoiceId) {
      sendErrorResponse(res, 400, 'invoiceId is required');
      return;
    }

    const invoice = await findInvoiceById(invoiceId, companyId);
    if (!invoice) {
      sendErrorResponse(res, 404, 'Invoice not found');
      return;
    }

    if (invoice.status === 'paid') {
      sendErrorResponse(res, 400, 'Cannot schedule emails for a paid invoice');
      return;
    }

    const scheduled = await scheduleDunningEmails(invoiceId, companyId);

    logInfo(LOG_MODULE, handler, 'Emails scheduled', { invoiceId, scheduled });

    res.status(200).json({
      message: `${scheduled} dunning emails scheduled`,
      data: { invoiceId, scheduled },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to schedule emails', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * Send a dunning email immediately (manual trigger)
 * POST /api/email/send-now
 */
export const sendEmailNow = async (req: Request, res: Response): Promise<void> => {
  const handler = 'sendEmailNow';
  const companyId = (req as any).companyId;

  try {
    const { invoiceId, emailType } = req.body;

    if (!invoiceId) {
      sendErrorResponse(res, 400, 'invoiceId is required');
      return;
    }

    const invoice = await findInvoiceById(invoiceId, companyId);
    if (!invoice) {
      sendErrorResponse(res, 404, 'Invoice not found');
      return;
    }

    if (!invoice.customer_email) {
      sendErrorResponse(res, 400, 'Customer has no email address');
      return;
    }

    const dueDate = new Date(invoice.due_date).getTime();
    const daysOverdue = Math.max(0, Math.floor((Date.now() - dueDate) / (24 * 60 * 60 * 1000)));

    const jobId = await queueEmailNow({
      companyId,
      customerId: invoice.customer_id,
      invoiceId,
      recipientEmail: invoice.customer_email,
      customerName: invoice.customer_name || 'Valued Customer',
      invoiceAmount: Number(invoice.amount),
      dueDate: invoice.due_date,
      daysOverdue,
      emailType: (emailType as DunningEmailType) || 'dunning_1',
      attemptNumber: 1,
    });

    logInfo(LOG_MODULE, handler, 'Email queued for immediate send', { invoiceId, jobId });

    res.status(200).json({
      message: 'Email queued for immediate delivery',
      data: { invoiceId, jobId },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to queue email', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * List email logs for a company (optionally filtered by invoice)
 * GET /api/email/logs?invoiceId=xxx
 */
export const getEmailLogs = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getEmailLogs';
  const companyId = (req as any).companyId;

  try {
    const invoiceId = req.query.invoiceId as string | undefined;

    const logs = await listEmailLogs(companyId, invoiceId);

    res.status(200).json({
      data: logs,
      total: logs.length,
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to fetch email logs', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * SendGrid webhook — track email delivery events (open, click, bounce, etc.)
 * POST /api/email/webhook/sendgrid
 * No auth required — raw body, verified by IP or basic signature
 */
export const sendgridWebhook = async (req: Request, res: Response): Promise<void> => {
  const handler = 'sendgridWebhook';

  try {
    const events: SendGridWebhookEvent[] = Array.isArray(req.body) ? req.body : [];

    logInfo(LOG_MODULE, handler, 'SendGrid webhook received', { eventCount: events.length });

    for (const event of events) {
      const messageId = event.sg_message_id;

      if (!messageId) {
        logWarn(LOG_MODULE, handler, 'Event missing sg_message_id — skipping', { event: event.event });
        continue;
      }

      const eventTimestamp = Number((event as any).timestamp || 0);
      // 24h replay window for provider retries/replays.
      if (eventTimestamp > 0 && Math.abs(Date.now() / 1000 - eventTimestamp) > 24 * 60 * 60) {
        logWarn(LOG_MODULE, handler, 'Ignored stale SendGrid event', { messageId, event: event.event, eventTimestamp });
        continue;
      }

      const dedupeKey = `${messageId}:${event.event}:${eventTimestamp || 'na'}`;
      const payloadHash = crypto.createHash('sha256').update(JSON.stringify(event)).digest('hex');
      const accepted = await SecurityDB.registerWebhookEvent({
        provider: 'sendgrid',
        eventId: dedupeKey,
        eventType: event.event,
        payloadHash,
      });

      if (!accepted) {
        logInfo(LOG_MODULE, handler, 'Duplicate SendGrid event ignored', { dedupeKey });
        continue;
      }

      switch (event.event) {
        case 'delivered':
          await updateEmailStatus(messageId, 'delivered');
          break;
        case 'open':
          await updateEmailStatus(messageId, 'opened', 'opened_at');
          break;
        case 'click':
          await updateEmailStatus(messageId, 'clicked', 'clicked_at');
          break;
        case 'bounce':
        case 'blocked':
        case 'invalid_email':
          await updateEmailStatus(messageId, 'bounced');
          break;
        default:
          logInfo(LOG_MODULE, handler, `Unhandled event type: ${event.event}`, { messageId });
      }
      await SecurityDB.completeWebhookEvent('sendgrid', dedupeKey);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Webhook processing error', error);
    // Always return 200 to SendGrid so it doesn't retry
    res.status(200).json({ received: true });
  }
};

/**
 * Get queue stats (jobs waiting, active, completed, failed)
 * GET /api/email/queue/stats
 */
export const getQueueStats = async (_req: Request, res: Response): Promise<void> => {
  const handler = 'getQueueStats';

  try {
    const queue = getDunningQueue();
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    res.status(200).json({
      data: { waiting, active, completed, failed, delayed },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get queue stats', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * Preview AI-generated email for an invoice
 * GET /api/email/preview?invoiceId=xxx&emailType=dunning_1
 */
export const previewEmail = async (req: Request, res: Response): Promise<void> => {
  const handler = 'previewEmail';
  const companyId = (req as any).companyId;

  try {
    const { invoiceId, emailType } = req.query;

    if (!invoiceId) {
      sendErrorResponse(res, 400, 'invoiceId is required');
      return;
    }

    // Check cache first (avoid LLM call if already generated)
    const cached = await getCachedEmailPreview(invoiceId as string, (emailType as string) || 'dunning_1');
    if (cached) {
      res.status(200).json({
        data: {
          ...cached,
          invoiceId,
          emailType: emailType || 'dunning_1',
        },
      });
      return;
    }

    const invoice = await findInvoiceById(invoiceId as string, companyId);
    if (!invoice) {
      sendErrorResponse(res, 404, 'Invoice not found');
      return;
    }

    // Fetch company name for personalization
    const companyRes = await (await import('../config/database')).pool.query(
      'SELECT name FROM companies WHERE id = $1',
      [companyId]
    );
    const companyName = companyRes.rows[0]?.name || 'Your Company';

    // Use AI service to generate preview (same as agent would generate)
    const aiService = (await import('../services/aiService')).default;
    const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)));

    const generated = await aiService.generateDunningEmail({
      customerId: invoice.customer_id,
      invoiceId: invoice.id,
      customerName: invoice.customer_name || 'Valued Customer',
      companyName,
      invoiceAmount: parseFloat(invoice.amount),
      dueDate: invoice.due_date,
      daysOverdue,
      riskScore: invoice.risk_score || 50,
    });

    const preview = {
      subject: generated.subject,
      body: generated.bodyText,
      tone: generated.tone,
    };

    // Cache for future requests
    await cacheEmailPreview(invoiceId as string, (emailType as string) || 'dunning_1', preview);

    logInfo(LOG_MODULE, handler, 'Preview generated and cached', { invoiceId, emailType });

    res.status(200).json({
      data: {
        ...preview,
        invoiceId,
        emailType: emailType || 'dunning_1',
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Preview generation failed', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

// 1x1 transparent GIF
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * GET /api/email/track/open?logId=xxx
 * Called when email client loads the tracking pixel.
 */
export const trackEmailOpen = async (req: Request, res: Response): Promise<void> => {
  const { logId } = req.query as { logId?: string };
  if (logId) {
    markEmailOpened(logId).catch(() => {}); // non-blocking
  }
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.status(200).end(TRACKING_PIXEL);
};

/**
 * GET /api/email/track/click?logId=xxx&url=https://...
 * Records click and 302-redirects to the original URL.
 */
export const trackEmailClick = async (req: Request, res: Response): Promise<void> => {
  const { logId, url } = req.query as { logId?: string; url?: string };
  if (logId) {
    markEmailClicked(logId).catch(() => {}); // non-blocking
  }
  const redirectTo = url ? decodeURIComponent(url) : '/';
  // Basic URL safety check — only allow http/https
  if (redirectTo.startsWith('http://') || redirectTo.startsWith('https://')) {
    res.redirect(302, redirectTo);
  } else {
    res.redirect(302, '/');
  }
};

