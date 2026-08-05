import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requireActiveSubscription } from '../middleware/subscriptionGate';
import { checkTrialStatus, requireNotTrial } from '../middleware/trialGating';
import { demoBlocker } from '../middleware/demoBlocker';
import { getStats, getPipeline, getCoreStats, getRiskList, getRecoveryTimeline, getAtRisk, getCashPositionHandler, updateCashBalanceHandler, updateBurnRateHandler, getWhatIfHandler, getRunwayHandler, getCashLeakageHandler, getKpi, getAgingAnalysisHandler, getEmailAnalyticsHandler, getRiskDriversHandler, /*getPaymentPlansSummaryHandler,*/ getPaymentEvents, getSmsActivity, getWorkingCapitalFreedHandler, getDSOReductionHandler, getHoursSavedHandler, getCashForecastHandler, getVoiceStatsHandler, getRecoveryToday, getTrialAnalysis } from '../controllers/dashboardController';  // ❌ getPaymentPlansSummaryHandler disabled (PHASE 2)
import { runDecisionEngineNow, runDecisionEngineDryRun } from '../queue/agentLoop';
import { findInvoiceById } from '../db/invoices';
import { findCompanyById } from '../db/companies';
import { queueEmailNow } from '../queue/dunningQueue';
import { logInfo, logError } from '../utils/logger';
import { pool } from '../config/database';

const router = Router();

router.use(authMiddleware);
router.use(checkTrialStatus);
router.use(demoBlocker);

// ============================================================
// Rate Limiters (prevent infinite loops from frontend polling)
// IMPORTANT: Only record timestamp on SUCCESS, not on request start
// ============================================================
const agentTriggerTimestamps = new Map<string, number>();
const agentPreviewTimestamps = new Map<string, number>();
const emailTriggerTimestamps = new Map<string, number>();

/**
 * Check if request is rate limited (WITHOUT recording it yet)
 * Only call recordRateLimit() AFTER the operation succeeds
 */
function checkRateLimit(limiter: Map<string, number>, key: string, windowMs: number): { allowed: boolean; secondsUntilNext?: number } {
  const now = Date.now();
  const lastTime = limiter.get(key);
  if (lastTime && now - lastTime < windowMs) {
    return { allowed: false, secondsUntilNext: Math.ceil((windowMs - (now - lastTime)) / 1000) };
  }
  return { allowed: true };
}

/**
 * Record successful request (call AFTER operation succeeds)
 */
function recordRateLimit(limiter: Map<string, number>, key: string): void {
  limiter.set(key, Date.now());
}

router.get('/stats', getStats);
router.get('/pipeline', getPipeline);
router.get('/core-stats', getCoreStats);  // ✅ Batch endpoint: returns stats + pipeline + aging in one call
router.get('/risk-list', getRiskList);
router.get('/timeline', getRecoveryTimeline);
router.get('/at-risk', getAtRisk);
router.get('/cash-position', getCashPositionHandler);
router.put('/cash-balance', updateCashBalanceHandler);
router.put('/burn-rate', updateBurnRateHandler);
router.post('/cash-whatif', getWhatIfHandler);
router.get('/runway', getRunwayHandler);
router.get('/cash-leakage', getCashLeakageHandler);
router.get('/kpi', getKpi);
router.get('/aging-analysis', getAgingAnalysisHandler);
router.get('/email-analytics', getEmailAnalyticsHandler);
router.get('/risk-drivers', getRiskDriversHandler);
// router.get('/payment-plans-summary', getPaymentPlansSummaryHandler);  // ❌ DISABLED: PHASE 2 feature
router.get('/payment-events', getPaymentEvents);
router.get('/sms-activity', getSmsActivity);
router.get('/working-capital-freed', getWorkingCapitalFreedHandler);
router.get('/dso-reduction', getDSOReductionHandler);
router.get('/hours-saved', getHoursSavedHandler);
router.get('/cash-forecast', getCashForecastHandler);
router.get('/voice-stats', getVoiceStatsHandler);
router.get('/recovery-today', getRecoveryToday);
router.get('/trial-analysis', getTrialAnalysis);

/**
 * POST /api/dashboard/agent/trigger
 * Manually trigger an agent run and return a real-time summary.
 * Only available on paid plans (blocks if trial)
 * Rate limited: max 1 trigger per company per 60 seconds
 */
router.post('/agent/trigger', requireActiveSubscription, requireNotTrial, async (req, res) => {
  try {
    const companyId = (req as any).companyId;
    const rateLimitCheck = checkRateLimit(agentTriggerTimestamps, companyId, 60000);

    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        error: `Agent already triggered recently. Please wait ${rateLimitCheck.secondsUntilNext} seconds.`,
        retryAfter: rateLimitCheck.secondsUntilNext,
      });
    }

    logInfo('dashboardRoute', 'agentTrigger', 'Manual agent run starting', {
      companyId,
    });
    const result = await runDecisionEngineNow();

    // Record rate limit ONLY on success
    recordRateLimit(agentTriggerTimestamps, companyId);

    res.json({
      message: 'Agent run complete',
      emailsQueued: result.emailsQueued,
      plansOffered: result.planOffersQueued,
      invoicesScanned: result.total,
      skipped: result.skipped,
    });
  } catch (err) {
    // DO NOT record rate limit on failure — allow retry immediately
    logError('dashboardRoute', 'agentTrigger', 'Agent trigger failed', err);
    res.status(500).json({ error: 'Failed to trigger agent run' });
  }
});

