import { Request, Response } from 'express';
import aiService from '../services/aiService';
import { RiskScoreInput, DunningEmailGenerationInput, PaymentPlanRecommendationInput } from '../types/ai';
import { createAuditLog } from '../db/auditLogs';
import { logError as baseLogError, logInfo as baseLogInfo } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';

// ============ Structured Logger ============
const LOG_MODULE = 'aiController';

function logInfo(handler: string, msg: string, data?: Record<string, unknown>): void {
  baseLogInfo(LOG_MODULE, handler, msg, data);
}

function logError(handler: string, msg: string, error?: unknown): void {
  baseLogError(LOG_MODULE, handler, msg, error);
}

// ============ Handlers ============

/**
 * Calculate risk score for a customer
 * POST /api/ai/risk-score
 */
export const calculateRiskScore = async (req: Request, res: Response): Promise<void> => {
  const handler = 'calculateRiskScore';
  const startTime = Date.now();
  const companyId = (req as any).companyId;
  const userId = (req as any).userId;

  try {
    const { customerId, invoiceId, includeHistory } = req.body as RiskScoreInput;

    logInfo(handler, 'Request received', { customerId, invoiceId, userId, companyId });

    // Validate input
    if (!customerId) {
      logInfo(handler, 'Validation failed — missing customerId');
      sendErrorResponse(res, 400, 'customerId is required');
      return;
    }

    if (typeof customerId !== 'string' || customerId.length < 1) {
      logInfo(handler, 'Validation failed — invalid customerId format');
      sendErrorResponse(res, 400, 'customerId must be a non-empty string');
      return;
    }

    // Call AI service
    const riskScore = await aiService.calculateRiskScore({ customerId, invoiceId, includeHistory });

    // Audit log (non-blocking — never let audit failure crash the response)
    try {
      await createAuditLog({
        companyId,
        userId,
        action: 'AI_RISK_SCORE',
        resourceType: 'customer',
        resourceId: customerId,
        details: { riskScore: riskScore.riskScore, riskLevel: riskScore.riskLevel },
      });
    } catch (auditErr) {
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
  } catch (error) {
    const elapsed = Date.now() - startTime;
    logError(handler, `Failed after ${elapsed}ms`, error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * Generate dunning email
 * POST /api/ai/generate-email
 */
export const generateDunningEmail = async (req: Request, res: Response): Promise<void> => {
  const handler = 'generateDunningEmail';
  const startTime = Date.now();
  const companyId = (req as any).companyId;
  const userId = (req as any).userId;

  try {
    const {
      customerId,
      invoiceId,
      customerName,
      invoiceAmount,
      dueDate,
      daysOverdue,
      riskScore,
      previousReminders,
      companyName,
      paymentLink,
    } = req.body as DunningEmailGenerationInput;

    logInfo(handler, 'Request received', { customerId, invoiceId, daysOverdue, userId, companyId });

    // Validate required fields
    const missing: string[] = [];
    if (!customerId) missing.push('customerId');
    if (!invoiceId) missing.push('invoiceId');
    if (!customerName) missing.push('customerName');
    if (!invoiceAmount && invoiceAmount !== 0) missing.push('invoiceAmount');
    if (!dueDate) missing.push('dueDate');
    if (daysOverdue === undefined || daysOverdue === null) missing.push('daysOverdue');

    if (missing.length > 0) {
      logInfo(handler, 'Validation failed', { missingFields: missing });
      sendErrorResponse(res, 400, `Missing required fields: ${missing.join(', ')}`);
      return;
    }

    if (typeof invoiceAmount !== 'number' || invoiceAmount < 0) {
      sendErrorResponse(res, 400, 'invoiceAmount must be a non-negative number');
      return;
    }

    if (typeof daysOverdue !== 'number' || daysOverdue < 0) {
      sendErrorResponse(res, 400, 'daysOverdue must be a non-negative number');
      return;
    }

    // Call AI service
    const email = await aiService.generateDunningEmail({
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
      await createAuditLog({
        companyId,
        userId,
        action: 'AI_EMAIL_GENERATION',
        resourceType: 'invoice',
        resourceId: invoiceId,
        details: { customerId, tone: email.tone, daysOverdue },
      });
    } catch (auditErr) {
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
  } catch (error) {
    const elapsed = Date.now() - startTime;
    logError(handler, `Failed after ${elapsed}ms`, error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * Recommend payment plan
 * POST /api/ai/recommend-plan
 */
export const recommendPaymentPlan = async (req: Request, res: Response): Promise<void> => {
  const handler = 'recommendPaymentPlan';
  const startTime = Date.now();
  const companyId = (req as any).companyId;
  const userId = (req as any).userId;

  try {
    const {
      customerId,
      invoiceId,
      invoiceAmount,
      daysOverdue,
      riskScore,
      customerPaymentHistory,
      maxDurationDays,
    } = req.body as PaymentPlanRecommendationInput;

    logInfo(handler, 'Request received', { customerId, invoiceId, invoiceAmount, daysOverdue, userId, companyId });

    // Validate required fields
    const missing: string[] = [];
    if (!customerId) missing.push('customerId');
    if (!invoiceId) missing.push('invoiceId');
    if (!invoiceAmount && invoiceAmount !== 0) missing.push('invoiceAmount');
    if (daysOverdue === undefined || daysOverdue === null) missing.push('daysOverdue');

    if (missing.length > 0) {
      logInfo(handler, 'Validation failed', { missingFields: missing });
      sendErrorResponse(res, 400, `Missing required fields: ${missing.join(', ')}`);
      return;
    }

    if (typeof invoiceAmount !== 'number' || invoiceAmount <= 0) {
      sendErrorResponse(res, 400, 'invoiceAmount must be a positive number');
      return;
    }

    // Call AI service
    const recommendation = await aiService.recommendPaymentPlan({
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
      await createAuditLog({
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
    } catch (auditErr) {
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
  } catch (error) {
    const elapsed = Date.now() - startTime;
    logError(handler, `Failed after ${elapsed}ms`, error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};
