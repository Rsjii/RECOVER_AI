import { Router } from 'express';
import * as ctrl from './repoController';
import { requireAuth, requireAdmin } from '../../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', ctrl.listRepos);
router.post('/', requireAdmin, ctrl.addRepo);
router.get('/github', ctrl.listGitHubRepos);
router.get('/:repoId', ctrl.getRepo);
router.delete('/:repoId', requireAdmin, ctrl.removeRepo);

export default router;
