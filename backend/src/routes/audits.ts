import express from 'express';
import * as auditController from '../controllers/auditController';
import * as generateAuditController from '../controllers/generateAuditController';
import { auditOtpLimiter, publicFormLimiter } from '../middleware/rateLimiter';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = express.Router();

/**
 * ─────────────────────────────────────────────────────────────
 * NEW EARLY ACCOUNT CREATION FLOW
 * ─────────────────────────────────────────────────────────────
 */

/**
 * POST /api/audits/create-account
 * STEP 0 (NEW): Early account creation for audit flow
 * Called when user enters email in FreeAuditSignup
 * Enables session persistence if user kills app mid-flow
 */
router.post('/create-account', publicFormLimiter, auditController.createAuditAccount);

/**
 * ─────────────────────────────────────────────────────────────
 * OTP FLOW (Steps 1-5)
 * ─────────────────────────────────────────────────────────────
 */

/**
 * POST /api/audits/send-otp
 * Step 1: Prospect enters email, gets OTP
 */
router.post('/send-otp', auditOtpLimiter, auditController.sendAuditOtp);

/**
 * POST /api/audits/verify-otp
 * Step 2 (NEW): Prospect enters OTP, gets audit created + OAuth link
 */
router.post('/verify-otp', auditOtpLimiter, auditController.verifyAuditOtp);

/**
 * GET /api/audits/callback
 * Stripe OAuth callback for audit analysis
 */
router.get('/callback', auditController.handleStripeOAuthCallback);

/**
 * GET /api/audits/results/:token
 * Retrieve audit results by token (public, no auth required)
 * Returns cash clarity score, metrics, risks, billing errors, insights
 */
router.get('/results/:token', auditController.getAuditResultsByToken);

/**
 * POST /api/audits/create-trial-account
 * Convert audit to trial account (user clicks "Start 14-Day Trial")
 * Creates company + user + auto-login
 */
router.post('/create-trial-account', publicFormLimiter, auditController.createTrialAccount);

/**
 * ─────────────────────────────────────────────────────────────
 * MOTION 2: PUBLIC AUDIT REQUEST FORM + ADMIN DASHBOARD
 * MUST come before /:auditId to prevent route conflicts
 * ─────────────────────────────────────────────────────────────
 */

/**
 * POST /api/audits/requests/submit
 * Motion 2 Step 1: Public form submission (rate limited)
 */
router.post('/requests/submit', publicFormLimiter, auditController.submitAuditRequest);

/**
 * POST /api/audits/requests/verify-email
 * Motion 2 Step 2: Verify email from form
 */
router.post('/requests/verify-email', auditOtpLimiter, auditController.verifyAuditEmail);

/**
 * GET /api/audits/requests (Admin only)
 * List all audit requests with optional status filter
 */
router.get('/requests', authMiddleware, requireRole('admin'), auditController.listAuditRequests);

/**
 * POST /api/audits/requests/:id/approve (Admin only)
 * Admin approves request, generates token, sends email
 */
router.post('/requests/:id/approve', authMiddleware, requireRole('admin'), auditController.approveAuditRequest);

/**
 * POST /api/audits/requests/:id/reject (Admin only)
 * Admin rejects request, sends rejection email
 */
router.post('/requests/:id/reject', authMiddleware, requireRole('admin'), auditController.rejectAuditRequest);

/**
 * GET /api/audits/validate-token
 * Validate invite token for onboarding flow
 */
router.get('/validate-token', auditController.validateInviteToken);

/**
 * GET /api/audits/check-stage
 * Check current onboarding stage for user
 */
router.get('/check-stage', authMiddleware, auditController.checkOnboardingStage);

/**
 * POST /api/audits/generate
 * NEW: Generate audit analysis from Stripe data
 * Called from GenerateAudit page (auto-triggered on load)
 * Requires authentication
 */
router.post('/generate', authMiddleware, generateAuditController.generateAudit);

/**
 * POST /api/audits/start-trial
 * NEW: Start 14-day trial for authenticated user
 * Called when user clicks "Start Trial" on GenerateAudit page
 * Creates trial company if needed, sets trial_ends_at
 */
router.post('/start-trial', authMiddleware, generateAuditController.startTrial);

/**
 * ─────────────────────────────────────────────────────────────
 * CASHOS NEW FLOW ENDPOINTS (replaces Stage 4-5)
 * ─────────────────────────────────────────────────────────────
 */

/**
 * GET /api/integrations/status
 * Check if Stripe/QB connected (replaces /api/audits/stage/4)
 * AUTHENTICATED
 */
router.get('/integrations/status', authMiddleware, generateAuditController.getIntegrationStatus);

/**
 * POST /api/integrations/proceed
 * Proceed to audit generation after Stripe connected (replaces /api/audits/stage/4/next)
 * AUTHENTICATED
 */
router.post('/integrations/proceed', authMiddleware, generateAuditController.proceedFromIntegrations);

/**
 * GET /api/audit/generate
 * Generate full audit analysis from Stripe data (replaces /api/audits/stage/5/analysis)
 * Returns 6 advanced metrics: aging buckets, concentration, high-risk, trend, billing errors
 * AUTHENTICATED
 */
router.get('/audit/generate', authMiddleware, generateAuditController.generateAudit);

/**
 * POST /api/trial/start
 * Start 14-day free trial (replaces /api/audits/stage/5/start-trial)
 * AUTHENTICATED
 */
router.post('/trial/start', authMiddleware, generateAuditController.startTrial);

/**
 * POST /api/integrations/validate-stripe-key
 * Validate and store Stripe API key (manual entry)
 * AUTHENTICATED
 */
router.post('/integrations/validate-stripe-key', authMiddleware, generateAuditController.validateStripeKey);

/**
 * POST /api/integrations/upload-invoices
 * Upload invoice CSV file (manual entry)
 * AUTHENTICATED
 */
router.post('/integrations/upload-invoices', authMiddleware, generateAuditController.uploadInvoices);

/**
 * ─────────────────────────────────────────────────────────────
 * PARAMETERIZED ROUTES - MUST come last
 * ─────────────────────────────────────────────────────────────
 */

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
