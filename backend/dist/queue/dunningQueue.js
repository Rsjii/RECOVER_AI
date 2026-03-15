"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisConnection = getRedisConnection;
exports.getDunningQueue = getDunningQueue;
exports.scheduleDunningEmails = scheduleDunningEmails;
exports.queueEmailNow = queueEmailNow;
exports.startDunningWorker = startDunningWorker;
exports.stopDunningWorker = stopDunningWorker;
const bullmq_1 = require("bullmq");
const env_1 = require("../config/env");
const emailService_1 = __importDefault(require("../services/emailService"));
const emailLogs_1 = require("../db/emailLogs");
const logger_1 = require("../utils/logger");
const invoices_1 = require("../db/invoices");
const LOG_MODULE = 'dunningQueue';
const QUEUE_NAME = 'dunning-emails';
// ============================================================
// Queue connection config (Upstash Redis)
// ============================================================
function getRedisConnection() {
    const redisUrl = env_1.config.redisUrl;
    if (!redisUrl) {
        throw new Error('REDIS_URL not configured — cannot start dunning queue');
    }
    // Parse rediss:// or redis:// URL
    const url = new URL(redisUrl);
    return {
        host: url.hostname,
        port: parseInt(url.port || '6379'),
        password: url.password || undefined,
        tls: url.protocol === 'rediss:' ? {} : undefined,
        maxRetriesPerRequest: null, // Required by BullMQ
    };
}
// ============================================================
// Queue (producer side — add jobs here)
// ============================================================
let dunningQueue = null;
function getDunningQueue() {
    if (!dunningQueue) {
        dunningQueue = new bullmq_1.Queue(QUEUE_NAME, {
            connection: getRedisConnection(),
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000, // 5s, 25s, 125s
                },
                removeOnComplete: { count: 100 },
                removeOnFail: { count: 200 },
            },
        });
        dunningQueue.on('error', (err) => {
            (0, logger_1.logWarn)(LOG_MODULE, 'queue', 'Redis queue connection issue', { error: err.message });
        });
        (0, logger_1.logInfo)(LOG_MODULE, 'getDunningQueue', 'Queue initialized', { queueName: QUEUE_NAME });
    }
    return dunningQueue;
}
// ============================================================
// Schedule dunning emails for an invoice
// ============================================================
// Default dunning schedule (days after due date)
const DUNNING_SCHEDULE = [
    { dayOffset: 1, emailType: 'dunning_1' },
    { dayOffset: 7, emailType: 'dunning_2' },
    { dayOffset: 14, emailType: 'dunning_3' },
    { dayOffset: 30, emailType: 'dunning_4' },
    { dayOffset: 60, emailType: 'dunning_5' },
];
async function scheduleDunningEmails(invoiceId, companyId) {
    const method = 'scheduleDunningEmails';
    (0, logger_1.logInfo)(LOG_MODULE, method, 'Scheduling dunning emails', { invoiceId, companyId });
    const invoice = await (0, invoices_1.findInvoiceById)(invoiceId, companyId);
    if (!invoice) {
        (0, logger_1.logWarn)(LOG_MODULE, method, 'Invoice not found — skipping schedule', { invoiceId });
        return 0;
    }
    if (invoice.status === 'paid') {
        (0, logger_1.logInfo)(LOG_MODULE, method, 'Invoice already paid — skipping schedule', { invoiceId });
        return 0;
    }
    const queue = getDunningQueue();
    const now = Date.now();
    const dueDate = new Date(invoice.due_date).getTime();
    let scheduled = 0;
    for (const step of DUNNING_SCHEDULE) {
        const sendAt = dueDate + step.dayOffset * 24 * 60 * 60 * 1000;
        const delay = Math.max(0, sendAt - now);
        const job = {
            companyId,
            customerId: invoice.customer_id,
            invoiceId,
            recipientEmail: invoice.customer_email || '',
            customerName: invoice.customer_name || 'Valued Customer',
            invoiceAmount: Number(invoice.amount),
            dueDate: invoice.due_date,
            daysOverdue: Math.max(0, Math.floor((now - dueDate) / (24 * 60 * 60 * 1000))),
            emailType: step.emailType,
            attemptNumber: scheduled + 1,
        };
        // Skip if no recipient email
        if (!job.recipientEmail) {
            (0, logger_1.logWarn)(LOG_MODULE, method, 'Skipping email — no recipient email', {
                invoiceId,
                emailType: step.emailType,
            });
            continue;
        }
        await queue.add(step.emailType, job, {
            delay,
            jobId: `${invoiceId}-${step.emailType}`, // Deduplication (no colons in BullMQ job IDs)
        });
        (0, logger_1.logInfo)(LOG_MODULE, method, `Scheduled ${step.emailType}`, {
            invoiceId,
            sendAtISO: new Date(sendAt).toISOString(),
            delayMs: delay,
        });
        scheduled++;
    }
    (0, logger_1.logInfo)(LOG_MODULE, method, `Scheduled ${scheduled} emails for invoice`, { invoiceId });
    return scheduled;
}
// ============================================================
// Add a single email job immediately (manual trigger)
// ============================================================
async function queueEmailNow(job) {
    const queue = getDunningQueue();
    const bullJob = await queue.add(job.emailType, job, {
        delay: 0,
        jobId: `${job.invoiceId}-${job.emailType}-${Date.now()}`,
    });
    (0, logger_1.logInfo)(LOG_MODULE, 'queueEmailNow', 'Email queued immediately', {
        jobId: bullJob.id,
        invoiceId: job.invoiceId,
        emailType: job.emailType,
    });
    return bullJob.id;
}
// ============================================================
// Worker (consumer side — processes jobs)
// ============================================================
let dunningWorker = null;
function startDunningWorker() {
    if (dunningWorker)
        return dunningWorker;
    (0, logger_1.logInfo)(LOG_MODULE, 'startDunningWorker', 'Starting dunning email worker');
    dunningWorker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { data } = job;
        (0, logger_1.logInfo)(LOG_MODULE, 'worker', 'Processing dunning email job', {
            jobId: job.id,
            invoiceId: data.invoiceId,
            emailType: data.emailType,
            attempt: job.attemptsMade + 1,
        });
        // Check if invoice is still unpaid before sending
        const invoice = await (0, invoices_1.findInvoiceById)(data.invoiceId, data.companyId);
        if (!invoice || invoice.status === 'paid') {
            (0, logger_1.logInfo)(LOG_MODULE, 'worker', 'Invoice paid or missing — discarding job', {
                jobId: job.id,
                invoiceId: data.invoiceId,
            });
            return { skipped: true, reason: 'Invoice already paid' };
        }
        // Check how many emails already sent for this invoice
        const emailsSent = await (0, emailLogs_1.countEmailsSentForInvoice)(data.invoiceId);
        if (emailsSent >= 5) {
            (0, logger_1.logWarn)(LOG_MODULE, 'worker', 'Max emails reached — discarding job', {
                jobId: job.id,
                invoiceId: data.invoiceId,
                emailsSent,
            });
            return { skipped: true, reason: 'Max emails reached' };
        }
        // Update daysOverdue at send time (not at schedule time)
        const dueDate = new Date(data.dueDate).getTime();
        const daysOverdue = Math.max(0, Math.floor((Date.now() - dueDate) / (24 * 60 * 60 * 1000)));
        const result = await emailService_1.default.sendDunningEmail({
            ...data,
            daysOverdue,
            attemptNumber: emailsSent + 1,
        });
        if (!result.success) {
            throw new Error(result.error || 'Email send failed');
        }
        (0, logger_1.logInfo)(LOG_MODULE, 'worker', 'Dunning email sent successfully', {
            jobId: job.id,
            invoiceId: data.invoiceId,
            emailLogId: result.emailLogId,
            sendgridMessageId: result.sendgridMessageId,
        });
        return {
            success: true,
            emailLogId: result.emailLogId,
            sendgridMessageId: result.sendgridMessageId,
        };
    }, {
        connection: getRedisConnection(),
        concurrency: 5,
    });
    dunningWorker.on('completed', (job, result) => {
        (0, logger_1.logInfo)(LOG_MODULE, 'worker', 'Job completed', {
            jobId: job.id,
            invoiceId: job.data.invoiceId,
            result,
        });
    });
    dunningWorker.on('failed', (job, err) => {
        (0, logger_1.logError)(LOG_MODULE, 'worker', 'Job failed', err, {
            jobId: job?.id,
            invoiceId: job?.data.invoiceId,
            attempt: job?.attemptsMade,
        });
    });
    dunningWorker.on('stalled', (jobId) => {
        (0, logger_1.logWarn)(LOG_MODULE, 'worker', 'Job stalled', { jobId });
    });
    dunningWorker.on('error', (err) => {
        (0, logger_1.logWarn)(LOG_MODULE, 'worker', 'Worker connection issue', { error: err.message });
    });
    (0, logger_1.logInfo)(LOG_MODULE, 'startDunningWorker', 'Worker started', { concurrency: 5 });
    return dunningWorker;
}
async function stopDunningWorker() {
    if (dunningWorker) {
        await dunningWorker.close();
        dunningWorker = null;
        (0, logger_1.logInfo)(LOG_MODULE, 'stopDunningWorker', 'Worker stopped');
    }
}
