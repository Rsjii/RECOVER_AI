import { Router } from 'express';
import * as ctrl from './teamController';
import { requireAuth, requireAdmin } from '../../middleware/auth';

const router = Router();

// Team & org
router.get('/',                              requireAuth,               ctrl.getTeam);
router.post('/setup',                        requireAuth,               ctrl.setupOrg);

// Email invites (admin only)
router.post('/invites',                      requireAuth, requireAdmin, ctrl.sendInvite);
router.post('/invites/:inviteId/resend',     requireAuth, requireAdmin, ctrl.resendInvite);
router.delete('/invites/:inviteId',          requireAuth, requireAdmin, ctrl.revokeInvite);
router.get('/invites/:token',                                           ctrl.validateInvite);
router.post('/join/:token',                  requireAuth,               ctrl.acceptInvite);

// Join links (shareable — admin manages, anyone with link can use)
router.post('/join-links',                   requireAuth, requireAdmin, ctrl.createJoinLink);
router.get('/join-links',                    requireAuth, requireAdmin, ctrl.listJoinLinks);
router.delete('/join-links/:linkId',         requireAuth, requireAdmin, ctrl.revokeJoinLink);
router.get('/join-links/validate/:token',                               ctrl.validateJoinLink);
router.post('/join-links/accept/:token',     requireAuth,               ctrl.acceptJoinLink);

// Members
router.post('/leave',                        requireAuth,               ctrl.leaveTeam);
router.put('/members/:userId/role',          requireAuth, requireAdmin, ctrl.updateMemberRole);
router.delete('/members/:userId',            requireAuth, requireAdmin, ctrl.removeMember);

export default router;
