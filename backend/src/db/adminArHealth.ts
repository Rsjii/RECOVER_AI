import { pool } from '../config/database';

export interface ArHealthData {
  total_ar: number;
  recovered: number;
  recovery_rate: number;
  avg_dso: number;
  overdue_count: number;
  invoices_by_status: Record<string, number>;
  aging_buckets: {
    current: number;
    days_0_30: number;
    days_31_60: number;
    days_61_90: number;
    days_90_plus: number;
  };
  dunning_stage_distribution: Record<string, number>;
  recovery_rate_12m: { month: string; recovery_rate: number }[];
  avg_collection_time_by_bucket: Record<string, number>;
  most_at_risk_customer: { name: string; email: string; ar_amount: number } | null;
  largest_overdue_invoice: { id: string; customer: string; amount: number; days_overdue: number } | null;
}

export async function getArHealth(companyId: string): Promise<ArHealthData> {
  // Get main AR metrics
  const metricsResult = await pool.query(`
    SELECT
      COALESCE(SUM(amount_due), 0)::numeric AS total_ar,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_paid ELSE 0 END), 0)::numeric AS recovered,
      COUNT(CASE WHEN status = 'overdue' THEN 1 END)::int AS overdue_count,
      AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400)::int AS avg_dso
    FROM invoices
    WHERE company_id = $1
  `, [companyId]);

  const metrics = metricsResult.rows[0] || { total_ar: 0, recovered: 0, overdue_count: 0, avg_dso: 0 };
  const total_ar = parseFloat(metrics.total_ar) || 0;
  const recovered = parseFloat(metrics.recovered) || 0;
  const recovery_rate = total_ar > 0 ? (recovered / total_ar) * 100 : 0;

  // Get invoices by status
  const statusResult = await pool.query(`
    SELECT status, COUNT(*)::int as count
    FROM invoices
    WHERE company_id = $1
    GROUP BY status
  `, [companyId]);

  const invoices_by_status: Record<string, number> = {};
  statusResult.rows.forEach(row => {
    invoices_by_status[row.status] = row.count;
  });

  // Get aging buckets
  const agingResult = await pool.query(`
    SELECT
      COUNT(CASE WHEN EXTRACT(EPOCH FROM (NOW() - due_date)) / 86400 <= 0 THEN 1 END)::int AS current,
      COUNT(CASE WHEN EXTRACT(EPOCH FROM (NOW() - due_date)) / 86400 > 0 AND EXTRACT(EPOCH FROM (NOW() - due_date)) / 86400 <= 30 THEN 1 END)::int AS days_0_30,
      COUNT(CASE WHEN EXTRACT(EPOCH FROM (NOW() - due_date)) / 86400 > 30 AND EXTRACT(EPOCH FROM (NOW() - due_date)) / 86400 <= 60 THEN 1 END)::int AS days_31_60,
      COUNT(CASE WHEN EXTRACT(EPOCH FROM (NOW() - due_date)) / 86400 > 60 AND EXTRACT(EPOCH FROM (NOW() - due_date)) / 86400 <= 90 THEN 1 END)::int AS days_61_90,
      COUNT(CASE WHEN EXTRACT(EPOCH FROM (NOW() - due_date)) / 86400 > 90 THEN 1 END)::int AS days_90_plus
    FROM invoices
    WHERE company_id = $1 AND status NOT IN ('paid', 'void')
  `, [companyId]);

  const aging = agingResult.rows[0] || {};
  const aging_buckets = {
    current: aging.current || 0,
    days_0_30: aging.days_0_30 || 0,
    days_31_60: aging.days_31_60 || 0,
    days_61_90: aging.days_61_90 || 0,
    days_90_plus: aging.days_90_plus || 0,
  };

  // Get dunning stage distribution
  const dunningResult = await pool.query(`
    SELECT dunning_stage, COUNT(*)::int as count
    FROM customers
    WHERE company_id = $1
    GROUP BY dunning_stage
  `, [companyId]);

  const dunning_stage_distribution: Record<string, number> = {};
  dunningResult.rows.forEach(row => {
    dunning_stage_distribution[row.dunning_stage || 'none'] = row.count;
  });

  // Get most at-risk customer
  const atRiskResult = await pool.query(`
    SELECT c.company_name, c.email, COALESCE(SUM(i.amount_due), 0)::numeric as ar_amount
    FROM customers c
    LEFT JOIN invoices i ON c.id = i.customer_id AND i.status NOT IN ('paid', 'void')
    WHERE c.company_id = $1
    GROUP BY c.id, c.company_name, c.email
    ORDER BY ar_amount DESC
    LIMIT 1
  `, [companyId]);

  const most_at_risk_customer = atRiskResult.rows[0] ? {
    name: atRiskResult.rows[0].name,
    email: atRiskResult.rows[0].email,
    ar_amount: parseFloat(atRiskResult.rows[0].ar_amount) || 0,
  } : null;

  // Get largest overdue invoice
  const largestResult = await pool.query(`
    SELECT i.id, c.company_name as customer, i.amount_due::numeric,
           EXTRACT(EPOCH FROM (NOW() - i.due_date)) / 86400 as days_overdue
    FROM invoices i
    LEFT JOIN customers c ON i.customer_id = c.id
    WHERE i.company_id = $1 AND i.status = 'overdue'
    ORDER BY i.amount_due DESC
    LIMIT 1
  `, [companyId]);

  const largest_overdue_invoice = largestResult.rows[0] ? {
    id: largestResult.rows[0].id,
    customer: largestResult.rows[0].customer || 'Unknown',
    amount: parseFloat(largestResult.rows[0].amount_due) || 0,
    days_overdue: Math.floor(largestResult.rows[0].days_overdue || 0),
  } : null;

  // Get 12-month recovery rate trend
  const recoveryTrendResult = await pool.query(`
    SELECT
      TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_paid ELSE 0 END), 0)::numeric /
      NULLIF(COALESCE(SUM(amount_due), 0)::numeric, 0) * 100 as recovery_rate
    FROM invoices
    WHERE company_id = $1 AND created_at > NOW() - INTERVAL '12 months'
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY month
  `, [companyId]);

  const recovery_rate_12m = recoveryTrendResult.rows.map(row => ({
    month: row.month,
    recovery_rate: Math.round(parseFloat(row.recovery_rate) || 0),
  }));

  // Get average collection time by bucket (invoices that are NOW paid)
  const collectionTimeResult = await pool.query(`
    SELECT
      CASE
        WHEN i.amount_due < 10000 THEN '<$10k'
        WHEN i.amount_due < 50000 THEN '$10-50k'
        WHEN i.amount_due < 100000 THEN '$50-100k'
        ELSE '$100k+'
      END as bucket,
      AVG(EXTRACT(EPOCH FROM (i.paid_at - i.due_date)) / 86400)::int as avg_days
    FROM invoices i
    WHERE i.company_id = $1 AND i.status = 'paid' AND i.paid_at IS NOT NULL AND i.due_date IS NOT NULL
    GROUP BY bucket
  `, [companyId]);

  const avg_collection_time_by_bucket: Record<string, number> = {};
  collectionTimeResult.rows.forEach(row => {
    avg_collection_time_by_bucket[row.bucket] = row.avg_days || 0;
  });

  return {
    total_ar,
    recovered,
    recovery_rate: Math.round(recovery_rate * 100) / 100,
    avg_dso: metrics.avg_dso || 0,
    overdue_count: metrics.overdue_count || 0,
    invoices_by_status,
    aging_buckets,
    dunning_stage_distribution,
    recovery_rate_12m,
    avg_collection_time_by_bucket,
    most_at_risk_customer,
    largest_overdue_invoice,
  };
}

