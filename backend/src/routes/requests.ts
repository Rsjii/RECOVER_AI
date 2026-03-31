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

// Approval/reject flows removed - direct signup flow instead

export default router;
