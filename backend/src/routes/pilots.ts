import { Router } from 'express';
import { requestPilot } from '../controllers/pilotController';
import { setupPilotPassword } from '../controllers/adminPilotController';

const router = Router();

// Public endpoint - no auth required
router.post('/request', requestPilot);

// Public endpoint - setup password with token (no auth required, just valid token)
router.post('/setup-password', setupPilotPassword);

export default router;