export async function getCompanyCustomers(
  companyId: string,
  options: { limit?: number; offset?: number; search?: string; riskScoreMin?: number; arMin?: number } = {}
) {
  const limit = Math.min(options.limit || 50, 500);
  const offset = options.offset || 0;
  const params: unknown[] = [companyId];
  const conditions = ['c.company_id = $1'];

  if (options.search) {
    params.push(`%${options.search}%`);
    conditions.push(`(c.company_name ILIKE $${params.length} OR c.email ILIKE $${params.length - 1})`);
  }

  const where = conditions.join(' AND ');
  params.push(limit, offset);

  const result = await pool.query(`
    SELECT
      c.id, c.company_name, c.email, c.risk_score,
      COALESCE(SUM(i.amount_due), 0)::numeric as total_ar,
      COUNT(CASE WHEN i.status = 'overdue' THEN 1 END)::int as overdue_count,
      c.dunning_stage,
      MAX(el.sent_at) as last_contact
    FROM customers c
    LEFT JOIN invoices i ON c.id = i.customer_id AND i.status NOT IN ('paid', 'void')
    LEFT JOIN email_logs el ON c.id = el.customer_id
    WHERE ${where}
    GROUP BY c.id, c.company_name, c.email, c.risk_score, c.dunning_stage
    ORDER BY COALESCE(SUM(i.amount_due), 0) DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);

  return result.rows;
}

export async function getCompanyInvoicesDetailed(
  companyId: string,
  options: { limit?: number; offset?: number; status?: string; daysOverdueMin?: number } = {}
) {
  const limit = Math.min(options.limit || 50, 500);
  const offset = options.offset || 0;
  const params: unknown[] = [companyId];
  const conditions = ['i.company_id = $1'];

  if (options.status) {
    params.push(options.status);
    conditions.push(`i.status = $${params.length}`);
  }

  const where = conditions.join(' AND ');
  params.push(limit, offset);

  const result = await pool.query(`
    SELECT
      i.id, i.invoice_number, c.company_name as customer, i.amount_due::numeric,
      i.due_date, i.status,
      EXTRACT(EPOCH FROM (NOW() - i.due_date)) / 86400 as days_overdue,
      c.dunning_stage
    FROM invoices i
    LEFT JOIN customers c ON i.customer_id = c.id
    WHERE ${where}
    ORDER BY i.due_date ASC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);

  return result.rows;
}
