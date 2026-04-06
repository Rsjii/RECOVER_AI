import { pool } from '../config/database';

export interface AdminCompanyRow {
  id: string;
  name: string;
  account_type: string;
  billing_tier: string;
  trial_status: string | null;
  trial_ends_at: string | null;
  created_at: string;
  user_count: number;
  customer_count: number;
  invoice_count: number;
  total_ar: number;
  recovered_ar: number;
  email_count: number;
  has_stripe: boolean;
  stripe_account_id: string | null;
  last_activity: string | null;
}

export interface AdminCompanyDetail {
  id: string;
  name: string;
  account_type: string;
  billing_tier: string;
  trial_status: string | null;
  trial_ends_at: string | null;
  trial_started_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  created_at: string;
  last_login: string | null;
}

export interface CompanyInvoiceSummary {
  total_invoices: number;
  total_ar: number;
  recovered_ar: number;
  pending_ar: number;
  overdue_count: number;
  avg_days_overdue: number;
}

export interface CompanyEmailSummary {
  total_sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  last_sent: string | null;
}

export interface CompanyStripeAccount {
  id: string;
  stripe_account_id: string;
  label: string | null;
  connection_type: string;
  is_active: boolean;
  connected_at: string;
  last_synced_at: string | null;
}

export interface CompanyActivityLog {
  id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, any>;
  created_at: string;
}

/**
 * Get all companies with aggregated stats for admin list view
 */
export async function getAdminCompanyList(options: {
  limit?: number;
  offset?: number;
  search?: string;
  accountType?: string;
  hasStripe?: boolean;
} = {}): Promise<{ companies: AdminCompanyRow[]; total: number }> {
  const limit = Math.min(options.limit || 50, 200);
  const offset = options.offset || 0;
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (options.search) {
    params.push(`%${options.search}%`);
    conditions.push(`c.name ILIKE $${params.length}`);
  }
  if (options.accountType) {
    params.push(options.accountType);
    conditions.push(`c.account_type = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(
    `SELECT COUNT(*)::int as count FROM companies c ${where}`,
    params
  );
  const total = countResult.rows[0]?.count || 0;

  params.push(limit, offset);
  const result = await pool.query(
    `SELECT
      c.id,
      c.name,
      c.account_type,
      c.billing_tier,
      c.trial_status,
      c.trial_ends_at,
      c.created_at,
      COALESCE(u_stats.user_count, 0)::int AS user_count,
      COALESCE(cust_stats.customer_count, 0)::int AS customer_count,
      COALESCE(inv_stats.invoice_count, 0)::int AS invoice_count,
      COALESCE(inv_stats.total_ar, 0)::numeric AS total_ar,
      COALESCE(inv_stats.recovered_ar, 0)::numeric AS recovered_ar,
      COALESCE(email_stats.email_count, 0)::int AS email_count,
      false AS has_stripe,
      null AS stripe_account_id,
      el_stats.last_activity
    FROM companies c
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS user_count FROM users WHERE company_id = c.id AND is_active = true
    ) u_stats ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS customer_count FROM customers WHERE company_id = c.id
    ) cust_stats ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COUNT(i.id)::int AS invoice_count,
        COALESCE(SUM(i.amount), 0)::numeric AS total_ar,
        COALESCE(SUM(p.amount), 0)::numeric AS recovered_ar
      FROM invoices i
      LEFT JOIN payments p ON i.id = p.invoice_id AND p.status = 'completed'
      WHERE i.company_id = c.id
    ) inv_stats ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS email_count FROM email_logs WHERE company_id = c.id
    ) email_stats ON TRUE
    LEFT JOIN LATERAL (
      SELECT MAX(created_at) AS last_activity FROM event_logs WHERE company_id = c.id
    ) el_stats ON TRUE
    ${where}
    ORDER BY c.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { companies: result.rows, total };
}

/**
 * Get full company detail
 */
export async function getAdminCompanyDetail(companyId: string): Promise<AdminCompanyDetail | null> {
  const result = await pool.query(
    `SELECT id, name, account_type, billing_tier, trial_status, trial_ends_at, created_at, created_at as trial_started_at, updated_at
     FROM companies WHERE id = $1`,
    [companyId]
  );
  return result.rows[0] || null;
}

