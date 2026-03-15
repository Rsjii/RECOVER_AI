import { Router } from 'express';
import * as ctrl from './authController';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.get('/github',                  ctrl.githubLogin);
router.get('/github/callback',         ctrl.githubCallback);
router.get('/github-app/install',      ctrl.githubAppInstall);
router.get('/github-app/callback',     ctrl.githubAppCallback);
router.post('/logout',                 ctrl.logout);
router.get('/me',         requireAuth, ctrl.getMe);

export default router;
