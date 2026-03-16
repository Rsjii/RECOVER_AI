import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config/env';
import { DunningEmailJob, DunningEmailType } from '../types/email';
import emailService from '../services/emailService';
import { countEmailsSentForInvoice } from '../db/emailLogs';
import { logError, logInfo, logWarn } from '../utils/logger';
import { findInvoiceById } from '../db/invoices';

const LOG_MODULE = 'dunningQueue';
const QUEUE_NAME = 'dunning-emails';

// ============================================================
// Queue connection config (Upstash Redis)
// ============================================================
export function getRedisConnection() {
  const redisUrl = config.redisUrl;

  if (!redisUrl) {
    throw new Error('REDIS_URL not configured — cannot start dunning queue');
  }

  // Parse rediss:// or redis:// URL
  const url = new URL(redisUrl);

  return {
    host: url.hostname,
    port: parseInt(url.port || '6379'),
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,  // Required by BullMQ
  };
}

// ============================================================
// Queue (producer side — add jobs here)
// ============================================================
let dunningQueue: Queue<DunningEmailJob> | null = null;

export function getDunningQueue(): Queue<DunningEmailJob> {
  if (!dunningQueue) {
    dunningQueue = new Queue<DunningEmailJob>(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,  // 5s, 25s, 125s
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    });
    dunningQueue.on('error', (err: Error) => {
      logWarn(LOG_MODULE, 'queue', 'Redis queue connection issue', { error: err.message });
    });
    logInfo(LOG_MODULE, 'getDunningQueue', 'Queue initialized', { queueName: QUEUE_NAME });
  }

  return dunningQueue;
}

// ============================================================
// Schedule dunning emails for an invoice
// ============================================================

// Default dunning schedule (days after due date)
const DUNNING_SCHEDULE: Array<{ dayOffset: number; emailType: DunningEmailType }> = [
  { dayOffset: 1,  emailType: 'dunning_1' },
  { dayOffset: 7,  emailType: 'dunning_2' },
  { dayOffset: 14, emailType: 'dunning_3' },
  { dayOffset: 30, emailType: 'dunning_4' },
  { dayOffset: 60, emailType: 'dunning_5' },
];

export async function scheduleDunningEmails(
  invoiceId: string,
  companyId: string,
): Promise<number> {
  const method = 'scheduleDunningEmails';
  logInfo(LOG_MODULE, method, 'Scheduling dunning emails', { invoiceId, companyId });

  // Block demo account from queuing any jobs (save Redis requests)
  if (companyId === '639eb868-e760-4587-8853-58bc380663db') {
    logInfo(LOG_MODULE, method, 'Demo account — not queuing jobs (demo mode)', { invoiceId });
    return 0;
  }

  const invoice = await findInvoiceById(invoiceId, companyId);
  if (!invoice) {
    logWarn(LOG_MODULE, method, 'Invoice not found — skipping schedule', { invoiceId });
    return 0;
  }

  if (invoice.status === 'paid') {
    logInfo(LOG_MODULE, method, 'Invoice already paid — skipping schedule', { invoiceId });
    return 0;
  }

  const queue = getDunningQueue();
  const now = Date.now();
  const dueDate = new Date(invoice.due_date).getTime();

  let scheduled = 0;

  for (const step of DUNNING_SCHEDULE) {
    const sendAt = dueDate + step.dayOffset * 24 * 60 * 60 * 1000;
    const delay = Math.max(0, sendAt - now);

    const job: DunningEmailJob = {
      companyId,
      customerId: invoice.customer_id,
      invoiceId,
      recipientEmail: invoice.customer_email || '',
      customerName: invoice.customer_name || 'Valued Customer',
      invoiceAmount: Number(invoice.amount),
      dueDate: invoice.due_date,
      daysOverdue: Math.max(0, Math.floor((now - dueDate) / (24 * 60 * 60 * 1000))),
      emailType: step.emailType,
      attemptNumber: scheduled + 1,
    };

    // Skip if no recipient email
    if (!job.recipientEmail) {
      logWarn(LOG_MODULE, method, 'Skipping email — no recipient email', {
        invoiceId,
        emailType: step.emailType,
      });
      continue;
    }

    await queue.add(step.emailType, job, {
      delay,
      jobId: `${invoiceId}-${step.emailType}`,  // Deduplication (no colons in BullMQ job IDs)
    });

    logInfo(LOG_MODULE, method, `Scheduled ${step.emailType}`, {
      invoiceId,
      sendAtISO: new Date(sendAt).toISOString(),
      delayMs: delay,
    });

    scheduled++;
  }

  logInfo(LOG_MODULE, method, `Scheduled ${scheduled} emails for invoice`, { invoiceId });
  return scheduled;
}

