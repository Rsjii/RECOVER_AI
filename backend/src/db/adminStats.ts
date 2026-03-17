import { pool } from '../config/database';
import { ApiUsageSummaryRow } from './apiUsage';

export interface PlatformCompanyStats {
  total: number;
  active: number;
  trialing: number;
  canceled: number;
  pastDue: number;
}

export interface RecentCompany {
  id: string;
  name: string;
  email: string;
  subscription_status: string;
  created_at: string;
}

export interface PlatformUserStats {
  total: number;
  active7d: number;
  active30d: number;
}

export interface PlatformEmailStats {
  sent: number;
  opened: number;
  clicked: number;
  failed: number;
  bounced: number;
  byType: { email_type: string; count: number }[];
}

export interface TopCompanyByCost {
  company_name: string;
  company_email: string;
  total_cost: string;
  total_calls: number;
}

export interface PlatformRevenue {
  totalBilled: number;
  paidCount: number;
}

/**
 * Company counts by subscription status (all companies, no company_id filter).
 */
export async function getPlatformCompanyStats(): Promise<PlatformCompanyStats> {
  const result = await pool.query(`
    SELECT
      COUNT(*)::int                                                          AS total,
      COUNT(*) FILTER (WHERE subscription_status = 'active')::int           AS active,
      COUNT(*) FILTER (WHERE subscription_status = 'trialing')::int         AS trialing,
      COUNT(*) FILTER (WHERE subscription_status = 'canceled')::int         AS canceled,
      COUNT(*) FILTER (WHERE subscription_status = 'past_due')::int         AS past_due
    FROM companies
  `);
  const row = result.rows[0] || {};
  return {
    total: row.total ?? 0,
    active: row.active ?? 0,
    trialing: row.trialing ?? 0,
    canceled: row.canceled ?? 0,
    pastDue: row.past_due ?? 0,
  };
}

/**
 * Most recently signed-up companies.
 */
