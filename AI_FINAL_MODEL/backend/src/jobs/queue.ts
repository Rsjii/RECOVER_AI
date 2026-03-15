import { Queue, Worker } from 'bullmq';
import { redis } from '../config/redis';
import { logger } from '../config/logger';

export const indexingQueue = new Queue('indexing', {
  connection: redis,
  defaultJobOptions: { attempts: 2, backoff: { type: 'exponential', delay: 10000 } },
});

export const analysisQueue = new Queue('analysis', {
  connection: redis,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
});

// Partial re-index queue: triggered on every PR merge, processes only changed files
export const reindexQueue = new Queue('reindex', {
  connection: redis,
  defaultJobOptions: { attempts: 2, backoff: { type: 'exponential', delay: 5000 } },
});

export async function startWorkers() {
  const { processIndexingJob, processPartialReindexJob } = await import('./indexingJob');
  const { processAnalysisJob } = await import('./analysisJob');

  const indexingWorker = new Worker('indexing', processIndexingJob, {
    connection: redis,
    concurrency: 2,
  });

  const analysisWorker = new Worker('analysis', processAnalysisJob, {
    connection: redis,
    concurrency: 5,
  });

  // Low concurrency for reindex — GitHub API content fetches per file
  const reindexWorker = new Worker('reindex', processPartialReindexJob, {
    connection: redis,
    concurrency: 2,
  });

  const ignorableErrCodes = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNABORTED']);
  const suppressConnErr = (err: any) => {
    if (!ignorableErrCodes.has(err?.code)) logger.error({ err }, '[Queue] Connection error');
  };

  indexingWorker.on('completed', job => logger.info(`[Indexing] Job ${job.id} completed`));
  indexingWorker.on('failed', (job, err) => logger.error({ err }, `[Indexing] Job ${job?.id} failed`));
  indexingWorker.on('error', suppressConnErr);

  analysisWorker.on('completed', job => logger.info(`[Analysis] Job ${job.id} completed`));
  analysisWorker.on('failed', (job, err) => logger.error({ err }, `[Analysis] Job ${job?.id} failed`));
  analysisWorker.on('error', suppressConnErr);

  reindexWorker.on('completed', job => logger.info(`[Reindex] Job ${job.id} completed`));
  reindexWorker.on('failed', (job, err) => logger.error({ err }, `[Reindex] Job ${job?.id} failed`));
  reindexWorker.on('error', suppressConnErr);

  indexingQueue.on('error', suppressConnErr);
  analysisQueue.on('error', suppressConnErr);
  reindexQueue.on('error', suppressConnErr);
}
