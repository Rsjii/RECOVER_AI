"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recommendPaymentPlan = exports.generateDunningEmail = exports.calculateRiskScore = void 0;
const aiService_1 = __importDefault(require("../services/aiService"));
const auditLogs_1 = require("../db/auditLogs");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../utils/errorHandler");
// ============ Structured Logger ============
const LOG_MODULE = 'aiController';
function logInfo(handler, msg, data) {
    (0, logger_1.logInfo)(LOG_MODULE, handler, msg, data);
}
function logError(handler, msg, error) {
    (0, logger_1.logError)(LOG_MODULE, handler, msg, error);
}
// ============ Handlers ============
/**
 * Calculate risk score for a customer
 * POST /api/ai/risk-score
 */
const calculateRiskScore = async (req, res) => {
    const handler = 'calculateRiskScore';
    const startTime = Date.now();
    const companyId = req.companyId;
    const userId = req.userId;
    try {
        const { customerId, invoiceId, includeHistory } = req.body;
        logInfo(handler, 'Request received', { customerId, invoiceId, userId, companyId });
        // Validate input
        if (!customerId) {
            logInfo(handler, 'Validation failed — missing customerId');
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'customerId is required');
            return;
        }
        if (typeof customerId !== 'string' || customerId.length < 1) {
            logInfo(handler, 'Validation failed — invalid customerId format');
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'customerId must be a non-empty string');
            return;
        }
        // Call AI service
        const riskScore = await aiService_1.default.calculateRiskScore({ customerId, invoiceId, includeHistory });
        // Audit log (non-blocking — never let audit failure crash the response)
        try {
            await (0, auditLogs_1.createAuditLog)({
                companyId,
                userId,
                action: 'AI_RISK_SCORE',
                resourceType: 'customer',
                resourceId: customerId,
                details: { riskScore: riskScore.riskScore, riskLevel: riskScore.riskLevel },
            });
        }
        catch (auditErr) {
            logError(handler, 'Audit log write failed (non-fatal)', auditErr);
        }
        const elapsed = Date.now() - startTime;
        logInfo(handler, `Completed in ${elapsed}ms`, {
            customerId,
            riskScore: riskScore.riskScore,
            riskLevel: riskScore.riskLevel,
        });
        res.status(200).json({
            message: 'Risk score calculated successfully',
            data: riskScore,
        });
    }
    catch (error) {
        const elapsed = Date.now() - startTime;
        logError(handler, `Failed after ${elapsed}ms`, error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.calculateRiskScore = calculateRiskScore;
/**
 * Generate dunning email
 * POST /api/ai/generate-email
 */
const generateDunningEmail = async (req, res) => {
    const handler = 'generateDunningEmail';
    const startTime = Date.now();
    const companyId = req.companyId;
    const userId = req.userId;
    try {
        const { customerId, invoiceId, customerName, invoiceAmount, dueDate, daysOverdue, riskScore, previousReminders, companyName, paymentLink, } = req.body;
        logInfo(handler, 'Request received', { customerId, invoiceId, daysOverdue, userId, companyId });
        // Validate required fields
        const missing = [];
        if (!customerId)
            missing.push('customerId');
        if (!invoiceId)
            missing.push('invoiceId');
        if (!customerName)
            missing.push('customerName');
        if (!invoiceAmount && invoiceAmount !== 0)
            missing.push('invoiceAmount');
        if (!dueDate)
            missing.push('dueDate');
        if (daysOverdue === undefined || daysOverdue === null)
            missing.push('daysOverdue');
        if (missing.length > 0) {
            logInfo(handler, 'Validation failed', { missingFields: missing });
            (0, errorHandler_1.sendErrorResponse)(res, 400, `Missing required fields: ${missing.join(', ')}`);
            return;
        }
        if (typeof invoiceAmount !== 'number' || invoiceAmount < 0) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'invoiceAmount must be a non-negative number');
            return;
        }
        if (typeof daysOverdue !== 'number' || daysOverdue < 0) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'daysOverdue must be a non-negative number');
            return;
        }
        // Call AI service
        const email = await aiService_1.default.generateDunningEmail({
            customerId,
            invoiceId,
            customerName,
            invoiceAmount,
            dueDate,
            daysOverdue,
            riskScore,
            previousReminders,
            companyName: companyName || 'Our Company',
            paymentLink,
        });
        // Audit log (non-blocking)
        try {
            await (0, auditLogs_1.createAuditLog)({
                companyId,
                userId,
                action: 'AI_EMAIL_GENERATION',
                resourceType: 'invoice',
                resourceId: invoiceId,
                details: { customerId, tone: email.tone, daysOverdue },
            });
        }
        catch (auditErr) {
            logError(handler, 'Audit log write failed (non-fatal)', auditErr);
        }
        const elapsed = Date.now() - startTime;
        logInfo(handler, `Completed in ${elapsed}ms`, {
            customerId,
            invoiceId,
            tone: email.tone,
            subjectLength: email.subject.length,
        });
        res.status(200).json({
            message: 'Dunning email generated successfully',
            data: email,
        });
    }
    catch (error) {
        const elapsed = Date.now() - startTime;
        logError(handler, `Failed after ${elapsed}ms`, error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.generateDunningEmail = generateDunningEmail;
/**
 * Recommend payment plan
 * POST /api/ai/recommend-plan
 */
const recommendPaymentPlan = async (req, res) => {
    const handler = 'recommendPaymentPlan';
    const startTime = Date.now();
    const companyId = req.companyId;
    const userId = req.userId;
    try {
        const { customerId, invoiceId, invoiceAmount, daysOverdue, riskScore, customerPaymentHistory, maxDurationDays, } = req.body;
        logInfo(handler, 'Request received', { customerId, invoiceId, invoiceAmount, daysOverdue, userId, companyId });
        // Validate required fields
        const missing = [];
        if (!customerId)
            missing.push('customerId');
        if (!invoiceId)
            missing.push('invoiceId');
        if (!invoiceAmount && invoiceAmount !== 0)
            missing.push('invoiceAmount');
        if (daysOverdue === undefined || daysOverdue === null)
            missing.push('daysOverdue');
        if (missing.length > 0) {
            logInfo(handler, 'Validation failed', { missingFields: missing });
            (0, errorHandler_1.sendErrorResponse)(res, 400, `Missing required fields: ${missing.join(', ')}`);
            return;
        }
        if (typeof invoiceAmount !== 'number' || invoiceAmount <= 0) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'invoiceAmount must be a positive number');
            return;
        }
        // Call AI service
        const recommendation = await aiService_1.default.recommendPaymentPlan({
            customerId,
            invoiceId,
            invoiceAmount,
            daysOverdue,
            riskScore,
            customerPaymentHistory,
            maxDurationDays,
        });
        // Audit log (non-blocking)
        try {
            await (0, auditLogs_1.createAuditLog)({
                companyId,
                userId,
                action: 'AI_PAYMENT_PLAN',
                resourceType: 'invoice',
                resourceId: invoiceId,
                details: {
                    customerId,
                    installmentCount: recommendation.recommendedPlan.installmentCount,
                    successProbability: recommendation.successProbability,
                },
            });
        }
        catch (auditErr) {
            logError(handler, 'Audit log write failed (non-fatal)', auditErr);
        }
        const elapsed = Date.now() - startTime;
        logInfo(handler, `Completed in ${elapsed}ms`, {
            customerId,
            invoiceId,
            installmentCount: recommendation.recommendedPlan.installmentCount,
            successProbability: recommendation.successProbability,
        });
        res.status(200).json({
            message: 'Payment plan recommendation generated',
            data: recommendation,
        });
    }
    catch (error) {
        const elapsed = Date.now() - startTime;
        logError(handler, `Failed after ${elapsed}ms`, error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.recommendPaymentPlan = recommendPaymentPlan;
