/**
 * Complete Admin Dashboard
 * A-Z visibility: users, roles, activity, billing, logs, tracing, everything
 */

import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { logInfo, logError } from '../utils/logger';

const router = Router();
const LOG_MODULE = 'adminDashboardController';

/**
 * GET /api/admin/dashboard/overview
 * Admin home: key metrics, alerts, recent activity
 */
router.get('/overview', authMiddleware, async (req: Request, res: Response) => {
  const method = 'GET /overview';
  const companyId = req.user?.companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logInfo(LOG_MODULE, method, 'Fetching admin overview', { companyId });

    // Get all key metrics in parallel
    const [usersRes, invoicesRes, emailsRes, billingSub, recentLogsRes] = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM users WHERE company_id = $1', [companyId]),
      pool.query('SELECT COUNT(*) as total, SUM(amount) as total_amount FROM invoices WHERE company_id = $1 AND status = $2', [companyId, 'unpaid']),
      pool.query('SELECT COUNT(*) as total, SUM(CASE WHEN status = $1 THEN 1 ELSE 0 END) as sent FROM email_logs WHERE company_id = $2', [companyId, 'sent']),
      pool.query('SELECT * FROM billing WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1', [companyId]),
      pool.query('SELECT * FROM audit_logs WHERE company_id = $1 ORDER BY created_at DESC LIMIT 10', [companyId]),
    ]);

    res.json({
      users: {
        total: parseInt(usersRes.rows[0]?.total || 0, 10),
      },
      invoices: {
        unpaid_count: parseInt(invoicesRes.rows[0]?.total || 0, 10),
        unpaid_amount: invoicesRes.rows[0]?.total_amount || 0,
      },
      emails: {
        total_sent: parseInt(emailsRes.rows[0]?.sent || 0, 10),
        total_logged: parseInt(emailsRes.rows[0]?.total || 0, 10),
      },
      billing: {
        current_plan: billingSub.rows[0]?.plan_name || 'STARTER',
        status: billingSub.rows[0]?.status || 'active',
        next_billing_date: billingSub.rows[0]?.next_billing_date,
      },
      recent_activity: recentLogsRes.rows,
    });
  } catch (err: any) {
    logError(LOG_MODULE, method, 'Failed to fetch overview', err);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

/**
 * GET /api/admin/dashboard/users
 * All users with roles, permissions, activity
 */
router.get('/users', authMiddleware, async (req: Request, res: Response) => {
  const method = 'GET /users';
  const companyId = req.user?.companyId;
  const { page = 1, limit = 50, role, status } = req.query;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logInfo(LOG_MODULE, method, 'Fetching users', { companyId, page, limit });

    let whereClause = 'u.company_id = $1';
    let paramIndex = 2;
    const params: any[] = [companyId];

    if (role) {
      whereClause += ` AND u.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (status) {
      whereClause += ` AND u.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const offset = ((Number(page) || 1) - 1) * (Number(limit) || 50);

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM users WHERE ${whereClause}`,
      params
    );

    const result = await pool.query(
      `SELECT
        u.id,
        u.email,
        u.full_name,
        u.role,
        u.status,
        u.created_at,
        u.last_login,
        u.email_verified,
        (SELECT COUNT(*) FROM audit_logs WHERE user_id = u.id AND company_id = $1) as activity_count
      FROM users u
      WHERE ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, Number(limit) || 50, offset]
    );

    res.json({
      data: result.rows,
      pagination: {
        page: Number(page) || 1,
        limit: Number(limit) || 50,
        total: parseInt(countResult.rows[0].total, 10),
      },
    });
  } catch (err: any) {
    logError(LOG_MODULE, method, 'Failed to fetch users', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/admin/dashboard/activity
 * Complete audit log of all user actions
 */
router.get('/activity', authMiddleware, async (req: Request, res: Response) => {
  const method = 'GET /activity';
  const companyId = req.user?.companyId;
  const { page = 1, limit = 100, userId, action, startDate, endDate } = req.query;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logInfo(LOG_MODULE, method, 'Fetching activity logs', { companyId });

    let whereClause = 'al.company_id = $1';
    let paramIndex = 2;
    const params: any[] = [companyId];

    if (userId) {
      whereClause += ` AND al.user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    if (action) {
      whereClause += ` AND al.action ILIKE $${paramIndex}`;
      params.push(`%${action}%`);
      paramIndex++;
    }

    if (startDate) {
      whereClause += ` AND al.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND al.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    const offset = ((Number(page) || 1) - 1) * (Number(limit) || 100);

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM audit_logs WHERE ${whereClause}`,
      params
    );

    const result = await pool.query(
      `SELECT
        al.id,
        al.user_id,
        u.email as user_email,
        u.full_name,
        al.action,
        al.resource_type,
        al.resource_id,
        al.changes,
        al.ip_address,
        al.user_agent,
        al.created_at
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, Number(limit) || 100, offset]
    );

    res.json({
      data: result.rows,
      pagination: {
        page: Number(page) || 1,
        limit: Number(limit) || 100,
        total: parseInt(countResult.rows[0].total, 10),
      },
    });
  } catch (err: any) {
    logError(LOG_MODULE, method, 'Failed to fetch activity logs', err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

/**
 * GET /api/admin/dashboard/billing
 * Billing info: subscriptions, invoices, usage, payment history
 */
router.get('/billing', authMiddleware, async (req: Request, res: Response) => {
  const method = 'GET /billing';
  const companyId = req.user?.companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logInfo(LOG_MODULE, method, 'Fetching billing info', { companyId });

    const [subRes, invoicesRes, usageRes] = await Promise.all([
      pool.query('SELECT * FROM billing WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1', [companyId]),
      pool.query('SELECT * FROM billing_invoices WHERE company_id = $1 ORDER BY created_at DESC LIMIT 10', [companyId]),
      pool.query('SELECT * FROM usage_logs WHERE company_id = $1 AND created_at >= NOW() - INTERVAL \'30 days\' ORDER BY created_at DESC', [companyId]),
    ]);

    res.json({
      subscription: subRes.rows[0] || null,
      invoices: invoicesRes.rows,
      usage_30d: usageRes.rows,
    });
  } catch (err: any) {
    logError(LOG_MODULE, method, 'Failed to fetch billing', err);
    res.status(500).json({ error: 'Failed to fetch billing' });
  }
});

/**
 * GET /api/admin/dashboard/roles
 * User roles and permissions configuration
 */
router.get('/roles', authMiddleware, async (req: Request, res: Response) => {
  const method = 'GET /roles';
  const companyId = req.user?.companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logInfo(LOG_MODULE, method, 'Fetching roles', { companyId });

    const result = await pool.query(
      `SELECT
        r.id,
        r.name,
        r.description,
        COUNT(u.id) as user_count,
        array_agg(DISTINCT p.permission) FILTER (WHERE p.permission IS NOT NULL) as permissions
      FROM roles r
      LEFT JOIN users u ON r.id = u.role AND u.company_id = $1
      LEFT JOIN role_permissions p ON r.id = p.role_id
      WHERE r.company_id = $1
      GROUP BY r.id, r.name, r.description
      ORDER BY r.created_at DESC`,
      [companyId]
    );

    res.json({ roles: result.rows });
  } catch (err: any) {
    logError(LOG_MODULE, method, 'Failed to fetch roles', err);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

/**
 * GET /api/admin/dashboard/system-logs
 * System-level logs: errors, performance, webhooks, etc.
 */
router.get('/system-logs', authMiddleware, async (req: Request, res: Response) => {
  const method = 'GET /system-logs';
  const companyId = req.user?.companyId;
  const { type = 'error', limit = 100 } = req.query;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logInfo(LOG_MODULE, method, 'Fetching system logs', { companyId, type });

    const result = await pool.query(
      `SELECT
        id,
        type,
        module,
        message,
        data,
        created_at,
        request_id
      FROM system_logs
      WHERE company_id = $1 AND type = $2
      ORDER BY created_at DESC
      LIMIT $3`,
      [companyId, type, Number(limit) || 100]
    );

    res.json({ logs: result.rows });
  } catch (err: any) {
    logError(LOG_MODULE, method, 'Failed to fetch system logs', err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

/**
 * GET /api/admin/dashboard/integrations
 * All connected integrations: Stripe, Slack, etc. status, last sync
 */
router.get('/integrations', authMiddleware, async (req: Request, res: Response) => {
  const method = 'GET /integrations';
  const companyId = req.user?.companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logInfo(LOG_MODULE, method, 'Fetching integrations', { companyId });

    const result = await pool.query(
      `SELECT
        id,
        integration_type,
        status,
        last_sync_at,
        last_error,
        configuration,
        created_at
      FROM integrations
      WHERE company_id = $1
      ORDER BY created_at DESC`,
      [companyId]
    );

    res.json({ integrations: result.rows });
  } catch (err: any) {
    logError(LOG_MODULE, method, 'Failed to fetch integrations', err);
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});

/**
 * GET /api/admin/dashboard/webhooks
 * All webhooks: registered, delivery status, failure logs
 */
router.get('/webhooks', authMiddleware, async (req: Request, res: Response) => {
  const method = 'GET /webhooks';
  const companyId = req.user?.companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logInfo(LOG_MODULE, method, 'Fetching webhooks', { companyId });

    const [webhooksRes, deliveryRes] = await Promise.all([
      pool.query('SELECT * FROM webhooks WHERE company_id = $1 ORDER BY created_at DESC', [companyId]),
      pool.query('SELECT * FROM webhook_deliveries WHERE company_id = $1 ORDER BY created_at DESC LIMIT 100', [companyId]),
    ]);

    res.json({
      webhooks: webhooksRes.rows,
      recent_deliveries: deliveryRes.rows,
    });
  } catch (err: any) {
    logError(LOG_MODULE, method, 'Failed to fetch webhooks', err);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
});

/**
 * GET /api/admin/dashboard/performance
 * Performance metrics: API response times, queue depths, database stats
 */
router.get('/performance', authMiddleware, async (req: Request, res: Response) => {
  const method = 'GET /performance';
  const companyId = req.user?.companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logInfo(LOG_MODULE, method, 'Fetching performance metrics', { companyId });

    const result = await pool.query(
      `SELECT
        endpoint,
        COUNT(*) as request_count,
        AVG(response_time_ms) as avg_response_time,
        MAX(response_time_ms) as max_response_time,
        MIN(response_time_ms) as min_response_time
      FROM request_logs
      WHERE company_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY endpoint
      ORDER BY request_count DESC`,
      [companyId]
    );

    res.json({ performance: result.rows });
  } catch (err: any) {
    logError(LOG_MODULE, method, 'Failed to fetch performance metrics', err);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

/**
 * GET /api/admin/dashboard/compliance
 * Compliance: data retention, GDPR exports, audit trails, data deletion requests
 */
router.get('/compliance', authMiddleware, async (req: Request, res: Response) => {
  const method = 'GET /compliance';
  const companyId = req.user?.companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logInfo(LOG_MODULE, method, 'Fetching compliance data', { companyId });

    const [dataRetentionRes, gdprRes, deletionRes] = await Promise.all([
      pool.query('SELECT * FROM data_retention_policies WHERE company_id = $1', [companyId]),
      pool.query('SELECT * FROM gdpr_exports WHERE company_id = $1 ORDER BY created_at DESC LIMIT 10', [companyId]),
      pool.query('SELECT * FROM data_deletion_requests WHERE company_id = $1 ORDER BY created_at DESC LIMIT 10', [companyId]),
    ]);

    res.json({
      retention_policies: dataRetentionRes.rows,
      gdpr_exports: gdprRes.rows,
      deletion_requests: deletionRes.rows,
    });
  } catch (err: any) {
    logError(LOG_MODULE, method, 'Failed to fetch compliance data', err);
    res.status(500).json({ error: 'Failed to fetch compliance' });
  }
});

/**
 * GET /api/admin/dashboard/security
 * Security: failed login attempts, suspicious activity, ip blocking
 */
router.get('/security', authMiddleware, async (req: Request, res: Response) => {
  const method = 'GET /security';
  const companyId = req.user?.companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logInfo(LOG_MODULE, method, 'Fetching security info', { companyId });

    const [failedLoginsRes, suspiciousRes, blockedIpsRes] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM failed_logins WHERE company_id = $1 AND created_at >= NOW() - INTERVAL \'24 hours\'', [companyId]),
      pool.query('SELECT * FROM suspicious_activity WHERE company_id = $1 ORDER BY created_at DESC LIMIT 20', [companyId]),
      pool.query('SELECT * FROM blocked_ips WHERE company_id = $1 ORDER BY created_at DESC', [companyId]),
    ]);

    res.json({
      failed_logins_24h: parseInt(failedLoginsRes.rows[0]?.count || 0, 10),
      suspicious_activity: suspiciousRes.rows,
      blocked_ips: blockedIpsRes.rows,
    });
  } catch (err: any) {
    logError(LOG_MODULE, method, 'Failed to fetch security info', err);
    res.status(500).json({ error: 'Failed to fetch security info' });
  }
});

/**
 * GET /api/admin/dashboard/feature-flags
 * Feature flags and experiments: active flags, rollout %, user groups
 */
router.get('/feature-flags', authMiddleware, async (req: Request, res: Response) => {
  const method = 'GET /feature-flags';
  const companyId = req.user?.companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logInfo(LOG_MODULE, method, 'Fetching feature flags', { companyId });

    const result = await pool.query(
      `SELECT
        id,
        key,
        enabled,
        rollout_percentage,
        description,
        created_at
      FROM feature_flags
      WHERE company_id = $1
      ORDER BY created_at DESC`,
      [companyId]
    );

    res.json({ feature_flags: result.rows });
  } catch (err: any) {
    logError(LOG_MODULE, method, 'Failed to fetch feature flags', err);
    res.status(500).json({ error: 'Failed to fetch flags' });
  }
});

export default router;
