import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantScopeGuard } from '../middleware/tenantScope';
import { getEntitlements } from '../controllers/billingController';

const router = Router();
router.use(authMiddleware);
router.use(tenantScopeGuard);
router.get('/', getEntitlements);

export default router;


