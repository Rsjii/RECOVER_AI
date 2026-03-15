import { db } from '../../config/db';

export async function listPRs(orgId: string, filters: {
  repoId?: string;
  riskLevel?: string;
  days?: number;
  page?: number;
  limit?: number;
}) {
  const { repoId, riskLevel, days = 30, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;
  const conditions: string[] = [`p.org_id = $1`];
  const params: any[] = [orgId];
  let i = 2;

  if (repoId) { conditions.push(`p.repo_id = $${i++}`); params.push(repoId); }
  if (riskLevel && riskLevel !== 'all') { conditions.push(`p.risk_level = $${i++}`); params.push(riskLevel); }
  if (days > 0) { conditions.push(`p.pr_created_at > NOW() - INTERVAL '${Number(days)} days'`); }

  const where = conditions.join(' AND ');

  const res = await db.query(
    `SELECT p.*, r.full_name as repo_full_name
     FROM pull_requests p
     JOIN repositories r ON r.id = p.repo_id
     WHERE ${where}
       AND p.status = 'analyzed'
       AND (p.source IS NULL OR p.source != 'historical')
     ORDER BY p.pr_created_at DESC
     LIMIT $${i} OFFSET $${i+1}`,
    [...params, limit, offset]
  );

  const countRes = await db.query(
    `SELECT COUNT(*) FROM pull_requests p
     WHERE ${where}
       AND p.status = 'analyzed'
       AND (p.source IS NULL OR p.source != 'historical')`,
    params
  );

  return { prs: res.rows, total: Number(countRes.rows[0].count) };
}

export async function getPRById(prId: string, orgId: string) {
  const res = await db.query(
    `SELECT p.*, r.full_name as repo_full_name
     FROM pull_requests p
     JOIN repositories r ON r.id = p.repo_id
     WHERE p.id = $1 AND p.org_id = $2`,
    [prId, orgId]
  );
  return res.rows[0] || null;
}
