import { Request, Response } from 'express';
import { createPlanForInvoice } from '../services/paymentPlanService';
import {
  findPaymentPlanByInvoice,
  listPaymentPlans,
  updatePaymentPlanStatus,
} from '../db/paymentPlans';
import { logError, logInfo } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';

const LOG_MODULE = 'paymentPlanController';

/**
 * Create a payment plan for an invoice
 * POST /api/payment-plans
 * Body: { invoiceId, numInstallments }
 */
export const createPlan = async (req: Request, res: Response): Promise<void> => {
  const handler = 'createPlan';
  const companyId = (req as any).companyId;

  try {
    const { invoiceId, numInstallments } = req.body;

    if (!invoiceId) {
      sendErrorResponse(res, 400, 'invoiceId is required');
      return;
    }

    const count = parseInt(numInstallments) || 3;
    if (count < 2 || count > 12) {
      sendErrorResponse(res, 400, 'numInstallments must be between 2 and 12');
      return;
    }

    const plan = await createPlanForInvoice(invoiceId, companyId, count);

    logInfo(LOG_MODULE, handler, 'Payment plan created', { planId: plan.id, invoiceId });

    res.status(201).json({ data: plan });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Create plan failed', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * Get payment plan for an invoice
 * GET /api/payment-plans?invoiceId=xxx
 */
export const getPlan = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getPlan';
  const companyId = (req as any).companyId;

  try {
    const invoiceId = req.query.invoiceId as string;

    if (!invoiceId) {
      sendErrorResponse(res, 400, 'invoiceId query param is required');
      return;
    }

    const plan = await findPaymentPlanByInvoice(invoiceId, companyId);
    if (!plan) {
      sendErrorResponse(res, 404, 'No payment plan found for this invoice');
      return;
    }

    res.status(200).json({ data: plan });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Get plan failed', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * List all payment plans for the company
 * GET /api/payment-plans/list
 */
export const listPlans = async (req: Request, res: Response): Promise<void> => {
  const handler = 'listPlans';
  const companyId = (req as any).companyId;

  try {
    const plans = await listPaymentPlans(companyId);
    res.status(200).json({ data: plans, total: plans.length });
  } catch (error) {
    logError(LOG_MODULE, handler, 'List plans failed', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * Mark a plan as defaulted (manual override)
 * PATCH /api/payment-plans/:planId/status
 * Body: { status: 'defaulted' | 'completed' | 'active' }
 */
export const updatePlanStatus = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updatePlanStatus';
  const companyId = (req as any).companyId;

  try {
    const planIdParam = req.params.planId;
    const { status } = req.body;

    if (typeof planIdParam !== 'string' || planIdParam.trim() === '') {
      sendErrorResponse(res, 400, 'planId route param is required');
      return;
    }
    const planId = planIdParam;

    if (!['active', 'completed', 'defaulted'].includes(status)) {
      sendErrorResponse(res, 400, 'status must be active | completed | defaulted');
      return;
    }

    const plan = await updatePaymentPlanStatus(planId, companyId, status);
    if (!plan) {
      sendErrorResponse(res, 404, 'Payment plan not found');
      return;
    }
    logInfo(LOG_MODULE, handler, 'Plan status updated', { planId, status });
    res.status(200).json({ data: plan });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Update plan status failed', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};
