import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { tenantScopeGuard } from '../middleware/tenantScope';
import { demoBlocker } from '../middleware/demoBlocker';
import {
  decideApprovalQueueItem,
  getPolicySettings,
  listApprovalQueue,
  simulatePolicyDecision,
  updatePolicySettings,
} from '../controllers/policyController';

const router = Router();

router.use(authMiddleware);
router.use(tenantScopeGuard);
router.use(demoBlocker);
router.get('/', getPolicySettings);
router.put('/', requireRole('admin'), updatePolicySettings);
router.post('/simulate', requireRole('admin'), simulatePolicyDecision);
router.get('/approvals', requireRole('admin'), listApprovalQueue);
router.post('/approvals/:approvalId/decision', requireRole('admin'), decideApprovalQueueItem);

export default router;


