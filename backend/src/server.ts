import app from './app';
import { config } from './config/env';
import { testDbConnection } from './config/database';
import { connectRedis } from './config/redis';
import { runMigrations } from './lib/migrate';
import { startDunningWorker, stopDunningWorker } from './queue/dunningQueue';
import { startDailyDigestWorker, stopDailyDigestWorker } from './queue/dailyDigestJob';
import { startAgentLoop, stopAgentLoop } from './queue/agentLoop';
import { startRecoveryTimelineJob, stopRecoveryTimelineJob } from './queue/recoveryTimelineJob';
import { startPaymentPlanChargeJob, stopPaymentPlanChargeJob } from './queue/paymentPlanChargeJob';
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

    startDunningWorker();
    startDailyDigestWorker();
    startAgentLoop();
    startRecoveryTimelineJob();
    startPaymentPlanChargeJob();

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