/**
 * POST /api/dashboard/agent/preview
 * Dry-run: shows what the agent WOULD do — no emails sent.
 * Used for trial mode "pending approval" UI on Dashboard.
 * Rate limited: max 1 preview per company per 30 seconds
 */
router.post('/agent/preview', async (req, res) => {
  try {
    const companyId = (req as any).companyId as string;
    const rateLimitCheck = checkRateLimit(agentPreviewTimestamps, companyId, 30000);

    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        error: `Preview already requested recently. Please wait ${rateLimitCheck.secondsUntilNext} seconds.`,
        retryAfter: rateLimitCheck.secondsUntilNext,
      });
    }

    logInfo('dashboardRoute', 'agentPreview', 'Dry-run preview requested', { companyId });
    const result = await runDecisionEngineDryRun(companyId);

    // Record rate limit ONLY on success
    recordRateLimit(agentPreviewTimestamps, companyId);

    res.json({
      message: 'Agent preview complete — no emails sent',
      emailsWouldQueue: result.emailsWouldQueue,
      plansWouldOffer: result.plansWouldOffer,
      invoicesScanned: result.total,
      skipped: result.skipped,
      estimatedRecoveryUsd: result.estimatedRecoveryUsd,
      previews: result.previews,
    });
  } catch (err) {
    // DO NOT record rate limit on failure — allow retry immediately
    logError('dashboardRoute', 'agentPreview', 'Agent preview failed', err);
    res.status(500).json({ error: 'Failed to run agent preview' });
  }
});

/**
 * POST /api/dashboard/agent/trigger-single
 * Send a single email for a specific invoice (called by dashboard individual Send button).
 * Accepts invoiceId and optional emailOverride.
 * Only available on paid plans (blocks if trial)
 * Rate limited: max 5 emails per company per minute (per invoice)
 */
router.post('/agent/trigger-single', requireActiveSubscription, requireNotTrial, async (req, res) => {
  try {
    const companyId = (req as any).companyId as string;
    const { invoiceId, emailOverride } = req.body;

    if (!invoiceId) {
      res.status(400).json({ error: 'invoiceId is required' });
      return;
    }

    // Rate limit: max 5 emails per company per minute
    const emailRateLimitKey = `${companyId}:${invoiceId}`;
    const rateLimitCheck = checkRateLimit(emailTriggerTimestamps, emailRateLimitKey, 12000); // 12s between emails per invoice

    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        error: `Email already sent recently for this invoice. Please wait ${rateLimitCheck.secondsUntilNext} seconds.`,
        retryAfter: rateLimitCheck.secondsUntilNext,
      });
    }

    // Verify invoice belongs to this company
    const invoice = await findInvoiceById(invoiceId, companyId);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    if (invoice.status === 'paid') {
      res.status(400).json({ error: 'Cannot send email for a paid invoice' });
      return;
    }

    // Use override email if provided, otherwise use customer email
    const recipientEmail = emailOverride || invoice.customer_email;
    if (!recipientEmail) {
      res.status(400).json({ error: 'No recipient email available' });
      return;
    }

    // Calculate days overdue
    const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / (24 * 60 * 60 * 1000)));

    // Get company config and customer risk score
    const company = await findCompanyById(companyId);
    const customerRes = await pool.query(
      'SELECT customer_risk_score FROM customers WHERE id = $1',
      [invoice.customer_id]
    );
    const customerRiskScore = customerRes.rows[0]?.customer_risk_score || undefined;

    // Queue the email
    const jobId = await queueEmailNow({
      companyId,
      customerId: invoice.customer_id,
      invoiceId: invoice.id,
      recipientEmail,
      customerName: invoice.customer_name || 'Valued Customer',
      invoiceAmount: Number(invoice.amount),
      dueDate: invoice.due_date,
      daysOverdue,
      emailType: 'dunning_1', // Always send first-stage email for manual triggers
      attemptNumber: 1,
      riskScore: customerRiskScore,
      pilotMode: (company?.pilot_mode || 'auto') as any,
      manualMode: company?.manual_mode || false,
    });

    // Record rate limit ONLY on success (after email is actually queued)
    recordRateLimit(emailTriggerTimestamps, emailRateLimitKey);

    logInfo('dashboardRoute', 'triggerSingle', 'Individual email queued', {
      invoiceId,
      recipientEmail,
      jobId,
    });

    res.json({
      message: 'Email queued successfully',
      invoiceId,
      recipientEmail,
      jobId,
    });
  } catch (err) {
    // DO NOT record rate limit on failure — allow retry immediately
    logError('dashboardRoute', 'triggerSingle', 'Failed to queue individual email', err);
    res.status(500).json({ error: 'Failed to queue email' });
  }
});

export default router;
