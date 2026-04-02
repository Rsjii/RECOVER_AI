import { Queue, Worker, Job } from 'bullmq';
import Stripe from 'stripe';
import { config } from '../config/env';
import { getRedisConnection } from './dunningQueue';
import { isRedisConnected } from '../config/redis';
import { findInvoiceById, updateInvoiceStatus } from '../db/invoices';
import { findCompanyById } from '../db/companies';
import { decryptField } from '../lib/encryption';
import { createPlanForInvoice } from '../services/paymentPlanService';
import { recordSuccessfulRetry, recordDeclineOccurrence, classifyDeclineCode } from '../services/declineCodeService';
import { updateOptimalRetryProfile } from '../services/paymentBehaviorService';
import { pool } from '../config/database';
import { logError, logInfo, logWarn } from '../utils/logger';

const LOG_MODULE = 'retryQueue';
const QUEUE_NAME = 'payment-retries';
const MAX_ATTEMPTS = 5;
const DEMO_COMPANY_ID = '639eb868-e760-4587-8853-58bc380663db';
const WORKER_IDLE_TIMEOUT_MS = 60000; // Close worker if idle for 1 minute

let retryWorkerCleanupTimer: NodeJS.Timeout | null = null;

function scheduleRetryWorkerCleanup(): void {
  if (retryWorkerCleanupTimer) {
    clearTimeout(retryWorkerCleanupTimer);
  }

  retryWorkerCleanupTimer = setTimeout(async () => {
    if (retryWorker) {
      try {
        await retryWorker.close();
        retryWorker = null;
        logInfo(LOG_MODULE, 'scheduleRetryWorkerCleanup', 'Retry worker closed after idle timeout');
      } catch (err: any) {
        logError(LOG_MODULE, 'scheduleRetryWorkerCleanup', 'Failed to close retry worker', err);
      }
    }
  }, WORKER_IDLE_TIMEOUT_MS);
}

export interface RetryJob {
  invoiceId: string;
  companyId: string;
  customerId: string;
  attempt: number;  // 1-MAX_ATTEMPTS
  variant: 'optimized' | 'generic';
  declineCode?: string;
}

// ============================================================
// Queue (producer side)
// ============================================================
let retryQueue: Queue<RetryJob> | null = null;

export function getRetryQueue(): Queue<RetryJob> | null {
  if (!retryQueue) {
    // OPTIMIZATION: Check if Redis is available before creating queue
    if (!isRedisConnected()) {
      logWarn(LOG_MODULE, 'getRetryQueue', 'Redis not connected - queue disabled');
      return null;
    }

    retryQueue = new Queue<RetryJob>(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 1,  // BullMQ attempts = 1; our own retry logic controls re-queuing
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 200 },
      },
    });
    retryQueue.on('error', (err: Error) => {
      logWarn(LOG_MODULE, 'queue', 'Redis connection issue', { error: err.message });
    });
  }
  return retryQueue;
}

export async function addRetryJob(
  data: RetryJob,
  options: { delay?: number } = {}
): Promise<string | undefined> {
  if (data.companyId === DEMO_COMPANY_ID) {
    logInfo(LOG_MODULE, 'addRetryJob', 'Demo account — skipping retry job', { invoiceId: data.invoiceId });
    return undefined;
  }

  const queue = getRetryQueue();

  // OPTIMIZATION: If Redis not available, skip queuing
  if (!queue) {
    logWarn(LOG_MODULE, 'addRetryJob', 'Queue unavailable (Redis disconnected) - skipping retry job', {
      invoiceId: data.invoiceId,
    });
    return undefined;
  }

  // Lazy-start worker on first job
  if (!retryWorker) {
    startRetryWorker();
  }

  const jobId = `retry-${data.invoiceId}-attempt-${data.attempt}-${Date.now()}`;
  const job = await queue.add('retry', data, {
    delay: options.delay ?? 0,
    jobId,
  });

  logInfo(LOG_MODULE, 'addRetryJob', 'Retry job queued', {
    invoiceId: data.invoiceId,
    attempt: data.attempt,
    variant: data.variant,
    delayMs: options.delay ?? 0,
    jobId: job.id,
  });

  return job.id;
}

