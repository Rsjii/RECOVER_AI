import express from 'express';
import * as requestsController from '../controllers/requestsController';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = express.Router();

/**
 * POST /api/audit-requests
 * Submit an audit request from website form (PUBLIC)
 */
router.post('/', requestsController.submitAuditRequest);

/**
 * GET /api/audit-requests
 * List audit requests (ADMIN ONLY)
 */
router.get('/', authMiddleware, requireRole('admin'), requestsController.listAuditRequests);

/**
 * GET /api/audit-requests/:email
 * Get single audit request (ADMIN ONLY)
 */
router.get('/:email', authMiddleware, requireRole('admin'), requestsController.getAuditRequest);

/**
 * POST /api/audit-requests/:email/approve
 * Approve audit request (ADMIN ONLY)
 */
router.post('/:email/approve', authMiddleware, requireRole('admin'), requestsController.approveAuditRequest);

/**
 * POST /api/audit-requests/:email/reject
 * Reject audit request (ADMIN ONLY)
 */
router.post('/:email/reject', authMiddleware, requireRole('admin'), requestsController.rejectAuditRequest);

export default router;
