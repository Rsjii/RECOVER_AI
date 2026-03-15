"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAgentLoop = startAgentLoop;
exports.stopAgentLoop = stopAgentLoop;
exports.runDecisionEngineNow = runDecisionEngineNow;
exports.runDecisionEngineDryRun = runDecisionEngineDryRun;
const bullmq_1 = require("bullmq");
const dunningQueue_1 = require("./dunningQueue");
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const AGENT_QUEUE = 'agent-loop';
const LOG_MODULE = 'agentLoop';
const MAX_DUNNING_EMAILS = 5;
const PAYMENT_PLAN_DAY_THRESHOLD = 15;
// Decision tree: days overdue → email type (in order)
const DUNNING_DECISION_TREE = [
    { dayOffset: 1, emailType: 'dunning_1' },
    { dayOffset: 7, emailType: 'dunning_2' },
    { dayOffset: 14, emailType: 'dunning_3' },
    { dayOffset: 30, emailType: 'dunning_4' },
    { dayOffset: 60, emailType: 'dunning_5' },
];
let agentQueue = null;
let agentWorker = null;
function getAgentQueue() {
    if (!agentQueue) {
        agentQueue = new bullmq_1.Queue(AGENT_QUEUE, { connection: (0, dunningQueue_1.getRedisConnection)() });
        agentQueue.on('error', (err) => {
            (0, logger_1.logError)(LOG_MODULE, 'queue', 'Agent queue connection issue', err);
        });
    }
    return agentQueue;
}
/**
 * Fetch all unpaid overdue invoices with their email and payment plan state.
 * Returns one row per invoice with aggregated email/plan data.
 */
async function getOverdueInvoicesForProcessing() {
    const result = await database_1.pool.query(`
    SELECT
      i.id,
      i.company_id,
      i.customer_id,
      i.amount::float AS amount,
      i.due_date,
      i.risk_score,
      c.email  AS customer_email,
      c.name   AS customer_name,
      COUNT(DISTINCT el.id) FILTER (
        WHERE el.email_type LIKE 'dunning_%' AND el.status != 'failed'
      )::int AS dunning_emails_sent,
      COALESCE(
        ARRAY_AGG(DISTINCT el.email_type) FILTER (WHERE el.email_type IS NOT NULL AND el.status != 'failed'),
        '{}'::text[]
      ) AS email_types_sent,
      (COUNT(DISTINCT pp.id) FILTER (WHERE pp.status = 'active') > 0) AS has_active_plan,
      (COUNT(DISTINCT el2.id) FILTER (WHERE el2.email_type = 'payment_plan_offer' AND el2.status != 'failed') > 0) AS plan_offer_sent
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN email_logs el  ON el.invoice_id = i.id
    LEFT JOIN email_logs el2 ON el2.invoice_id = i.id
    LEFT JOIN payment_plans pp ON pp.invoice_id = i.id
    WHERE i.status NOT IN ('paid', 'uncollectable')
      AND i.due_date < NOW()
      AND c.email IS NOT NULL
      AND c.email != ''
      AND COALESCE(c.do_not_email, false) = false
    GROUP BY i.id, i.company_id, i.customer_id, i.amount, i.due_date, i.risk_score, c.email, c.name
    ORDER BY i.due_date ASC
  `);
    return result.rows.map(row => ({
        ...row,
        has_active_plan: row.has_active_plan === true || row.has_active_plan === 't',
        plan_offer_sent: row.plan_offer_sent === true || row.plan_offer_sent === 't',
    }));
}
/**
 * Core decision engine: scans all unpaid overdue invoices and queues the
 * appropriate next dunning email for each one.
 */
