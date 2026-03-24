import { pool } from '../config/database';

// ─── New Analytics Types ───────────────────────────────────────────────────

export interface DashboardKpi {
  dso: number;
  cei: number;
  recoveryRate: number;
  revenueAtRisk: number;
  revenueAtRiskPct: number;
  involuntaryChurnRate: number;
  atRiskCustomerCount: number;
  totalCustomers: number;
}

export interface AgingBucket {
  label: string;
  days: string;
  amount: number;
  invoiceCount: number;
  pctOfTotal: number;
}

export interface AgingAnalysis {
  buckets: AgingBucket[];
  totalAr: number;
}

export interface EmailAnalyticsByType {
  type: string;
  sent: number;
  opened: number;
  clicked: number;
  openRate: number;
  ctr: number;
}

export interface EmailAnalytics {
  period: string;
  sent: number;
  opened: number;
  clicked: number;
  openRate: number;
  ctr: number;
  ctor: number;
  openRateBenchmark: number;
  ctrBenchmark: number;
  byEmailType: EmailAnalyticsByType[];
}

export interface RiskDrivers {
  failedPayment: number;
  expiringCard: number;
  inactivity: number;
  hardDecline: number;
  total: number;
}

export interface PaymentPlanSummaryItem {
  planId: string;
  customerName: string;
  totalAmount: number;
  status: string;
  installmentsTotal: number;
  installmentsPaid: number;
  pctComplete: number;
}

export interface PaymentPlansSummary {
  activePlans: number;
  completedPlans: number;
  defaultedPlans: number;
  totalOffered: number;
  acceptanceRate: number;
  completionRate: number;
  totalValueActive: number;
  recentPlans: PaymentPlanSummaryItem[];
}

// ─── Existing Types ────────────────────────────────────────────────────────

export interface RecoveryStats {
  totalInvoices: number;
  totalOwed: number;
  totalRecovered: number;
  recoveryRate: number;
  avgDaysToCollect: number;
  overdueCount: number;
  overdueAmount: number;
}

export interface InvoicePipeline {
  unpaid: number;
  arranged: number;
  disputed: number;
  uncollectable: number;
  paid: number;
  unpaidAmount: number;
  arrangedAmount: number;
}

export interface CustomerRiskItem {
  customerId: string;
  customerName: string;
  customerEmail: string;
  unpaidInvoices: number;
  totalOwed: number;
  maxRiskScore: number;
  oldestDueDays: number;
}

export async function getRecoveryStats(companyId: string): Promise<RecoveryStats> {
  const result = await pool.query(
    `SELECT
       COUNT(*) as total_invoices,
       COALESCE(SUM(CASE WHEN status != 'paid' THEN amount ELSE 0 END), 0) as total_owed,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_recovered,
       COUNT(CASE WHEN status != 'paid' AND due_date < NOW() THEN 1 END) as overdue_count,
       COALESCE(SUM(CASE WHEN status != 'paid' AND due_date < NOW() THEN amount ELSE 0 END), 0) as overdue_amount
     FROM invoices
     WHERE company_id = $1`,
    [companyId]
  );

  const row = result.rows[0];
  const totalOwed = parseFloat(row.total_owed);
  const totalRecovered = parseFloat(row.total_recovered);
  const totalAll = totalOwed + totalRecovered;

  // Avg days to collect (from issued_date to payment)
  const avgResult = await pool.query(
    `SELECT AVG(EXTRACT(EPOCH FROM (p.paid_at - i.issued_date)) / 86400) as avg_days
     FROM payments p
     JOIN invoices i ON p.invoice_id = i.id
     WHERE i.company_id = $1 AND p.status = 'succeeded'`,
    [companyId]
  );

  return {
    totalInvoices: parseInt(row.total_invoices),
    totalOwed,
    totalRecovered,
    recoveryRate: totalAll > 0 ? Math.round((totalRecovered / totalAll) * 100) : 0,
    avgDaysToCollect: Math.round(parseFloat(avgResult.rows[0]?.avg_days || '0')),
    overdueCount: parseInt(row.overdue_count),
    overdueAmount: parseFloat(row.overdue_amount),
  };
}

