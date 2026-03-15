import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getSprintHealth, getVelocity } from './analyticsController';

const router = Router();

router.get('/sprints/health', requireAuth, getSprintHealth);
router.get('/velocity',       requireAuth, getVelocity);

export default router;
