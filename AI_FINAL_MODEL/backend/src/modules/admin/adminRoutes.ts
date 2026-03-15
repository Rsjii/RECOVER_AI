import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import {
  getHealth, getOrgSettings, updateOrgSettings,
  getIntegrations, updateIntegrations,
  getActivityLog, deleteOrg,
  getBusFactor, getCodeQuality, getInsightsReport, reanalyzePR,
  getDependencyGraph, findExperts, getCrossRepoImpact,
  getBugMagnets, getVelocity,
} from './adminController';
import { listJoinLinks, createJoinLink, deactivateJoinLink, acceptJoinLink, getJoinLinkInfo } from './joinLinksController';

const router = Router();

router.get('/health',           requireAuth, requireAdmin, getHealth);
router.get('/bus-factor',       requireAuth, requireAdmin, getBusFactor);
router.get('/code-quality',     requireAuth, requireAdmin, getCodeQuality);
router.get('/insights-report',  requireAuth, requireAdmin, getInsightsReport);
router.get('/organization',     requireAuth, requireAdmin, getOrgSettings);
router.put('/organization',     requireAuth, requireAdmin, updateOrgSettings);
router.get('/integrations',     requireAuth, requireAdmin, getIntegrations);
router.put('/integrations',     requireAuth, requireAdmin, updateIntegrations);
router.get('/activity',         requireAuth, requireAdmin, getActivityLog);
router.delete('/org',           requireAuth, requireAdmin, deleteOrg);

// Cross-repo features
router.get('/dependency-graph',          requireAuth, requireAdmin, getDependencyGraph);
router.get('/experts',                   requireAuth, requireAdmin, findExperts);
router.get('/cross-repo-impact/:prId',   requireAuth, requireAdmin, getCrossRepoImpact);

// Bug Magnets + Review Velocity
router.get('/bug-magnets',  requireAuth, requireAdmin, getBugMagnets);
router.get('/velocity',     requireAuth, requireAdmin, getVelocity);

router.get('/join-links',              requireAuth, requireAdmin, listJoinLinks);
router.post('/join-links',             requireAuth, requireAdmin, createJoinLink);
router.delete('/join-links/:id',       requireAuth, requireAdmin, deactivateJoinLink);
router.post('/join-link/:token/accept', requireAuth, acceptJoinLink);
router.get('/join-link/:token/info',    getJoinLinkInfo);
router.post('/prs/:prId/reanalyze', requireAuth, requireAdmin, reanalyzePR);

export default router;
