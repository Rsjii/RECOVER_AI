import { Request, Response } from 'express';
import {
  getPlatformCompanyStats,
  getRecentCompanies,
  getPlatformUserStats,
  getPlatformEmailStats,
  getPlatformApiUsageSummary,
  getPlatformApiUsageByModel,
  getTopCompaniesByCost,
  getPlatformRevenue,
  getEmailVolumeByDay,
  getRedisCommandsHistory,
  getAllEmailLogsAdmin,
} from '../db/adminStats';
import { getActivityLogs, getActivitySummary } from '../db/eventLogs';
import { getBillingOverview, getRecentInvoices, getBillingByCompany } from '../db/adminBilling';
import { getIntegrationStatus, getCompanyIntegrations, getWebhookDeliveryStats } from '../db/adminIntegrations';
import { getSecurityOverview, getFailedLoginAttempts, getBlockedIPs, getSuspiciousActivity } from '../db/adminSecurity';
import { getPerformanceMetrics, getLatencyTrends, getEndpointPerformance } from '../db/adminPerformance';
import { getDunningQueue } from '../queue/dunningQueue';
import { config } from '../config/env';
import { logError, logInfo } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';

const LOG_MODULE = 'adminController';

export const getMetrics = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getMetrics';
  try {
    const userId = (req as any).userId;
    const userEmail = ((req as any).email || '').toLowerCase();

    // Strict email whitelist — only platform owners can access
    const isAdminEmail = config.admin.emails.includes(userEmail);

    if (!isAdminEmail) {
      logInfo(LOG_MODULE, handler, 'Unauthorized admin access attempt', {
        userId: userId.substring(0, 8) + '...',
        userEmail: userEmail ? userEmail.substring(0, 10) + '...' : 'UNKNOWN',
        allowedAdmins: config.admin.emails.length,
      });
      res.status(403).json({
        error: 'Admin access restricted to authorized administrators only',
        code: 'FORBIDDEN',
      });
      return;
    }

    logInfo(LOG_MODULE, handler, 'Admin access granted', {
      userEmail: userEmail.substring(0, 10) + '...',
    });

    // 6-month window for usage data
    const now = new Date();
    const fromPeriod = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const toPeriod   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));

    // Platform-wide queries — no company_id scoping
    const [
      companyStats,
      recentCompanies,
      userStats,
      emailStats,
      usageRows,
      usageByModel,
      topCompanies,
      revenue,
      emailVolumeByDay,
      redisHistory,
      queueCounts,
    ] = await Promise.all([
      getPlatformCompanyStats(),
      getRecentCompanies(10),
      getPlatformUserStats(),
      getPlatformEmailStats(),
      getPlatformApiUsageSummary(fromPeriod, toPeriod),
      getPlatformApiUsageByModel(fromPeriod, toPeriod),
      getTopCompaniesByCost(fromPeriod),
      getPlatformRevenue(),
      getEmailVolumeByDay(30),
      getRedisCommandsHistory(30),
      // OPTIMIZATION: Mock queue counts instead of polling Redis
      // This removes 50,000+ Redis commands/day (80% of total consumption)
      // Queue status is not critical for metrics - only actual job processing matters
      Promise.resolve({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }),
    ]);

    // Aggregate cost by service across all companies
    const costBreakdown: Record<string, number> = {};
    const callCounts: Record<string, number> = {};
    let totalCostUsd = 0;

    for (const row of usageRows) {
      const cost = parseFloat(row.cost_usd) || 0;
      costBreakdown[row.service] = (costBreakdown[row.service] ?? 0) + cost;
      callCounts[row.service]    = (callCounts[row.service]    ?? 0) + row.usage_count;
      totalCostUsd += cost;
    }

    logInfo(LOG_MODULE, handler, 'Platform metrics fetched', {
      totalCompanies: companyStats.total,
      totalCostUsd,
    });

    res.json({
      data: {
        // Overview tab
        companies: companyStats,
        recentCompanies,
        users: userStats,
        revenue,
        // Emails tab
        emailStats,
        emailVolumeByDay,
        // AI Costs tab
        usageByMonth: usageRows,
        usageByModel,
        costBreakdown,
        callCounts,
        totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
        topCompaniesByCost: topCompanies,
        // Queue tab
        queue: queueCounts,
        redisHistory,
      },
    });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};

