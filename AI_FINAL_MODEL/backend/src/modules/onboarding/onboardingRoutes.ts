import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import {
  getOnboardingStatus,
  configureBrief,
  getBriefConfig,
  completeOnboarding,
  getIndexProgress,
} from './onboardingController';

const router = Router();

router.get('/status',    requireAuth, getOnboardingStatus);
router.get('/progress',  requireAuth, getIndexProgress);
router.get('/config',    requireAuth, getBriefConfig);
router.post('/configure', requireAuth, requireAdmin, configureBrief);
router.post('/complete',  requireAuth, requireAdmin, completeOnboarding);

export default router;
