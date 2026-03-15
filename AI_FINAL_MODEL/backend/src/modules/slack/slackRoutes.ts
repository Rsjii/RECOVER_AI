import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import {
  connectSlack,
  testSlack,
  getSlackStatus,
  disconnectSlack,
  handleSlackAction,
} from './slackController';

const router = Router();

router.post('/connect',    requireAuth, requireAdmin, connectSlack);
router.post('/test',       requireAuth, requireAdmin, testSlack);
router.get('/status',      requireAuth, requireAdmin, getSlackStatus);
router.delete('/disconnect', requireAuth, requireAdmin, disconnectSlack);

// Slack interactive component callbacks (button clicks from brief messages)
router.post('/actions', handleSlackAction);

export default router;
