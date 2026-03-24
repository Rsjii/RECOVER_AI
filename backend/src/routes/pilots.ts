import { Router } from 'express';
import { requestPilot } from '../controllers/pilotController';

const router = Router();

// Public endpoint - no auth required
router.post('/request', requestPilot);

export default router;
