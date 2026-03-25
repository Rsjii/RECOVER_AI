import express from 'express';
import * as pilotQueueController from '../controllers/pilotQueueController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

/**
 * GET /api/pilot-queue
 * List queued emails for pilot company (requires auth)
 */
router.get('/', authMiddleware, pilotQueueController.listQueuedEmails);

/**
 * GET /api/pilot-queue/stats
 * Get queue statistics (requires auth)
 */
router.get('/stats', authMiddleware, pilotQueueController.getQueueStats);

/**
 * POST /api/pilot-queue/:id/approve
 * Approve and send a queued email (requires auth)
 */
router.post('/:id/approve', authMiddleware, pilotQueueController.approveQueuedEmail);

/**
 * POST /api/pilot-queue/:id/reject
 * Reject a queued email (requires auth)
 */
router.post('/:id/reject', authMiddleware, pilotQueueController.rejectQueuedEmail);

/**
 * POST /api/pilot-queue/approve-all
 * Approve and send all pending queued emails (requires auth)
 */
router.post('/approve-all', authMiddleware, pilotQueueController.approveAllQueuedEmails);

export default router;