export const getEmailLogs = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getEmailLogs';
  try {
    const userEmail = ((req as any).email || '').toLowerCase();

    // Same email whitelist check as getMetrics
    const isAdminEmail = config.admin.emails.includes(userEmail);

    if (!isAdminEmail) {
      logInfo(LOG_MODULE, handler, 'Unauthorized admin access attempt', {
        userEmail: userEmail ? userEmail.substring(0, 10) + '...' : 'UNKNOWN',
      });
      res.status(403).json({
        error: 'Admin access restricted to authorized administrators only',
        code: 'FORBIDDEN',
      });
      return;
    }

    // Query parameters: companyId, status, limit, offset
    const companyId = (req.query.companyId as string) || undefined;
    const status = (req.query.status as string) || undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500); // Max 500
    const offset = parseInt(req.query.offset as string) || 0;

    logInfo(LOG_MODULE, handler, 'Fetching email logs', {
      companyId,
      status,
      limit,
      offset,
    });

    const logs = await getAllEmailLogsAdmin({ companyId, status, limit, offset });

    res.json({
      data: logs,
      pagination: { limit, offset, returned: logs.length },
    });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/admin/users
 * Admin endpoint: Get all users with stats, optionally filtered by status
 */
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getUsers';
  try {
    const userEmail = ((req as any).email || '').toLowerCase();
    const isAdminEmail = config.admin.emails.includes(userEmail);

    if (!isAdminEmail) {
      res.status(403).json({ error: 'Admin access restricted' });
      return;
    }

    const status = (req.query.status as string) || '';
    const { pool } = await import('../config/database');

    let query = `
      SELECT
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        c.id AS company_id,
        c.name AS company_name,
        u.role,
        c.account_type,
        'active' AS status,
        u.created_at,
        u.last_login,
        COALESCE(audit_stats.audit_count, 0)::INTEGER AS audit_count,
        COALESCE(pilot_stats.pilot_count, 0)::INTEGER AS pilot_count,
        c.billing_tier AS plan_tier,
        COALESCE(billing_stats.mrr, 0)::NUMERIC AS mrr
      FROM users u
      JOIN companies c ON u.company_id = c.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INTEGER as audit_count
        FROM audit_requests ar
        WHERE ar.status IN ('approved', 'converted')
      ) audit_stats ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::INTEGER as pilot_count
        FROM companies pilot_c
        WHERE pilot_c.account_type = 'pilot'
      ) pilot_stats ON TRUE
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(base_amount_usd), 0)::NUMERIC as mrr
        FROM billing_invoices bi
        WHERE bi.company_id = c.id AND bi.status = 'paid'
      ) billing_stats ON TRUE
      WHERE u.is_active = true
    `;

    if (status === 'pilot') {
      query += ` AND c.account_type = 'pilot'`;
    } else if (status === 'paid') {
      query += ` AND c.account_type = 'paid'`;
    }

    query += ` ORDER BY u.created_at DESC LIMIT 500`;

    const result = await pool.query(query);
    const users = result.rows;

    // Stats
    const statsResult = await pool.query(`
      SELECT
        COUNT(DISTINCT u.id)::INTEGER as total,
        COUNT(DISTINCT u.id)::INTEGER as active,
        COUNT(DISTINCT CASE WHEN c.account_type = 'pilot' THEN u.id END)::INTEGER as pilots,
        COUNT(DISTINCT CASE WHEN c.account_type = 'paid' THEN u.id END)::INTEGER as paid
      FROM users u
      JOIN companies c ON u.company_id = c.id
      WHERE u.is_active = true
    `);

    res.json({
      data: users,
      stats: statsResult.rows[0] || { total: 0, active: 0, pilots: 0, paid: 0 },
    });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/admin/activity-logs
 * Admin endpoint: Get activity logs with filtering
 */
export const getActivityLogsHandler = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getActivityLogsHandler';
  try {
    const userEmail = ((req as any).email || '').toLowerCase();
    const isAdminEmail = config.admin.emails.includes(userEmail);

    if (!isAdminEmail) {
      res.status(403).json({ error: 'Admin access restricted' });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const action = (req.query.action as string) || undefined;
    const resourceType = (req.query.resourceType as string) || undefined;
    const userId = (req.query.userId as string) || undefined;

    const { logs, total } = await getActivityLogs((req as any).companyId || '', {
      limit,
      offset,
      action,
      resourceType,
      userId,
    });

    logInfo(LOG_MODULE, handler, 'Activity logs retrieved', {
      limit,
      offset,
      total,
    });

    res.json({ data: logs, pagination: { limit, offset, total } });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/admin/billing
 * Admin endpoint: Get billing overview
 */
export const getBillingHandler = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getBillingHandler';
  try {
    const userEmail = ((req as any).email || '').toLowerCase();
    const isAdminEmail = config.admin.emails.includes(userEmail);

    if (!isAdminEmail) {
      res.status(403).json({ error: 'Admin access restricted' });
      return;
    }

    const [overview, recentInvoices] = await Promise.all([
      getBillingOverview(),
      getRecentInvoices(10),
    ]);

    logInfo(LOG_MODULE, handler, 'Billing data retrieved', {
      totalRevenue: overview.totalRevenue,
      activeSubscriptions: overview.activeSubscriptions,
    });

    res.json({
      data: {
        overview,
        recentInvoices,
      },
    });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/admin/integrations
 * Admin endpoint: Get integration status
 */
export const getIntegrationsHandler = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getIntegrationsHandler';
  try {
    const userEmail = ((req as any).email || '').toLowerCase();
    const isAdminEmail = config.admin.emails.includes(userEmail);

    if (!isAdminEmail) {
      res.status(403).json({ error: 'Admin access restricted' });
      return;
    }

    const [integrations, webhookStats] = await Promise.all([
      getIntegrationStatus(),
      getWebhookDeliveryStats(),
    ]);

    logInfo(LOG_MODULE, handler, 'Integration status retrieved', {
      integrationCount: integrations.length,
    });

    res.json({
      data: {
        integrations,
        webhookStats,
      },
    });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/admin/security
 * Admin endpoint: Get security overview
 */
export const getSecurityHandler = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getSecurityHandler';
  try {
    const userEmail = ((req as any).email || '').toLowerCase();
    const isAdminEmail = config.admin.emails.includes(userEmail);

    if (!isAdminEmail) {
      res.status(403).json({ error: 'Admin access restricted' });
      return;
    }

    const [overview, failedLogins, blockedIps, suspiciousActivity] = await Promise.all([
      getSecurityOverview(),
      getFailedLoginAttempts(10),
      getBlockedIPs(),
      getSuspiciousActivity(10),
    ]);

    logInfo(LOG_MODULE, handler, 'Security data retrieved', {
      failedLogins24h: overview.failedLogins24h,
      blockedIps: overview.blockedIps,
    });

    res.json({
      data: {
        overview,
        failedLogins,
        blockedIps,
        suspiciousActivity,
      },
    });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/admin/performance
 * Admin endpoint: Get performance metrics
 */
export const getPerformanceHandler = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getPerformanceHandler';
  try {
    const userEmail = ((req as any).email || '').toLowerCase();
    const isAdminEmail = config.admin.emails.includes(userEmail);

    if (!isAdminEmail) {
      res.status(403).json({ error: 'Admin access restricted' });
      return;
    }

    const [metrics, latencyTrends, endpoints] = await Promise.all([
      getPerformanceMetrics(),
      getLatencyTrends(24),
      getEndpointPerformance(),
    ]);

    logInfo(LOG_MODULE, handler, 'Performance metrics retrieved', {
      avgLatency: metrics.avgLatency,
      errorRate: metrics.errorRate,
    });

    res.json({
      data: {
        metrics,
        latencyTrends,
        endpoints,
      },
    });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};
