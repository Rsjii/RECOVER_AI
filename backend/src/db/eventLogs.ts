import { pool } from '../config/database';

export interface EventLogRow {
  id: string;
  company_id: string;
  user_id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface CreateEventLogInput {
  companyId: string;
  userId: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log a user action to the event_logs table (audit trail)
 */
export async function createEventLog(input: CreateEventLogInput): Promise<string> {
  const result = await pool.query(
    `INSERT INTO event_logs (
      company_id, user_id, user_email, action, resource_type, resource_id,
      details, ip_address, user_agent, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    RETURNING id`,
    [
      input.companyId,
      input.userId,
      input.userEmail,
      input.action,
      input.resourceType,
      input.resourceId,
      JSON.stringify(input.details || {}),
      input.ipAddress || null,
      input.userAgent || null,
    ]
  );
  return result.rows[0].id;
}

/**
 * Get activity logs for a company (paginated)
 */
export async function getActivityLogs(companyId: string, options: {
  limit?: number;
  offset?: number;
  action?: string;
  resourceType?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
} = {}): Promise<{ logs: EventLogRow[]; total: number }> {
  const limit = Math.min(options.limit || 50, 500);
  const offset = options.offset || 0;

  const params: unknown[] = [companyId];
  let query = `SELECT * FROM event_logs WHERE company_id = $1`;

  if (options.action) {
    params.push(options.action);
    query += ` AND action ILIKE '%' || $${params.length} || '%'`;
  }

  if (options.resourceType) {
    params.push(options.resourceType);
    query += ` AND resource_type = $${params.length}`;
  }

  if (options.userId) {
    params.push(options.userId);
    query += ` AND user_id = $${params.length}`;
  }

  if (options.startDate) {
    params.push(options.startDate);
    query += ` AND created_at >= $${params.length}`;
  }

  if (options.endDate) {
    params.push(options.endDate);
    query += ` AND created_at <= $${params.length}`;
  }

  query += ` ORDER BY created_at DESC`;

  // Get total count
  const countResult = await pool.query(
    query.replace('SELECT *', 'SELECT COUNT(*)::int as count'),
    params
  );
  const total = countResult.rows[0]?.count || 0;

  // Get paginated results
  params.push(limit, offset);
  query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const result = await pool.query(query, params);
  return { logs: result.rows, total };
}

/**
 * Get all activity logs for platform admin (no company_id filter)
 */
export async function getAllActivityLogsAdmin(options: {
  limit?: number;
  offset?: number;
  action?: string;
  resourceType?: string;
  companyId?: string;
} = {}): Promise<{ logs: EventLogRow[]; total: number }> {
  const limit = Math.min(options.limit || 50, 500);
  const offset = options.offset || 0;

  const params: unknown[] = [];
  let where = 'WHERE 1=1';

  if (options.companyId) {
    params.push(options.companyId);
    where += ` AND company_id = $${params.length}`;
  }
  if (options.action) {
    params.push(options.action);
    where += ` AND action ILIKE '%' || $${params.length} || '%'`;
  }
  if (options.resourceType) {
    params.push(options.resourceType);
    where += ` AND resource_type = $${params.length}`;
  }

  const countResult = await pool.query(
    `SELECT COUNT(*)::int as count FROM event_logs ${where}`,
    params
  );
  const total = countResult.rows[0]?.count || 0;

  params.push(limit, offset);
  const result = await pool.query(
    `SELECT * FROM event_logs ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { logs: result.rows, total };
}

/**
 * Get activity summary for admin dashboard
 */
export async function getActivitySummary(companyId: string): Promise<{
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByUser: Record<string, number>;
  last24h: number;
  last7d: number;
}> {
  const result = await pool.query(
    `SELECT
      COUNT(*)::int as total,
      action,
      user_email,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int as last_24h,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int as last_7d
    FROM event_logs
    WHERE company_id = $1
    GROUP BY action, user_email
    ORDER BY COUNT(*) DESC`,
    [companyId]
  );

  const byType: Record<string, number> = {};
  const byUser: Record<string, number> = {};
  let last24h = 0;
  let last7d = 0;
  let total = 0;

  for (const row of result.rows) {
    total += row.total;
    byType[row.action] = (byType[row.action] || 0) + row.total;
    byUser[row.user_email] = (byUser[row.user_email] || 0) + row.total;
    last24h += row.last_24h || 0;
    last7d += row.last_7d || 0;
  }

  return { totalEvents: total, eventsByType: byType, eventsByUser: byUser, last24h, last7d };
}
