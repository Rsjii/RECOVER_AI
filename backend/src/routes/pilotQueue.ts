import express from 'express';
import * as pilotQueueController from '../controllers/pilotQueueController';
import { authMiddleware } from '../middleware/auth';
import { demoBlocker } from '../middleware/demoBlocker';

const router = express.Router();

/**
 * GET /api/pilot-queue
 * List queued emails for pilot company (requires auth)
 */
router.get('/', authMiddleware, demoBlocker, pilotQueueController.listQueuedEmails);

/**
 * GET /api/pilot-queue/stats
 * Get queue statistics (requires auth)
 */
router.get('/stats', authMiddleware, demoBlocker, pilotQueueController.getQueueStats);

/**
 * POST /api/pilot-queue/approve-all
 * Approve and send all pending queued emails (requires auth)
 * MUST be registered BEFORE /:id routes to prevent :id from matching "approve-all"
 */
router.post('/approve-all', authMiddleware, demoBlocker, pilotQueueController.approveAllQueuedEmails);

/**
 * POST /api/pilot-queue/:id/approve
 * Approve and send a queued email (requires auth)
 */
router.post('/:id/approve', authMiddleware, demoBlocker, pilotQueueController.approveQueuedEmail);

/**
 * POST /api/pilot-queue/:id/reject
 * Reject a queued email (requires auth)
 */
router.post('/:id/reject', authMiddleware, demoBlocker, pilotQueueController.rejectQueuedEmail);

export default router;
