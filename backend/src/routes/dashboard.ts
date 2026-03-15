import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getStats, getPipeline, getRiskList, getRecoveryTimeline } from '../controllers/dashboardController';
import { runDecisionEngineNow, runDecisionEngineDryRun } from '../queue/agentLoop';
import { logInfo } from '../utils/logger';

const router = Router();

router.use(authMiddleware);

router.get('/stats', getStats);
router.get('/pipeline', getPipeline);
router.get('/risk-list', getRiskList);
router.get('/timeline', getRecoveryTimeline);

/**
 * POST /api/dashboard/agent/trigger
 * Manually trigger an agent run and return a real-time summary.
 */
router.post('/agent/trigger', async (req, res) => {
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

export default router;
