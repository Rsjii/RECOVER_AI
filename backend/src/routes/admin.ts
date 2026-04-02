import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantScopeGuard } from '../middleware/tenantScope';
import {
  getMetrics,
  getEmailLogs,
  getUsers,
  getActivityLogsHandler,
  getBillingHandler,
  getIntegrationsHandler,
  getSecurityHandler,
  getPerformanceHandler,
} from '../controllers/adminController';

const router = Router();

router.use(authMiddleware);
router.use(tenantScopeGuard);

router.get('/metrics', getMetrics);
router.get('/email-logs', getEmailLogs);
router.get('/users', getUsers);
router.get('/activity-logs', getActivityLogsHandler);
router.get('/billing', getBillingHandler);
router.get('/integrations', getIntegrationsHandler);
router.get('/security', getSecurityHandler);
router.get('/performance', getPerformanceHandler);

export default router;
