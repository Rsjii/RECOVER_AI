import { Queue, Worker, Job } from 'bullmq';
import { getRedisConnection } from './dunningQueue';
import { isRedisConnected } from '../config/redis';
import { sendSMS } from '../services/smsService';
import { generateSMSMessage } from '../services/smsGenerationService';
import { checkTCPACompliance, getUSEasternHour } from '../utils/tcpaCompliance';
import { pool } from '../config/database';
import { logError, logInfo, logWarn } from '../utils/logger';

const LOG_MODULE = 'smsQueue';
const QUEUE_NAME = 'sms-messages';
const WORKER_IDLE_TIMEOUT_MS = 60000; // Close worker if idle for 1 minute
const SMS_FEATURE_ENABLED = true; // ENABLED: Phase 1 Multi-channel Orchestration

let smsWorkerCleanupTimer: NodeJS.Timeout | null = null;

function scheduleSMSWorkerCleanup(): void {
  if (smsWorkerCleanupTimer) {
    clearTimeout(smsWorkerCleanupTimer);
  }

  smsWorkerCleanupTimer = setTimeout(async () => {
    if (smsWorker) {
      try {
        await smsWorker.close();
        smsWorker = null;
        logInfo(LOG_MODULE, 'scheduleSMSWorkerCleanup', 'SMS worker closed after idle timeout');
      } catch (err: any) {
        logError(LOG_MODULE, 'scheduleSMSWorkerCleanup', 'Failed to close SMS worker', err);
      }
    }
  }, WORKER_IDLE_TIMEOUT_MS);
}

export interface SMSJob {
  companyId: string;
  customerId: string;
  invoiceId: string;
  phoneNumber: string;
  customerName: string;
  companyName: string;
  invoiceAmount: number;
  daysOverdue: number;
}

// ── Queue (producer) ──────────────────────────────────────────────────────────

let smsQueue: Queue<SMSJob> | null = null;

export function getSMSQueue(): Queue<SMSJob> | null {
  if (!SMS_FEATURE_ENABLED) {
    return null;
  }

  if (!smsQueue) {
    // OPTIMIZATION: Check if Redis is available before creating queue
    if (!isRedisConnected()) {
      logWarn(LOG_MODULE, 'getSMSQueue', 'Redis not connected - queue disabled');
      return null;
    }

    smsQueue = new Queue<SMSJob>(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    });
    smsQueue.on('error', (err: Error) => {
      logWarn(LOG_MODULE, 'queue', 'SMS queue error', { error: err.message });
    });
  }
  return smsQueue;
}

export async function queueSMSNow(job: SMSJob): Promise<void> {
  if (!SMS_FEATURE_ENABLED) {
    logInfo(LOG_MODULE, 'queueSMSNow', 'SMS feature paused (Phase 2) - skipping SMS queue', {
      invoiceId: job.invoiceId,
    });
    return;
  }

  const queue = getSMSQueue();

  // OPTIMIZATION: If Redis not available, skip queuing
  if (!queue) {
    logWarn(LOG_MODULE, 'queueSMSNow', 'Queue unavailable (Redis disconnected) - skipping SMS queue', {
      invoiceId: job.invoiceId,
    });
    return;
  }

  // Lazy-start worker on first job
  if (!smsWorker) {
    startSMSWorker();
  }

  await queue.add('send-sms', job, { jobId: `sms-${job.invoiceId}-${Date.now()}` });
  logInfo(LOG_MODULE, 'queueSMSNow', 'SMS queued', {
    invoiceId: job.invoiceId,
    customerId: job.customerId,
  });
}

// ── Worker (consumer) ────────────────────────────────────────────────────────

let smsWorker: Worker<SMSJob> | null = null;

