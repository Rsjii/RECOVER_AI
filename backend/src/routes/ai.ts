import { Router } from 'express';
import { calculateRiskScore, generateDunningEmail, recommendPaymentPlan } from '../controllers/aiController';
import { authMiddleware } from '../middleware/auth';
import { demoBlocker } from '../middleware/demoBlocker';

const router = Router();

// All AI routes require authentication
router.use(authMiddleware);
router.use(demoBlocker);

// Risk scoring
router.post('/risk-score', calculateRiskScore);

// Email generation
router.post('/generate-email', generateDunningEmail);

// Payment plan recommendation
router.post('/recommend-plan', recommendPaymentPlan);

export default router;
