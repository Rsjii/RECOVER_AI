import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { tenantScopeGuard } from '../middleware/tenantScope';
import { demoBlocker } from '../middleware/demoBlocker';
import { listFeatureFlags, upsertFeatureFlag } from '../controllers/featureFlagsController';

const router = Router();
router.use(authMiddleware);
router.use(tenantScopeGuard);
router.use(demoBlocker);
router.get('/', requireRole('admin'), listFeatureFlags);
router.put('/', requireRole('admin'), upsertFeatureFlag);

export default router;


