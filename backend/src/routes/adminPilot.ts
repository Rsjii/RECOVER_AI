import { Router } from 'express';
import { createPilotCompany, createPilotUser, setupPilotPassword } from '../controllers/adminPilotController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All admin routes require authentication
router.use(authMiddleware);

// Create a pilot company (admin only)
router.post('/pilot-company', createPilotCompany);

// Create a pilot user (admin only)
router.post('/pilot-user', createPilotUser);

// Public endpoint - setup password (no auth required, just valid token)
// This is exported separately for use without auth middleware
router.post('/pilot-setup-password', setupPilotPassword);

export default router;
