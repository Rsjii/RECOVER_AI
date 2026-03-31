import express from 'express';
import { publicFormLimiter } from '../middleware/rateLimiter';
import { authMiddleware } from '../middleware/auth';
import * as c from '../controllers/auditStagesController';

const router = express.Router();

// ─── PUBLIC (token-based, no auth cookie) ────────────────────────────────────

/** Validate invite token (check expiry, get pre-fill data) */
router.get('/validate-token', publicFormLimiter, c.validateToken);

/**
 * Stage 1: Auth + Company Details (3-step form)
 * Step 1: Submit email+password (sends OTP) or Google OAuth (creates account)
 */
router.post('/stage/1', publicFormLimiter, c.submitStage1Auth);

/**
 * Stage 1: Auth + Company Details (3-step form)
 * Step 2: Verify OTP → creates account, sets auth cookies
 */
router.post('/stage/1/verify-otp', publicFormLimiter, c.verifyStage1OTP);

/**
 * Stage 1: Auth + Company Details (3-step form)
 * Step 3: Update company + first/last name details
 */
router.post('/stage/1/details', authMiddleware, c.updateStage3Details);

// ─── AUTHENTICATED (httpOnly cookie required after Stage 1) ─────────────────

/** Resume helper: returns which frontend stage number to redirect to */
router.get('/check-stage', authMiddleware, c.checkOnboardingStage);

/** Stage 2: Get integration status (Stripe + QB) */
router.get('/stage/2', authMiddleware, c.getStage4Status);

/** Stage 2: Proceed to Stage 3 (requires Stripe connected) */
router.post('/stage/2/proceed', authMiddleware, c.proceedFromStage4);

/** Stage 3: Generate cash position analysis */
router.get('/stage/3/analysis', authMiddleware, c.generateAuditAnalysis);

/** Stage 3: Start 14-day free trial */
router.post('/stage/3/start-trial', authMiddleware, c.startTrial);

// ─── BACKWARDS COMPATIBILITY (old route names still work for existing clients) ─
router.post('/stage/3/details', authMiddleware, c.updateStage3Details);
router.get('/stage/4', authMiddleware, c.getStage4Status);
router.post('/stage/4/next', authMiddleware, c.proceedFromStage4);
router.get('/stage/5/analysis', authMiddleware, c.generateAuditAnalysis);
router.post('/stage/5/start-trial', authMiddleware, c.startTrial);

export default router;
