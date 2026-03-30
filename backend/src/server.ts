import app from './app';
import { config } from './config/env';
import { testDbConnection } from './config/database';
import { connectRedis } from './config/redis';
import { runMigrations } from './lib/migrate';
import { initScheduler, stopScheduler } from './jobs/scheduler';
import { registerEventListeners } from './jobs/eventListeners';
import { logError, logInfo } from './utils/logger';
import { initObservability } from './config/observability';

logInfo('server', 'bootstrap', 'App imported');

const PORT = config.port;

async function startServer() {
  logInfo('server', 'startServer', 'RecoverAI backend starting');

  try {
    await initObservability();
    await testDbConnection();
    await runMigrations();
    await connectRedis();

    // ============================================================
    // ARCHITECTURE: Cron Scheduler + Event-Driven (Best Practice)
    // ============================================================
    // Why: No Redis polling waste, exact job timing, instant event triggers
    // Jobs run on schedule (cron), actions trigger immediately (events)
    // Reference: Netflix, Uber, Stripe use this pattern
    // ============================================================

    // 1. Initialize cron scheduler (8 scheduled jobs)
    initScheduler();

    // 2. Register event listeners (instant triggers for immediate actions)
    registerEventListeners();

    logInfo('server', 'startServer', 'Background system ready', {
      architecture: 'Cron + Event-Driven',
      scheduledJobs: 8,
      eventListeners: 5,
      redisUsage: '0 polling commands (event-based only)',
      mode: config.nodeEnv,
    });

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

  } catch (err: any) {
    logError('server', 'startServer', 'Server failed to start', err);
    process.exit(1);
  }
}

startServer();
