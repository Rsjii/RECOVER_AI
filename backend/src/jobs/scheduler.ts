/**
 * Cron Scheduler: Best Practice Implementation
 *
 * Pattern: Netflix, Uber, Stripe
 * Replaces wasteful Redis polling with exact-time scheduling
 *
 * Status: Infrastructure ready, individual jobs to be refactored incrementally
 */

import cron from 'node-cron';
import { logInfo, logError } from '../utils/logger';

const LOG_MODULE = 'scheduler';
const activeJobs = new Map<string, boolean>();

/**
 * Wrapper for job execution (prevents concurrent runs)
 */
async function executeJob(jobName: string, fn: () => Promise<void>) {
  if (activeJobs.get(jobName)) {
    logInfo(LOG_MODULE, jobName, 'Already running, skipping');
    return;
  }

  activeJobs.set(jobName, true);
  const startTime = Date.now();

  try {
    logInfo(LOG_MODULE, jobName, 'Starting');
    await fn();
    const duration = Date.now() - startTime;
    logInfo(LOG_MODULE, jobName, 'Completed', { durationMs: duration });
  } catch (err) {
    logError(LOG_MODULE, jobName, 'Failed', err);
  } finally {
    activeJobs.set(jobName, false);
  }
}

/**
 * Initialize cron scheduler
 */
export function initScheduler() {
  logInfo(LOG_MODULE, 'initScheduler', 'Initializing cron scheduler');

  // Placeholder jobs - will be replaced with actual implementations
  // These demonstrate the cron scheduling pattern

  cron.schedule('0 */6 * * *', async () => {
    await executeJob('agentLoop', async () => {
      logInfo(LOG_MODULE, 'agentLoop', 'Would score all invoices here');
    });
  });

  cron.schedule('0 1 * * *', async () => {
    await executeJob('timeline', async () => {
      logInfo(LOG_MODULE, 'timeline', 'Would aggregate recovery data here');
    });
  });

  cron.schedule('0 2 * * *', async () => {
    await executeJob('segmentation', async () => {
      logInfo(LOG_MODULE, 'segmentation', 'Would update customer tiers here');
    });
  });

  cron.schedule('0 9 * * *', async () => {
    await executeJob('paymentPlans', async () => {
      logInfo(LOG_MODULE, 'paymentPlans', 'Would charge installments here');
    });
  });

  cron.schedule('0 5 * * *', async () => {
    await executeJob('trialExpiry', async () => {
      logInfo(LOG_MODULE, 'trialExpiry', 'Would check trial expiry here');
    });
  });

  cron.schedule('0 3 1 * *', async () => {
    await executeJob('billing', async () => {
      logInfo(LOG_MODULE, 'billing', 'Would generate invoices here');
    });
  });

  cron.schedule('0 2 * * 0', async () => {
    await executeJob('billingOptimization', async () => {
      logInfo(LOG_MODULE, 'billingOptimization', 'Would detect anomalies here');
    });
  });

  cron.schedule('0 * * * *', async () => {
    await executeJob('retries', async () => {
      logInfo(LOG_MODULE, 'retries', 'Would process retries here');
    });
  });

  logInfo(LOG_MODULE, 'initScheduler', '✅ Cron scheduler initialized (8 jobs, 0 polling)', {
    architecture: 'Event-driven + Cron-scheduled',
  });
}

/**
 * Stop scheduler
 */
export function stopScheduler() {
  const tasks = cron.getTasks();
  let count = 0;
  tasks.forEach((task) => {
    task.stop();
    count++;
  });
  logInfo(LOG_MODULE, 'stopScheduler', 'Scheduler stopped', { taskCount: count });
}
