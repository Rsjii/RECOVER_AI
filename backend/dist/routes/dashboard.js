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
exports.default = router;
