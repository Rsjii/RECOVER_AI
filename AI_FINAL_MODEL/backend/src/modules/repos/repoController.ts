import { Response } from 'express';
import axios from 'axios';
import { AuthRequest } from '../../types';
import { db } from '../../config/db';
import { config } from '../../config/env';
import { getPlan } from '../../config/plans';
import { githubService } from '../../services/githubService';
import { indexingQueue } from '../../jobs/queue';
import { logger } from '../../config/logger';
import * as repoDao from './repoDao';

export const listRepos = async (req: AuthRequest, res: Response) => {
  if (!req.orgId) return res.status(401).json({ error: 'No org' });
  const repos = await repoDao.getReposByOrg(req.orgId);
  res.json({ repos });
};

export const getRepo = async (req: AuthRequest, res: Response) => {
  const repo = await repoDao.getRepoById(req.params.repoId);
  if (!repo || repo.org_id !== req.orgId) return res.status(404).json({ error: 'Not found' });
  res.json({ repo });
};

export const listGitHubRepos = async (req: AuthRequest, res: Response) => {
  if (!req.user?.access_token) return res.status(401).json({ error: 'No GitHub token' });

  try {
    const response = await axios.get('https://api.github.com/user/repos', {
      headers: { Authorization: `Bearer ${req.user.access_token}` },
      params: { per_page: 100, sort: 'updated', type: 'all' },
    });
    res.json({ repos: response.data });
  } catch (err: any) {
    res.status(502).json({ error: 'Failed to fetch GitHub repos' });
  }
};

export const addRepo = async (req: AuthRequest, res: Response) => {
  if (!req.orgId || !req.user?.access_token) return res.status(401).json({ error: 'Unauthorized' });

  const { github_repo_id, full_name, default_branch } = req.body;
  if (!github_repo_id || !full_name) return res.status(400).json({ error: 'github_repo_id and full_name required' });

  // Check plan repo limit
  const subRes = await db.query(`SELECT tier FROM subscriptions WHERE org_id = $1`, [req.orgId]);
  const tier = subRes.rows[0]?.tier || 'free';
  const plan = getPlan(tier);

  const existingRepos = await repoDao.getReposByOrg(req.orgId);
  if (plan.maxRepos !== Infinity && existingRepos.length >= plan.maxRepos) {
    return res.status(403).json({
      error: `Plan limit reached. Your ${tier} plan allows ${plan.maxRepos} repo(s). Upgrade to add more.`,
    });
  }

  // Check if already added
  const existing = await repoDao.getRepoByOrgAndGithubId(req.orgId, String(github_repo_id));
  if (existing) return res.status(409).json({ error: 'Repository already added' });

  // Create repo record
  const repo = await repoDao.createRepo(req.orgId, String(github_repo_id), full_name, default_branch || 'main');

  // Queue full indexing
  await indexingQueue.add('index-repo', {
    repoId: repo.id,
    fullName: full_name,
    accessToken: req.user.access_token,
    orgId: req.orgId,
  });

  // After indexing completes the dep graph will be built for this new repo.
  // Also trigger a scan of ALL existing repos to discover any that depend on this new repo.
  // This runs async/non-blocking so the response is immediate.
  const orgId = req.orgId;
  setImmediate(async () => {
    try {
      const { dependencyGraphService } = await import('../../services/dependencyGraphService');
      // Re-scan existing ready repos to find if any depend on the new repo
      const readyRepos = await repoDao.getReposByOrg(orgId);
      for (const r of readyRepos) {
        if (r.id !== repo.id && r.status === 'ready') {
          await dependencyGraphService.detectAndStore(r.id, orgId);
        }
      }
    } catch { /* non-fatal */ }
  });

  res.status(201).json({ repo });
};

export const reindexRepo = async (req: AuthRequest, res: Response) => {
  if (!req.orgId || !req.user?.access_token) return res.status(401).json({ error: 'Unauthorized' });

  const repo = await repoDao.getRepoById(req.params.repoId);
  if (!repo || repo.org_id !== req.orgId) return res.status(404).json({ error: 'Not found' });

  await repoDao.updateRepoStatus(repo.id, 'pending', 0);

  await indexingQueue.add('index-repo', {
    repoId: repo.id,
    fullName: repo.full_name,
    accessToken: req.user.access_token,
    orgId: req.orgId,
  });

  res.json({ success: true, message: 'Reindexing started' });
};

export const removeRepo = async (req: AuthRequest, res: Response) => {
  if (!req.orgId || !req.user?.access_token) return res.status(401).json({ error: 'Unauthorized' });

  const repo = await repoDao.getRepoById(req.params.repoId);
  if (!repo || repo.org_id !== req.orgId) return res.status(404).json({ error: 'Not found' });

  // Delete GitHub webhook if exists
  if (repo.webhook_id) {
    try {
      await githubService.deleteWebhook(req.user.access_token, repo.full_name, repo.webhook_id);
    } catch { /* webhook may already be gone */ }
  }

  await repoDao.deleteRepo(repo.id);
  res.json({ success: true });
};
