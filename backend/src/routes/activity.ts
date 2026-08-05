import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantScopeGuard } from '../middleware/tenantScope';
import { getActivityLogsHandler, getPausedInvoices, getStoppedInvoices } from '../controllers/activityController';

const router = Router();

// All routes require authentication + tenant scoping
router.use(authMiddleware);
router.use(tenantScopeGuard);

// GET /api/activity/logs - Combined email + SMS activity logs
router.get('/logs', getActivityLogsHandler);

// GET /api/activity/paused - Paused invoices
router.get('/paused', getPausedInvoices);

// GET /api/activity/stopped - Stopped invoices
router.get('/stopped', getStoppedInvoices);

export default router;
