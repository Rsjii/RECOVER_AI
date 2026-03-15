"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const dashboardController_1 = require("../controllers/dashboardController");
const agentLoop_1 = require("../queue/agentLoop");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
router.get('/stats', dashboardController_1.getStats);
router.get('/pipeline', dashboardController_1.getPipeline);
router.get('/risk-list', dashboardController_1.getRiskList);
router.get('/timeline', dashboardController_1.getRecoveryTimeline);
/**
 * POST /api/dashboard/agent/trigger
 * Manually trigger an agent run and return a real-time summary.
 */
router.post('/agent/trigger', async (req, res) => {
    try {
        (0, logger_1.logInfo)('dashboardRoute', 'agentTrigger', 'Manual agent run starting', {
            companyId: req.companyId,
        });
        const result = await (0, agentLoop_1.runDecisionEngineNow)();
        res.json({
            message: 'Agent run complete',
            emailsQueued: result.emailsQueued,
            plansOffered: result.planOffersQueued,
            invoicesScanned: result.total,
            skipped: result.skipped,
        });
    }
    catch (err) {
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
        const companyId = req.companyId;
        (0, logger_1.logInfo)('dashboardRoute', 'agentPreview', 'Dry-run preview requested', { companyId });
        const result = await (0, agentLoop_1.runDecisionEngineDryRun)(companyId);
        res.json({
            message: 'Agent preview complete — no emails sent',
            emailsWouldQueue: result.emailsWouldQueue,
            plansWouldOffer: result.plansWouldOffer,
            invoicesScanned: result.total,
            skipped: result.skipped,
            estimatedRecoveryUsd: result.estimatedRecoveryUsd,
            previews: result.previews,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to run agent preview' });
    }
});
exports.default = router;
