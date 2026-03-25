import express from 'express';
import * as auditController from '../controllers/auditController';

const router = express.Router();

/**
 * POST /api/audits/request
 * Step 1: Prospect enters email, gets OAuth link
 */
router.post('/request', auditController.createAuditRequest);

/**
 * GET /api/audits/callback
 * Step 2: Stripe OAuth callback
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
