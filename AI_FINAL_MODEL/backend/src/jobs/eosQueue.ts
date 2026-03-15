import { Queue, Worker } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../config/logger';

// ── EngineeringOS Phase 1 Queues ─────────────────────────────────────────────

// One-time 180-day historical index (GitHub + Jira) — triggered on onboarding complete
export const historicalIndexQueue = new Queue('eos-historical-index', {
  connection: redis,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 30000 } },
});

// Incremental Jira sync — triggered by Jira webhooks
export const jiraSyncQueue = new Queue('eos-jira-sync', {
  connection: redis,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
});

// Nightly pattern detection — cron at 23:00
export const patternDetectionQueue = new Queue('eos-pattern-detection', {
  connection: redis,
  defaultJobOptions: { attempts: 2, backoff: { type: 'exponential', delay: 10000 } },
});

// Morning brief delivery — cron per org delivery_time
export const briefDeliveryQueue = new Queue('eos-brief-delivery', {
  connection: redis,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 10000 } },
});

// ── EngineeringOS Phase 1.5 Queues ───────────────────────────────────────────

// Friday weekly engineering health report — checks every 15min on Fridays
export const weeklyReportQueue = new Queue('eos-weekly-report', {
  connection: redis,
  defaultJobOptions: { attempts: 2, backoff: { type: 'exponential', delay: 30000 } },
});

export async function startEosWorkers() {
  const { processHistoricalIndexJob }  = await import('./historicalIndexJob');
  const { processJiraSyncJob }         = await import('./jiraSyncJob');
  const { processPatternDetectionJob } = await import('./patternDetectionJob');
  const { processBriefDeliveryJob }    = await import('./briefDeliveryJob');
  const { processWeeklyReportJob }     = await import('./weeklyReportJob');

  const ignorableErrCodes = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNABORTED']);
  const suppressConnErr = (err: any) => {
    if (!ignorableErrCodes.has(err?.code)) logger.error({ err }, '[EOS Queue] Connection error');
  };

  const historicalWorker = new Worker('eos-historical-index', processHistoricalIndexJob, {
    connection: redis, concurrency: 1,
  });
  historicalWorker.on('completed', job => logger.info(`[EOS] Historical index job ${job.id} completed`));
  historicalWorker.on('failed', (job, err) => logger.error({ err }, `[EOS] Historical index job ${job?.id} failed`));
  historicalWorker.on('error', suppressConnErr);

  const jiraSyncWorker = new Worker('eos-jira-sync', processJiraSyncJob, {
    connection: redis, concurrency: 3,
  });
  jiraSyncWorker.on('completed', job => logger.info(`[EOS] Jira sync job ${job.id} completed`));
  jiraSyncWorker.on('failed', (job, err) => logger.error({ err }, `[EOS] Jira sync ${job?.id} failed`));
  jiraSyncWorker.on('error', suppressConnErr);

  const patternWorker = new Worker('eos-pattern-detection', processPatternDetectionJob, {
    connection: redis, concurrency: 2,
  });
  patternWorker.on('completed', job => logger.info(`[EOS] Pattern detection ${job.id} done`));
  patternWorker.on('failed', (job, err) => logger.error({ err }, `[EOS] Pattern detection ${job?.id} failed`));
  patternWorker.on('error', suppressConnErr);

  const briefWorker = new Worker('eos-brief-delivery', processBriefDeliveryJob, {
    connection: redis, concurrency: 3,
  });
  briefWorker.on('completed', job => logger.info(`[EOS] Brief delivery ${job.id} done`));
  briefWorker.on('failed', (job, err) => logger.error({ err }, `[EOS] Brief delivery ${job?.id} failed`));
  briefWorker.on('error', suppressConnErr);

  const weeklyWorker = new Worker('eos-weekly-report', processWeeklyReportJob, {
    connection: redis, concurrency: 1,
  });
  weeklyWorker.on('completed', job => logger.info(`[EOS] Weekly report ${job.id} done`));
  weeklyWorker.on('failed', (job, err) => logger.error({ err }, `[EOS] Weekly report ${job?.id} failed`));
  weeklyWorker.on('error', suppressConnErr);

  // Setup repeating cron jobs — wrapped in timeout so Redis unavailability doesn't hang startup
  const withTimeout = <T>(p: Promise<T>, ms: number, label: string): Promise<T | void> =>
    Promise.race([
      p,
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} scheduler setup timed out after ${ms}ms`)), ms)
      ),
    ]).catch(err => logger.warn(`[EOS] ${err.message} — scheduler will register when Redis reconnects`));

  await withTimeout(
    patternDetectionQueue.upsertJobScheduler(
      'nightly-pattern-detection',
      { pattern: '0 23 * * *' },
      { name: 'run-all-orgs', data: { allOrgs: true } }
    ), 5000, 'Pattern detection'
  );

  await withTimeout(
    briefDeliveryQueue.upsertJobScheduler(
      'morning-brief-check',
      { every: 15 * 60 * 1000 },
      { name: 'check-delivery', data: { allOrgs: true } }
    ), 5000, 'Brief delivery'
  );

  // Weekly report: check every 15min — job itself skips non-Friday runs
  await withTimeout(
    weeklyReportQueue.upsertJobScheduler(
      'weekly-report-check',
      { every: 15 * 60 * 1000 },
      { name: 'check-weekly', data: { allOrgs: true } }
    ), 5000, 'Weekly report'
  );

  historicalIndexQueue.on('error', suppressConnErr);
  jiraSyncQueue.on('error', suppressConnErr);
  patternDetectionQueue.on('error', suppressConnErr);
  briefDeliveryQueue.on('error', suppressConnErr);
  weeklyReportQueue.on('error', suppressConnErr);

  logger.info('[EOS] Workers started');
}
