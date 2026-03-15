import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import {
  getTodayBrief,
  getBriefHistory,
  getBriefById,
  previewBrief,
  acknowledgeItem,
  dismissItem,
  snoozeItem,
} from './briefController';

const router = Router();

router.get('/today',                       requireAuth, getTodayBrief);
router.get('/history',                     requireAuth, getBriefHistory);
router.get('/:briefId',                    requireAuth, getBriefById);
router.post('/preview',                    requireAuth, requireAdmin, previewBrief);
router.post('/items/:itemId/acknowledge',  requireAuth, acknowledgeItem);
router.post('/items/:itemId/dismiss',      requireAuth, dismissItem);
router.post('/items/:itemId/snooze',       requireAuth, snoozeItem);

export default router;