// ============================================================
// Worker (consumer side)
// ============================================================
let retryWorker: Worker<RetryJob> | null = null;

async function recordRetryAttempt(
  data: RetryJob,
  result: 'success' | 'failed' | 'skipped'
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO payment_retries
         (invoice_id, company_id, attempt_number, retry_at, scheduled_reason, ab_variant, result, result_at, decline_code)
       VALUES ($1, $2, $3, NOW(), 'soft_decline', $4, $5, NOW(), $6)`,
      [data.invoiceId, data.companyId, data.attempt, data.variant, result, data.declineCode ?? null]
    );
  } catch (err) {
    logError(LOG_MODULE, 'recordRetryAttempt', 'Failed to record retry (non-blocking)', err);
  }
}

export function startRetryWorker(): Worker<RetryJob> {
  if (retryWorker) {
    // Worker already running, cancel cleanup timer since we're submitting a job
    if (retryWorkerCleanupTimer) {
      clearTimeout(retryWorkerCleanupTimer);
      retryWorkerCleanupTimer = null;
    }
    return retryWorker;
  }

  logInfo(LOG_MODULE, 'startRetryWorker', 'Starting payment retry worker (lazy-init)');

  retryWorker = new Worker<RetryJob>(
    QUEUE_NAME,
    async (job: Job<RetryJob>) => {
      const { data } = job;
      logInfo(LOG_MODULE, 'worker', 'Processing retry job', {
        jobId: job.id,
        invoiceId: data.invoiceId,
        attempt: data.attempt,
        variant: data.variant,
      });

      // Verify invoice is still unpaid
      const invoice = await findInvoiceById(data.invoiceId, data.companyId);
      if (!invoice || invoice.status === 'paid') {
        logInfo(LOG_MODULE, 'worker', 'Invoice already paid — skipping retry', { invoiceId: data.invoiceId });
        await recordRetryAttempt(data, 'skipped');
        return { skipped: true, reason: 'Invoice already paid' };
      }

      if (invoice.dunning_stopped) {
        logInfo(LOG_MODULE, 'worker', 'Dunning stopped — skipping retry', { invoiceId: data.invoiceId });
        await recordRetryAttempt(data, 'skipped');
        return { skipped: true, reason: 'Dunning stopped' };
      }

      // Only auto-charge Stripe-sourced invoices
      if (invoice.source !== 'stripe' || !invoice.source_id) {
        logInfo(LOG_MODULE, 'worker', 'Non-Stripe invoice — cannot auto-retry charge', { invoiceId: data.invoiceId });
        await recordRetryAttempt(data, 'skipped');
        return { skipped: true, reason: 'Non-Stripe invoice' };
      }

      // Get company's Stripe key
      const company = await findCompanyById(data.companyId);
      if (!company?.stripe_api_key_encrypted) {
        logWarn(LOG_MODULE, 'worker', 'No Stripe key — cannot retry', { companyId: data.companyId });
        await recordRetryAttempt(data, 'skipped');
        return { skipped: true, reason: 'No Stripe API key' };
      }

      const apiKey = decryptField(company.stripe_api_key_encrypted);
      const stripe = new Stripe(apiKey, { apiVersion: '2026-02-25.clover' });

      try {
        // Attempt to pay the Stripe invoice using the existing payment method
        await stripe.invoices.pay(invoice.source_id, { forgive: false });

        // Success — record it
        await recordRetryAttempt(data, 'success');
        if (data.declineCode) {
          recordSuccessfulRetry(data.companyId, data.declineCode).catch(() => {});
        }
        updateOptimalRetryProfile(data.companyId, data.customerId).catch(() => {});

        logInfo(LOG_MODULE, 'worker', 'Retry payment succeeded', {
          invoiceId: data.invoiceId,
          attempt: data.attempt,
        });

        // Mark invoice paid immediately (webhook will also fire, but it's idempotent)
        await updateInvoiceStatus(data.invoiceId, data.companyId, 'paid');

        return { success: true, attempt: data.attempt };
      } catch (stripeErr: any) {
        const newDeclineCode = stripeErr?.raw?.decline_code || stripeErr?.code || null;
        const newClassification = classifyDeclineCode(newDeclineCode, stripeErr?.code);

        logWarn(LOG_MODULE, 'worker', 'Retry payment failed', {
          invoiceId: data.invoiceId,
          attempt: data.attempt,
          stripeCode: newDeclineCode,
          type: newClassification.type,
        });

        await recordRetryAttempt({ ...data, declineCode: newDeclineCode || data.declineCode }, 'failed');

        // Track new decline code analytics
        if (newDeclineCode) {
          recordDeclineOccurrence(data.companyId, newDeclineCode).catch(() => {});
        }

        // Escalate if: hard/fraud decline OR max attempts reached
        const shouldEscalate =
          newClassification.type === 'hard' ||
          newClassification.type === 'fraud' ||
          data.attempt >= MAX_ATTEMPTS;

        if (shouldEscalate) {
          logInfo(LOG_MODULE, 'worker', 'Escalating to payment plan', {
            invoiceId: data.invoiceId,
            reason: data.attempt >= MAX_ATTEMPTS ? 'max_attempts' : newClassification.type,
          });
          try {
            await createPlanForInvoice(data.invoiceId, data.companyId, 3);
          } catch (planErr) {
            logWarn(LOG_MODULE, 'worker', 'Payment plan creation skipped (may exist)', {
              invoiceId: data.invoiceId,
              error: String(planErr),
            });
          }
        } else {
          // Schedule next retry attempt with 24h delay (generic back-off)
          const nextAttempt = data.attempt + 1;
          const delays = [0, 24, 48, 72, 96];  // hours per attempt index (0-based)
          const delayHours = delays[data.attempt] ?? 24;

          await addRetryJob(
            {
              invoiceId: data.invoiceId,
              companyId: data.companyId,
              customerId: data.customerId,
              attempt: nextAttempt,
              variant: data.variant,
              declineCode: newDeclineCode || data.declineCode,
            },
            { delay: delayHours * 60 * 60 * 1000 }
          );

          logInfo(LOG_MODULE, 'worker', `Next retry scheduled (attempt ${nextAttempt})`, {
            invoiceId: data.invoiceId,
            delayHours,
          });
        }

        return { failed: true, attempt: data.attempt, escalated: shouldEscalate };
      }
    },
    ({
      connection: getRedisConnection(),
      concurrency: 2,
    } as any)
  );

  retryWorker.on('completed', async (job, result) => {
    logInfo(LOG_MODULE, 'worker', 'Job completed', { jobId: job.id, result });
    // Schedule cleanup after idle timeout
    scheduleRetryWorkerCleanup();
  });

  retryWorker.on('failed', async (job, err) => {
    logError(LOG_MODULE, 'worker', 'Job failed', err, { jobId: job?.id, invoiceId: job?.data.invoiceId });
    // Schedule cleanup after idle timeout
    scheduleRetryWorkerCleanup();
  });

  retryWorker.on('error', (err: Error) => {
    logWarn(LOG_MODULE, 'worker', 'Worker connection issue', { error: err.message });
  });

  logInfo(LOG_MODULE, 'startRetryWorker', 'Worker started (lazy)', {
    concurrency: 2,
    idleTimeout: `${WORKER_IDLE_TIMEOUT_MS / 1000}s`,
  });
  return retryWorker;
}

export async function stopRetryWorker(): Promise<void> {
  if (retryWorker) {
    await retryWorker.close();
    retryWorker = null;
    logInfo(LOG_MODULE, 'stopRetryWorker', 'Worker stopped');
  }
}