async function runDecisionEngine() {
    const method = 'runDecisionEngine';
    (0, logger_1.logInfo)(LOG_MODULE, method, 'Agent decision engine starting');
    const invoices = await getOverdueInvoicesForProcessing();
    (0, logger_1.logInfo)(LOG_MODULE, method, `Processing ${invoices.length} unpaid overdue invoices`);
    let emailsQueued = 0;
    let planOffersQueued = 0;
    let skipped = 0;
    for (const invoice of invoices) {
        try {
            const now = Date.now();
            const dueDate = new Date(invoice.due_date).getTime();
            const daysOverdue = Math.floor((now - dueDate) / (24 * 60 * 60 * 1000));
            if (daysOverdue < 1) {
                skipped++;
                continue;
            }
            if (!invoice.customer_email) {
                (0, logger_1.logWarn)(LOG_MODULE, method, 'No customer email — skipping', { invoiceId: invoice.id });
                skipped++;
                continue;
            }
            const emailTypesSent = new Set(invoice.email_types_sent || []);
            // ── Find next dunning step to send ──
            // Pick the first step (lowest dayOffset) that is due and not yet sent.
            // This ensures emails go out in sequence (1→2→3→4→5), one per agent run.
            let nextStep = null;
            for (const step of DUNNING_DECISION_TREE) {
                if (daysOverdue >= step.dayOffset && !emailTypesSent.has(step.emailType)) {
                    nextStep = step;
                    break;
                }
            }
            if (nextStep && invoice.dunning_emails_sent < MAX_DUNNING_EMAILS) {
                await (0, dunningQueue_1.queueEmailNow)({
                    companyId: invoice.company_id,
                    customerId: invoice.customer_id,
                    invoiceId: invoice.id,
                    recipientEmail: invoice.customer_email,
                    customerName: invoice.customer_name,
                    invoiceAmount: invoice.amount,
                    dueDate: invoice.due_date,
                    daysOverdue,
                    emailType: nextStep.emailType,
                    attemptNumber: invoice.dunning_emails_sent + 1,
                    riskScore: invoice.risk_score || undefined,
                });
                emailsQueued++;
                (0, logger_1.logInfo)(LOG_MODULE, method, 'Dunning email queued', {
                    invoiceId: invoice.id,
                    daysOverdue,
                    emailType: nextStep.emailType,
                    attemptNumber: invoice.dunning_emails_sent + 1,
                });
            }
            else if (!nextStep) {
                (0, logger_1.logInfo)(LOG_MODULE, method, 'No pending dunning step', {
                    invoiceId: invoice.id,
                    daysOverdue,
                    emailTypesSent: [...emailTypesSent],
                });
                skipped++;
            }
            else {
                (0, logger_1.logInfo)(LOG_MODULE, method, 'Max dunning emails reached', {
                    invoiceId: invoice.id,
                    dunningEmailsSent: invoice.dunning_emails_sent,
                });
                skipped++;
            }
            // ── Auto-offer payment plan at day 15+ ──
            if (daysOverdue >= PAYMENT_PLAN_DAY_THRESHOLD &&
                !invoice.has_active_plan &&
                !invoice.plan_offer_sent) {
                await (0, dunningQueue_1.queueEmailNow)({
                    companyId: invoice.company_id,
                    customerId: invoice.customer_id,
                    invoiceId: invoice.id,
                    recipientEmail: invoice.customer_email,
                    customerName: invoice.customer_name,
                    invoiceAmount: invoice.amount,
                    dueDate: invoice.due_date,
                    daysOverdue,
                    emailType: 'payment_plan_offer',
                    attemptNumber: 1,
                    riskScore: invoice.risk_score || undefined,
                });
                planOffersQueued++;
                (0, logger_1.logInfo)(LOG_MODULE, method, 'Payment plan offer queued', {
                    invoiceId: invoice.id,
                    daysOverdue,
                });
            }
        }
        catch (err) {
            (0, logger_1.logError)(LOG_MODULE, method, 'Error processing invoice', err, { invoiceId: invoice.id });
        }
    }
    const result = { total: invoices.length, emailsQueued, planOffersQueued, skipped };
    (0, logger_1.logInfo)(LOG_MODULE, method, 'Agent run complete', result);
    return result;
}
function startAgentLoop() {
    try {
        const connection = (0, dunningQueue_1.getRedisConnection)();
        agentWorker = new bullmq_1.Worker(AGENT_QUEUE, async (job) => {
            (0, logger_1.logInfo)(LOG_MODULE, 'worker', 'Processing agent loop job', { jobId: job.id });
            const result = await runDecisionEngine();
            return result;
        }, { connection, concurrency: 1 });
        agentWorker.on('completed', (job, result) => {
            (0, logger_1.logInfo)(LOG_MODULE, 'worker', 'Agent loop job completed', { jobId: job.id, ...result });
        });
        agentWorker.on('failed', (job, err) => {
            (0, logger_1.logError)(LOG_MODULE, 'worker', 'Agent loop job failed', err, { jobId: job?.id });
        });
        agentWorker.on('error', (err) => {
            (0, logger_1.logError)(LOG_MODULE, 'worker', 'Agent worker connection issue', err);
        });
        scheduleAgentLoop();
        (0, logger_1.logInfo)(LOG_MODULE, 'startAgentLoop', 'Agent loop started (runs every 6 hours)');
    }
    catch (err) {
        (0, logger_1.logError)(LOG_MODULE, 'startAgentLoop', 'Failed to start agent loop', err);
    }
}
async function scheduleAgentLoop() {
    try {
        const queue = getAgentQueue();
        await queue.removeRepeatable('agent-loop', { pattern: '0 */6 * * *' });
        await queue.add('agent-loop', {}, {
            repeat: { pattern: '0 */6 * * *' }, // Every 6 hours
            jobId: 'agent-loop-cron',
        });
        (0, logger_1.logInfo)(LOG_MODULE, 'scheduleAgentLoop', 'Agent loop cron scheduled (every 6 hours)');
        // Trigger a startup run after 60s delay to let server fully settle
        setTimeout(() => {
            queue.add('agent-loop-startup', {}, {
                delay: 0,
                jobId: `agent-startup-${Date.now()}`,
            }).catch(err => {
                (0, logger_1.logError)(LOG_MODULE, 'scheduleAgentLoop', 'Startup run failed to queue', err);
            });
        }, 60000);
    }
    catch (err) {
        (0, logger_1.logError)(LOG_MODULE, 'scheduleAgentLoop', 'Failed to schedule agent loop', err);
    }
}
async function stopAgentLoop() {
    try {
        await agentWorker?.close();
        await agentQueue?.close();
        (0, logger_1.logInfo)(LOG_MODULE, 'stop', 'Agent loop stopped');
    }
    catch (err) {
        (0, logger_1.logError)(LOG_MODULE, 'stop', 'Error stopping agent loop', err);
    }
}
/**
 * Run the decision engine synchronously and return results immediately.
 * Used by the manual trigger endpoint for real-time feedback.
 */
