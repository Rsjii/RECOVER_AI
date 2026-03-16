import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantScopeGuard } from '../middleware/tenantScope';
import { getMetrics } from '../controllers/adminController';

const router = Router();

router.use(authMiddleware);
router.use(tenantScopeGuard);

router.get('/metrics', getMetrics);

export default router;
