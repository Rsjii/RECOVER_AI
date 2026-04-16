import express from 'express';
import * as pilotQueueController from '../controllers/pilotQueueController';
import { authMiddleware } from '../middleware/auth';
import { demoBlocker } from '../middleware/demoBlocker';

const router = express.Router();

/**
 * TEST ENDPOINT (Staging only - no auth required for testing)
 * POST /api/pilot-queue/test/populate?count=3
 * Populates queue with test email + SMS items
 */
router.post('/test/populate', authMiddleware, pilotQueueController.testPopulateQueue);

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
 * POST /api/pilot-queue/bulk/approve-selected
 * Approve and send selected pending emails (optimized bulk operation)
 */
router.post('/bulk/approve-selected', authMiddleware, demoBlocker, pilotQueueController.bulkApproveSelected);

/**
 * POST /api/pilot-queue/bulk/reject-selected
 * Reject selected pending emails (optimized bulk operation)
 */
router.post('/bulk/reject-selected', authMiddleware, demoBlocker, pilotQueueController.bulkRejectSelected);

/**
 * POST /api/pilot-queue/bulk/move-to-pending-selected
 * Move selected rejected emails back to pending (optimized bulk operation)
 */
router.post('/bulk/move-to-pending-selected', authMiddleware, demoBlocker, pilotQueueController.bulkMoveToPendingSelected);

/**
 * POST /api/pilot-queue/:id/preview
 * Preview a queued email (requires auth)
 */
router.post('/:id/preview', authMiddleware, demoBlocker, pilotQueueController.previewQueuedEmail);

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

/**
 * POST /api/pilot-queue/:id/move-to-pending
 * Move a rejected email back to pending for review/edit (SHADOW mode)
 */
router.post('/:id/move-to-pending', authMiddleware, demoBlocker, pilotQueueController.moveRejectedToPending);

/**
 * POST /api/pilot-queue/:id/retry
 * Manually retry a failed email (requires auth)
 */
router.post('/:id/retry', authMiddleware, demoBlocker, pilotQueueController.retryQueuedEmail);

/**
 * PUT /api/pilot-queue/:id
 * Update subject/body of a queued email (requires auth)
 */
router.put('/:id', authMiddleware, demoBlocker, pilotQueueController.updateQueuedEmail);

export default router;
