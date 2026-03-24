import { Router } from 'express';
import {
  listPilots,
  approvePilot,
  rejectPilot,
  completeAudit,
  convertPilot,
  getPilot,
} from '../controllers/pilotManagementController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// List all pilots with optional status filter
router.get('/list', listPilots);

// Get single pilot details
router.get('/:pilotId', getPilot);

// Approve pilot and schedule demo
router.post('/:pilotId/approve', approvePilot);

// Reject pilot
router.post('/:pilotId/reject', rejectPilot);

// Complete audit and start pilot
router.post('/:pilotId/complete-audit', completeAudit);

// Convert pilot to paid
router.post('/:pilotId/convert', convertPilot);

export default router;
