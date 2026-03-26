import { Router } from 'express';
import { createPilotCompany, createPilotUser, setupPilotPassword } from '../controllers/adminPilotController';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

// All admin routes require authentication
router.use(authMiddleware);

// Create a pilot company (admin only)
router.post('/pilot-company', requireRole('admin'), createPilotCompany);

// Create a pilot user (admin only)
router.post('/pilot-user', requireRole('admin'), createPilotUser);

// Public endpoint - setup password (no auth required, just valid token)
// This is exported separately for use without auth middleware
router.post('/pilot-setup-password', setupPilotPassword);

export default router;
