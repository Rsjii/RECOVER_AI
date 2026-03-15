import { db } from '../../config/db';
import { Repository } from '../../types';

export async function getReposByOrg(orgId: string): Promise<any[]> {
  const res = await db.query(
    `SELECT r.*,
       COALESCE((
         SELECT jsonb_build_object(
           'critical', COUNT(CASE WHEN p.risk_level = 'critical' THEN 1 END),
           'high',     COUNT(CASE WHEN p.risk_level = 'high'     THEN 1 END),
           'medium',   COUNT(CASE WHEN p.risk_level = 'medium'   THEN 1 END),
           'low',      COUNT(CASE WHEN p.risk_level = 'low'      THEN 1 END),
           'total',    COUNT(*)
         )
         FROM pull_requests p
         WHERE p.repo_id = r.id
           AND p.status = 'analyzed'
           AND (p.source IS NULL OR p.source != 'historical')
       ), '{"critical":0,"high":0,"medium":0,"low":0,"total":0}'::jsonb) AS risk_stats
     FROM repositories r
     WHERE r.org_id = $1
     ORDER BY r.created_at DESC`,
    [orgId]
  );
  return res.rows;
}

export async function getRepoById(repoId: string): Promise<Repository | null> {
  const res = await db.query(`SELECT * FROM repositories WHERE id = $1`, [repoId]);
  return res.rows[0] || null;
}

export async function getRepoByOrgAndGithubId(orgId: string, githubRepoId: string): Promise<Repository | null> {
  const res = await db.query(
    `SELECT * FROM repositories WHERE org_id = $1 AND github_repo_id = $2`,
    [orgId, githubRepoId]
  );
  return res.rows[0] || null;
}

export async function createRepo(orgId: string, githubRepoId: string, fullName: string, defaultBranch: string): Promise<Repository> {
  const res = await db.query(
    `INSERT INTO repositories (org_id, github_repo_id, full_name, default_branch)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [orgId, githubRepoId, fullName, defaultBranch]
  );
  return res.rows[0];
}

export async function updateRepoStatus(repoId: string, status: string, progress?: number, error?: string): Promise<void> {
  await db.query(
    `UPDATE repositories SET status = $1, indexing_progress = COALESCE($2, indexing_progress), error_message = $3 WHERE id = $4`,
    [status, progress ?? null, error ?? null, repoId]
  );
}

export async function updateRepoWebhook(repoId: string, webhookId: string, webhookSecret: string): Promise<void> {
  await db.query(
    `UPDATE repositories SET webhook_id = $1, webhook_secret = $2 WHERE id = $3`,
    [webhookId, webhookSecret, repoId]
  );
}

export async function deleteRepo(repoId: string): Promise<void> {
  await db.query(`DELETE FROM repositories WHERE id = $1`, [repoId]);
}
