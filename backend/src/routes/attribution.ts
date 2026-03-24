import { Router } from 'express';
import {
  getRecoveryByStage,
  getRecoveryByAction,
  getRecoveryTimeline,
  getROI
} from '../controllers/attributionController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All attribution endpoints require authentication
router.get('/by-stage', authMiddleware, getRecoveryByStage);
router.get('/by-action', authMiddleware, getRecoveryByAction);
router.get('/timeline', authMiddleware, getRecoveryTimeline);
router.get('/roi', authMiddleware, getROI);

export default router;
