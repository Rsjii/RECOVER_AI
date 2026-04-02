import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantScopeGuard } from '../middleware/tenantScope';
import { demoBlocker } from '../middleware/demoBlocker';
import { listAnomalies, updateAnomalyStatus, triggerScan } from '../controllers/billingOptimizationController';

const router = Router();

router.use(authMiddleware);
router.use(tenantScopeGuard);
router.use(demoBlocker);

router.get('/', listAnomalies);
router.patch('/:id', updateAnomalyStatus);
router.post('/trigger', triggerScan);

export default router;
