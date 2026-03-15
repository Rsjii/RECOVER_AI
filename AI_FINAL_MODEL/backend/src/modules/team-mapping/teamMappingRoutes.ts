import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import {
  getMappings,
  confirmMapping,
  autoMapMembers,
  setManualMapping,
  deleteMapping,
  getGithubUsers,
  getJiraUsers,
} from './teamMappingController';

const router = Router();

router.get('/',                    requireAuth, requireAdmin, getMappings);
router.post('/confirm',            requireAuth, requireAdmin, confirmMapping);
router.post('/:id/confirm',        requireAuth, requireAdmin, confirmMapping);
router.post('/auto',               requireAuth, requireAdmin, autoMapMembers);
router.post('/set',                requireAuth, requireAdmin, setManualMapping);
router.delete('/:id',              requireAuth, requireAdmin, deleteMapping);
router.get('/github-users',        requireAuth, requireAdmin, getGithubUsers);
router.get('/jira-users',          requireAuth, requireAdmin, getJiraUsers);

export default router;
