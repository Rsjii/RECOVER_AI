import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantScopeGuard } from '../middleware/tenantScope';
import { getMetrics, getEmailLogs } from '../controllers/adminController';

const router = Router();

router.use(authMiddleware);
router.use(tenantScopeGuard);

router.get('/metrics', getMetrics);
router.get('/email-logs', getEmailLogs);

export default router;
