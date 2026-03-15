"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const database_1 = require("./config/database");
const redis_1 = require("./config/redis");
const migrate_1 = require("./lib/migrate");
const dunningQueue_1 = require("./queue/dunningQueue");
const dailyDigestJob_1 = require("./queue/dailyDigestJob");
const agentLoop_1 = require("./queue/agentLoop");
const recoveryTimelineJob_1 = require("./queue/recoveryTimelineJob");
const paymentPlanChargeJob_1 = require("./queue/paymentPlanChargeJob");
const logger_1 = require("./utils/logger");
const observability_1 = require("./config/observability");
(0, logger_1.logInfo)('server', 'bootstrap', 'App imported');
const PORT = env_1.config.port;
async function startServer() {
    (0, logger_1.logInfo)('server', 'startServer', 'RecoverAI backend starting');
    try {
        await (0, observability_1.initObservability)();
        await (0, database_1.testDbConnection)();
        await (0, migrate_1.runMigrations)();
        await (0, redis_1.connectRedis)();
        (0, dunningQueue_1.startDunningWorker)();
        (0, dailyDigestJob_1.startDailyDigestWorker)();
        (0, agentLoop_1.startAgentLoop)();
        (0, recoveryTimelineJob_1.startRecoveryTimelineJob)();
        (0, paymentPlanChargeJob_1.startPaymentPlanChargeJob)();
        const server = app_1.default.listen(PORT, () => {
            (0, logger_1.logInfo)('server', 'listen', 'Server ready', {
                port: PORT,
                env: env_1.config.nodeEnv,
                health: `http://localhost:${PORT}/health`,
                agent: 'Autonomous agent loop running (every 6h)',
                timeline: 'Recovery timeline aggregation running (daily 01:00 UTC)',
                paymentPlans: 'Payment plan auto-charge running (daily 09:00 UTC)',
            });
        });
        const shutdown = async (signal) => {
            (0, logger_1.logInfo)('server', 'shutdown', 'Shutdown signal received', { signal });
            await (0, dunningQueue_1.stopDunningWorker)();
            await (0, dailyDigestJob_1.stopDailyDigestWorker)();
            await (0, agentLoop_1.stopAgentLoop)();
            await (0, recoveryTimelineJob_1.stopRecoveryTimelineJob)();
            await (0, paymentPlanChargeJob_1.stopPaymentPlanChargeJob)();
            server.close(() => {
                (0, logger_1.logInfo)('server', 'shutdown', 'Server closed');
                process.exit(0);
            });
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
    catch (err) {
        (0, logger_1.logError)('server', 'startServer', 'Server failed to start', err);
        process.exit(1);
    }
}
startServer();
