import { Worker, Queue } from 'bullmq';
import { getRedisConnection, queueEmailNow } from './dunningQueue';
import { pool } from '../config/database';
import { logError, logInfo, logWarn } from '../utils/logger';
import type { DunningEmailType } from '../types/email';

const AGENT_QUEUE = 'agent-loop';
const LOG_MODULE = 'agentLoop';
const MAX_DUNNING_EMAILS = 5;
const PAYMENT_PLAN_DAY_THRESHOLD = 15;

// Decision tree: days overdue → email type (in order)
// Exported so invoiceController can compute nextScheduledDate without duplicating
export const DUNNING_DECISION_TREE: Array<{ dayOffset: number; emailType: DunningEmailType }> = [
  { dayOffset: 1,  emailType: 'dunning_1' },
  { dayOffset: 7,  emailType: 'dunning_2' },
  { dayOffset: 14, emailType: 'dunning_3' },
  { dayOffset: 30, emailType: 'dunning_4' },
  { dayOffset: 60, emailType: 'dunning_5' },
];

let agentQueue: Queue | null = null;
let agentWorker: Worker | null = null;

function getAgentQueue(): Queue {
  if (!agentQueue) {
    agentQueue = new Queue(AGENT_QUEUE, { connection: getRedisConnection() });
    agentQueue.on('error', (err: Error) => {
      logError(LOG_MODULE, 'queue', 'Agent queue connection issue', err);
    });
  }
  return agentQueue;
}

/**
 * Fetch all unpaid overdue invoices with their email and payment plan state.
 * Returns one row per invoice with aggregated email/plan data.
 */
