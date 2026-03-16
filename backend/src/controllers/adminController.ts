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
} from '../db/adminStats';
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
      getDunningQueue().getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed').catch(() => ({})),
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
