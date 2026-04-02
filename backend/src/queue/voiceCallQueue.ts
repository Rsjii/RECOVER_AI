import { Queue, Worker } from 'bullmq';
import { config } from '../config/env';
import { isRedisConnected } from '../config/redis';
import { logInfo, logError } from '../utils/logger';
import { initiateVoiceCall, VoiceCallRequest } from '../services/twilioService';
import { pool } from '../config/database';

const MODULE = 'voiceCallQueue';
const WORKER_IDLE_TIMEOUT_MS = 60000; // Close worker if idle for 1 minute

let voiceCallWorker: any = null;
let voiceWorkerCleanupTimer: NodeJS.Timeout | null = null;

function scheduleVoiceWorkerCleanup(): void {
  if (voiceWorkerCleanupTimer) {
    clearTimeout(voiceWorkerCleanupTimer);
  }

  voiceWorkerCleanupTimer = setTimeout(async () => {
    if (voiceCallWorker) {
      try {
        await voiceCallWorker.close();
        voiceCallWorker = null;
        logInfo(MODULE, 'scheduleVoiceWorkerCleanup', 'Voice worker closed after idle timeout');
      } catch (err: any) {
        logError(MODULE, 'scheduleVoiceWorkerCleanup', 'Failed to close voice worker', err);
      }
    }
  }, WORKER_IDLE_TIMEOUT_MS);
}

// ============================================================
// Queue connection config
// ============================================================
function getRedisConnection() {
  const redisUrl = config.redisUrl;

  if (!redisUrl) {
    throw new Error('REDIS_URL not configured — cannot start voice call queue');
  }

  const url = new URL(redisUrl);

  return {
    host: url.hostname,
    port: parseInt(url.port || '6379'),
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
  };
}

// OPTIMIZATION: Lazy load queue instead of creating at module load time
// This prevents errors in dev mode without REDIS_URL
let voiceCallQueue: Queue | null = null;

export function getVoiceCallQueue(): Queue | null {
  if (!voiceCallQueue) {
    const redisUrl = config.redisUrl;
    if (!redisUrl) {
      logError(MODULE, 'getVoiceCallQueue', 'REDIS_URL not configured - queue disabled');
      return null;
    }

    if (!isRedisConnected()) {
      logError(MODULE, 'getVoiceCallQueue', 'Redis not connected - queue disabled');
      return null;
    }

    voiceCallQueue = new Queue('voice-calls', {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
      },
    });
  }

  return voiceCallQueue;
}

/**
 * Add a voice call to the queue
 */
export async function queueVoiceCall(req: VoiceCallRequest): Promise<string> {
  try {
    const queue = getVoiceCallQueue();
    if (!queue) {
      logError(MODULE, 'queueVoiceCall', 'Queue unavailable - skipping voice call', { invoiceId: req.invoiceId });
      return 'queue-unavailable';
    }

    // Lazy-start worker on first job
    if (!voiceCallWorker) {
      await startVoiceCallWorker();
    }

    const job = await queue.add('initiate-call', req, {
      jobId: `voice-${req.invoiceId}`,
      delay: 0, // Immediate
    });

    logInfo(MODULE, 'queueVoiceCall', 'Voice call queued', {
      jobId: job.id,
      invoiceId: req.invoiceId,
    });

    return job.id!;
  } catch (error) {
    logError(MODULE, 'queueVoiceCall', 'Failed to queue voice call', {
      error: String(error),
      invoiceId: req.invoiceId,
    });
    throw error;
  }
}

/**
 * Start the voice call worker (lazy-init)
 */
export async function startVoiceCallWorker(): Promise<void> {
  // Already running
  if (voiceCallWorker) {
    if (voiceWorkerCleanupTimer) {
      clearTimeout(voiceWorkerCleanupTimer);
      voiceWorkerCleanupTimer = null;
    }
    return;
  }

  // OPTIMIZATION: Check if Redis is available before starting worker
  if (!isRedisConnected()) {
    logError(MODULE, 'startVoiceCallWorker', 'Redis not connected - worker disabled');
    return;
  }

  logInfo(MODULE, 'startVoiceCallWorker', 'Starting voice call worker (lazy-init)');

  voiceCallWorker = new Worker(
    'voice-calls',
    async (job) => {
      const req: VoiceCallRequest = job.data;

      logInfo(MODULE, 'Worker', 'Processing voice call job', {
        jobId: job.id,
        invoiceId: req.invoiceId,
      });

      try {
        // Fetch invoice details for TwiML generation
        const invoiceResult = await pool.query(
          `SELECT invoice_number, amount FROM invoices WHERE id = $1`,
          [req.invoiceId]
        );

        if (invoiceResult.rows.length === 0) {
          logError(MODULE, 'Worker', 'Invoice not found', { invoiceId: req.invoiceId });
          return { status: 'failed', reason: 'Invoice not found' };
        }

        const invoice = invoiceResult.rows[0];

        // Initiate call via Twilio
        const result = await initiateVoiceCall({
          ...req,
          amount: invoice.amount,
          invoiceNumber: invoice.invoice_number,
        });

        if (result.status === 'failed') {
          logError(MODULE, 'Worker', 'Failed to initiate voice call', {
            error: result.error,
            invoiceId: req.invoiceId,
          });
          throw new Error(result.error || 'Twilio call failed');
        }

        logInfo(MODULE, 'Worker', 'Voice call initiated successfully', {
          jobId: job.id,
          callId: result.call_id,
          invoiceId: req.invoiceId,
        });

        return {
          status: 'success',
          callId: result.call_id,
        };
      } catch (error) {
        logError(MODULE, 'Worker', 'Voice call job failed', {
          error: String(error),
          invoiceId: req.invoiceId,
          jobId: job.id,
        });
        throw error;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 5, // Max 5 concurrent calls
    }
  );

  // Event listeners
  voiceCallWorker.on('completed', async (job: any) => {
    logInfo(MODULE, 'Worker', 'Voice call job completed', {
      jobId: job.id,
      invoiceId: job.data.invoiceId,
    });
    scheduleVoiceWorkerCleanup();
  });

  voiceCallWorker.on('failed', async (job: any, error: any) => {
    logError(MODULE, 'Worker', 'Voice call job failed permanently', {
      jobId: job?.id,
      error: error.message,
      invoiceId: job?.data?.invoiceId,
    });
    scheduleVoiceWorkerCleanup();
  });

  logInfo(MODULE, 'startVoiceCallWorker', 'Voice call worker started (lazy)', {
    concurrency: 5,
    idleTimeout: `${WORKER_IDLE_TIMEOUT_MS / 1000}s`,
  });
}

/**
 * Clean old voice calls from queue
 */
export async function cleanOldVoiceCalls(ageMinutes: number = 1440): Promise<void> {
  try {
    const queue = getVoiceCallQueue();
    if (!queue) {
      logError(MODULE, 'cleanOldVoiceCalls', 'Queue unavailable - skipping cleanup');
      return;
    }

    const before = Date.now() - ageMinutes * 60 * 1000;
    await queue.clean(before, 100, 'completed');
    await queue.clean(before, 100, 'failed');

    logInfo(MODULE, 'cleanOldVoiceCalls', 'Cleaned old voice call jobs', {
      ageMinutes,
    });
  } catch (error) {
    logError(MODULE, 'cleanOldVoiceCalls', 'Failed to clean old jobs', {
      error: String(error),
    });
  }
}
