import { Router } from 'express';
import {
  getPaymentPlansStats,
  getRecentPlans,
  getPlanDetails,
  acceptPlan,
  completePlan
} from '../controllers/paymentPlanController';
import { authMiddleware } from '../middleware/auth';
import { demoBlocker } from '../middleware/demoBlocker';

const router = Router();

// Authenticated endpoints
router.get('/stats', authMiddleware, demoBlocker, getPaymentPlansStats);
router.get('/recent', authMiddleware, demoBlocker, getRecentPlans);
router.get('/:planId', authMiddleware, demoBlocker, getPlanDetails);
router.patch('/:planId/complete', authMiddleware, demoBlocker, completePlan);

// Public endpoint for plan acceptance (no auth needed - token-based)
router.post('/:planId/accept', acceptPlan);

export default router;
