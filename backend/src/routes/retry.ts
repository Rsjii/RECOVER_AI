import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantScopeGuard } from '../middleware/tenantScope';
import { demoBlocker } from '../middleware/demoBlocker';
import { getRetryAnalytics, retryNow, getAbPerformance } from '../controllers/retryController';

const router = Router();

router.use(authMiddleware);
router.use(tenantScopeGuard);
router.use(demoBlocker);

router.get('/ab-performance', getAbPerformance);
router.get('/:customerId', getRetryAnalytics);
router.post('/retry-now/:invoiceId', retryNow);

export default router;
