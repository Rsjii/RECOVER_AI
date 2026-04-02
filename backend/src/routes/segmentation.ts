import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantScopeGuard } from '../middleware/tenantScope';
import { demoBlocker } from '../middleware/demoBlocker';
import {
  getCustomersByTier,
  getTierDistribution,
  overrideCustomerTier,
  triggerSegmentation,
} from '../controllers/segmentationController';

const router = Router();

router.use(authMiddleware);
router.use(tenantScopeGuard);
router.use(demoBlocker);

router.get('/by-tier', getCustomersByTier);
router.get('/distribution', getTierDistribution);
router.patch('/customers/:id/tier', overrideCustomerTier);
router.post('/run', triggerSegmentation);

export default router;
