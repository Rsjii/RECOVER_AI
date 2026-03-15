"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startRecoveryTimelineJob = startRecoveryTimelineJob;
exports.stopRecoveryTimelineJob = stopRecoveryTimelineJob;
const bullmq_1 = require("bullmq");
const dunningQueue_1 = require("./dunningQueue");
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const TIMELINE_QUEUE = 'recovery-timeline';
const LOG_MODULE = 'recoveryTimelineJob';
let timelineQueue = null;
let timelineWorker = null;
function getTimelineQueue() {
    if (!timelineQueue) {
        timelineQueue = new bullmq_1.Queue(TIMELINE_QUEUE, { connection: (0, dunningQueue_1.getRedisConnection)() });
        timelineQueue.on('error', (err) => {
            (0, logger_1.logError)(LOG_MODULE, 'queue', 'Timeline queue connection issue', err);
        });
    }
    return timelineQueue;
}
async function getAllActiveCompanyIds() {
    const result = await database_1.pool.query(`
    SELECT DISTINCT id FROM companies
    WHERE id IN (
      SELECT DISTINCT company_id FROM invoices
    )
  `);
    return result.rows.map((r) => r.id);
}
/**
 * Aggregate daily stats for a company on a specific date and UPSERT into recovery_timeline.
 */
async function aggregateAndUpsertDay(companyId, date) {
    const periodDate = date.toISOString().slice(0, 10); // YYYY-MM-DD
    const dayStart = `${periodDate}T00:00:00.000Z`;
    const dayEnd = `${periodDate}T23:59:59.999Z`;
    // Aggregate invoices created on this day
    const invoiceStats = await database_1.pool.query(`
    SELECT
      COUNT(*)::int                                                         AS invoices_created,
      COALESCE(SUM(amount), 0)::float                                       AS amount_created,
      COUNT(*) FILTER (WHERE status = 'paid')::int                          AS invoices_recovered,
      COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0)::float        AS amount_recovered
    FROM invoices
    WHERE company_id = $1
      AND issued_date BETWEEN $2 AND $3
  `, [companyId, dayStart, dayEnd]);
    // Aggregate payments received on this day (for "recovered" by payment date)
    const paymentStats = await database_1.pool.query(`
    SELECT
      COUNT(*)::int                       AS payments_count,
      COALESCE(SUM(p.amount), 0)::float   AS payments_amount,
      COALESCE(
        AVG(
          EXTRACT(EPOCH FROM (p.paid_at - i.issued_date)) / 86400.0
        ), 0
      )::float                            AS avg_days_to_collect
    FROM payments p
    JOIN invoices i ON p.invoice_id = i.id
    WHERE p.company_id = $1
      AND p.paid_at BETWEEN $2 AND $3
      AND p.status = 'succeeded'
  `, [companyId, dayStart, dayEnd]);
    // Aggregate email activity on this day
    const emailStats = await database_1.pool.query(`
    SELECT
      COUNT(*)::int                                               AS emails_sent,
      COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::int         AS emails_opened,
      COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::int        AS emails_clicked
    FROM email_logs
    WHERE company_id = $1
      AND sent_at BETWEEN $2 AND $3
  `, [companyId, dayStart, dayEnd]);
    const inv = invoiceStats.rows[0];
    const pay = paymentStats.rows[0];
    const eml = emailStats.rows[0];
    // Use payment-based recovered amounts (more accurate than status-based)
    const amountRecovered = pay.payments_amount > 0
        ? pay.payments_amount
        : inv.amount_recovered;
    await database_1.pool.query(`
    INSERT INTO recovery_timeline (
      company_id, period_date, period_type,
      invoices_created, invoices_recovered,
      amount_created, amount_recovered,
      emails_sent, emails_opened, emails_clicked,
      avg_days_to_collect
    ) VALUES ($1, $2, 'daily', $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (company_id, period_date, period_type) DO UPDATE SET
      invoices_created      = EXCLUDED.invoices_created,
      invoices_recovered    = EXCLUDED.invoices_recovered,
      amount_created        = EXCLUDED.amount_created,
      amount_recovered      = EXCLUDED.amount_recovered,
      emails_sent           = EXCLUDED.emails_sent,
      emails_opened         = EXCLUDED.emails_opened,
      emails_clicked        = EXCLUDED.emails_clicked,
      avg_days_to_collect   = EXCLUDED.avg_days_to_collect
  `, [
        companyId,
        periodDate,
        inv.invoices_created,
        inv.invoices_recovered,
        inv.amount_created,
        amountRecovered,
        eml.emails_sent,
        eml.emails_opened,
        eml.emails_clicked,
        pay.avg_days_to_collect,
    ]);
}
/**
 * Run the timeline aggregation: backfill last 7 days for all companies.
 * Idempotent — safe to run multiple times (UPSERT).
 */