export async function getInvoicePipeline(companyId: string): Promise<InvoicePipeline> {
  const result = await pool.query(
    `SELECT
       status,
       COUNT(*) as count,
       COALESCE(SUM(amount), 0) as total_amount
     FROM invoices
     WHERE company_id = $1
     GROUP BY status`,
    [companyId]
  );

  const pipeline: InvoicePipeline = {
    unpaid: 0, arranged: 0, disputed: 0, uncollectable: 0, paid: 0,
    unpaidAmount: 0, arrangedAmount: 0,
  };

  for (const row of result.rows) {
    const count = parseInt(row.count);
    const amount = parseFloat(row.total_amount);
    switch (row.status) {
      case 'unpaid':
        pipeline.unpaid = count;
        pipeline.unpaidAmount = amount;
        break;
      case 'arranged':
        pipeline.arranged = count;
        pipeline.arrangedAmount = amount;
        break;
      case 'disputed': pipeline.disputed = count; break;
      case 'uncollectable': pipeline.uncollectable = count; break;
      case 'paid': pipeline.paid = count; break;
    }
  }

  return pipeline;
}

export async function getCustomerRiskList(
  companyId: string,
  limit = 20
): Promise<CustomerRiskItem[]> {
  const result = await pool.query(
    `SELECT
       c.id as customer_id,
       c.name as customer_name,
       c.email as customer_email,
       COUNT(i.id) as unpaid_invoices,
       COALESCE(SUM(i.amount), 0) as total_owed,
       MAX(i.risk_score) as max_risk_score,
       COALESCE(MAX(EXTRACT(EPOCH FROM (NOW() - i.due_date)) / 86400), 0) as oldest_due_days
     FROM customers c
     JOIN invoices i ON i.customer_id = c.id
     WHERE c.company_id = $1
       AND i.status NOT IN ('paid', 'uncollectable')
       AND i.company_id = $1
     GROUP BY c.id, c.name, c.email
     ORDER BY max_risk_score DESC, total_owed DESC
     LIMIT $2`,
    [companyId, limit]
  );

  return result.rows.map(row => ({
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    unpaidInvoices: parseInt(row.unpaid_invoices),
    totalOwed: parseFloat(row.total_owed),
    maxRiskScore: parseInt(row.max_risk_score) || 0,
    oldestDueDays: Math.floor(parseFloat(row.oldest_due_days)),
  }));
}

// ─── New Analytics DB Functions ────────────────────────────────────────────

