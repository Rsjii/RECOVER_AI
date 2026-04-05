import { Request, Response } from 'express';
import { scheduleDunningEmails, queueEmailNow, getDunningQueue } from '../queue/dunningQueue';
import { listEmailLogs, updateEmailStatus, markEmailOpened, markEmailClicked } from '../db/emailLogs';
import { findInvoiceById } from '../db/invoices';
import { findCompanyById } from '../db/companies';
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

    // Get company config to pass to worker (avoid DB lookup in worker)
    const company = await findCompanyById(companyId);

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
      pilotMode: (company?.pilot_mode || 'auto') as any,
    });

    logInfo(LOG_MODULE, handler, 'Email queued for immediate send', { invoiceId, jobId });

    // Flag whether this email was queued for review (shadow mode) vs sent directly (auto mode)
    const queuedForReview = company?.pilot_mode === 'shadow';

    res.status(200).json({
      message: queuedForReview ? 'Email queued for review' : 'Email queued for immediate delivery',
      data: { invoiceId, jobId, queued_for_review: queuedForReview },
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
 * Resend webhook — track email delivery events (open, click, bounce, delivered, etc.)
 * POST /api/email/webhook/resend
 * No auth required — signature verified by Resend's HMAC
 */
export const resendWebhook = async (req: Request, res: Response): Promise<void> => {
  const handler = 'resendWebhook';

  try {
    // Resend sends a single event object (not an array like SendGrid)
    const event = req.body;

    if (!event || !event.data || !event.data.email_id) {
      logWarn(LOG_MODULE, handler, 'Invalid Resend webhook payload — missing email_id', { event: event?.type });
      res.status(200).json({ received: true });
      return;
    }

    const emailId = event.data.email_id;
    const eventType = event.type; // email.opened | email.clicked | email.bounced | email.delivered | etc.

    logInfo(LOG_MODULE, handler, 'Resend webhook received', { emailId, eventType });

    // Extract timestamp from Resend event (ISO 8601 format in created_at field)
    const createdAt = event.created_at ? new Date(event.created_at).getTime() / 1000 : 0;
    // 24h replay window for provider retries/replays.
    if (createdAt > 0 && Math.abs(Date.now() / 1000 - createdAt) > 24 * 60 * 60) {
      logWarn(LOG_MODULE, handler, 'Ignored stale Resend event', { emailId, eventType, createdAt });
      res.status(200).json({ received: true });
      return;
    }

    const dedupeKey = `${emailId}:${eventType}:${createdAt || 'na'}`;
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(event)).digest('hex');
    const accepted = await SecurityDB.registerWebhookEvent({
      provider: 'resend',
      eventId: dedupeKey,
      eventType: eventType,
      payloadHash,
    });

    if (!accepted) {
      logInfo(LOG_MODULE, handler, 'Duplicate Resend event ignored', { dedupeKey });
      res.status(200).json({ received: true });
      return;
    }

    // Handle Resend event types
    // Resend webhook events: https://resend.com/docs/api-reference/webhooks
    switch (eventType) {
      case 'email.delivered':
        await updateEmailStatus(emailId, 'delivered');
        break;
      case 'email.opened':
        await updateEmailStatus(emailId, 'opened', 'opened_at');
        break;
      case 'email.clicked':
        await updateEmailStatus(emailId, 'clicked', 'clicked_at');
        break;
      case 'email.bounced':
      case 'email.complained':
        await updateEmailStatus(emailId, 'bounced');
        break;
      case 'email.sent':
        // Resend also sends 'sent' event, but we already know email was sent when queued
        logInfo(LOG_MODULE, handler, 'Email sent confirmation from Resend', { emailId });
        break;
      default:
        logInfo(LOG_MODULE, handler, `Unhandled Resend event type: ${eventType}`, { emailId });
    }

    await SecurityDB.completeWebhookEvent('resend', dedupeKey);
    res.status(200).json({ received: true });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Webhook processing error', error);
    // Always return 200 to Resend so it doesn't retry
    res.status(200).json({ received: true });
  }
};

/**
 * Get queue stats (pending, approved, rejected, sent emails in pilot queue)
 * GET /api/email/queue/stats
 */
export const getQueueStats = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getQueueStats';
  const companyId = (req as any).companyId;

  try {
    // Query pilot_queued_emails for real counts (not Redis mock data)
    const { pool } = await import('../config/database');
    const result = await pool.query(
      `SELECT status, COUNT(*)::int AS count
       FROM pilot_queued_emails
       WHERE company_id = $1
       GROUP BY status`,
      [companyId]
    );

    // Map database status to UI field names: pending→waiting, sent→active
    const stats = { waiting: 0, approved: 0, rejected: 0, active: 0 };
    for (const row of result.rows) {
      const s = row.status as string;
      if (s === 'pending') stats.waiting = row.count;           // Pending approval in queue = waiting
      else if (s === 'approved') stats.approved = row.count;    // Approved but not yet sent
      else if (s === 'rejected') stats.rejected = row.count;
      else if (s === 'sent') stats.active = row.count;          // Sent/being tracked = active
    }

    res.status(200).json({
      data: stats,
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

    // Fetch customer risk score for AI email generation
    const { pool } = await import('../config/database');
    const customerRes = await pool.query(
      'SELECT customer_risk_score FROM customers WHERE id = $1',
      [invoice.customer_id]
    );
    const customerRiskScore = customerRes.rows[0]?.customer_risk_score || 50;

    // Use AI service to generate preview (same as agent would generate)
    const aiService = (await import('../services/aiService')).default;
    const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)));

    // Map emailType to previousReminders count (attempt number - 1)
    const emailTypeToAttempt: Record<string, number> = {
      dunning_1: 0, dunning_2: 1, dunning_3: 2, dunning_4: 3, dunning_5: 4,
      final_notice: 4, payment_plan_offer: 2
    };
    const normalizedEmailType = (emailType as string) || 'dunning_1';
    const previousReminders = emailTypeToAttempt[normalizedEmailType] ?? 0;

    const generated = await aiService.generateDunningEmail({
      customerId: invoice.customer_id,
      invoiceId: invoice.id,
      customerName: invoice.customer_name || 'Valued Customer',
      companyName,
      invoiceAmount: parseFloat(invoice.amount),
      dueDate: invoice.due_date,
      daysOverdue,
      riskScore: customerRiskScore,
      previousReminders,
      emailType: normalizedEmailType,
    });

    const preview = {
      subject: generated.subject,
      body: generated.bodyHtml || generated.bodyText,
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