export function startSMSWorker(): void {
  // Feature paused
  if (!SMS_FEATURE_ENABLED) {
    logInfo(LOG_MODULE, 'startSMSWorker', 'SMS feature paused - worker not started');
    return;
  }

  if (smsWorker) {
    // Worker already running, cancel cleanup timer since we're submitting a job
    if (smsWorkerCleanupTimer) {
      clearTimeout(smsWorkerCleanupTimer);
      smsWorkerCleanupTimer = null;
    }
    return;
  }

  logInfo(LOG_MODULE, 'startSMSWorker', 'Starting SMS worker (lazy-init)');

  smsWorker = new Worker<SMSJob>(
    QUEUE_NAME,
    async (job: Job<SMSJob>) => {
      const data = job.data;
      const method = 'worker';

      logInfo(LOG_MODULE, method, 'Processing SMS job', {
        invoiceId: data.invoiceId,
        customerId: data.customerId,
      });

      // 1. TCPA compliance check
      const smsCount = await getSMSCountLast30Days(data.customerId);
      const compliance = checkTCPACompliance({
        phoneOptIn: true, // already verified before queuing
        localHour: getUSEasternHour(),
        smsCountLast30Days: smsCount,
      });

      if (!compliance.allowed) {
        logWarn(LOG_MODULE, method, 'TCPA check failed — not sending', {
          invoiceId: data.invoiceId,
          reason: compliance.reason,
        });
        return; // don't throw — job succeeds (intentional skip)
      }

      // 2. Generate SMS message
      const message = await generateSMSMessage({
        customerName: data.customerName,
        companyName: data.companyName,
        invoiceAmount: data.invoiceAmount,
        daysOverdue: data.daysOverdue,
      });

      // 3. Send SMS
      const result = await sendSMS({
        to: data.phoneNumber,
        message,
        invoiceId: data.invoiceId,
        customerId: data.customerId,
        companyId: data.companyId,
      });

      if (!result.success) {
        throw new Error(`SMS send failed: ${result.error}`);
      }

      // 4. Log to email_logs (reuse existing table, email_type = 'sms')
      await logSMSSent({
        invoiceId: data.invoiceId,
        companyId: data.companyId,
        phoneNumber: data.phoneNumber,
        message,
        twilioSid: result.messageId!,
      });

      // 5. Increment sms_count on invoice
      await pool.query(
        `UPDATE invoices SET sms_count = COALESCE(sms_count, 0) + 1, last_sms_sent_at = NOW() WHERE id = $1`,
        [data.invoiceId]
      );

      logInfo(LOG_MODULE, method, 'SMS sent successfully', {
        messageId: result.messageId,
        invoiceId: data.invoiceId,
      });
    },
    {
      connection: getRedisConnection(),
      concurrency: 2,
      // Event-driven only: BZPOPMIN blocking, never poll
      tryBlockedFetch: true,        // Use BZPOPMIN (blocking) — blocks until job arrives
      maxStalCount: 2,              // Switch to blocking mode immediately
      stalledInterval: 600_000,     // Check for stalled jobs every 10 min
      drainDelay: 300,              // Wait 5 minutes before giving up on blocking
    } as any
  );

  smsWorker.on('completed', async (job) => {
    logInfo(LOG_MODULE, 'worker', 'SMS job completed', { jobId: job.id });
    scheduleSMSWorkerCleanup();
  });

  smsWorker.on('failed', async (job, err) => {
    logError(LOG_MODULE, 'worker', 'SMS job failed', err, { jobId: job?.id });
    scheduleSMSWorkerCleanup();
  });

  logInfo(LOG_MODULE, 'startSMSWorker', 'SMS worker started (lazy)', {
    concurrency: 3,
    idleTimeout: `${WORKER_IDLE_TIMEOUT_MS / 1000}s`,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getSMSCountLast30Days(customerId: string): Promise<number> {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) FROM email_logs
       WHERE recipient_email IN (
         SELECT phone FROM customers WHERE id = $1
       )
       AND email_type = 'sms'
       AND sent_at > NOW() - INTERVAL '30 days'`,
      [customerId]
    );
    return parseInt(result.rows[0].count, 10);
  } catch {
    return 0;
  }
}

async function logSMSSent(params: {
  invoiceId: string;
  companyId: string;
  phoneNumber: string;
  message: string;
  twilioSid: string;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO email_logs
         (invoice_id, company_id, email_type, recipient_email, subject, body, status, sendgrid_message_id)
       VALUES ($1, $2, 'sms', $3, 'SMS', $4, 'sent', $5)`,
      [params.invoiceId, params.companyId, params.phoneNumber, params.message, params.twilioSid]
    );
  } catch (err) {
    logError(LOG_MODULE, 'logSMSSent', 'Failed to log SMS', err);
  }
}
