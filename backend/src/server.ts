import app from './app';
import { config } from './config/env';
import { testDbConnection } from './config/database';
import { connectRedis, isRedisConnected } from './config/redis';
import { runMigrations } from './lib/migrate';
import { initScheduler, stopScheduler } from './jobs/scheduler';
import { registerEventListeners } from './jobs/eventListeners';
import { logError, logInfo } from './utils/logger';
import { initObservability } from './config/observability';

logInfo('server', 'bootstrap', 'App imported');

const PORT = config.port;

async function startServer() {
  logInfo('server', 'startServer', 'RecoverAI backend starting');

  // Check if running as worker-only process
  const isWorkerOnly = process.argv.includes('--worker-only');

  try {
    logInfo('server', 'startServer', 'Step 1: Initializing observability...');
    await initObservability();
    logInfo('server', 'startServer', 'Step 1 OK: Observability initialized');

    logInfo('server', 'startServer', 'Step 2: Testing DB connection...');
    await testDbConnection();
    logInfo('server', 'startServer', 'Step 2 OK: DB connection successful');

    logInfo('server', 'startServer', 'Step 3: Running migrations...');
    await runMigrations();
    logInfo('server', 'startServer', 'Step 3 OK: Migrations complete');

    logInfo('server', 'startServer', 'Step 4: Connecting to Redis...');
    await connectRedis();
    logInfo(
      'server',
      'startServer',
      isRedisConnected()
        ? 'Step 4 OK: Redis connected'
        : 'Step 4: Redis unavailable - continuing without cache/OTP/queues (demo mode)'
    );

    // ============================================================
    // ARCHITECTURE: Cron Scheduler + Event-Driven (Best Practice)
    // ============================================================
    // Why: No Redis polling waste, exact job timing, instant event triggers
    // Jobs run on schedule (cron), actions trigger immediately (events)
    // Reference: Netflix, Uber, Stripe use this pattern
    // ============================================================

    // 1. Initialize cron scheduler (8 scheduled jobs) - only on API pod
    if (!isWorkerOnly) {
      initScheduler();
    }

    // 2. Register event listeners (instant triggers) - only on API pod
    if (!isWorkerOnly) {
      registerEventListeners();
    }

    // 3. Dunning email worker is lazy-initialized on first email queue
    // Never started at startup to prevent BZPOPMIN polling when idle
    logInfo('server', 'startServer', 'Dunning worker ready (lazy-init on first email)', { concurrency: 1, polling: 'zero idle' });

    // 4. CSV import worker is lazy-initialized on first upload
    // Never imported at startup to prevent BZPOPMIN polling
    logInfo('server', 'startServer', 'CSV import worker ready (lazy-init on upload)', { concurrency: 1, polling: 'zero idle' });

    logInfo('server', 'startServer', 'Background system ready', {
      architecture: 'Cron + Event-Driven + BullMQ Workers',
      scheduledJobs: isWorkerOnly ? 0 : 8,
      eventListeners: isWorkerOnly ? 0 : 5,
      workers: 1,
      redisUsage: '0 polling commands (event-based only)',
      mode: config.nodeEnv,
      processType: isWorkerOnly ? 'worker-only' : 'api-server',
    });

    // Only start HTTP server if not worker-only
    if (!isWorkerOnly) {
      const server = app.listen(PORT, () => {
        logInfo('server', 'listen', 'Server ready', {
          port: PORT,
          env: config.nodeEnv,
          health: `http://localhost:${PORT}/health`,
          agent: 'Autonomous agent loop running (every 6h)',
          timeline: 'Recovery timeline aggregation running (daily 01:00 UTC)',
          paymentPlans: 'Payment plan auto-charge running (daily 09:00 UTC)',
        });
      });

      const shutdown = async (signal: string) => {
        logInfo('server', 'shutdown', 'Shutdown signal received', { signal });
        stopScheduler(); // Stop all cron jobs
        server.close(() => {
          logInfo('server', 'shutdown', 'Server closed');
          process.exit(0);
        });
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    } else {
      logInfo('server', 'startServer', 'Worker-only mode: listening for BullMQ jobs', {
        workers: 1,
        queueName: 'csv-import',
      });

      // Worker mode: keep process alive for job processing
      const shutdown = (signal: string) => {
        logInfo('server', 'shutdown', 'Worker shutdown signal received', { signal });
        process.exit(0);
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    }

  } catch (err: any) {
    logError('server', 'startServer', 'Server failed to start', err);
    process.exit(1);
  }
}

startServer();