// ============================================================
// Add a single email job immediately (manual trigger)
// ============================================================
export async function queueEmailNow(job: DunningEmailJob): Promise<string> {
  // Block demo account from queuing jobs
  if (job.companyId === '639eb868-e760-4587-8853-58bc380663db') {
    logInfo(LOG_MODULE, 'queueEmailNow', 'Demo account — not queuing jobs (demo mode)', {
      invoiceId: job.invoiceId,
    });
    return 'demo-blocked';
  }

  const queue = getDunningQueue();

  const bullJob = await queue.add(job.emailType, job, {
    delay: 0,
    jobId: `${job.invoiceId}-${job.emailType}-${Date.now()}`,
  });

  logInfo(LOG_MODULE, 'queueEmailNow', 'Email queued immediately', {
    jobId: bullJob.id,
    invoiceId: job.invoiceId,
    emailType: job.emailType,
  });

  return bullJob.id!;
}

// ============================================================
// Worker (consumer side — processes jobs)
// ============================================================
let dunningWorker: Worker<DunningEmailJob> | null = null;

export function startDunningWorker(): Worker<DunningEmailJob> {
  if (dunningWorker) return dunningWorker;

  logInfo(LOG_MODULE, 'startDunningWorker', 'Starting dunning email worker');

  dunningWorker = new Worker<DunningEmailJob>(
    QUEUE_NAME,
    async (job: Job<DunningEmailJob>) => {
      const { data } = job;

      logInfo(LOG_MODULE, 'worker', 'Processing dunning email job', {
        jobId: job.id,
        invoiceId: data.invoiceId,
        emailType: data.emailType,
        attempt: job.attemptsMade + 1,
      });

      // Check if invoice is still unpaid before sending
      const invoice = await findInvoiceById(data.invoiceId, data.companyId);
      if (!invoice || invoice.status === 'paid') {
        logInfo(LOG_MODULE, 'worker', 'Invoice paid or missing — discarding job', {
          jobId: job.id,
          invoiceId: data.invoiceId,
        });
        return { skipped: true, reason: 'Invoice already paid' };
      }

      // Check how many emails already sent for this invoice
      const emailsSent = await countEmailsSentForInvoice(data.invoiceId);
      if (emailsSent >= 5) {
        logWarn(LOG_MODULE, 'worker', 'Max emails reached — discarding job', {
          jobId: job.id,
          invoiceId: data.invoiceId,
          emailsSent,
        });
        return { skipped: true, reason: 'Max emails reached' };
      }

      // Update daysOverdue at send time (not at schedule time)
      const dueDate = new Date(data.dueDate).getTime();
      const daysOverdue = Math.max(0, Math.floor((Date.now() - dueDate) / (24 * 60 * 60 * 1000)));

      const result = await emailService.sendDunningEmail({
        ...data,
        daysOverdue,
        attemptNumber: emailsSent + 1,
      });

      if (!result.success) {
        throw new Error(result.error || 'Email send failed');
      }

      logInfo(LOG_MODULE, 'worker', 'Dunning email sent successfully', {
        jobId: job.id,
        invoiceId: data.invoiceId,
        emailLogId: result.emailLogId,
        sendgridMessageId: result.sendgridMessageId,
      });

      return {
        success: true,
        emailLogId: result.emailLogId,
        sendgridMessageId: result.sendgridMessageId,
      };
    },
    ({
      connection: getRedisConnection(),
      concurrency: 1,  // Respect Resend's 2 requests/sec rate limit
      // Blocking fetch optimization: fetch jobs without polling
      pollInterval: 30000,        // 30 second poll when idle (fallback if blocking disabled)
      tryBlockedFetch: true,      // Use BZPOPMIN (blocking) — blocks instead of polling
      maxStalCount: 2,            // Aggressively switch to blocking mode immediately
      stalledInterval: 600000,    // Check for stalled jobs every 10 min (instead of default 30s)
      drainDelay: 60,             // Long poll for 60 seconds when queue empty (instead of default 5s)
    } as any)
  );

  dunningWorker.on('completed', (job, result) => {
    logInfo(LOG_MODULE, 'worker', 'Job completed', {
      jobId: job.id,
      invoiceId: job.data.invoiceId,
      result,
    });
  });

  dunningWorker.on('failed', (job, err) => {
    logError(LOG_MODULE, 'worker', 'Job failed', err, {
      jobId: job?.id,
      invoiceId: job?.data.invoiceId,
      attempt: job?.attemptsMade,
    });
  });

  dunningWorker.on('stalled', (jobId) => {
    logWarn(LOG_MODULE, 'worker', 'Job stalled', { jobId });
  });

  dunningWorker.on('error', (err: Error) => {
    logWarn(LOG_MODULE, 'worker', 'Worker connection issue', { error: err.message });
  });

  logInfo(LOG_MODULE, 'startDunningWorker', 'Worker started', { concurrency: 1 });
  return dunningWorker;
}

export async function stopDunningWorker(): Promise<void> {
  if (dunningWorker) {
    await dunningWorker.close();
    dunningWorker = null;
    logInfo(LOG_MODULE, 'stopDunningWorker', 'Worker stopped');
  }
}
