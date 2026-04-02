import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requireActiveSubscription } from '../middleware/subscriptionGate';
import { checkTrialStatus, requireNotTrial } from '../middleware/trialGating';
import { demoBlocker } from '../middleware/demoBlocker';
import { getStats, getPipeline, getRiskList, getRecoveryTimeline, getAtRisk, getCashPositionHandler, updateCashBalanceHandler, getWhatIfHandler, getRunwayHandler, getCashLeakageHandler, getKpi, getAgingAnalysisHandler, getEmailAnalyticsHandler, getRiskDriversHandler, getPaymentPlansSummaryHandler, getPaymentEvents, getSmsActivity, getWorkingCapitalFreedHandler, getDSOReductionHandler, getCashForecastHandler, getVoiceStatsHandler, getRecoveryToday, getTrialAnalysis } from '../controllers/dashboardController';
import { runDecisionEngineNow, runDecisionEngineDryRun } from '../queue/agentLoop';
import { findInvoiceById } from '../db/invoices';
import { queueEmailNow } from '../queue/dunningQueue';
import { logInfo, logError } from '../utils/logger';

const router = Router();

router.use(authMiddleware);
router.use(checkTrialStatus);
router.use(demoBlocker);

router.get('/stats', getStats);
router.get('/pipeline', getPipeline);
router.get('/risk-list', getRiskList);
router.get('/timeline', getRecoveryTimeline);
router.get('/at-risk', getAtRisk);
router.get('/cash-position', getCashPositionHandler);
router.put('/cash-balance', updateCashBalanceHandler);
router.post('/cash-whatif', getWhatIfHandler);
router.get('/runway', getRunwayHandler);
router.get('/cash-leakage', getCashLeakageHandler);
router.get('/kpi', getKpi);
router.get('/aging-analysis', getAgingAnalysisHandler);
router.get('/email-analytics', getEmailAnalyticsHandler);
router.get('/risk-drivers', getRiskDriversHandler);
router.get('/payment-plans-summary', getPaymentPlansSummaryHandler);
router.get('/payment-events', getPaymentEvents);
router.get('/sms-activity', getSmsActivity);
router.get('/working-capital-freed', getWorkingCapitalFreedHandler);
router.get('/dso-reduction', getDSOReductionHandler);
router.get('/cash-forecast', getCashForecastHandler);
router.get('/voice-stats', getVoiceStatsHandler);
router.get('/recovery-today', getRecoveryToday);
router.get('/trial-analysis', getTrialAnalysis);

/**
 * POST /api/dashboard/agent/trigger
 * Manually trigger an agent run and return a real-time summary.
 * Only available on paid plans (blocks if trial)
 */
router.post('/agent/trigger', requireActiveSubscription, requireNotTrial, async (req, res) => {
  try {
    logInfo('dashboardRoute', 'agentTrigger', 'Manual agent run starting', {
      companyId: (req as any).companyId,
    });
    const result = await runDecisionEngineNow();
    res.json({
      message: 'Agent run complete',
      emailsQueued: result.emailsQueued,
      plansOffered: result.planOffersQueued,
      invoicesScanned: result.total,
      skipped: result.skipped,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to trigger agent run' });
  }
});

/**
 * POST /api/dashboard/agent/preview
 * Dry-run: shows what the agent WOULD do — no emails sent.
 * Used for trial mode "pending approval" UI on Dashboard.
 */
router.post('/agent/preview', async (req, res) => {
  try {
    const companyId = (req as any).companyId as string;
    logInfo('dashboardRoute', 'agentPreview', 'Dry-run preview requested', { companyId });
    const result = await runDecisionEngineDryRun(companyId);
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
    res.status(500).json({ error: 'Failed to run agent preview' });
  }
});

/**
 * POST /api/dashboard/agent/trigger-single
 * Send a single email for a specific invoice (called by dashboard individual Send button).
 * Accepts invoiceId and optional emailOverride.
 * Only available on paid plans (blocks if trial)
 */
router.post('/agent/trigger-single', requireActiveSubscription, requireNotTrial, async (req, res) => {
  try {
    const companyId = (req as any).companyId as string;
    const { invoiceId, emailOverride } = req.body;

    if (!invoiceId) {
      res.status(400).json({ error: 'invoiceId is required' });
      return;
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
      riskScore: invoice.risk_score || undefined,
    });

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
    logError('dashboardRoute', 'triggerSingle', 'Failed to queue individual email', err);
    res.status(500).json({ error: 'Failed to queue email' });
  }
});

export default router;
