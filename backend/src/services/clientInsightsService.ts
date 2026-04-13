import { pool } from '../config/database';
import { logInfo, logError } from '../utils/logger';

const MODULE = 'ClientInsightsService';

export interface PaymentInsights {
  reliability_pct: number | null;          // % invoices paid historically
  historical_recovery_rate: number | null; // paid / (paid + uncollectable) %
  avg_days_to_pay: number | null;          // avg days from due_date to payment (Stripe only)
  dso_trend: 'improving' | 'stable' | 'worsening' | null; // trend over last 90d vs 90-180d
  avg_emails_before_payment: number | null; // builds up after RecoverAI sends emails
  total_analyzed: number;                  // how many invoices we looked at
  data_source: 'stripe' | 'csv' | 'mixed';
  analyzed_at: string;
}

/**
 * Build behavioral insights for all clients (debtors) of a company.
 * Called after CSV import or Stripe sync — runs async, non-blocking.
 *
 * What we compute:
 * - reliability_pct: always (from invoice statuses)
 * - historical_recovery_rate: always
 * - avg_days_to_pay + dso_trend: Stripe users only (payments table has timestamps)
 * - avg_emails_before_payment: builds over time as RecoverAI sends emails
 *
 * Stores in customers.payment_insights JSONB.
 */
export async function buildClientInsights(companyId: string): Promise<void> {
  logInfo(MODULE, 'buildClientInsights', 'Starting client insights build', { companyId });

  try {
    // Get all customers for this company
    const customersResult = await pool.query<{ id: string }>(
      `SELECT id FROM customers WHERE company_id = $1`,
      [companyId]
    );

    if (customersResult.rows.length === 0) {
      logInfo(MODULE, 'buildClientInsights', 'No customers found', { companyId });
      return;
    }

    let processed = 0;
    let failed = 0;

    for (const { id: customerId } of customersResult.rows) {
      try {
        await buildSingleClientInsights(companyId, customerId);
        processed++;
      } catch (err) {
        failed++;
        logError(MODULE, 'buildClientInsights', 'Failed for customer', err, { companyId, customerId });
      }
    }

    logInfo(MODULE, 'buildClientInsights', 'Client insights build complete', {
      companyId,
      processed,
      failed,
      total: customersResult.rows.length,
    });
  } catch (err) {
    logError(MODULE, 'buildClientInsights', 'Build failed', err, { companyId });
  }
}

/**
 * Build insights for a single client (debtor).
 */
