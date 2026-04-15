import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantScopeGuard } from '../middleware/tenantScope';
import {
  getUnreadHandler,
  getAllHandler,
  getUnreadCountHandler,
  markAsReadHandler,
  dismissHandler,
  getByTypeHandler,
  markAllReadHandler,
} from '../controllers/notificationsController';

const router = Router();

// All routes require authentication + tenant scoping
router.use(authMiddleware);
router.use(tenantScopeGuard);

// GET endpoints
router.get('/unread', getUnreadHandler);
router.get('/unread-count', getUnreadCountHandler);
router.get('/by-type/:eventType', getByTypeHandler);
router.get('/', getAllHandler);

// POST endpoints
router.post('/:id/read', markAsReadHandler);
router.post('/:id/dismiss', dismissHandler);
router.post('/mark-all-read', markAllReadHandler);

export default router;
