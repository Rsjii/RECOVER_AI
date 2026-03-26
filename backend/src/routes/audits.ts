import express from 'express';
import * as auditController from '../controllers/auditController';
import { auditOtpLimiter } from '../middleware/rateLimiter';

const router = express.Router();

/**
 * ─────────────────────────────────────────────────────────────
 * NEW OTP FLOW (Tier 3)
 * ─────────────────────────────────────────────────────────────
 */

/**
 * POST /api/audits/send-otp
 * Step 1 (NEW): Prospect enters email, gets OTP
 */
router.post('/send-otp', auditOtpLimiter, auditController.sendAuditOtp);

/**
 * POST /api/audits/verify-otp
 * Step 2 (NEW): Prospect enters OTP, gets audit created + OAuth link
 */
router.post('/verify-otp', auditOtpLimiter, auditController.verifyAuditOtp);

/**
 * ─────────────────────────────────────────────────────────────
 * LEGACY FLOW (Still supported for backward compatibility)
 * ─────────────────────────────────────────────────────────────
 */

/**
 * POST /api/audits/request
 * Step 1 (LEGACY): Prospect enters email, gets OAuth link
 */
router.post('/request', auditController.createAuditRequest);

/**
 * GET /api/audits/callback
 * Step 2: Stripe OAuth callback (used by both flows)
 */
router.get('/callback', auditController.handleStripeOAuthCallback);

/**
 * GET /api/audits/validate-invite?token=xxx
 * Validate an audit invite token (for gated/invitation-only access)
 */
router.get('/validate-invite', auditController.validateInvite);

/**
 * GET /api/audits/:auditId
 * Step 4: Retrieve audit results
 */
router.get('/:auditId', auditController.getAuditResults);

/**
 * POST /api/audits/:auditId/convert-to-pilot
 * Step 5: Convert to pilot account
 */
router.post('/:auditId/convert-to-pilot', auditController.convertAuditToPilot);

export default router;
