"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePlanStatus = exports.listPlans = exports.getPlan = exports.createPlan = void 0;
const paymentPlanService_1 = require("../services/paymentPlanService");
const paymentPlans_1 = require("../db/paymentPlans");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../utils/errorHandler");
const LOG_MODULE = 'paymentPlanController';
/**
 * Create a payment plan for an invoice
 * POST /api/payment-plans
 * Body: { invoiceId, numInstallments }
 */
const createPlan = async (req, res) => {
    const handler = 'createPlan';
    const companyId = req.companyId;
    try {
        const { invoiceId, numInstallments } = req.body;
        if (!invoiceId) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'invoiceId is required');
            return;
        }
        const count = parseInt(numInstallments) || 3;
        if (count < 2 || count > 12) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'numInstallments must be between 2 and 12');
            return;
        }
        const plan = await (0, paymentPlanService_1.createPlanForInvoice)(invoiceId, companyId, count);
        (0, logger_1.logInfo)(LOG_MODULE, handler, 'Payment plan created', { planId: plan.id, invoiceId });
        res.status(201).json({ data: plan });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, handler, 'Create plan failed', error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.createPlan = createPlan;
/**
 * Get payment plan for an invoice
 * GET /api/payment-plans?invoiceId=xxx
 */
const getPlan = async (req, res) => {
    const handler = 'getPlan';
    const companyId = req.companyId;
    try {
        const invoiceId = req.query.invoiceId;
        if (!invoiceId) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'invoiceId query param is required');
            return;
        }
        const plan = await (0, paymentPlans_1.findPaymentPlanByInvoice)(invoiceId, companyId);
        if (!plan) {
            (0, errorHandler_1.sendErrorResponse)(res, 404, 'No payment plan found for this invoice');
            return;
        }
        res.status(200).json({ data: plan });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, handler, 'Get plan failed', error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.getPlan = getPlan;
/**
 * List all payment plans for the company
 * GET /api/payment-plans/list
 */
const listPlans = async (req, res) => {
    const handler = 'listPlans';
    const companyId = req.companyId;
    try {
        const plans = await (0, paymentPlans_1.listPaymentPlans)(companyId);
        res.status(200).json({ data: plans, total: plans.length });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, handler, 'List plans failed', error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.listPlans = listPlans;
/**
 * Mark a plan as defaulted (manual override)
 * PATCH /api/payment-plans/:planId/status
 * Body: { status: 'defaulted' | 'completed' | 'active' }
 */
const updatePlanStatus = async (req, res) => {
    const handler = 'updatePlanStatus';
    const companyId = req.companyId;
    try {
        const planIdParam = req.params.planId;
        const { status } = req.body;
        if (typeof planIdParam !== 'string' || planIdParam.trim() === '') {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'planId route param is required');
            return;
        }
        const planId = planIdParam;
        if (!['active', 'completed', 'defaulted'].includes(status)) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'status must be active | completed | defaulted');
            return;
        }
        const plan = await (0, paymentPlans_1.updatePaymentPlanStatus)(planId, companyId, status);
        if (!plan) {
            (0, errorHandler_1.sendErrorResponse)(res, 404, 'Payment plan not found');
            return;
        }
        (0, logger_1.logInfo)(LOG_MODULE, handler, 'Plan status updated', { planId, status });
        res.status(200).json({ data: plan });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, handler, 'Update plan status failed', error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.updatePlanStatus = updatePlanStatus;
