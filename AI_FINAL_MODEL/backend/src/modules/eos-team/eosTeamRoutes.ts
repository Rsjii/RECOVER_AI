import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { getTeamOverview } from './eosTeamController';

const router = Router();

router.get('/team/overview', requireAuth, getTeamOverview);

export default router;
