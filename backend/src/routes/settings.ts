import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { tenantScopeGuard } from '../middleware/tenantScope';
import {
  getSettings,
  updateDunningSettings,
  updateSlackSettings,
  updateGeneralSettings,
  updatePilotMode,  // P0
} from '../controllers/settingsController';

const router = Router();

router.use(authMiddleware);
router.use(tenantScopeGuard);

router.get('/', getSettings);
router.put('/dunning', requireRole('admin'), updateDunningSettings);
router.put('/slack', requireRole('admin'), updateSlackSettings);
router.put('/general', requireRole('admin'), updateGeneralSettings);
router.patch('/pilot-mode', requireRole('admin'), updatePilotMode);  // P0

export default router;
