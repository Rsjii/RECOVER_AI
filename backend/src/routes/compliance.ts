import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { tenantScopeGuard } from '../middleware/tenantScope';
import { demoBlocker } from '../middleware/demoBlocker';
import { exportData, getComplianceRequests, requestDeletion } from '../controllers/complianceController';

const router = Router();

router.use(authMiddleware);
router.use(tenantScopeGuard);
router.use(demoBlocker);
router.get('/requests', requireRole('admin'), getComplianceRequests);
router.post('/export', requireRole('admin'), exportData);
router.post('/delete', requireRole('owner'), requestDeletion);

export default router;


