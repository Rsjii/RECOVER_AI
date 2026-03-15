import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { tenantScopeGuard } from '../middleware/tenantScope';
import {
  acceptInvitation,
  inviteMember,
  listTeamMembers,
  revokeMember,
  updateMemberRole,
  validateInvitation,
} from '../controllers/teamController';

const router = Router();

router.get('/invitation/validate', validateInvitation);

router.use(authMiddleware);
router.use(tenantScopeGuard);
router.get('/members', listTeamMembers);
router.post('/invite', requireRole('admin'), inviteMember);
router.put('/members/:userId/role', requireRole('admin'), updateMemberRole);
router.delete('/members/:userId', requireRole('admin'), revokeMember);
router.post('/invitation/accept', acceptInvitation);

export default router;


