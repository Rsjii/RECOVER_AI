import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantScopeGuard } from '../middleware/tenantScope';
import { createPlan, getPlan, listPlans, updatePlanStatus } from '../controllers/paymentPlanController';

const router = Router();

router.use(authMiddleware);
router.use(tenantScopeGuard);

router.post('/', createPlan);
router.get('/', getPlan);
router.get('/list', listPlans);
router.patch('/:planId/status', updatePlanStatus);

export default router;