async function runTimelineAggregation() {
    const method = 'runTimelineAggregation';
    (0, logger_1.logInfo)(LOG_MODULE, method, 'Starting recovery timeline aggregation');
    const companyIds = await getAllActiveCompanyIds();
    (0, logger_1.logInfo)(LOG_MODULE, method, `Aggregating timeline for ${companyIds.length} companies`);
    const daysToBackfill = 7;
    let daysProcessed = 0;
    for (const companyId of companyIds) {
        for (let i = 0; i < daysToBackfill; i++) {
            const date = new Date();
            date.setUTCDate(date.getUTCDate() - i);
            try {
                await aggregateAndUpsertDay(companyId, date);
                daysProcessed++;
            }
            catch (err) {
                (0, logger_1.logError)(LOG_MODULE, method, `Failed to aggregate day ${date.toISOString().slice(0, 10)}`, err, { companyId });
            }
        }
    }
    (0, logger_1.logInfo)(LOG_MODULE, method, 'Timeline aggregation complete', {
        companies: companyIds.length,
        daysProcessed,
    });
    return { companies: companyIds.length, daysProcessed };
}
function startRecoveryTimelineJob() {
    try {
        const connection = (0, dunningQueue_1.getRedisConnection)();
        timelineWorker = new bullmq_1.Worker(TIMELINE_QUEUE, async (job) => {
            (0, logger_1.logInfo)(LOG_MODULE, 'worker', 'Processing timeline job', { jobId: job.id });
            const result = await runTimelineAggregation();
            return result;
        }, { connection, concurrency: 1 });
        timelineWorker.on('completed', (job, result) => {
            (0, logger_1.logInfo)(LOG_MODULE, 'worker', 'Timeline job completed', { jobId: job.id, ...result });
        });
        timelineWorker.on('failed', (job, err) => {
            (0, logger_1.logError)(LOG_MODULE, 'worker', 'Timeline job failed', err, { jobId: job?.id });
        });
        timelineWorker.on('error', (err) => {
            (0, logger_1.logError)(LOG_MODULE, 'worker', 'Timeline worker connection issue', err);
        });
        scheduleTimelineJob();
        (0, logger_1.logInfo)(LOG_MODULE, 'startRecoveryTimelineJob', 'Recovery timeline job started (runs daily at 01:00 UTC)');
    }
    catch (err) {
        (0, logger_1.logError)(LOG_MODULE, 'startRecoveryTimelineJob', 'Failed to start recovery timeline job', err);
    }
}
async function scheduleTimelineJob() {
    try {
        const queue = getTimelineQueue();
        await queue.removeRepeatable('recovery-timeline', { pattern: '0 1 * * *' });
        await queue.add('recovery-timeline', {}, {
            repeat: { pattern: '0 1 * * *' }, // 1:00 AM UTC daily
            jobId: 'recovery-timeline-cron',
        });
        (0, logger_1.logInfo)(LOG_MODULE, 'scheduleTimelineJob', 'Recovery timeline cron scheduled (01:00 AM UTC daily)');
        // Run on startup to backfill
        setTimeout(() => {
            queue.add('recovery-timeline-startup', {}, {
                delay: 0,
                jobId: `timeline-startup-${Date.now()}`,
            }).catch(err => {
                (0, logger_1.logError)(LOG_MODULE, 'scheduleTimelineJob', 'Startup run failed to queue', err);
            });
        }, 90000); // 90s after server start
    }
    catch (err) {
        (0, logger_1.logError)(LOG_MODULE, 'scheduleTimelineJob', 'Failed to schedule timeline job', err);
    }
}
async function stopRecoveryTimelineJob() {
    try {
        await timelineWorker?.close();
        await timelineQueue?.close();
        (0, logger_1.logInfo)(LOG_MODULE, 'stop', 'Recovery timeline job stopped');
    }
    catch (err) {
        (0, logger_1.logError)(LOG_MODULE, 'stop', 'Error stopping recovery timeline job', err);
    }
}
