import app from './app';
import { config } from './config/env';
import { testDbConnection } from './config/database';
import { connectRedis } from './config/redis';
import { runMigrations } from './lib/migrate';
import { startDunningWorker, stopDunningWorker } from './queue/dunningQueue';
import { startSMSWorker } from './queue/smsQueue';
import { startDailyDigestWorker, stopDailyDigestWorker } from './queue/dailyDigestJob';
import { startAgentLoop, stopAgentLoop } from './queue/agentLoop';
import { startRecoveryTimelineJob, stopRecoveryTimelineJob } from './queue/recoveryTimelineJob';
import { startPaymentPlanChargeJob, stopPaymentPlanChargeJob } from './queue/paymentPlanChargeJob';
import { startTrialExpiryJob, stopTrialExpiryJob } from './queue/trialExpiryJob';
import { snapshotRedisStats } from './queue/redisStatsJob';
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

    // Start workers in PRODUCTION or when explicitly testing in dev
    //
    // TESTING WITH REAL DATA IN DEV:
    //   DEV_TEST_WORKERS=true npm run dev
    //
    // Workers use BLPOP (blocking) not polling → only ~150 Redis requests per test
    // (vs 90,000+ if they were polling)
    const enableWorkers = config.nodeEnv === 'production' ||
                         process.env.DEV_TEST_WORKERS === 'true';

    if (enableWorkers) {
      logInfo('server', 'startServer', 'Starting background workers', {
        mode: config.nodeEnv === 'production' ? 'production' : 'dev-test',
        workers: 'dunning, agent-loop, payment-plans, recovery-timeline, daily-digest'
      });
      startDunningWorker();
      startSMSWorker();
      startDailyDigestWorker();
      startAgentLoop();
      startRecoveryTimelineJob();
      startPaymentPlanChargeJob();
      startTrialExpiryJob();
      // Redis stats snapshot: run once on boot + every 24h
      snapshotRedisStats().catch(() => {});
      setInterval(() => snapshotRedisStats().catch(() => {}), 24 * 60 * 60 * 1000);
    } else {
      logInfo('server', 'startServer', 'Background workers DISABLED (dev mode, no polling waste)');
      logInfo('server', 'startServer', 'To test with workers: DEV_TEST_WORKERS=true npm run dev');
    }

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
      await stopDunningWorker();
      await stopDailyDigestWorker();
      await stopAgentLoop();
      await stopRecoveryTimelineJob();
      await stopPaymentPlanChargeJob();
      stopTrialExpiryJob();
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
