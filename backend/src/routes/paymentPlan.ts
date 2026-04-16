import { Router } from 'express';
// PHASE 2: Payment plans feature - disabled for now
// import {
//   getPaymentPlansStats,
//   getRecentPlans,
//   getPlanDetails,
//   acceptPlan,
//   completePlan
// } from '../controllers/paymentPlanController';
// import { authMiddleware } from '../middleware/auth';
// import { demoBlocker } from '../middleware/demoBlocker';

const router = Router();

// PHASE 2: Payment plan routes disabled
// // Authenticated endpoints
// router.get('/stats', authMiddleware, demoBlocker, getPaymentPlansStats);
// router.get('/recent', authMiddleware, demoBlocker, getRecentPlans);
// router.get('/:planId', authMiddleware, demoBlocker, getPlanDetails);
// router.patch('/:planId/complete', authMiddleware, demoBlocker, completePlan);

// // Public endpoint for plan acceptance (no auth needed - token-based)
// router.post('/:planId/accept', acceptPlan);

export default router;
