"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecoveryTimeline = exports.getRiskList = exports.getPipeline = exports.getStats = void 0;
const dashboard_1 = require("../db/dashboard");
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../utils/errorHandler");
const LOG_MODULE = 'dashboardController';
/**
 * GET /api/dashboard/stats
 * Recovery stats: total owed, recovered, recovery rate, overdue
 */
const getStats = async (req, res) => {
    const handler = 'getStats';
    const companyId = req.companyId;
    try {
        const startedAt = Date.now();
        const stats = await (0, dashboard_1.getRecoveryStats)(companyId);
        (0, logger_1.logInfo)(LOG_MODULE, handler, 'Stats fetched', { elapsedMs: Date.now() - startedAt });
        res.status(200).json({ data: stats });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, handler, 'Failed to get stats', error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.getStats = getStats;
/**
 * GET /api/dashboard/pipeline
 * Invoice counts by status
 */
const getPipeline = async (req, res) => {
    const handler = 'getPipeline';
    const companyId = req.companyId;
    try {
        const pipeline = await (0, dashboard_1.getInvoicePipeline)(companyId);
        res.status(200).json({ data: pipeline });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, handler, 'Failed to get pipeline', error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.getPipeline = getPipeline;
/**
 * GET /api/dashboard/risk-list?limit=20
 * Customers ranked by risk score with unpaid invoice totals
 */
const getRiskList = async (req, res) => {
    const handler = 'getRiskList';
    const companyId = req.companyId;
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const riskList = await (0, dashboard_1.getCustomerRiskList)(companyId, limit);
        res.status(200).json({ data: riskList, total: riskList.length });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, handler, 'Failed to get risk list', error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.getRiskList = getRiskList;
/**
 * GET /api/dashboard/timeline?period=monthly&months=6
 * Recovery timeline data for charts
 */
const getRecoveryTimeline = async (req, res) => {
    const handler = 'getRecoveryTimeline';
    const companyId = req.companyId;
    const period = req.query.period || 'monthly';
    const months = parseInt(req.query.months) || 6;
    try {
        const periodType = period === 'weekly' ? 'week' : 'month';
        const result = await database_1.pool.query(`SELECT
         DATE_TRUNC($2, i.created_at) as period,
         COUNT(*) FILTER (WHERE i.status = 'paid') as recovered_count,
         COALESCE(SUM(i.amount) FILTER (WHERE i.status = 'paid'), 0) as recovered_amount,
         COUNT(*) as total_count,
         COALESCE(SUM(i.amount), 0) as total_amount
       FROM invoices i
       WHERE i.company_id = $1
         AND i.created_at >= NOW() - ($3 || ' months')::INTERVAL
       GROUP BY period
       ORDER BY period`, [companyId, periodType, months]);
        (0, logger_1.logInfo)(LOG_MODULE, handler, 'Timeline fetched', { companyId, period, months, rows: result.rows.length });
        res.status(200).json({ data: result.rows });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, handler, 'Failed to fetch timeline', error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.getRecoveryTimeline = getRecoveryTimeline;