async function runDecisionEngineNow() {
    (0, logger_1.logInfo)(LOG_MODULE, 'runDecisionEngineNow', 'Manual synchronous agent run starting');
    return runDecisionEngine();
}
/**
 * Dry-run the decision engine — same logic as runDecisionEngine but NO emails queued.
 * Returns what WOULD happen if agent ran now. Safe to call anytime.
 * Optionally scoped to a single company (pass companyId).
 */
async function runDecisionEngineDryRun(companyId) {
    const method = 'runDecisionEngineDryRun';
    (0, logger_1.logInfo)(LOG_MODULE, method, 'Dry-run agent preview starting', { companyId });
    const allInvoices = await getOverdueInvoicesForProcessing();
    const invoices = companyId
        ? allInvoices.filter(i => i.company_id === companyId)
        : allInvoices;
    let emailsWouldQueue = 0;
    let plansWouldOffer = 0;
    let skipped = 0;
    let estimatedRecoveryUsd = 0;
    const previews = [];
    for (const invoice of invoices) {
        const now = Date.now();
        const dueDate = new Date(invoice.due_date).getTime();
        const daysOverdue = Math.floor((now - dueDate) / (24 * 60 * 60 * 1000));
        if (daysOverdue < 1 || !invoice.customer_email) {
            skipped++;
            continue;
        }
        const emailTypesSent = new Set(invoice.email_types_sent || []);
        let nextStep = null;
        for (const step of DUNNING_DECISION_TREE) {
            if (daysOverdue >= step.dayOffset && !emailTypesSent.has(step.emailType)) {
                nextStep = step;
                break;
            }
        }
        if (nextStep && invoice.dunning_emails_sent < MAX_DUNNING_EMAILS) {
            emailsWouldQueue++;
            // Estimate 30% recovery probability per email (conservative)
            estimatedRecoveryUsd += Math.round(invoice.amount * 0.30);
            previews.push({
                invoiceId: invoice.id,
                customerId: invoice.customer_id,
                customerName: invoice.customer_name,
                recipientEmail: invoice.customer_email,
                amount: invoice.amount,
                daysOverdue,
                emailType: nextStep.emailType,
                riskScore: invoice.risk_score || 0,
            });
        }
        else {
            skipped++;
        }
        if (daysOverdue >= PAYMENT_PLAN_DAY_THRESHOLD &&
            !invoice.has_active_plan &&
            !invoice.plan_offer_sent) {
            plansWouldOffer++;
            previews.push({
                invoiceId: invoice.id,
                customerId: invoice.customer_id,
                customerName: invoice.customer_name,
                recipientEmail: invoice.customer_email,
                amount: invoice.amount,
                daysOverdue,
                emailType: 'payment_plan_offer',
                riskScore: invoice.risk_score || 0,
            });
        }
    }
    const result = { total: invoices.length, emailsWouldQueue, plansWouldOffer, skipped, estimatedRecoveryUsd, previews };
    (0, logger_1.logInfo)(LOG_MODULE, method, 'Dry-run complete', { total: result.total, emailsWouldQueue, plansWouldOffer });
    return result;
}
