import { pool } from '../config/database';

export interface SecurityEventRow {
  id: string;
  eventType: string;
  userId: string;
  userEmail: string;
  description: string;
  ipAddress: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}

/**
 * Get security overview for admin dashboard
 */
export async function getSecurityOverview(): Promise<{
  failedLogins24h: number;
  blockedIps: number;
  suspiciousActivities: number;
  twoFactorEnabledPercent: number;
  activeSessions: number;
  criticalAlerts: number;
}> {
  const failedResult = await pool.query(`
    SELECT COUNT(*)::int as count
    FROM user_sessions
    WHERE revoked_at IS NOT NULL AND created_at > NOW() - INTERVAL '24 hours'
  `);

  const blockedResult = await pool.query(`
    SELECT COUNT(DISTINCT ip_address)::int as count
    FROM user_sessions
    WHERE revoked_at IS NOT NULL
      AND created_at > NOW() - INTERVAL '24 hours'
  `);

  const twoFactorResult = await pool.query(`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE two_factor_enabled = true)::int as enabled
    FROM users
    WHERE is_active = true
  `);

  const sessionsResult = await pool.query(`
    SELECT COUNT(*)::int as count
    FROM user_sessions
    WHERE revoked_at IS NULL AND expires_at > NOW()
  `);

  const twoFactorStats = twoFactorResult.rows[0] || { total: 1, enabled: 0 };
  const twoFactorPercent = twoFactorStats.total > 0
    ? (twoFactorStats.enabled / twoFactorStats.total) * 100
    : 0;

  return {
    failedLogins24h: failedResult.rows[0]?.count || 0,
    blockedIps: blockedResult.rows[0]?.count || 0,
    suspiciousActivities: 0, // Will be populated by event logs with suspicious actions
    twoFactorEnabledPercent: Math.round(twoFactorPercent),
    activeSessions: sessionsResult.rows[0]?.count || 0,
    criticalAlerts: 0, // Alerts are added when malicious activity detected
  };
}

/**
 * Get failed login attempts (last 24 hours)
 */
export async function getFailedLoginAttempts(limit: number = 20): Promise<Array<{
  userId: string;
  userEmail: string;
  ipAddress: string | null;
  timestamp: string;
  reason: string;
}>> {
  // Use event logs to track failed logins
  const result = await pool.query(`
    SELECT
      user_id,
      user_email,
      ip_address,
      created_at,
      details->>'reason' as reason
    FROM event_logs
    WHERE action = 'LOGIN_FAILED'
      AND created_at > NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC
    LIMIT $1`,
    [limit]
  );

  return result.rows.map(row => ({
    userId: row.user_id,
    userEmail: row.user_email,
    ipAddress: row.ip_address,
    timestamp: new Date(row.created_at).toISOString(),
    reason: row.reason || 'Unknown',
  }));
}

/**
 * Get list of blocked or suspicious IPs
 */
export async function getBlockedIPs(): Promise<Array<{
  ipAddress: string;
  failureCount: number;
  lastAttempt: string;
  blocked: boolean;
}>> {
  // Aggregate failed logins by IP
  const result = await pool.query(`
    SELECT
      ip_address,
      COUNT(*)::int as failure_count,
      MAX(created_at) as last_attempt,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')::int as recent_failures
    FROM event_logs
    WHERE action = 'LOGIN_FAILED'
      AND ip_address IS NOT NULL
      AND created_at > NOW() - INTERVAL '7 days'
    GROUP BY ip_address
    HAVING COUNT(*) >= 5
    ORDER BY COUNT(*) DESC
    LIMIT 20
  `);

  return result.rows.map(row => ({
    ipAddress: row.ip_address,
    failureCount: row.failure_count,
    lastAttempt: new Date(row.last_attempt).toISOString(),
    blocked: row.recent_failures >= 3, // Block if 3+ failures in last hour
  }));
}

/**
 * Get suspicious activity summary
 */
export async function getSuspiciousActivity(limit: number = 10): Promise<SecurityEventRow[]> {
  const result = await pool.query(`
    SELECT
      id,
      action,
      user_id,
      user_email,
      resource_type,
      ip_address,
      created_at
    FROM event_logs
    WHERE action IN (
      'PERMISSION_DENIED',
      'UNAUTHORIZED_ACCESS_ATTEMPT',
      'BULK_OPERATION',
      'DATA_EXPORT',
      'ROLE_CHANGE',
      'API_KEY_CREATED'
    )
    AND created_at > NOW() - INTERVAL '7 days'
    ORDER BY created_at DESC
    LIMIT $1`,
    [limit]
  );

  return result.rows.map(row => ({
    id: row.id,
    eventType: row.action,
    userId: row.user_id,
    userEmail: row.user_email,
    description: `${row.action} on ${row.resource_type}`,
    ipAddress: row.ip_address,
    severity: row.action === 'UNAUTHORIZED_ACCESS_ATTEMPT' ? 'critical' : 'high',
    timestamp: new Date(row.created_at).toISOString(),
  }));
}

/**
 * Log a security event
 */
export async function logSecurityEvent(input: {
  userId: string;
  userEmail: string;
  eventType: string;
  description: string;
  ipAddress?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}): Promise<void> {
  await pool.query(
    `INSERT INTO security_events (user_id, user_email, event_type, description, ip_address, severity, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      input.userId,
      input.userEmail,
      input.eventType,
      input.description,
      input.ipAddress || null,
      input.severity,
    ]
  );
}
