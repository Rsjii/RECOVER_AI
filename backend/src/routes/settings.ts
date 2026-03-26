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
  updateManualMode,  // P0
  getApiCosts,
} from '../controllers/settingsController';

const router = Router();

router.use(authMiddleware);
router.use(tenantScopeGuard);

router.get('/', getSettings);
router.get('/costs', getApiCosts);
router.put('/dunning', requireRole('admin'), updateDunningSettings);
router.put('/slack', requireRole('admin'), updateSlackSettings);
router.put('/general', requireRole('admin'), updateGeneralSettings);
router.patch('/pilot-mode', requireRole('admin'), updatePilotMode);  // P0
router.patch('/manual-mode', requireRole('admin'), updateManualMode);  // P0

export default router;