async function getOverdueInvoicesForProcessing(): Promise<Array<{
  id: string;
  company_id: string;
  customer_id: string;
  amount: number;
  due_date: string;
  customer_email: string;
  customer_name: string;
  risk_score: number;
  dunning_emails_sent: number;
  email_types_sent: string[];
  has_active_plan: boolean;
  plan_offer_sent: boolean;
  dunning_paused_until: string | null;
  dunning_stopped: boolean;
}>> {
  const result = await pool.query(`
    SELECT
      i.id,
      i.company_id,
      i.customer_id,
      i.amount::float AS amount,
      i.due_date,
      i.risk_score,
      i.dunning_paused_until,
      COALESCE(i.dunning_stopped, false) AS dunning_stopped,
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
    GROUP BY i.id, i.company_id, i.customer_id, i.amount, i.due_date, i.risk_score, i.dunning_paused_until, i.dunning_stopped, c.email, c.name
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
async function runDecisionEngine(): Promise<{
  total: number;
  emailsQueued: number;
  planOffersQueued: number;
  skipped: number;
}> {
  const method = 'runDecisionEngine';
  logInfo(LOG_MODULE, method, 'Agent decision engine starting');

  const allInvoices = await getOverdueInvoicesForProcessing();

  // Filter out demo company from actual agent loop (but keep for preview)
  const demoCompanyId = await pool.query(
    `SELECT id FROM companies WHERE name = 'Acme SaaS (Demo)' LIMIT 1`
  );
  const demoCompId = demoCompanyId.rows[0]?.id;
  const invoices = demoCompId
    ? allInvoices.filter(inv => inv.company_id !== demoCompId)
    : allInvoices;

  logInfo(LOG_MODULE, method, `Processing ${invoices.length} unpaid overdue invoices (skipped ${allInvoices.length - invoices.length} demo invoices)`);

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

      // ── Dunning control checks ──
      if (invoice.dunning_stopped) {
        logInfo(LOG_MODULE, method, 'Dunning stopped — skipping', { invoiceId: invoice.id });
        skipped++;
        continue;
      }

      if (invoice.dunning_paused_until && new Date(invoice.dunning_paused_until) > new Date()) {
        logInfo(LOG_MODULE, method, 'Dunning paused — skipping', {
          invoiceId: invoice.id,
          pausedUntil: invoice.dunning_paused_until,
        });
        skipped++;
        continue;
      }

      if (!invoice.customer_email) {
        logWarn(LOG_MODULE, method, 'No customer email — skipping', { invoiceId: invoice.id });
        skipped++;
        continue;
      }

      const emailTypesSent = new Set<string>(invoice.email_types_sent || []);

      // ── Find next dunning step to send ──
      // Pick the first step (lowest dayOffset) that is due and not yet sent.
      // This ensures emails go out in sequence (1→2→3→4→5), one per agent run.
      let nextStep: { dayOffset: number; emailType: DunningEmailType } | null = null;
      for (const step of DUNNING_DECISION_TREE) {
        if (daysOverdue >= step.dayOffset && !emailTypesSent.has(step.emailType)) {
          nextStep = step;
          break;
        }
      }

      if (nextStep && invoice.dunning_emails_sent < MAX_DUNNING_EMAILS) {
        await queueEmailNow({
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
        logInfo(LOG_MODULE, method, 'Dunning email queued', {
          invoiceId: invoice.id,
          daysOverdue,
          emailType: nextStep.emailType,
          attemptNumber: invoice.dunning_emails_sent + 1,
        });
      } else if (!nextStep) {
        logInfo(LOG_MODULE, method, 'No pending dunning step', {
          invoiceId: invoice.id,
          daysOverdue,
          emailTypesSent: [...emailTypesSent],
        });
        skipped++;
      } else {
        logInfo(LOG_MODULE, method, 'Max dunning emails reached', {
          invoiceId: invoice.id,
          dunningEmailsSent: invoice.dunning_emails_sent,
        });
        skipped++;
      }

      // ── Auto-offer payment plan at day 15+ ──
      if (
        daysOverdue >= PAYMENT_PLAN_DAY_THRESHOLD &&
        !invoice.has_active_plan &&
        !invoice.plan_offer_sent
      ) {
        await queueEmailNow({
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
        logInfo(LOG_MODULE, method, 'Payment plan offer queued', {
          invoiceId: invoice.id,
          daysOverdue,
        });
      }
    } catch (err) {
      logError(LOG_MODULE, method, 'Error processing invoice', err, { invoiceId: invoice.id });
    }
  }

  const result = { total: invoices.length, emailsQueued, planOffersQueued, skipped };
  logInfo(LOG_MODULE, method, 'Agent run complete', result);
  return result;
}

export function startAgentLoop(): void {
  try {
    const connection = getRedisConnection();

    agentWorker = new Worker(
      AGENT_QUEUE,
      async (job) => {
        logInfo(LOG_MODULE, 'worker', 'Processing agent loop job', { jobId: job.id });
        const result = await runDecisionEngine();
        return result;
      },
      ({
        connection,
        concurrency: 1,
        // Blocking fetch optimization for cron-based jobs
        pollInterval: 60000,        // 60 second poll (agent runs every 6h anyway)
        tryBlockedFetch: true,      // Use BZPOPMIN (blocking)
        maxStalCount: 2,            // Aggressively switch to blocking mode
      } as any)
    );

    agentWorker.on('completed', (job, result) => {
      logInfo(LOG_MODULE, 'worker', 'Agent loop job completed', { jobId: job.id, ...result });
    });

    agentWorker.on('failed', (job, err) => {
      logError(LOG_MODULE, 'worker', 'Agent loop job failed', err, { jobId: job?.id });
    });

    agentWorker.on('error', (err: Error) => {
      logError(LOG_MODULE, 'worker', 'Agent worker connection issue', err);
    });

    scheduleAgentLoop();
    logInfo(LOG_MODULE, 'startAgentLoop', 'Agent loop started (runs every 6 hours)');
  } catch (err) {
    logError(LOG_MODULE, 'startAgentLoop', 'Failed to start agent loop', err);
  }
}

async function scheduleAgentLoop(): Promise<void> {
  try {
    const queue = getAgentQueue();
    await queue.removeRepeatable('agent-loop', { pattern: '0 */6 * * *' });
    await queue.add('agent-loop', {}, {
      repeat: { pattern: '0 */6 * * *' },  // Every 6 hours
      jobId: 'agent-loop-cron',
    });
    logInfo(LOG_MODULE, 'scheduleAgentLoop', 'Agent loop cron scheduled (every 6 hours)');

    // Trigger a startup run after 60s delay to let server fully settle
    setTimeout(() => {
      queue.add('agent-loop-startup', {}, {
        delay: 0,
        jobId: `agent-startup-${Date.now()}`,
      }).catch(err => {
        logError(LOG_MODULE, 'scheduleAgentLoop', 'Startup run failed to queue', err);
      });
    }, 60_000);
  } catch (err) {
    logError(LOG_MODULE, 'scheduleAgentLoop', 'Failed to schedule agent loop', err);
  }
}

export async function stopAgentLoop(): Promise<void> {
  try {
    await agentWorker?.close();
    await agentQueue?.close();
    logInfo(LOG_MODULE, 'stop', 'Agent loop stopped');
  } catch (err) {
    logError(LOG_MODULE, 'stop', 'Error stopping agent loop', err);
  }
}

/**
 * Run the decision engine synchronously and return results immediately.
 * Used by the manual trigger endpoint for real-time feedback.
 */
export async function runDecisionEngineNow(): Promise<{
  total: number;
  emailsQueued: number;
  planOffersQueued: number;
  skipped: number;
}> {
  logInfo(LOG_MODULE, 'runDecisionEngineNow', 'Manual synchronous agent run starting');
  return runDecisionEngine();
}

export interface DryRunPreviewItem {
  invoiceId: string;
  customerId: string;
  customerName: string;
  recipientEmail: string;
  amount: number;
  daysOverdue: number;
  emailType: DunningEmailType | 'payment_plan_offer';
  riskScore: number;
}

/**
 * Dry-run the decision engine — same logic as runDecisionEngine but NO emails queued.
 * Returns what WOULD happen if agent ran now. Safe to call anytime.
 * Optionally scoped to a single company (pass companyId).
 */
export async function runDecisionEngineDryRun(companyId?: string): Promise<{
  total: number;
  emailsWouldQueue: number;
  plansWouldOffer: number;
  skipped: number;
  estimatedRecoveryUsd: number;
  previews: DryRunPreviewItem[];
}> {
  const method = 'runDecisionEngineDryRun';
  logInfo(LOG_MODULE, method, 'Dry-run agent preview starting', { companyId });

  const allInvoices = await getOverdueInvoicesForProcessing();
  const invoices = companyId
    ? allInvoices.filter(i => i.company_id === companyId)
    : allInvoices;

  let emailsWouldQueue = 0;
  let plansWouldOffer = 0;
  let skipped = 0;
  let estimatedRecoveryUsd = 0;
  const previews: DryRunPreviewItem[] = [];

  for (const invoice of invoices) {
    const now = Date.now();
    const dueDate = new Date(invoice.due_date).getTime();
    const daysOverdue = Math.floor((now - dueDate) / (24 * 60 * 60 * 1000));

    if (daysOverdue < 1 || !invoice.customer_email) {
      skipped++;
      continue;
    }

    if (invoice.dunning_stopped) {
      skipped++;
      continue;
    }

    if (invoice.dunning_paused_until && new Date(invoice.dunning_paused_until) > new Date()) {
      skipped++;
      continue;
    }

    const emailTypesSent = new Set<string>(invoice.email_types_sent || []);
    let nextStep: { dayOffset: number; emailType: DunningEmailType } | null = null;
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
    } else {
      skipped++;
    }

    if (
      daysOverdue >= PAYMENT_PLAN_DAY_THRESHOLD &&
      !invoice.has_active_plan &&
      !invoice.plan_offer_sent
    ) {
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
  logInfo(LOG_MODULE, method, 'Dry-run complete', { total: result.total, emailsWouldQueue, plansWouldOffer });
  return result;
}
