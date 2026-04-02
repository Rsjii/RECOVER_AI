import { pool } from '../config/database';

export interface BillingDataRow {
  totalRevenue: number;
  mrrTotal: number;
  activeSubscriptions: number;
  churnRate: number;
  recentInvoices: Array<{
    id: string;
    companyName: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
}

/**
 * Get billing overview data for admin dashboard
 */
export async function getBillingOverview(): Promise<{
  totalRevenue: number;
  activeSubscriptions: number;
  mrrTotal: number;
  churnRate: number;
  trialCount: number;
  paidCount: number;
}> {
  const result = await pool.query(`
    SELECT
      COALESCE(SUM(CASE WHEN bi.status = 'paid' THEN bi.base_amount_usd ELSE 0 END), 0)::numeric as total_revenue,
      COUNT(DISTINCT CASE WHEN s.status = 'active' THEN c.id END)::int as active_subscriptions,
      COALESCE(SUM(CASE WHEN s.status = 'active' THEN bi.base_amount_usd ELSE 0 END), 0)::numeric as mrr_total,
      COUNT(DISTINCT CASE WHEN c.account_type = 'trial' THEN c.id END)::int as trial_count,
      COUNT(DISTINCT CASE WHEN c.account_type = 'paid' THEN c.id END)::int as paid_count
    FROM companies c
    LEFT JOIN subscriptions s ON c.id = s.company_id
    LEFT JOIN billing_invoices bi ON c.id = bi.company_id AND bi.status = 'paid'
  `);

  const row = result.rows[0] || {};
  const activeSubscriptions = row.active_subscriptions || 0;
  const prevActiveSubscriptions = activeSubscriptions + 1; // Mock churn for demo

  return {
    totalRevenue: parseFloat(row.total_revenue) || 0,
    activeSubscriptions,
    mrrTotal: parseFloat(row.mrr_total) || 0,
    churnRate: activeSubscriptions > 0 ? ((1 / prevActiveSubscriptions) * 100) : 0,
    trialCount: row.trial_count || 0,
    paidCount: row.paid_count || 0,
  };
}

/**
 * Get recent billing invoices for admin dashboard
 */
export async function getRecentInvoices(limit: number = 10): Promise<any[]> {
  const result = await pool.query(
    `SELECT
      bi.id,
      c.name as company_name,
      bi.base_amount_usd as amount,
      bi.status,
      bi.created_at
    FROM billing_invoices bi
    JOIN companies c ON bi.company_id = c.id
    ORDER BY bi.created_at DESC
    LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Get billing stats by company
 */
export async function getBillingByCompany(companyId: string): Promise<{
  totalSpent: number;
  activeSubscription: boolean;
  subscriptionStatus: string;
  mrr: number;
  lastPaymentDate: string | null;
  nextPaymentDate: string | null;
}> {
  const result = await pool.query(
    `SELECT
      COALESCE(SUM(CASE WHEN bi.status = 'paid' THEN bi.base_amount_usd ELSE 0 END), 0)::numeric as total_spent,
      COALESCE((SELECT status FROM subscriptions WHERE company_id = $1 LIMIT 1), 'none') as sub_status,
      COALESCE((SELECT base_amount_usd FROM billing_invoices WHERE company_id = $1 AND status = 'paid' ORDER BY created_at DESC LIMIT 1), 0)::numeric as mrr,
      COALESCE((SELECT created_at FROM billing_invoices WHERE company_id = $1 AND status = 'paid' ORDER BY created_at DESC LIMIT 1), null) as last_payment_date,
      COALESCE((SELECT next_billing_date FROM subscriptions WHERE company_id = $1 LIMIT 1), null) as next_payment_date
    FROM billing_invoices
    WHERE company_id = $1`,
    [companyId]
  );

  const row = result.rows[0] || {};
  return {
    totalSpent: parseFloat(row.total_spent) || 0,
    activeSubscription: row.sub_status === 'active',
    subscriptionStatus: row.sub_status || 'none',
    mrr: parseFloat(row.mrr) || 0,
    lastPaymentDate: row.last_payment_date ? new Date(row.last_payment_date).toISOString() : null,
    nextPaymentDate: row.next_payment_date ? new Date(row.next_payment_date).toISOString() : null,
  };
}
