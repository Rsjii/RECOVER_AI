import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import {
  connectJira,
  jiraCallback,
  getJiraSites,
  selectJiraSite,
  getJiraProjects,
  selectJiraProjects,
  getJiraStatus,
  disconnectJira,
} from './jiraController';

const router = Router();

// OAuth flow — no auth required for callback (Atlassian redirects here)
router.get('/connect',          requireAuth, requireAdmin, connectJira);
router.get('/callback',         jiraCallback);

// Post-connect management
router.get('/sites',            requireAuth, requireAdmin, getJiraSites);
router.post('/sites/select',    requireAuth, requireAdmin, selectJiraSite);
router.get('/projects',         requireAuth, requireAdmin, getJiraProjects);
router.post('/projects/select', requireAuth, requireAdmin, selectJiraProjects);
router.get('/status',           requireAuth, requireAdmin, getJiraStatus);
router.delete('/disconnect',    requireAuth, requireAdmin, disconnectJira);

export default router;
