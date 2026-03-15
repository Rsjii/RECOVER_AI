"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleLemonSqueezyWebhook = exports.createLemonSqueezyCheckout = exports.reconcileBillingState = exports.syncRecoveredAmountToUsage = exports.getEntitlements = exports.recordUsage = exports.getUsage = exports.createMonthlyBillingInvoice = exports.listBillingInvoices = exports.updateSubscription = exports.getCurrentSubscription = exports.listPlans = void 0;
const BillingDB = __importStar(require("../db/billing"));
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../utils/errorHandler");
const lemonSqueezyService_1 = __importDefault(require("../services/lemonSqueezyService"));
const LOG_MODULE = 'billingController';
const listPlans = async (_req, res) => {
    try {
        await BillingDB.ensureDefaultPlans();
        const plans = await BillingDB.listActivePlans();
        res.status(200).json({ data: plans });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'listPlans', 'Failed to list plans', error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.listPlans = listPlans;
const getCurrentSubscription = async (req, res) => {
    const companyId = req.companyId;
    try {
        const subscription = await BillingDB.getCurrentSubscription(companyId);
        // Augment with real-time recovery fee for current billing period
        let recoveryFee = null;
        if (subscription) {
            const now = new Date();
            const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
            const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
            const [paymentsRes, plansRes] = await Promise.all([
                database_1.pool.query(`SELECT COALESCE(SUM(amount), 0)::text AS total FROM payments
           WHERE company_id = $1 AND status = 'succeeded' AND paid_at >= $2 AND paid_at < $3`, [companyId, monthStart, monthEnd]),
                BillingDB.listActivePlans(),
            ]);
            const recoveredUsd = Number(paymentsRes.rows[0]?.total || 0);
            const plan = plansRes.find((p) => p.code === subscription.plan_code);
            const baseFeeUsd = Number(plan?.base_price_usd || 0);
            const feePct = Number(plan?.success_fee_percent || 1);
            const recoveryFeeUsd = Number(((recoveredUsd * feePct) / 100).toFixed(2));
            recoveryFee = {
                baseFeeUsd,
                recoveredUsd,
                feePct,
                recoveryFeeUsd,
                totalUsd: Number((baseFeeUsd + recoveryFeeUsd).toFixed(2)),
            };
        }
        res.status(200).json({ data: subscription, recoveryFee });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'getCurrentSubscription', 'Failed to fetch subscription', error, { companyId });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.getCurrentSubscription = getCurrentSubscription;
const updateSubscription = async (req, res) => {
    const companyId = req.companyId;
    const { planCode, status } = req.body;
    if (!planCode) {
        (0, errorHandler_1.sendErrorResponse)(res, 400, 'planCode is required');
        return;
    }
    const nextStatus = status || 'active';
    try {
        await BillingDB.upsertCompanySubscription({
            companyId,
            planCode,
            status: nextStatus,
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        (0, logger_1.logInfo)(LOG_MODULE, 'updateSubscription', 'Subscription updated', { companyId, planCode, nextStatus });
        const subscription = await BillingDB.getCurrentSubscription(companyId);
        res.status(200).json({ data: subscription });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'updateSubscription', 'Failed to update subscription', error, { companyId, planCode });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.updateSubscription = updateSubscription;
const listBillingInvoices = async (req, res) => {
    const companyId = req.companyId;
    try {
        const invoices = await BillingDB.listBillingInvoices(companyId, 50);
        res.status(200).json({ data: invoices });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'listBillingInvoices', 'Failed to list billing invoices', error, { companyId });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.listBillingInvoices = listBillingInvoices;
const createMonthlyBillingInvoice = async (req, res) => {
    const companyId = req.companyId;
    try {
        const subscription = await BillingDB.getCurrentSubscription(companyId);
        if (!subscription) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'No active subscription found');
            return;
        }
        const now = new Date();
        const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
        const usage = await BillingDB.getUsageRollups(companyId, periodStart);
        const recoveredMetric = usage.find((u) => u.metric_key === 'recovered_amount_usd');
        const recoveredAmount = Number(recoveredMetric?.quantity || 0);
        const plans = await BillingDB.listActivePlans();
        const plan = plans.find((p) => p.code === subscription.plan_code);
        const baseAmount = Number(plan?.base_price_usd || 0);
        const successFeePct = Number(plan?.success_fee_percent || 1);
        const successFeeAmount = Number(((recoveredAmount * successFeePct) / 100).toFixed(2));
        const total = Number((baseAmount + successFeeAmount).toFixed(2));
        await BillingDB.createBillingInvoice({
            companyId,
            subscriptionId: subscription.id,
            periodStart,
            periodEnd,
            baseAmountUsd: baseAmount,
            successFeeAmountUsd: successFeeAmount,
            totalAmountUsd: total,
            status: 'open',
            lineItems: [
                { key: 'base_plan_fee', amountUsd: baseAmount, note: `Base fee for ${subscription.plan_name}` },
                { key: 'success_fee', amountUsd: successFeeAmount, note: `${successFeePct}% of recovered amount`, baseRecoveredUsd: recoveredAmount },
            ],
        });
        const invoices = await BillingDB.listBillingInvoices(companyId, 1);
        res.status(201).json({ data: invoices[0] });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'createMonthlyBillingInvoice', 'Failed to generate monthly billing invoice', error, { companyId });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.createMonthlyBillingInvoice = createMonthlyBillingInvoice;
const getUsage = async (req, res) => {
    const companyId = req.companyId;
    try {
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const usage = await BillingDB.getUsageRollups(companyId, monthStart);
        res.status(200).json({ data: usage, periodMonth: monthStart.toISOString().slice(0, 10) });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'getUsage', 'Failed to fetch usage', error, { companyId });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.getUsage = getUsage;
const recordUsage = async (req, res) => {
    const companyId = req.companyId;
    const { metricKey, quantity, source, metadata } = req.body;
    if (!metricKey || typeof quantity !== 'number') {
        (0, errorHandler_1.sendErrorResponse)(res, 400, 'metricKey and numeric quantity are required');
        return;
    }
    try {
        await BillingDB.recordUsageEvent({
            companyId,
            metricKey,
            quantity,
            source,
            metadata,
        });
        res.status(201).json({ message: 'Usage event recorded' });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'recordUsage', 'Failed to record usage', error, { companyId, metricKey, quantity });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.recordUsage = recordUsage;
const getEntitlements = async (req, res) => {
    const companyId = req.companyId;
    try {
        const entitlements = await BillingDB.getEntitlements(companyId);
        res.status(200).json({ data: entitlements });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'getEntitlements', 'Failed to fetch entitlements', error, { companyId });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.getEntitlements = getEntitlements;
const syncRecoveredAmountToUsage = async (req, res) => {
    const companyId = req.companyId;
    try {
        const totals = await database_1.pool.query(`SELECT COALESCE(SUM(amount), 0)::text AS total
       FROM payments
       WHERE company_id = $1 AND status = 'succeeded'`, [companyId]);
        const recovered = Number(totals.rows[0]?.total || 0);
        await BillingDB.recordUsageEvent({
            companyId,
            metricKey: 'recovered_amount_usd',
            quantity: recovered,
            source: 'sync_job',
            metadata: { note: 'Synced from dashboard stats' },
        });
        res.status(200).json({ message: 'Recovered amount synced to usage rollups' });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'syncRecoveredAmountToUsage', 'Failed to sync recovered amount', error, { companyId });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.syncRecoveredAmountToUsage = syncRecoveredAmountToUsage;
const reconcileBillingState = async (req, res) => {
    const companyId = req.companyId;
    try {
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
        const [paymentsSum, usageRecovered] = await Promise.all([
            database_1.pool.query(`SELECT COALESCE(SUM(amount), 0)::text AS total
         FROM payments
         WHERE company_id = $1
           AND status = 'succeeded'
           AND paid_at >= $2
           AND paid_at < $3`, [companyId, monthStart, monthEnd]),
            database_1.pool.query(`SELECT COALESCE(SUM(quantity), 0)::text AS total
         FROM monthly_usage_rollups
         WHERE company_id = $1
           AND period_month = $2
           AND metric_key = 'recovered_amount_usd'`, [companyId, monthStart]),
        ]);
        const paymentsTotal = Number(paymentsSum.rows[0]?.total || 0);
        const usageTotal = Number(usageRecovered.rows[0]?.total || 0);
        const delta = Number((paymentsTotal - usageTotal).toFixed(2));
        if (Math.abs(delta) > 0.01) {
            await BillingDB.recordUsageEvent({
                companyId,
                metricKey: 'recovered_amount_usd',
                quantity: delta,
                source: 'reconciliation',
                metadata: { monthStart: monthStart.toISOString() },
            });
        }
        res.status(200).json({
            data: {
                periodMonth: monthStart.toISOString().slice(0, 10),
                paymentsTotal,
                usageTotalBefore: usageTotal,
                deltaApplied: Math.abs(delta) > 0.01 ? delta : 0,
                status: Math.abs(delta) > 0.01 ? 'corrected' : 'already_consistent',
            },
        });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'reconcileBillingState', 'Failed to reconcile billing state', error, { companyId });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.reconcileBillingState = reconcileBillingState;
// ============ LemonSqueezy Integration ============
const createLemonSqueezyCheckout = async (req, res) => {
    const companyId = req.companyId;
    const { plan } = req.body;
    try {
        (0, logger_1.logInfo)(LOG_MODULE, 'createLemonSqueezyCheckout', 'Creating checkout', { companyId, plan });
        if (!['starter', 'growth', 'enterprise'].includes(plan)) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'Invalid plan');
            return;
        }
        const result = await lemonSqueezyService_1.default.createCheckout({
            planId: plan,
            customerEmail: req.email || 'unknown@example.com',
            customerName: req.name || 'User',
            companyId,
        });
        if (!result.success) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, result.error || 'Failed to create checkout');
            return;
        }
        res.status(200).json({
            success: true,
            checkoutUrl: result.checkoutUrl,
        });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'createLemonSqueezyCheckout', 'Failed to create checkout', error, { companyId });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.createLemonSqueezyCheckout = createLemonSqueezyCheckout;
const handleLemonSqueezyWebhook = async (req, res) => {
    try {
        const signature = req.headers['x-signature'];
        const body = JSON.stringify(req.body);
        (0, logger_1.logInfo)(LOG_MODULE, 'handleLemonSqueezyWebhook', 'Received webhook');
        // Verify signature
        const isValid = lemonSqueezyService_1.default.verifyWebhookSignature(body, signature);
        if (!isValid) {
            (0, logger_1.logError)(LOG_MODULE, 'handleLemonSqueezyWebhook', 'Invalid signature');
            (0, errorHandler_1.sendErrorResponse)(res, 401, 'Invalid signature');
            return;
        }
        // Handle webhook event
        await lemonSqueezyService_1.default.handleWebhook(req.body);
        (0, logger_1.logInfo)(LOG_MODULE, 'handleLemonSqueezyWebhook', 'Webhook processed successfully');
        res.status(200).json({ success: true });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'handleLemonSqueezyWebhook', 'Webhook processing failed', error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.handleLemonSqueezyWebhook = handleLemonSqueezyWebhook;