/**
 * Get users for a company
 */
export async function getAdminCompanyUsers(companyId: string): Promise<CompanyUser[]> {
  const result = await pool.query(
    `SELECT id, email, first_name, last_name, role, created_at, last_login
     FROM users WHERE company_id = $1 AND is_active = true ORDER BY created_at`,
    [companyId]
  );
  return result.rows;
}

/**
 * Get invoice summary for a company
 */
export async function getAdminCompanyInvoiceSummary(companyId: string): Promise<CompanyInvoiceSummary> {
  const result = await pool.query(
    `WITH invoice_stats AS (
       SELECT
         i.id,
         i.amount,
         i.due_date,
         COALESCE(SUM(p.amount), 0) as paid_amount
       FROM invoices i
       LEFT JOIN payments p ON i.id = p.invoice_id AND p.status = 'completed'
       WHERE i.company_id = $1
       GROUP BY i.id, i.amount, i.due_date
     )
     SELECT
       COUNT(*)::int AS total_invoices,
       COALESCE(SUM(amount), 0)::numeric AS total_ar,
       COALESCE(SUM(paid_amount), 0)::numeric AS recovered_ar,
       COALESCE(SUM(amount - paid_amount), 0)::numeric AS pending_ar,
       COUNT(CASE WHEN due_date < NOW() AND paid_amount < amount THEN 1 END)::int AS overdue_count,
       COALESCE(AVG(CASE WHEN due_date < NOW() THEN EXTRACT(EPOCH FROM (NOW() - due_date)) / 86400 END), 0)::int AS avg_days_overdue
     FROM invoice_stats`,
    [companyId]
  );
  return result.rows[0] || { total_invoices: 0, total_ar: 0, recovered_ar: 0, pending_ar: 0, overdue_count: 0, avg_days_overdue: 0 };
}

/**
 * Get email sending summary for a company
 */
export async function getAdminCompanyEmailSummary(companyId: string): Promise<CompanyEmailSummary> {
  const result = await pool.query(
    `SELECT
      COUNT(*)::int AS total_sent,
      COUNT(CASE WHEN status = 'delivered' THEN 1 END)::int AS delivered,
      COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)::int AS opened,
      COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END)::int AS clicked,
      COUNT(CASE WHEN status = 'bounced' THEN 1 END)::int AS bounced,
      MAX(sent_at) AS last_sent
     FROM email_logs WHERE company_id = $1`,
    [companyId]
  );
  return result.rows[0] || { total_sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, last_sent: null };
}

/**
 * Get Stripe accounts for a company
 */
export async function getAdminCompanyStripeAccounts(companyId: string): Promise<CompanyStripeAccount[]> {
  // stripe_accounts table doesn't exist yet - return empty array
  // TODO: implement once stripe_accounts table is created
  return [];
}

/**
 * Get recent activity logs for a company
 */
export async function getAdminCompanyActivity(companyId: string, limit = 50): Promise<CompanyActivityLog[]> {
  const result = await pool.query(
    `SELECT id, user_email, action, resource_type, resource_id, details, created_at
     FROM event_logs WHERE company_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [companyId, limit]
  );
  return result.rows;
}

/**
 * Update company account_type or billing_tier (admin override)
 */
export async function updateAdminCompany(companyId: string, updates: {
  account_type?: string;
  billing_tier?: string;
  trial_status?: string;
  trial_ends_at?: string | null;
}): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.account_type !== undefined) {
    params.push(updates.account_type);
    sets.push(`account_type = $${params.length}`);
  }
  if (updates.billing_tier !== undefined) {
    params.push(updates.billing_tier);
    sets.push(`billing_tier = $${params.length}`);
  }
  if (updates.trial_status !== undefined) {
    params.push(updates.trial_status);
    sets.push(`trial_status = $${params.length}`);
  }
  if (updates.trial_ends_at !== undefined) {
    params.push(updates.trial_ends_at);
    sets.push(`trial_ends_at = $${params.length}`);
  }

  if (sets.length === 0) return;

  params.push(companyId);
  await pool.query(
    `UPDATE companies SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
    params
  );
}
