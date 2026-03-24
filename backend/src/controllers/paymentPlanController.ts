import { Request, Response } from 'express';
import {
  getPaymentPlanStats,
  getRecentPaymentPlans,
  getPaymentPlanById,
  acceptPaymentPlan,
  completePaymentPlan
} from '../services/paymentPlanService';
import { logInfo } from '../utils/logger';

const MODULE = 'PaymentPlanController';

/**
 * GET /api/payment-plans/stats
 * Get payment plan statistics for authenticated company
 */
export const getPaymentPlansStats = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getPaymentPlansStats';
  const companyId = (req as any).companyId;

  try {
    const daysBackParam = req.query.daysBack;
    const daysBack = typeof daysBackParam === 'string' ? parseInt(daysBackParam) : 30;
    const stats = await getPaymentPlanStats(companyId, daysBack);

    logInfo(MODULE, handler, 'Fetched payment plan stats', { companyId, daysBack });

    res.json({ data: stats });
  } catch (error) {
    console.error('Error fetching payment plan stats:', error);
    res.status(500).json({ error: 'Failed to fetch payment plan stats', code: 'INTERNAL_ERROR' });
  }
};

/**
 * GET /api/payment-plans/recent
 * Get recent payment plans for authenticated company
 */
export const getRecentPlans = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getRecentPlans';
  const companyId = (req as any).companyId;

  try {
    const limitParam = req.query.limit;
    const limit = typeof limitParam === 'string' ? parseInt(limitParam) : 5;
    const plans = await getRecentPaymentPlans(companyId, limit);

    logInfo(MODULE, handler, 'Fetched recent payment plans', { companyId, count: plans.length });

    res.json({ data: plans });
  } catch (error) {
    console.error('Error fetching recent payment plans:', error);
    res.status(500).json({ error: 'Failed to fetch recent payment plans', code: 'INTERNAL_ERROR' });
  }
};

/**
 * GET /api/payment-plans/:planId
 * Get payment plan details including charges
 */
export const getPlanDetails = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getPlanDetails';
  const companyId = (req as any).companyId;
  const planId = Array.isArray(req.params.planId) ? req.params.planId[0] : req.params.planId;

  try {
    const plan = await getPaymentPlanById(planId, companyId);

    logInfo(MODULE, handler, 'Fetched payment plan details', { planId });

    res.json({ data: plan });
  } catch (error) {
    console.error('Error fetching payment plan:', error);
    res.status(500).json({ error: 'Failed to fetch payment plan', code: 'INTERNAL_ERROR' });
  }
};

/**
 * POST /api/payment-plans/:planId/accept
 * Accept a payment plan using acceptance token (public endpoint)
 * Body: { acceptanceToken }
 */
export const acceptPlan = async (req: Request, res: Response): Promise<void> => {
  const handler = 'acceptPlan';
  const planId = Array.isArray(req.params.planId) ? req.params.planId[0] : req.params.planId;
  const { acceptanceToken } = req.body;

  try {
    if (!acceptanceToken) {
      res.status(400).json({ error: 'acceptanceToken is required', code: 'VALIDATION_ERROR' });
      return;
    }

    const plan = await acceptPaymentPlan(planId, acceptanceToken);

    logInfo(MODULE, handler, 'Payment plan accepted', { planId, customerId: plan.customer_id });

    res.json({ data: plan });
  } catch (error) {
    console.error('Error accepting payment plan:', error);
    const message = (error as Error).message || 'Failed to accept payment plan';
    res.status(400).json({ error: message, code: 'ACCEPTANCE_FAILED' });
  }
};

/**
 * PATCH /api/payment-plans/:planId/complete
 * Mark payment plan as completed (admin only, authenticated)
 */
export const completePlan = async (req: Request, res: Response): Promise<void> => {
  const handler = 'completePlan';
  const companyId = (req as any).companyId;
  const planId = Array.isArray(req.params.planId) ? req.params.planId[0] : req.params.planId;

  try {
    const plan = await completePaymentPlan(planId, companyId);

    logInfo(MODULE, handler, 'Payment plan marked as completed', { planId });

    res.json({ data: plan });
  } catch (error) {
    console.error('Error completing payment plan:', error);
    res.status(500).json({ error: 'Failed to complete payment plan', code: 'INTERNAL_ERROR' });
  }
};