async function buildSingleClientInsights(companyId: string, customerId: string): Promise<void> {
  // Query 1: Invoice stats — always available (CSV + Stripe)
  const invoiceStats = await pool.query<{
    total: string;
    paid_count: string;
    uncollectable_count: string;
  }>(
    `SELECT
       COUNT(*)                                              AS total,
       COUNT(CASE WHEN status = 'paid' THEN 1 END)         AS paid_count,
       COUNT(CASE WHEN status = 'uncollectable' THEN 1 END) AS uncollectable_count
     FROM invoices
     WHERE customer_id = $1 AND company_id = $2`,
    [customerId, companyId]
  );

  const stats = invoiceStats.rows[0];
  const total = parseInt(stats.total) || 0;
  const paidCount = parseInt(stats.paid_count) || 0;
  const uncollectableCount = parseInt(stats.uncollectable_count) || 0;

  if (total === 0) return; // No invoices yet — skip

  const reliabilityPct = total > 0 ? Math.round((paidCount / total) * 100) : null;
  const denominator = paidCount + uncollectableCount;
  const historicalRecoveryRate = denominator > 0 ? Math.round((paidCount / denominator) * 100) : null;

  // Query 2: DSO from payments table — Stripe users only
  // payments.paid_at exists when Stripe charges succeed
  let avgDaysToPay: number | null = null;
  let dsoTrend: 'improving' | 'stable' | 'worsening' | null = null;
  let dataSource: 'stripe' | 'csv' | 'mixed' = 'csv';

  try {
    const dsoResult = await pool.query<{
      avg_days_recent: string | null;
      avg_days_older: string | null;
      has_payment_data: string;
    }>(
      `SELECT
         AVG(CASE
           WHEN p.paid_at IS NOT NULL AND i.due_date >= NOW() - INTERVAL '90 days'
           THEN EXTRACT(EPOCH FROM (p.paid_at - i.due_date)) / 86400
         END)::numeric(10,2) AS avg_days_recent,
         AVG(CASE
           WHEN p.paid_at IS NOT NULL AND i.due_date < NOW() - INTERVAL '90 days'
             AND i.due_date >= NOW() - INTERVAL '180 days'
           THEN EXTRACT(EPOCH FROM (p.paid_at - i.due_date)) / 86400
         END)::numeric(10,2) AS avg_days_older,
         COUNT(p.id)::text AS has_payment_data
       FROM invoices i
       LEFT JOIN payments p ON p.invoice_id = i.id AND p.status = 'succeeded'
       WHERE i.customer_id = $1 AND i.company_id = $2 AND i.status = 'paid'`,
      [customerId, companyId]
    );

    const dso = dsoResult.rows[0];
    const hasPaymentData = parseInt(dso.has_payment_data || '0') > 0;

    if (hasPaymentData) {
      dataSource = 'stripe';
      const recent = dso.avg_days_recent ? parseFloat(dso.avg_days_recent) : null;
      const older = dso.avg_days_older ? parseFloat(dso.avg_days_older) : null;

      if (recent !== null) {
        avgDaysToPay = Math.round(recent * 10) / 10;
      }

      // DSO trend: compare recent 90d avg vs 90-180d avg
      if (recent !== null && older !== null) {
        const diff = recent - older;
        if (diff > 5) dsoTrend = 'worsening';       // getting slower to pay
        else if (diff < -5) dsoTrend = 'improving';  // paying faster
        else dsoTrend = 'stable';
      }
    }
  } catch (_err) {
    // payments table might not have paid_at for this customer — CSV-only user
  }

  // Query 3: Avg emails before payment — builds over time from email_logs
  // Only meaningful after RecoverAI has sent dunning emails
  let avgEmailsBeforePayment: number | null = null;

  try {
    const emailResult = await pool.query<{ avg_emails: string | null; invoice_count: string }>(
      `SELECT
         AVG(email_count)::numeric(10,2) AS avg_emails,
         COUNT(*) AS invoice_count
       FROM (
         SELECT
           i.id,
           COUNT(DISTINCT el.email_type) AS email_count
         FROM invoices i
         JOIN email_logs el ON el.invoice_id = i.id
           AND el.email_type LIKE 'dunning_%'
           AND el.status NOT IN ('failed', 'skipped')
         WHERE i.customer_id = $1
           AND i.company_id = $2
           AND i.status = 'paid'
         GROUP BY i.id
       ) AS per_invoice`,
      [customerId, companyId]
    );

    const emailStats = emailResult.rows[0];
    const invoiceCount = parseInt(emailStats.invoice_count) || 0;

    // Only trust this metric if we have at least 2 paid invoices with email history
    if (invoiceCount >= 2 && emailStats.avg_emails) {
      avgEmailsBeforePayment = Math.round(parseFloat(emailStats.avg_emails) * 10) / 10;
    }
  } catch (_err) {
    // email_logs might be empty — new account
  }

  const insights: PaymentInsights = {
    reliability_pct: reliabilityPct,
    historical_recovery_rate: historicalRecoveryRate,
    avg_days_to_pay: avgDaysToPay,
    dso_trend: dsoTrend,
    avg_emails_before_payment: avgEmailsBeforePayment,
    total_analyzed: total,
    data_source: dataSource,
    analyzed_at: new Date().toISOString(),
  };

  await pool.query(
    `UPDATE customers SET payment_insights = $1::jsonb, updated_at = NOW()
     WHERE id = $2 AND company_id = $3`,
    [JSON.stringify(insights), customerId, companyId]
  );
}

/**
 * Update email insights for a single customer after an invoice is paid.
 * Called event-driven from Stripe webhook (handleChargeSucceeded).
 * Incrementally updates avg_emails_before_payment using rolling average.
 */
export async function updateEmailInsightsAfterPayment(
  companyId: string,
  customerId: string,
  invoiceId: string
): Promise<void> {
  try {
    // Count dunning emails sent for this specific invoice
    const emailCount = await pool.query<{ count: string }>(
      `SELECT COUNT(DISTINCT email_type) AS count
       FROM email_logs
       WHERE invoice_id = $1
         AND company_id = $2
         AND email_type LIKE 'dunning_%'
         AND status NOT IN ('failed', 'skipped')`,
      [invoiceId, companyId]
    );

    const emailsSentForThisInvoice = parseInt(emailCount.rows[0]?.count || '0');
    if (emailsSentForThisInvoice === 0) return; // Invoice paid without dunning — self-payer, skip

    // Get existing insights
    const existing = await pool.query<{ payment_insights: PaymentInsights | null }>(
      `SELECT payment_insights FROM customers WHERE id = $1 AND company_id = $2`,
      [customerId, companyId]
    );

    const currentInsights = existing.rows[0]?.payment_insights;
    const currentAvg = currentInsights?.avg_emails_before_payment ?? null;

    let newAvg: number;
    if (currentAvg === null) {
      newAvg = emailsSentForThisInvoice;
    } else {
      // Rolling average: weight existing avg by 3 (give history more weight)
      newAvg = Math.round(((currentAvg * 3) + emailsSentForThisInvoice) / 4 * 10) / 10;
    }

    await pool.query(
      `UPDATE customers
       SET payment_insights = COALESCE(payment_insights, '{}'::jsonb) ||
           jsonb_build_object(
             'avg_emails_before_payment', $1::numeric,
             'analyzed_at', NOW()::text
           ),
           updated_at = NOW()
       WHERE id = $2 AND company_id = $3`,
      [newAvg, customerId, companyId]
    );

    logInfo(MODULE, 'updateEmailInsightsAfterPayment', 'Email insights updated', {
      companyId, customerId, invoiceId,
      emailsSentForThisInvoice, newAvg,
    });
  } catch (err) {
    logError(MODULE, 'updateEmailInsightsAfterPayment', 'Failed (non-critical)', err, {
      companyId, customerId, invoiceId,
    });
  }
}
