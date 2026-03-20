import { Request, Response } from 'express';
import { getRecoveryStats, getInvoicePipeline, getCustomerRiskList } from '../db/dashboard';
import { pool } from '../config/database';
import { logError, logInfo } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';
import { getAtRiskCustomers } from '../services/riskScoringService';
import { getCashPosition, updateCashBalance, calculateWhatIf, calculateRunway, getCashLeakage } from '../services/cashPositionService';
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