export async function getDashboardKpi(companyId: string): Promise<DashboardKpi> {
  // DSO: avg days from issue to payment
  const dsoResult = await pool.query(
    `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (p.paid_at - i.issued_date)) / 86400), 0) AS dso
     FROM payments p
     JOIN invoices i ON p.invoice_id = i.id
     WHERE i.company_id = $1 AND p.status = 'succeeded'`,
    [companyId]
  );
  const dso = Math.round(parseFloat(dsoResult.rows[0]?.dso || '0'));

  // CEI + Recovery Rate + Revenue at Risk
  const arResult = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'paid' AND due_date < NOW() THEN amount ELSE 0 END), 0) AS paid_overdue,
       COALESCE(SUM(CASE WHEN status != 'paid' AND due_date < NOW() THEN amount ELSE 0 END), 0) AS still_unpaid,
       COALESCE(SUM(CASE WHEN status NOT IN ('paid','uncollectable') AND risk_score >= 40 THEN amount ELSE 0 END), 0) AS at_risk_amount,
       COALESCE(SUM(amount), 0) AS total_amount
     FROM invoices WHERE company_id = $1`,
    [companyId]
  );
  const row = arResult.rows[0];
  const paidOverdue = parseFloat(row.paid_overdue);
  const stillUnpaid = parseFloat(row.still_unpaid);
  const totalOverdue = paidOverdue + stillUnpaid;
  const totalAmount = parseFloat(row.total_amount);
  const atRiskAmount = parseFloat(row.at_risk_amount);

  const recoveryRate = totalOverdue > 0 ? Math.round((paidOverdue / totalOverdue) * 100) : 0;
  const cei = totalAmount > 0 ? Math.round((paidOverdue / (paidOverdue + stillUnpaid || 1)) * 100) : 0;
  const revenueAtRiskPct = totalAmount > 0 ? parseFloat(((atRiskAmount / totalAmount) * 100).toFixed(1)) : 0;

  // Involuntary churn: customers with invoices gone uncollectable in last 30 days / total customers
  const churnResult = await pool.query(
    `SELECT
       COUNT(DISTINCT c.id) FILTER (
         WHERE i.status = 'uncollectable' AND i.updated_at > NOW() - INTERVAL '30 days'
       ) AS churned_customers,
       COUNT(DISTINCT c.id) AS total_customers
     FROM customers c
     LEFT JOIN invoices i ON i.customer_id = c.id AND i.company_id = $1
     WHERE c.company_id = $1`,
    [companyId]
  );
  const churnRow = churnResult.rows[0];
  const churnedCustomers = parseInt(churnRow.churned_customers || '0');
  const totalCustomers = parseInt(churnRow.total_customers || '0');
  const involuntaryChurnRate = totalCustomers > 0
    ? parseFloat(((churnedCustomers / totalCustomers) * 100).toFixed(1))
    : 0;

  // At-risk customer count (risk_score >= 40, unpaid)
  const atRiskResult = await pool.query(
    `SELECT COUNT(DISTINCT customer_id) AS at_risk_count
     FROM invoices
     WHERE company_id = $1 AND status NOT IN ('paid','uncollectable') AND risk_score >= 40`,
    [companyId]
  );
  const atRiskCustomerCount = parseInt(atRiskResult.rows[0]?.at_risk_count || '0');

  return {
    dso,
    cei,
    recoveryRate,
    revenueAtRisk: Math.round(atRiskAmount),
    revenueAtRiskPct,
    involuntaryChurnRate,
    atRiskCustomerCount,
    totalCustomers,
  };
}

export async function getAgingAnalysis(companyId: string): Promise<AgingAnalysis> {
  const result = await pool.query(
    `SELECT
       SUM(CASE WHEN due_date >= NOW() - INTERVAL '30 days' THEN amount ELSE 0 END) AS current_30,
       COUNT(CASE WHEN due_date >= NOW() - INTERVAL '30 days' THEN 1 END) AS current_30_count,
       SUM(CASE WHEN due_date < NOW() - INTERVAL '30 days' AND due_date >= NOW() - INTERVAL '60 days' THEN amount ELSE 0 END) AS days_31_60,
       COUNT(CASE WHEN due_date < NOW() - INTERVAL '30 days' AND due_date >= NOW() - INTERVAL '60 days' THEN 1 END) AS days_31_60_count,
       SUM(CASE WHEN due_date < NOW() - INTERVAL '60 days' AND due_date >= NOW() - INTERVAL '90 days' THEN amount ELSE 0 END) AS days_61_90,
       COUNT(CASE WHEN due_date < NOW() - INTERVAL '60 days' AND due_date >= NOW() - INTERVAL '90 days' THEN 1 END) AS days_61_90_count,
       SUM(CASE WHEN due_date < NOW() - INTERVAL '90 days' THEN amount ELSE 0 END) AS over_90,
       COUNT(CASE WHEN due_date < NOW() - INTERVAL '90 days' THEN 1 END) AS over_90_count
     FROM invoices
     WHERE company_id = $1 AND status IN ('unpaid', 'arranged')`,
    [companyId]
  );

  const r = result.rows[0];
  const current30 = parseFloat(r.current_30 || '0');
  const days3160 = parseFloat(r.days_31_60 || '0');
  const days6190 = parseFloat(r.days_61_90 || '0');
  const over90 = parseFloat(r.over_90 || '0');
  const totalAr = current30 + days3160 + days6190 + over90;

  const pct = (v: number) => totalAr > 0 ? parseFloat(((v / totalAr) * 100).toFixed(1)) : 0;

  return {
    totalAr,
    buckets: [
      { label: 'Current', days: '0–30d', amount: current30, invoiceCount: parseInt(r.current_30_count || '0'), pctOfTotal: pct(current30) },
      { label: '31–60 Days', days: '31–60d', amount: days3160, invoiceCount: parseInt(r.days_31_60_count || '0'), pctOfTotal: pct(days3160) },
      { label: '61–90 Days', days: '61–90d', amount: days6190, invoiceCount: parseInt(r.days_61_90_count || '0'), pctOfTotal: pct(days6190) },
      { label: '90+ Days', days: '90+d', amount: over90, invoiceCount: parseInt(r.over_90_count || '0'), pctOfTotal: pct(over90) },
    ],
  };
}

export async function getEmailAnalytics(companyId: string): Promise<EmailAnalytics> {
  const periodDays = 30;

  const totalResult = await pool.query(
    `SELECT
       COUNT(*) AS sent,
       COUNT(opened_at) AS opened,
       COUNT(clicked_at) AS clicked
     FROM email_logs
     WHERE company_id = $1 AND sent_at > NOW() - ($2 || ' days')::INTERVAL`,
    [companyId, periodDays]
  );

  const t = totalResult.rows[0];
  const sent = parseInt(t.sent || '0');
  const opened = parseInt(t.opened || '0');
  const clicked = parseInt(t.clicked || '0');
  const openRate = sent > 0 ? parseFloat(((opened / sent) * 100).toFixed(1)) : 0;
  const ctr = sent > 0 ? parseFloat(((clicked / sent) * 100).toFixed(1)) : 0;
  const ctor = opened > 0 ? parseFloat(((clicked / opened) * 100).toFixed(1)) : 0;

  const byTypeResult = await pool.query(
    `SELECT
       email_type,
       COUNT(*) AS sent,
       COUNT(opened_at) AS opened,
       COUNT(clicked_at) AS clicked
     FROM email_logs
     WHERE company_id = $1 AND sent_at > NOW() - ($2 || ' days')::INTERVAL
     GROUP BY email_type
     ORDER BY sent DESC`,
    [companyId, periodDays]
  );

  const byEmailType: EmailAnalyticsByType[] = byTypeResult.rows.map(row => {
    const s = parseInt(row.sent || '0');
    const o = parseInt(row.opened || '0');
    const c = parseInt(row.clicked || '0');
    return {
      type: row.email_type,
      sent: s,
      opened: o,
      clicked: c,
      openRate: s > 0 ? parseFloat(((o / s) * 100).toFixed(1)) : 0,
      ctr: s > 0 ? parseFloat(((c / s) * 100).toFixed(1)) : 0,
    };
  });

  return {
    period: `Last ${periodDays} days`,
    sent,
    opened,
    clicked,
    openRate,
    ctr,
    ctor,
    openRateBenchmark: 28,
    ctrBenchmark: 2.5,
    byEmailType,
  };
}

export async function getRiskDrivers(companyId: string): Promise<RiskDrivers> {
  const result = await pool.query(
    `SELECT
       COUNT(DISTINCT c.id) FILTER (
         WHERE c.payment_history->>'on_time_rate' IS NOT NULL
           AND (c.payment_history->>'on_time_rate')::numeric < 0.8
       ) AS failed_payment,
       COUNT(DISTINCT c.id) FILTER (
         WHERE c.card_expires_at IS NOT NULL AND c.card_expires_at < NOW() + INTERVAL '30 days'
       ) AS expiring_card,
       COUNT(DISTINCT c.id) FILTER (
         WHERE c.last_activity_at IS NOT NULL AND c.last_activity_at < NOW() - INTERVAL '21 days'
       ) AS inactivity,
       COUNT(DISTINCT i.customer_id) FILTER (
         WHERE i.last_decline_type = 'hard'
       ) AS hard_decline
     FROM customers c
     LEFT JOIN invoices i ON i.customer_id = c.id AND i.company_id = $1
     WHERE c.company_id = $1`,
    [companyId]
  );

  const r = result.rows[0];
  const failedPayment = parseInt(r.failed_payment || '0');
  const expiringCard = parseInt(r.expiring_card || '0');
  const inactivity = parseInt(r.inactivity || '0');
  const hardDecline = parseInt(r.hard_decline || '0');

  return {
    failedPayment,
    expiringCard,
    inactivity,
    hardDecline,
    total: failedPayment + expiringCard + inactivity + hardDecline,
  };
}

export async function getPaymentPlansSummary(companyId: string): Promise<PaymentPlansSummary> {
  // Get payment plan counts and metrics
  const statsResult = await pool.query(
    `SELECT
       COUNT(CASE WHEN status = 'active' THEN 1 END) as active_plans,
       COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_plans,
       COUNT(CASE WHEN status = 'failed' THEN 1 END) as defaulted_plans,
       COUNT(*) as total_plans,
       COALESCE(SUM(CASE WHEN status = 'active' THEN original_amount ELSE 0 END), 0) as total_value_active
     FROM payment_plans
     WHERE company_id = $1`,
    [companyId]
  );

  // Count plans offered (pending + accepted + active + completed + failed)
  const offersResult = await pool.query(
    `SELECT COUNT(*) AS offers_sent
     FROM payment_plans
     WHERE company_id = $1`,
    [companyId]
  );

  const stats = statsResult.rows[0];
  const activePlans = parseInt(stats.active_plans, 10);
  const completedPlans = parseInt(stats.completed_plans, 10);
  const defaultedPlans = parseInt(stats.defaulted_plans, 10);
  const totalPlans = parseInt(stats.total_plans, 10);
  const totalOffered = parseInt(offersResult.rows[0]?.offers_sent || '0');

  // Calculate acceptance rate (plans accepted or further along / total offered)
  const acceptanceResult = await pool.query(
    `SELECT COUNT(*) as accepted_count
     FROM payment_plans
     WHERE company_id = $1 AND status IN ('accepted', 'active', 'completed')`,
    [companyId]
  );
  const acceptedCount = parseInt(acceptanceResult.rows[0]?.accepted_count || '0');
  const acceptanceRate = totalOffered > 0
    ? Math.round((acceptedCount / totalOffered) * 100)
    : totalPlans > 0 ? 100 : 0;

  // Calculate completion rate
  const completionRate = (activePlans + completedPlans) > 0
    ? Math.round((completedPlans / (activePlans + completedPlans)) * 100)
    : 0;

  // Get recent plans with charge counts
  const recentResult = await pool.query(
    `SELECT
       pp.id,
       pp.status,
       pp.original_amount,
       pp.installment_count,
       c.name AS customer_name,
       (SELECT COUNT(*) FROM payment_plan_charges WHERE plan_id = pp.id AND status = 'charged') as charges_paid
     FROM payment_plans pp
     JOIN customers c ON c.id = pp.customer_id
     WHERE pp.company_id = $1
     ORDER BY pp.created_at DESC
     LIMIT 5`,
    [companyId]
  );

  const recentPlans: PaymentPlanSummaryItem[] = recentResult.rows.map(p => ({
    planId: p.id,
    customerName: p.customer_name,
    totalAmount: parseFloat(p.original_amount),
    status: p.status,
    installmentsTotal: p.installment_count,
    installmentsPaid: parseInt(p.charges_paid, 10),
    pctComplete: p.installment_count > 0
      ? Math.round((parseInt(p.charges_paid, 10) / p.installment_count) * 100)
      : 0
  }));

  return {
    activePlans,
    completedPlans,
    defaultedPlans,
    totalOffered,
    acceptanceRate,
    completionRate,
    totalValueActive: parseFloat(stats.total_value_active),
    recentPlans,
  };
}

// ─── Financial Operations Agent — new query functions ─────────────────────────

export interface WorkingCapitalFreedData {
  recoveredAR: number;
  billingErrorsConfirmed: number;
  total: number;
  period: string;
}

/**
 * Total working capital freed in the last 30 days:
 * AR recovered (payments.succeeded) + billing anomalies confirmed.
 */
export async function getWorkingCapitalFreed(companyId: string): Promise<WorkingCapitalFreedData> {
  const { rows } = await pool.query<{ recovered_30d: string; billing_confirmed_30d: string }>(
    `SELECT
       COALESCE((
         SELECT SUM(p.amount)
         FROM payments p
         JOIN invoices i ON p.invoice_id = i.id
         WHERE i.company_id = $1
           AND p.status = 'succeeded'
           AND p.paid_at >= NOW() - INTERVAL '30 days'
       ), 0) AS recovered_30d,
       COALESCE((
         SELECT SUM(estimated_impact_usd)
         FROM billing_anomalies
         WHERE company_id = $1
           AND status = 'confirmed'
           AND reviewed_at >= NOW() - INTERVAL '30 days'
       ), 0) AS billing_confirmed_30d`,
    [companyId]
  );

  const recoveredAR = Math.round(parseFloat(rows[0]?.recovered_30d ?? '0') * 100) / 100;
  const billingErrorsConfirmed = Math.round(parseFloat(rows[0]?.billing_confirmed_30d ?? '0') * 100) / 100;

  return {
    recoveredAR,
    billingErrorsConfirmed,
    total: Math.round((recoveredAR + billingErrorsConfirmed) * 100) / 100,
    period: 'Last 30 days',
  };
}

export interface DSOReductionData {
  currentDSO: number;
  historicalDSO: number;
  reductionDays: number;
  trend: 'improving' | 'stable' | 'worsening';
}

/**
 * DSO reduction: compare current avg days-to-collect vs. 30-60 days ago.
 * Positive reductionDays = improvement (DSO went down).
 */
export async function getDSOReduction(companyId: string): Promise<DSOReductionData> {
  const [currentRes, historicalRes] = await Promise.all([
    pool.query<{ dso: string }>(
      `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (p.paid_at - i.issued_date)) / 86400), 0) AS dso
       FROM payments p
       JOIN invoices i ON p.invoice_id = i.id
       WHERE i.company_id = $1
         AND p.status = 'succeeded'
         AND p.paid_at >= NOW() - INTERVAL '30 days'`,
      [companyId]
    ),
    pool.query<{ dso: string }>(
      `SELECT COALESCE(AVG(avg_days_to_collect), 0) AS dso
       FROM recovery_timeline
       WHERE company_id = $1
         AND period_type = 'daily'
         AND period_date BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days'`,
      [companyId]
    ),
  ]);

  const currentDSO = Math.round(parseFloat(currentRes.rows[0]?.dso ?? '0'));
  const historicalDSO = Math.round(parseFloat(historicalRes.rows[0]?.dso ?? '0'));
  const reductionDays = historicalDSO - currentDSO; // positive = improved

  let trend: DSOReductionData['trend'];
  if (reductionDays >= 2) trend = 'improving';
  else if (reductionDays <= -2) trend = 'worsening';
  else trend = 'stable';

  return { currentDSO, historicalDSO, reductionDays, trend };
}