export async function getRecentCompanies(limit = 10): Promise<RecentCompany[]> {
  const result = await pool.query(
    `SELECT id, name, email, subscription_status, created_at
     FROM companies
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Platform-wide user activity stats.
 */
export async function getPlatformUserStats(): Promise<PlatformUserStats> {
  const result = await pool.query(`
    SELECT
      COUNT(*)::int                                                              AS total,
      COUNT(*) FILTER (WHERE last_login > NOW() - interval '7 days')::int       AS active_7d,
      COUNT(*) FILTER (WHERE last_login > NOW() - interval '30 days')::int      AS active_30d
    FROM users
  `);
  const row = result.rows[0] || {};
  return {
    total: row.total ?? 0,
    active7d: row.active_7d ?? 0,
    active30d: row.active_30d ?? 0,
  };
}

/**
 * Platform-wide email funnel stats + breakdown by email type.
 */
export async function getPlatformEmailStats(): Promise<PlatformEmailStats> {
  const [statusResult, typeResult] = await Promise.all([
    pool.query(`SELECT status, COUNT(*)::int AS count FROM email_logs GROUP BY status`),
    pool.query(`SELECT email_type, COUNT(*)::int AS count FROM email_logs GROUP BY email_type ORDER BY count DESC`),
  ]);

  const stats: PlatformEmailStats = { sent: 0, opened: 0, clicked: 0, failed: 0, bounced: 0, byType: [] };

  for (const row of statusResult.rows) {
    const s = row.status as string;
    if (s === 'sent' || s === 'delivered') stats.sent += row.count;
    else if (s === 'opened')  stats.opened  = row.count;
    else if (s === 'clicked') stats.clicked = row.count;
    else if (s === 'failed')  stats.failed  = row.count;
    else if (s === 'bounced') stats.bounced = row.count;
  }

  stats.byType = typeResult.rows;
  return stats;
}

/**
 * Platform API usage grouped by service and month (all companies summed).
 */
export async function getPlatformApiUsageSummary(
  fromPeriod: Date,
  toPeriod: Date
): Promise<ApiUsageSummaryRow[]> {
  const result = await pool.query(
    `SELECT
       service,
       period,
       SUM(usage_count)::int        AS usage_count,
       SUM(cost_usd)::numeric       AS cost_usd,
       SUM(input_tokens)::bigint    AS input_tokens,
       SUM(output_tokens)::bigint   AS output_tokens
     FROM api_usage_tracking
     WHERE period >= $1 AND period <= $2
     GROUP BY service, period
     ORDER BY period DESC, service`,
    [fromPeriod, toPeriod]
  );
  return result.rows;
}

/**
 * Top companies ranked by total AI cost in a given period.
 */
export async function getTopCompaniesByCost(
  fromPeriod: Date,
  limit = 20
): Promise<TopCompanyByCost[]> {
  const result = await pool.query(
    `SELECT
       c.name  AS company_name,
       c.email AS company_email,
       SUM(a.cost_usd)::numeric   AS total_cost,
       SUM(a.usage_count)::int    AS total_calls
     FROM api_usage_tracking a
     JOIN companies c ON a.company_id = c.id
     WHERE a.period >= $1
     GROUP BY c.id, c.name, c.email
     ORDER BY total_cost DESC
     LIMIT $2`,
    [fromPeriod, limit]
  );
  return result.rows;
}

/**
 * Total revenue from paid billing invoices.
 */
export async function getPlatformRevenue(): Promise<PlatformRevenue> {
  const result = await pool.query(`
    SELECT
      COALESCE(SUM(total_amount_usd), 0)::numeric AS total_billed,
      COUNT(*)::int                               AS paid_count
    FROM billing_invoices
    WHERE status = 'paid'
  `);
  const row = result.rows[0] || {};
  return {
    totalBilled: parseFloat(row.total_billed) || 0,
    paidCount: row.paid_count ?? 0,
  };
}

/**
 * Daily email volume — sent + opened counts per day for the last N days (platform-wide).
 */
export async function getEmailVolumeByDay(days = 30): Promise<{
  date: string;
  sent: number;
  opened: number;
}[]> {
  const result = await pool.query(
    `SELECT
       DATE(sent_at)::text                                      AS date,
       COUNT(*)::int                                            AS sent,
       COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::int       AS opened
     FROM email_logs
     WHERE sent_at >= NOW() - make_interval(days => $1)
     GROUP BY DATE(sent_at)
     ORDER BY date ASC`,
    [days]
  );
  return result.rows;
}

/**
 * Per-model AI usage breakdown, platform-wide (all companies summed).
 */
export interface ModelUsageRow {
  service: string;
  model: string;
  total_cost: string;
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
}

export async function getPlatformApiUsageByModel(
  fromPeriod: Date,
  toPeriod: Date
): Promise<ModelUsageRow[]> {
  const result = await pool.query(
    `SELECT
       service,
       model,
       SUM(cost_usd)::numeric      AS total_cost,
       SUM(usage_count)::int       AS total_calls,
       SUM(input_tokens)::bigint   AS total_input_tokens,
       SUM(output_tokens)::bigint  AS total_output_tokens
     FROM api_usage_tracking
     WHERE period >= $1 AND period <= $2
     GROUP BY service, model
     ORDER BY total_cost DESC`,
    [fromPeriod, toPeriod]
  );
  return result.rows;
}

/**
 * Save a daily platform stat (Redis snapshot, bandwidth, etc.).
 * Uses ON CONFLICT to upsert — safe to call multiple times per day.
 */
export async function savePlatformDailyStat(
  date: Date,
  metricKey: string,
  value: number
): Promise<void> {
  await pool.query(
    `INSERT INTO platform_daily_stats (date, metric_key, value)
     VALUES ($1, $2, $3)
     ON CONFLICT (date, metric_key)
     DO UPDATE SET value = EXCLUDED.value`,
    [date.toISOString().slice(0, 10), metricKey, value]
  );
}

/**
 * Get Redis command history for the last N days.
 */
export async function getRedisCommandsHistory(days = 30): Promise<{
  date: string;
  commands: number;
  bandwidth_bytes: number;
}[]> {
  const result = await pool.query(
    `SELECT
       d.date::text,
       COALESCE(cmd.value, 0)::bigint  AS commands,
       COALESCE(bw.value,  0)::bigint  AS bandwidth_bytes
     FROM (
       SELECT generate_series(
         CURRENT_DATE - make_interval(days => $1),
         CURRENT_DATE,
         '1 day'::interval
       )::date AS date
     ) d
     LEFT JOIN platform_daily_stats cmd
       ON cmd.date = d.date AND cmd.metric_key = 'redis_commands_daily'
     LEFT JOIN platform_daily_stats bw
       ON bw.date = d.date AND bw.metric_key = 'redis_bandwidth_bytes_daily'
     ORDER BY d.date ASC`,
    [days]
  );
  return result.rows;
}

/**
 * Get all email logs across all companies (admin only, no tenant filter).
 * Supports filtering by company_id, status, and pagination.
 */
export interface EmailLogAdminRow {
  id: string;
  sent_at: string;
  company_id: string;
  company_name: string;
  recipient_email: string;
  email_type: string;
  status: string;
  subject: string;
  opened_at: string | null;
  clicked_at: string | null;
}

export async function getAllEmailLogsAdmin(filters: {
  companyId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<EmailLogAdminRow[]> {
  const { companyId, status, limit = 50, offset = 0 } = filters;

  let query = `
    SELECT
      el.id,
      el.sent_at,
      el.company_id,
      c.name AS company_name,
      el.recipient_email,
      el.email_type,
      el.status,
      el.subject,
      el.opened_at,
      el.clicked_at
    FROM email_logs el
    JOIN companies c ON el.company_id = c.id
    WHERE 1=1
  `;

  const params: any[] = [];
  let paramIndex = 1;

  if (companyId) {
    query += ` AND el.company_id = $${paramIndex}`;
    params.push(companyId);
    paramIndex++;
  }

  if (status) {
    query += ` AND el.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  query += ` ORDER BY el.sent_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
}
