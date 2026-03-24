import { Router } from 'express';
import {
  getPaymentPlansStats,
  getRecentPlans,
  getPlanDetails,
  acceptPlan,
  completePlan
} from '../controllers/paymentPlanController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Authenticated endpoints
router.get('/stats', authMiddleware, getPaymentPlansStats);
router.get('/recent', authMiddleware, getRecentPlans);
router.get('/:planId', authMiddleware, getPlanDetails);
router.patch('/:planId/complete', authMiddleware, completePlan);

// Public endpoint for plan acceptance (no auth needed - token-based)
router.post('/:planId/accept', acceptPlan);

export default router;