export interface BillingAnomalyRow {
  id: string;
  anomalyType: string;
  severity: string;
  description: string;
  estimatedImpactUsd: number;
  status: string;
  customerName: string | null;
  invoiceAmount: number | null;
  detectedAt: string;
}

/**
 * Fetch billing anomalies for a company, ordered by severity then date.
 * Optional status filter ('pending' | 'confirmed' | 'dismissed').
 */
export async function getBillingAnomalies(
  companyId: string,
  status?: string
): Promise<BillingAnomalyRow[]> {
  const { rows } = await pool.query<{
    id: string;
    anomaly_type: string;
    severity: string;
    description: string;
    estimated_impact_usd: string;
    status: string;
    customer_name: string | null;
    invoice_amount: string | null;
    detected_at: string;
  }>(
    `SELECT
       ba.id,
       ba.anomaly_type,
       ba.severity,
       ba.description,
       ba.estimated_impact_usd,
       ba.status,
       c.name   AS customer_name,
       i.amount AS invoice_amount,
       ba.detected_at
     FROM billing_anomalies ba
     LEFT JOIN customers c ON ba.customer_id = c.id AND c.company_id = $1
     LEFT JOIN invoices  i ON ba.invoice_id  = i.id AND i.company_id = $1
     WHERE ba.company_id = $1
       AND ($2::text IS NULL OR ba.status = $2)
     ORDER BY
       CASE ba.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
       ba.detected_at DESC
     LIMIT 50`,
    [companyId, status ?? null]
  );

  return rows.map((r) => ({
    id: r.id,
    anomalyType: r.anomaly_type,
    severity: r.severity,
    description: r.description,
    estimatedImpactUsd: Math.round(parseFloat(r.estimated_impact_usd ?? '0') * 100) / 100,
    status: r.status,
    customerName: r.customer_name ?? null,
    invoiceAmount: r.invoice_amount != null ? parseFloat(r.invoice_amount) : null,
    detectedAt: r.detected_at,
  }));
}
