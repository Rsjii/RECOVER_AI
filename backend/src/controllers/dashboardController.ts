import { Request, Response } from 'express';
import { getRecoveryStats, getInvoicePipeline, getCustomerRiskList, getDashboardKpi, getAgingAnalysis, getEmailAnalytics, getRiskDrivers, getPaymentPlansSummary, getWorkingCapitalFreed, getDSOReduction, getHoursSaved } from '../db/dashboard';
import { listPaymentsByCompany } from '../db/payments';
import { pool } from '../config/database';
import { logError, logInfo } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';
import { getAtRiskCustomers } from '../services/riskScoringService';
import { getVoiceCallStats, getRecentVoiceCalls } from '../services/twilioService';
import { getCashPosition, updateCashBalance, calculateWhatIf, calculateRunway, getCashLeakage, getEnhancedCashForecast } from '../services/cashPositionService';
import type { WhatIfScenario } from '../services/cashPositionService';

const LOG_MODULE = 'dashboardController';

/**
 * GET /api/dashboard/stats
 * Recovery stats: total owed, recovered, recovery rate, overdue
 */
export const getStats = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getStats';
  const companyId = (req as any).companyId;

  try {
    const startedAt = Date.now();
    const stats = await getRecoveryStats(companyId);
    logInfo(LOG_MODULE, handler, 'Stats fetched', { elapsedMs: Date.now() - startedAt });
    res.status(200).json({ data: stats });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get stats', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/dashboard/pipeline
 * Invoice counts by status
 */
export const getPipeline = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getPipeline';
  const companyId = (req as any).companyId;

  try {
    const pipeline = await getInvoicePipeline(companyId);
    res.status(200).json({ data: pipeline });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get pipeline', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/dashboard/risk-list?limit=20
 * Customers ranked by risk score with unpaid invoice totals
 */
export const getRiskList = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getRiskList';
  const companyId = (req as any).companyId;

  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const riskList = await getCustomerRiskList(companyId, limit);
    res.status(200).json({ data: riskList, total: riskList.length });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get risk list', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/dashboard/timeline?period=monthly&months=6
 * Recovery timeline data for charts
 */
export const getRecoveryTimeline = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getRecoveryTimeline';
  const companyId = (req as any).companyId;
  const period = (req.query.period as string) || 'monthly';
  const months = parseInt(req.query.months as string) || 6;

  try {
    const periodType = period === 'weekly' ? 'week' : 'month';
    const result = await pool.query(
      `SELECT
         DATE_TRUNC($2, i.created_at) as period,
         COUNT(*) FILTER (WHERE i.status = 'paid') as recovered_count,
         COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) as recovered_amount,
         COUNT(*) as total_count,
         COALESCE(SUM(i.amount), 0) as total_amount
       FROM invoices i
       WHERE i.company_id = $1
         AND i.created_at >= NOW() - ($3 || ' months')::INTERVAL
       GROUP BY period
       ORDER BY period`,
      [companyId, periodType, months]
    );

    logInfo(LOG_MODULE, handler, 'Timeline fetched', { companyId, period, months, rows: result.rows.length });
    res.status(200).json({ data: result.rows });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to fetch timeline', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/dashboard/at-risk
 * Returns customers with payment failure risk score >= 40
 */
export const getAtRisk = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getAtRisk';
  const companyId = (req as any).companyId;
  try {
    const atRisk = await getAtRiskCustomers(companyId);
    logInfo(LOG_MODULE, handler, `${atRisk.length} at-risk customers returned`, { companyId });
    res.status(200).json({ data: atRisk });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to fetch at-risk customers', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/dashboard/cash-position
 * Returns projected cash balance for 30/60/90 days
 */
export const getCashPositionHandler = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getCashPosition';
  const companyId = (req as any).companyId;
  try {
    const position = await getCashPosition(companyId);
    logInfo(LOG_MODULE, handler, 'Cash position calculated', { companyId });
    res.status(200).json({ data: position });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to calculate cash position', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * PUT /api/dashboard/cash-balance
 * Update the company's manually entered current cash balance
 */
export const updateCashBalanceHandler = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updateCashBalance';
  const companyId = (req as any).companyId;
  const { balanceUsd } = req.body;

  if (typeof balanceUsd !== 'number' || balanceUsd < 0) {
    sendErrorResponse(res, 400, 'balanceUsd must be a non-negative number');
    return;
  }

  try {
    await updateCashBalance(companyId, balanceUsd);
    logInfo(LOG_MODULE, handler, 'Cash balance updated', { companyId, balanceUsd });
    res.status(200).json({ data: { balanceUsd } });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to update cash balance', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * PUT /api/dashboard/burn-rate
 * Update the company's monthly operating expense burn rate (used in cash forecast)
 */
export const updateBurnRateHandler = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updateBurnRate';
  const companyId = (req as any).companyId;
  const { burnRateUsd } = req.body;

  if (typeof burnRateUsd !== 'number' || burnRateUsd < 0) {
    sendErrorResponse(res, 400, 'burnRateUsd must be a non-negative number');
    return;
  }

  try {
    await pool.query(
      'UPDATE companies SET monthly_burn_rate_usd = $1 WHERE id = $2',
      [burnRateUsd, companyId]
    );
    logInfo(LOG_MODULE, handler, 'Burn rate updated', { companyId, burnRateUsd });
    res.status(200).json({ data: { burnRateUsd } });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to update burn rate', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/dashboard/cash-whatif
 * Calculate a what-if scenario against current cash position
 */
export const getWhatIfHandler = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getWhatIf';
  const companyId = (req as any).companyId;
  const { type, removeCustomerId, accelerateDunningByDays, customReductionPct } = req.body;

  const validTypes = ['remove_customer', 'accelerate_dunning', 'custom'];
  if (!type || !validTypes.includes(type)) {
    sendErrorResponse(res, 400, `type must be one of: ${validTypes.join(', ')}`);
    return;
  }

  try {
    const scenario: WhatIfScenario = { type, removeCustomerId, accelerateDunningByDays, customReductionPct };
    const result = await calculateWhatIf(companyId, scenario);
    logInfo(LOG_MODULE, handler, 'What-if calculated', { companyId, type });
    res.status(200).json({ data: result });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to calculate what-if', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/dashboard/runway
 * Returns cash runway in days based on burn rate
 */
export const getRunwayHandler = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getRunway';
  const companyId = (req as any).companyId;

  try {
    const result = await calculateRunway(companyId);
    logInfo(LOG_MODULE, handler, 'Runway calculated', { companyId, runwayDays: result.runwayDays });
    res.status(200).json({ data: result });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to calculate runway', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/dashboard/cash-leakage
 * Returns cash leakage analysis by source
 */
export const getCashLeakageHandler = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getCashLeakage';
  const companyId = (req as any).companyId;

  try {
    const result = await getCashLeakage(companyId);
    logInfo(LOG_MODULE, handler, 'Cash leakage analyzed', { companyId, total: result.totalLeakageUsd });
    res.status(200).json({ data: result });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to analyze cash leakage', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/dashboard/kpi
 * CFO-level KPIs: DSO, CEI, Recovery Rate, Revenue at Risk, Involuntary Churn, At-Risk Count
 */
export const getKpi = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getKpi';
  const companyId = (req as any).companyId;
  try {
    const kpi = await getDashboardKpi(companyId);
    logInfo(LOG_MODULE, handler, 'KPIs fetched', { companyId });
    res.status(200).json({ data: kpi });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get KPIs', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/dashboard/aging-analysis
 * A/R breakdown by aging bucket (0–30, 31–60, 61–90, 90+)
 */
export const getAgingAnalysisHandler = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getAgingAnalysis';
  const companyId = (req as any).companyId;
  try {
    const aging = await getAgingAnalysis(companyId);
    logInfo(LOG_MODULE, handler, 'Aging analysis fetched', { companyId, totalAr: aging.totalAr });
    res.status(200).json({ data: aging });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get aging analysis', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/dashboard/email-analytics
 * Email open rate, CTR, CTOR, conversions by type (last 30 days)
 */
export const getEmailAnalyticsHandler = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getEmailAnalytics';
  const companyId = (req as any).companyId;
  try {
    const analytics = await getEmailAnalytics(companyId);
    logInfo(LOG_MODULE, handler, 'Email analytics fetched', { companyId, sent: analytics.sent });
    res.status(200).json({ data: analytics });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get email analytics', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/dashboard/risk-drivers
 * Count of customers by risk signal type
 */
export const getRiskDriversHandler = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getRiskDrivers';
  const companyId = (req as any).companyId;
  try {
    const drivers = await getRiskDrivers(companyId);
    logInfo(LOG_MODULE, handler, 'Risk drivers fetched', { companyId, total: drivers.total });
    res.status(200).json({ data: drivers });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get risk drivers', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/dashboard/payment-plans-summary
 * Active plans, acceptance %, completion %, total value, recent plans list
 */
export const getPaymentPlansSummaryHandler = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getPaymentPlansSummary';
  const companyId = (req as any).companyId;
  try {
    const summary = await getPaymentPlansSummary(companyId);
    logInfo(LOG_MODULE, handler, 'Payment plans summary fetched', { companyId, active: summary.activePlans });
    res.status(200).json({ data: summary });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get payment plans summary', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/dashboard/payment-events
 * Recent payment events for the Activity page
 */
export const getPaymentEvents = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getPaymentEvents';
  const companyId = (req as any).companyId;
  const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
  try {
    const result = await pool.query(
      `SELECT p.*, i.amount AS invoice_amount, c.name AS customer_name, c.email AS customer_email
       FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       JOIN customers c ON c.id = i.customer_id
       WHERE p.company_id = $1
       ORDER BY p.paid_at DESC
       LIMIT $2`,
      [companyId, limit]
    );
    logInfo(LOG_MODULE, handler, 'Payment events fetched', { companyId, count: result.rowCount });
    res.status(200).json({ data: result.rows });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get payment events', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/dashboard/sms-activity
 * Invoices with SMS sent, ordered by last SMS date
 */
export const getSmsActivity = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getSmsActivity';
  const companyId = (req as any).companyId;
  const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
  try {
    const result = await pool.query(
      `SELECT i.id, i.sms_count, i.last_sms_sent_at, i.amount, i.currency,
              c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
       FROM invoices i
       JOIN customers c ON c.id = i.customer_id
       WHERE i.company_id = $1 AND i.sms_count > 0
       ORDER BY i.last_sms_sent_at DESC
       LIMIT $2`,
      [companyId, limit]
    );
    logInfo(LOG_MODULE, handler, 'SMS activity fetched', { companyId, count: result.rowCount });
    res.status(200).json({ data: result.rows });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get SMS activity', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

// ─── Financial Operations Agent — new endpoints ───────────────────────────────

/**
 * GET /api/dashboard/working-capital-freed
 * AR recovered + billing errors confirmed in last 30 days.
 */
export const getWorkingCapitalFreedHandler = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getWorkingCapitalFreedHandler';
  const companyId = (req as any).companyId;
  try {
    const data = await getWorkingCapitalFreed(companyId);
    logInfo(LOG_MODULE, handler, 'Working capital freed fetched', { companyId, total: data.total });
    res.status(200).json({ data });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get working capital freed', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/dashboard/dso-reduction
 * Current DSO vs. historical DSO from 30-60 days ago.
 */
export const getDSOReductionHandler = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getDSOReductionHandler';
  const companyId = (req as any).companyId;
  try {
    const data = await getDSOReduction(companyId);
    logInfo(LOG_MODULE, handler, 'DSO reduction fetched', { companyId, reductionDays: data.reductionDays });
    res.status(200).json({ data });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get DSO reduction', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/dashboard/hours-saved
 * Hours saved from automation (email + payment plan effort).
 */
export const getHoursSavedHandler = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getHoursSavedHandler';
  const companyId = (req as any).companyId;
  try {
    const data = await getHoursSaved(companyId);
    logInfo(LOG_MODULE, handler, 'Hours saved fetched', { companyId, hoursSaved: data.hoursSaved });
    res.status(200).json({ data });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get hours saved', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/dashboard/cash-forecast
 * 90-day day-by-day cash balance forecast with trend.
 */
export const getCashForecastHandler = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getCashForecastHandler';
  const companyId = (req as any).companyId;
  try {
    const data = await getEnhancedCashForecast(companyId);
    logInfo(LOG_MODULE, handler, 'Cash forecast generated', { companyId, trend: data.trend, days: data.forecastDays.length });
    res.status(200).json({ data });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to generate cash forecast', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/dashboard/voice-stats
 * Voice calling metrics: calls this month, acceptance rate, duration, etc.
 */
export const getVoiceStatsHandler = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getVoiceStatsHandler';
  const companyId = (req as any).companyId;
  try {
    const stats = await getVoiceCallStats(companyId, 30);
    const recentCalls = await getRecentVoiceCalls(companyId, 5);
    logInfo(LOG_MODULE, handler, 'Voice stats fetched', { companyId, totalCalls: stats.calls_this_month });
    res.status(200).json({ data: { stats, recent_calls: recentCalls } });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get voice stats', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/dashboard/recovery-today
 * Recovery in last 24 hours from pilot accounts (shadow mode review).
 * Used by Dashboard recovery counter.
 */
export const getRecoveryToday = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getRecoveryToday';
  const companyId = (req as any).companyId;

  try {
    // Last 24 hours
    const todayResult = await pool.query(
      `SELECT
         COUNT(*) as count,
         COALESCE(SUM(recovered_amount), 0) as amount
       FROM invoices
       WHERE company_id = $1
         AND recovered_by_recoverai = true
         AND recovered_at >= NOW() - INTERVAL '24 hours'`,
      [companyId]
    );

    // Previous 24 hours (for change_pct calculation)
    const yesterdayResult = await pool.query(
      `SELECT
         COUNT(*) as count,
         COALESCE(SUM(recovered_amount), 0) as amount
       FROM invoices
       WHERE company_id = $1
         AND recovered_by_recoverai = true
         AND recovered_at >= NOW() - INTERVAL '48 hours'
         AND recovered_at < NOW() - INTERVAL '24 hours'`,
      [companyId]
    );

    const todayAmount = parseFloat(todayResult.rows[0]?.amount || 0);
    const todayCount = parseInt(todayResult.rows[0]?.count || 0);
    const yesterdayAmount = parseFloat(yesterdayResult.rows[0]?.amount || 0);

    // Calculate percentage change
    const changePct = yesterdayAmount > 0
      ? Math.round(((todayAmount - yesterdayAmount) / yesterdayAmount) * 100)
      : (todayAmount > 0 ? 100 : 0);

    logInfo(LOG_MODULE, handler, 'Recovery today fetched', { companyId, amount: todayAmount, count: todayCount, changePct });

    res.status(200).json({
      data: {
        amount: todayAmount,
        count: todayCount,
        change_pct: changePct,
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get recovery today', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/dashboard/trial-analysis
 * Returns stored audit analysis for trial users (no real data sync yet)
 */
export const getTrialAnalysis = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getTrialAnalysis';
  const companyId = (req as any).companyId;

  try {
    // Fetch the audit analysis stored during trial creation
    const result = await pool.query(
      `SELECT
        ar.analysis_data,
        ar.created_at as audit_date,
        c.trial_ends_at,
        c.account_type
      FROM companies c
      LEFT JOIN audit_requests ar ON c.id = ar.user_id OR c.email = ar.email
      WHERE c.id = $1
      ORDER BY ar.created_at DESC
      LIMIT 1`,
      [companyId]
    );

    if (result.rows.length === 0) {
      sendErrorResponse(res, 404, 'No trial analysis found');
      return;
    }

    const row = result.rows[0];
    const analysisData = typeof row.analysis_data === 'string'
      ? JSON.parse(row.analysis_data)
      : row.analysis_data;

    if (!analysisData) {
      sendErrorResponse(res, 400, 'Analysis not yet available');
      return;
    }

    // Calculate trial days remaining
    const trialEndsAt = new Date(row.trial_ends_at);
    const now = new Date();
    const daysRemaining = Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    const response = {
      data: {
        ...analysisData,
        trial_days_remaining: daysRemaining,
        trial_ends_at: row.trial_ends_at,
        audit_date: row.audit_date,
      }
    };

    logInfo(LOG_MODULE, handler, 'Trial analysis fetched', {
      companyId,
      score: analysisData.cash_clarity_score,
      daysRemaining
    });

    res.status(200).json(response);
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get trial analysis', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};
