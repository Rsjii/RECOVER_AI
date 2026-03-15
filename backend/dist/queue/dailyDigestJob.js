"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDailyDigestWorker = startDailyDigestWorker;
exports.stopDailyDigestWorker = stopDailyDigestWorker;
const bullmq_1 = require("bullmq");
const dunningQueue_1 = require("./dunningQueue");
const slackService_1 = require("../services/slackService");
const dashboard_1 = require("../db/dashboard");
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const DIGEST_QUEUE = 'daily-digest';
let digestQueue = null;
let digestWorker = null;
function getDigestQueue() {
    if (!digestQueue) {
        digestQueue = new bullmq_1.Queue(DIGEST_QUEUE, { connection: (0, dunningQueue_1.getRedisConnection)() });
        digestQueue.on('error', (err) => {
            (0, logger_1.logError)('dailyDigestJob', 'queue', 'Digest queue connection issue', err);
        });
    }
    return digestQueue;
}
async function countEmailsSentToday(companyId) {
    const result = await database_1.pool.query(`SELECT COUNT(*) FROM email_logs
     WHERE company_id = $1
       AND sent_at >= NOW() - INTERVAL '24 hours'`, [companyId]);
    return parseInt(result.rows[0].count);
}
async function getAllCompanyIds() {
    const result = await database_1.pool.query(`SELECT DISTINCT company_id FROM invoices WHERE status != 'paid'`);
    return result.rows.map((r) => r.company_id);
}
function startDailyDigestWorker() {
    try {
        const connection = (0, dunningQueue_1.getRedisConnection)();
        digestWorker = new bullmq_1.Worker(DIGEST_QUEUE, async (job) => {
            const method = 'dailyDigestWorker';
            (0, logger_1.logInfo)('dailyDigestJob', method, 'Processing daily digest job');
            const companyIds = await getAllCompanyIds();
            for (const companyId of companyIds) {
                try {
                    const stats = await (0, dashboard_1.getRecoveryStats)(companyId);
                    const emailsSentToday = await countEmailsSentToday(companyId);
                    // Get Slack webhook from company settings
                    const { pool: db } = await Promise.resolve().then(() => __importStar(require('../config/database')));
                    const companyResult = await db.query('SELECT slack_webhook_url_encrypted FROM companies WHERE id = $1', [companyId]);
                    const company = companyResult.rows[0];
                    let webhookUrl;
                    if (company?.slack_webhook_url_encrypted) {
                        const { decryptField } = await Promise.resolve().then(() => __importStar(require('../lib/encryption')));
                        webhookUrl = decryptField(company.slack_webhook_url_encrypted);
                    }
                    await (0, slackService_1.sendDailyDigest)({
                        totalOwed: stats.totalOwed,
                        totalRecovered: stats.totalRecovered,
                        recoveryRate: stats.recoveryRate,
                        overdueCount: stats.overdueCount,
                        emailsSentToday,
                        webhookUrl,
                    });
                    (0, logger_1.logInfo)('dailyDigestJob', method, 'Digest sent', { companyId });
                }
                catch (err) {
                    (0, logger_1.logError)('dailyDigestJob', method, 'Failed to send digest for company', err, { companyId });
                }
            }
        }, { connection });
        digestWorker.on('failed', (job, err) => {
            (0, logger_1.logError)('dailyDigestJob', 'worker', 'Job failed', err, { jobId: job?.id });
        });
        digestWorker.on('error', (err) => {
            (0, logger_1.logError)('dailyDigestJob', 'worker', 'Worker connection issue', err);
        });
        // Schedule daily at 8:00 AM UTC
        scheduleDaily();
        (0, logger_1.logInfo)('dailyDigestJob', 'startDailyDigestWorker', 'Daily digest worker started');
    }
    catch (err) {
        (0, logger_1.logError)('dailyDigestJob', 'startDailyDigestWorker', 'Failed to start digest worker', err);
    }
}
async function scheduleDaily() {
    try {
        const queue = getDigestQueue();
        // Remove existing repeatable job first to avoid duplicates
        await queue.removeRepeatable('daily-digest', { pattern: '0 8 * * *' });
        await queue.add('daily-digest', {}, {
            repeat: { pattern: '0 8 * * *' }, // 8 AM UTC daily
            jobId: 'daily-digest-cron',
        });
        (0, logger_1.logInfo)('dailyDigestJob', 'scheduleDaily', 'Daily digest cron scheduled (8:00 AM UTC)');
    }
    catch (err) {
        (0, logger_1.logError)('dailyDigestJob', 'scheduleDaily', 'Failed to schedule digest cron', err);
    }
}
async function stopDailyDigestWorker() {
    try {
        await digestWorker?.close();
        await digestQueue?.close();
        (0, logger_1.logInfo)('dailyDigestJob', 'stop', 'Daily digest worker stopped');
    }
    catch (err) {
        (0, logger_1.logError)('dailyDigestJob', 'stop', 'Error stopping digest worker', err);
    }
}
