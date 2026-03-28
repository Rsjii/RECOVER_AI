import express from 'express';
import { publicFormLimiter } from '../middleware/rateLimiter';
import { authMiddleware } from '../middleware/auth';
import * as c from '../controllers/auditStagesController';

const router = express.Router();

// ─── PUBLIC (token-based, no auth cookie) ────────────────────────────────────

/** Validate invite token (check expiry, get pre-fill data) */
router.get('/validate-token', publicFormLimiter, c.validateToken);

/** Stage 1: Submit email+password (sends OTP) or Google OAuth (creates account) */
router.post('/stage/1', publicFormLimiter, c.submitStage1Auth);

/** Stage 2: Verify OTP → creates account, sets auth cookies */
router.post('/stage/1/verify-otp', publicFormLimiter, c.verifyStage1OTP);

// ─── AUTHENTICATED (httpOnly cookie required after Stage 2) ─────────────────

/** Resume helper: returns which frontend stage number to redirect to */
router.get('/check-stage', authMiddleware, c.checkOnboardingStage);

/** Stage 3: Update company details */
router.post('/stage/3/details', authMiddleware, c.updateStage3Details);

/** Stage 4: Get integration status (Stripe + QB) */
router.get('/stage/4', authMiddleware, c.getStage4Status);

/** Stage 4: Proceed to Stage 5 (requires Stripe connected) */
router.post('/stage/4/next', authMiddleware, c.proceedFromStage4);

/** Stage 5: Generate cash position analysis */
router.get('/stage/5/analysis', authMiddleware, c.generateAuditAnalysis);

/** Stage 5: Start 14-day free trial */
router.post('/stage/5/start-trial', authMiddleware, c.startTrial);

export default router;
