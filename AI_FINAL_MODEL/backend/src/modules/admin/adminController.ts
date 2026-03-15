import { Response } from 'express';
import { AuthRequest } from '../../types';
import { db } from '../../config/db';
import { logActivity } from '../../lib/activity';
import { indexingQueue, analysisQueue } from '../../jobs/queue';
import { logger } from '../../config/logger';

// ── Engineering Health ────────────────────────────────────────────────────────

export const getHealth = async (req: AuthRequest, res: Response) => {
  const orgId    = req.orgId!;
  const days     = Math.min(Number(req.query['days'] || 30), 90) || 30;
  const interval = `${days} days`;

  const [totalPRs, criticalPRs, highPRs, avgTime, riskyFiles, riskyServices, perRepo, trend, queueCounts] =
    await Promise.all([
      db.query(`SELECT COUNT(*) FROM pull_requests WHERE org_id = $1 AND pr_created_at > NOW() - INTERVAL '${interval}' AND status = 'analyzed'`, [orgId]),
      db.query(`SELECT COUNT(*) FROM pull_requests WHERE org_id = $1 AND risk_level = 'critical' AND pr_created_at > NOW() - INTERVAL '${interval}'`, [orgId]),
      db.query(`SELECT COUNT(*) FROM pull_requests WHERE org_id = $1 AND risk_level = 'high' AND pr_created_at > NOW() - INTERVAL '${interval}'`, [orgId]),
      db.query(`SELECT AVG(EXTRACT(EPOCH FROM (analyzed_at - pr_created_at))) as avg_seconds FROM pull_requests WHERE org_id = $1 AND analyzed_at IS NOT NULL AND pr_created_at > NOW() - INTERVAL '${interval}'`, [orgId]),
      db.query(`SELECT fc->>'path' as file_path, COUNT(*) as incident_count FROM pull_requests, jsonb_array_elements(files_changed) fc WHERE org_id = $1 AND risk_level IN ('high','critical') AND pr_created_at > NOW() - INTERVAL '180 days' GROUP BY file_path ORDER BY incident_count DESC LIMIT 5`, [orgId]),
      db.query(`SELECT svc->>'service_path' as service, COUNT(*) as count FROM pull_requests, jsonb_array_elements(affected_services) svc WHERE org_id = $1 AND risk_level = 'critical' AND pr_created_at > NOW() - INTERVAL '${interval}' GROUP BY service ORDER BY count DESC LIMIT 5`, [orgId]),
      db.query(`SELECT r.full_name, COUNT(CASE WHEN p.risk_level = 'critical' THEN 1 END) as critical, COUNT(CASE WHEN p.risk_level = 'high' THEN 1 END) as high, COUNT(CASE WHEN p.risk_level = 'medium' THEN 1 END) as medium, COUNT(CASE WHEN p.risk_level = 'low' THEN 1 END) as low, COUNT(*) as total FROM repositories r LEFT JOIN pull_requests p ON p.repo_id = r.id AND p.pr_created_at > NOW() - INTERVAL '${interval}' AND p.status = 'analyzed' WHERE r.org_id = $1 GROUP BY r.id, r.full_name ORDER BY total DESC`, [orgId]),
      db.query(
        days <= 14
          ? `SELECT DATE_TRUNC('day', pr_created_at)::date as period, risk_level, COUNT(*) as count FROM pull_requests WHERE org_id = $1 AND pr_created_at > NOW() - INTERVAL '${interval}' AND status = 'analyzed' GROUP BY 1, 2 ORDER BY 1`
          : `SELECT DATE_TRUNC('week', pr_created_at)::date as period, risk_level, COUNT(*) as count FROM pull_requests WHERE org_id = $1 AND pr_created_at > NOW() - INTERVAL '${interval}' AND status = 'analyzed' GROUP BY 1, 2 ORDER BY 1`,
        [orgId]
      ),
      Promise.race([
        Promise.all([
          indexingQueue.getJobCounts('waiting', 'active', 'failed'),
          analysisQueue.getJobCounts('waiting', 'active', 'failed'),
        ]),
        new Promise<null[]>(resolve => setTimeout(() => resolve([null, null]), 3000)),
      ]).catch(() => [null, null]),
    ]);

  const trendMap = new Map<string, Record<string, number>>();
  for (const row of trend.rows) {
    const key = String(row.period);
    if (!trendMap.has(key)) trendMap.set(key, { critical: 0, high: 0, medium: 0, low: 0 });
    trendMap.get(key)![row.risk_level] = Number(row.count);
  }

  const [idxCounts, anaCounts] = queueCounts as any[];

  res.json({
    days,
    stats: {
      total_prs:            Number(totalPRs.rows[0].count),
      critical_prs:         Number(criticalPRs.rows[0].count),
      high_prs:             Number(highPRs.rows[0].count),
      avg_analysis_seconds: Math.round(avgTime.rows[0]?.avg_seconds || 0),
    },
    trend: Array.from(trendMap.entries()).map(([period, counts]) => ({ period, ...counts })),
    per_repo:               perRepo.rows,
    most_risky_files:       riskyFiles.rows,
    most_affected_services: riskyServices.rows,
    queues: {
      indexing: idxCounts || { waiting: 0, active: 0, failed: 0 },
      analysis: anaCounts || { waiting: 0, active: 0, failed: 0 },
    },
  });
};

// ── Org Settings ──────────────────────────────────────────────────────────────

export const getOrgSettings = async (req: AuthRequest, res: Response) => {
  const r = await db.query(`SELECT * FROM organizations WHERE id = $1`, [req.orgId]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Org not found' });
  res.json({ org: r.rows[0] });
};

export const updateOrgSettings = async (req: AuthRequest, res: Response) => {
  const { github_org_name, billing_email, timezone, logo_url } = req.body;
  const fields: string[] = [];
  const values: any[]   = [];
  let idx = 1;

  if (github_org_name !== undefined) { fields.push(`github_org_name = $${idx++}`); values.push(github_org_name); }
  if (billing_email   !== undefined) { fields.push(`billing_email = $${idx++}`);   values.push(billing_email); }
  if (timezone        !== undefined) { fields.push(`timezone = $${idx++}`);        values.push(timezone || 'UTC'); }
  if (logo_url        !== undefined) { fields.push(`logo_url = $${idx++}`);        values.push(logo_url); }

  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

  values.push(req.orgId);
  const r = await db.query(
    `UPDATE organizations SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  await logActivity(req.orgId!, req.userId!, 'settings_updated', 'Organization settings updated');
  res.json({ org: r.rows[0] });
};

// ── Integrations ──────────────────────────────────────────────────────────────

export const getIntegrations = async (req: AuthRequest, res: Response) => {
  const r = await db.query(
    `SELECT email_notifications_enabled, webhook_endpoints,
            slack_workspace_id, slack_channel_id,
            notify_on_critical, notify_on_high, notify_recipients,
            github_app_installation_id
     FROM organizations WHERE id = $1`,
    [req.orgId]
  );
  res.json({ integrations: r.rows[0] || {} });
};

export const updateIntegrations = async (req: AuthRequest, res: Response) => {
  const { email_notifications_enabled, webhook_endpoints, notify_on_critical, notify_on_high, notify_recipients } = req.body;
  const fields: string[] = [];
  const values: any[]   = [];
  let idx = 1;

  if (email_notifications_enabled !== undefined) { fields.push(`email_notifications_enabled = $${idx++}`); values.push(email_notifications_enabled); }
  if (webhook_endpoints           !== undefined) { fields.push(`webhook_endpoints = $${idx++}::jsonb`);    values.push(JSON.stringify(webhook_endpoints)); }
  if (notify_on_critical          !== undefined) { fields.push(`notify_on_critical = $${idx++}`);          values.push(notify_on_critical); }
  if (notify_on_high              !== undefined) { fields.push(`notify_on_high = $${idx++}`);              values.push(notify_on_high); }
  if (notify_recipients           !== undefined) { fields.push(`notify_recipients = $${idx++}`);           values.push(notify_recipients); }

  if (fields.length) {
    values.push(req.orgId);
    await db.query(`UPDATE organizations SET ${fields.join(', ')} WHERE id = $${idx}`, values);
  }

  await logActivity(req.orgId!, req.userId!, 'integrations_updated', 'Integration settings updated');
  res.json({ success: true });
};

// ── Activity Log ──────────────────────────────────────────────────────────────

export const getActivityLog = async (req: AuthRequest, res: Response) => {
  const { page = '1', limit = '50', type, from_date, to_date, user_id } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const filterParams: any[] = [req.orgId];
  let filterSql = '';

  if (type)      { filterParams.push(type);                                       filterSql += ` AND a.activity_type = $${filterParams.length}`; }
  if (from_date) { filterParams.push(from_date as string);                        filterSql += ` AND a.created_at >= $${filterParams.length}`; }
  if (to_date)   { filterParams.push((to_date as string) + 'T23:59:59.999Z');     filterSql += ` AND a.created_at <= $${filterParams.length}`; }
  if (user_id)   { filterParams.push(user_id as string);                          filterSql += ` AND a.user_id = $${filterParams.length}`; }

  const [rows, total, members] = await Promise.all([
    db.query(
      `SELECT a.*, u.github_username FROM activity_log a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.org_id = $1${filterSql}
       ORDER BY a.created_at DESC
       LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
      [...filterParams, Number(limit), offset]
    ),
    db.query(`SELECT COUNT(*) FROM activity_log a WHERE a.org_id = $1${filterSql}`, filterParams),
    db.query(
      `SELECT u.id, u.github_username FROM users u
       JOIN team_members tm ON tm.user_id = u.id
       WHERE tm.org_id = $1 ORDER BY u.github_username`,
      [req.orgId]
    ),
  ]);

  res.json({ activities: rows.rows, total: Number(total.rows[0].count), page: Number(page), members: members.rows });
};

// ── Danger Zone ───────────────────────────────────────────────────────────────

export const deleteOrg = async (req: AuthRequest, res: Response) => {
  const { confirm_name } = req.body;
  const orgRes = await db.query(`SELECT github_org_name FROM organizations WHERE id = $1`, [req.orgId]);
  if (!orgRes.rows[0]) return res.status(404).json({ error: 'Organization not found' });
  if (confirm_name !== orgRes.rows[0].github_org_name) {
    return res.status(400).json({ error: 'Organization name does not match. Please type it exactly.' });
  }

  await db.query(`DELETE FROM api_keys     WHERE org_id = $1`, [req.orgId]);
  await db.query(`DELETE FROM activity_log WHERE org_id = $1`, [req.orgId]);
  await db.query(`DELETE FROM pr_notes     WHERE org_id = $1`, [req.orgId]);
  await db.query(`DELETE FROM pull_requests WHERE org_id = $1`, [req.orgId]);
  await db.query(`DELETE FROM code_chunks  WHERE org_id = $1`, [req.orgId]);
  await db.query(`DELETE FROM file_dependencies WHERE org_id = $1`, [req.orgId]);
  await db.query(`DELETE FROM file_git_stats WHERE repo_id IN (SELECT id FROM repositories WHERE org_id = $1)`, [req.orgId]);
  await db.query(`DELETE FROM repo_git_summary WHERE repo_id IN (SELECT id FROM repositories WHERE org_id = $1)`, [req.orgId]);
  await db.query(`DELETE FROM file_metrics WHERE repo_id IN (SELECT id FROM repositories WHERE org_id = $1)`, [req.orgId]);
  await db.query(`DELETE FROM repo_quality_summary WHERE repo_id IN (SELECT id FROM repositories WHERE org_id = $1)`, [req.orgId]);
  await db.query(`DELETE FROM repositories WHERE org_id = $1`, [req.orgId]);
  await db.query(`DELETE FROM invites      WHERE org_id = $1`, [req.orgId]);
  await db.query(`DELETE FROM join_links   WHERE org_id = $1`, [req.orgId]);
  await db.query(`DELETE FROM usage        WHERE org_id = $1`, [req.orgId]);
  await db.query(`DELETE FROM subscriptions WHERE org_id = $1`, [req.orgId]);
  await db.query(`UPDATE users SET org_id = NULL WHERE org_id = $1`, [req.orgId]);
  await db.query(`DELETE FROM team_members WHERE org_id = $1`, [req.orgId]);
  await db.query(`DELETE FROM organizations WHERE id = $1`, [req.orgId]);

  res.json({ success: true });
};

// ── Bus Factor / Knowledge Risk ───────────────────────────────────────────────

export const getBusFactor = async (req: AuthRequest, res: Response) => {
  const orgId = req.orgId!;

  // Build set of active member emails/logins to detect departed owners
  // Uses team_members (always available) + GitHub org members (if App installed)
  const activeEmails = new Set<string>();
  const activeLogins = new Set<string>();
  try {
    const teamRes = await db.query(
      `SELECT u.email, u.github_username FROM users u
       JOIN team_members tm ON tm.user_id = u.id
       WHERE tm.org_id = $1`,
      [orgId]
    );
    for (const r of teamRes.rows) {
      if (r.email)           activeEmails.add(r.email.toLowerCase());
      if (r.github_username) activeLogins.add(r.github_username.toLowerCase());
    }
    // Try GitHub App org members for more accurate departed detection
    const orgData = await db.query(
      `SELECT github_org_name, github_app_installation_id FROM organizations WHERE id = $1`,
      [orgId]
    );
    const orgName = orgData.rows[0]?.github_org_name;
    if (orgData.rows[0]?.github_app_installation_id && orgName) {
      const { octokitForOrg } = await import('../../lib/octokitForOrg');
      const octokit = await octokitForOrg(orgId);
      const members = await octokit.paginate(octokit.orgs.listMembers, { org: orgName, per_page: 100 });
      for (const m of members) activeLogins.add(m.login.toLowerCase());
    }
  } catch { /* silently skip — departed detection degrades gracefully */ }

  const hasActiveData = activeEmails.size > 0 || activeLogins.size > 0;

  const isOwnerActive = (row: any): boolean => {
    if (!hasActiveData) return true;
    const email = (row.primary_owner_email || '').toLowerCase();
    const name  = (row.primary_owner_name  || '').toLowerCase();
    return activeEmails.has(email)
      || activeLogins.has(name)
      || (email.includes('@') && activeLogins.has(email.split('@')[0]));
  };

  const [silosRes, engineersRes, orphansRes, atRiskRes, summaryRes] = await Promise.all([
    db.query(
      `SELECT fgs.file_path, fgs.bus_factor, fgs.primary_owner_name, fgs.primary_owner_email,
              fgs.primary_owner_pct, fgs.knowledge_risk_score, fgs.incident_count, fgs.revert_count,
              fgs.churn_score, fgs.last_commit_date, fgs.total_commits, fgs.commits_30d, fgs.commits_90d,
              fgs.all_authors, r.full_name as repo_name, r.id as repo_id
       FROM file_git_stats fgs
       JOIN repositories r ON r.id = fgs.repo_id
       WHERE r.org_id = $1 AND fgs.bus_factor = 1
       ORDER BY fgs.knowledge_risk_score DESC LIMIT 25`,
      [orgId]
    ),
    db.query(
      `SELECT fgs.primary_owner_email as email, fgs.primary_owner_name as name,
              COUNT(*) as files_owned,
              AVG(fgs.primary_owner_pct) as avg_ownership_pct,
              SUM(fgs.incident_count) as total_incidents,
              COUNT(CASE WHEN fgs.bus_factor = 1 THEN 1 END) as sole_owner_files
       FROM file_git_stats fgs
       JOIN repositories r ON r.id = fgs.repo_id
       WHERE r.org_id = $1 AND fgs.primary_owner_email IS NOT NULL AND fgs.primary_owner_email != 'unknown'
       GROUP BY fgs.primary_owner_email, fgs.primary_owner_name
       ORDER BY files_owned DESC LIMIT 10`,
      [orgId]
    ),
    db.query(
      `SELECT fgs.file_path, fgs.file_age_days, fgs.last_commit_date,
              fgs.primary_owner_name, fgs.knowledge_risk_score, r.full_name as repo_name,
              (SELECT COUNT(*) FROM file_dependencies fd WHERE fd.repo_id = fgs.repo_id
               AND fd.target_file LIKE '%' || fgs.file_path || '%') as dependents_count
       FROM file_git_stats fgs
       JOIN repositories r ON r.id = fgs.repo_id
       WHERE r.org_id = $1 AND fgs.file_age_days > 180
       ORDER BY fgs.knowledge_risk_score DESC LIMIT 15`,
      [orgId]
    ),
    db.query(
      `SELECT fgs.file_path, fgs.bus_factor, fgs.churn_score, fgs.incident_count,
              fgs.revert_count, fgs.knowledge_risk_score, fgs.primary_owner_name,
              fgs.primary_owner_email, fgs.file_age_days, fgs.last_commit_date,
              fgs.total_commits, fgs.commits_30d, fgs.all_authors,
              r.full_name as repo_name, r.id as repo_id
       FROM file_git_stats fgs
       JOIN repositories r ON r.id = fgs.repo_id
       WHERE r.org_id = $1
       ORDER BY fgs.knowledge_risk_score DESC LIMIT 20`,
      [orgId]
    ),
    db.query(
      `SELECT rgs.*, r.full_name as repo_name
       FROM repo_git_summary rgs
       JOIN repositories r ON r.id = rgs.repo_id
       WHERE r.org_id = $1`,
      [orgId]
    ),
  ]);

  const totalSilos   = silosRes.rows.length;
  const totalOrphans = orphansRes.rows.length;
  const avgBusFactor = summaryRes.rows.length > 0
    ? Math.round((summaryRes.rows.reduce((s: number, r: any) => s + parseFloat(r.avg_bus_factor || 0), 0) / summaryRes.rows.length) * 10) / 10
    : 0;
  const totalContributors  = summaryRes.rows.reduce((s: number, r: any) => s + (r.total_contributors || 0), 0);
  const knowledgeRiskScore = Math.min(Math.max(Math.round((totalSilos * 5) + (totalOrphans * 2) + ((3 - avgBusFactor) * 10)), 0), 100);

  const addDeparted = (rows: any[]) =>
    rows.map(r => ({ ...r, owner_departed: !isOwnerActive(r) }));

  res.json({
    summary: {
      avg_bus_factor:       avgBusFactor,
      knowledge_silo_count: totalSilos,
      orphaned_files_count: totalOrphans,
      total_contributors:   totalContributors,
      knowledge_risk_score: knowledgeRiskScore,
    },
    knowledge_silos:   addDeparted(silosRes.rows),
    engineer_coverage: engineersRes.rows,
    orphaned_files:    addDeparted(orphansRes.rows),
    at_risk_files:     addDeparted(atRiskRes.rows),
    repo_summaries:    summaryRes.rows,
  });
};

// ── Code Quality ──────────────────────────────────────────────────────────────

export const getCodeQuality = async (req: AuthRequest, res: Response) => {
  const orgId  = req.orgId!;
  const repoId = req.query.repoId as string | undefined;

  // Build org + optional repo filter
  const baseParams: any[] = [orgId];
  let repoJoin = `JOIN repositories r ON r.id = fm.repo_id WHERE r.org_id = $1`;
  if (repoId) {
    baseParams.push(repoId);
    repoJoin += ` AND r.id = $${baseParams.length}`;
  }

  // Check if any data exists
  const hasData = await db.query(
    `SELECT COUNT(*) FROM file_metrics fm ${repoJoin}`,
    baseParams
  );
  if (Number(hasData.rows[0].count) === 0) {
    // Return repos list so user can see what's available
    const reposRes = await db.query(
      `SELECT id, full_name FROM repositories WHERE org_id = $1 AND status = 'ready' ORDER BY full_name`,
      [orgId]
    );
    return res.json({ has_data: false, repos: reposRes.rows });
  }

  // Get most recent snapshot month
  const latestMonthRes = await db.query(
    `SELECT MAX(fm.snapshot_month) as latest FROM file_metrics fm ${repoJoin}`,
    baseParams
  );
  const latestMonth = latestMonthRes.rows[0]?.latest;
  if (!latestMonth) return res.json({ has_data: false, repos: [] });

  const prevMonthDate = new Date(latestMonth);
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevMonth = prevMonthDate.toISOString().split('T')[0];

  const p = baseParams;           // alias for shorter queries
  const n = p.length;             // next param index

  const [summaryRes, prevSummaryRes, topGrowingRes, complexRes, refactorRes, historyRes, reposRes] = await Promise.all([

    // This month summary
    db.query(
      `SELECT ROUND(AVG(fm.cyclomatic_complexity)::numeric, 1) as avg_complexity,
              COUNT(DISTINCT fm.file_path) as total_files,
              SUM(fm.lines_of_code) as total_loc,
              COUNT(CASE WHEN fm.lines_of_code > 500 THEN 1 END) as files_over_500,
              COUNT(CASE WHEN fm.cyclomatic_complexity > 50 THEN 1 END) as files_over_c50
       FROM file_metrics fm ${repoJoin} AND fm.snapshot_month = $${n + 1}`,
      [...p, latestMonth]
    ),

    // Last month summary for trend
    db.query(
      `SELECT ROUND(AVG(fm.cyclomatic_complexity)::numeric, 1) as avg_complexity
       FROM file_metrics fm ${repoJoin} AND fm.snapshot_month = $${n + 1}`,
      [...p, prevMonth]
    ),

    // Top growing files
    db.query(
      `SELECT curr.file_path, curr.lines_of_code as current_loc,
              prev.lines_of_code as prev_loc, curr.language, r.full_name as repo_name,
              ROUND(((curr.lines_of_code - prev.lines_of_code)::numeric / GREATEST(prev.lines_of_code, 1)) * 100) as growth_pct
       FROM file_metrics curr
       JOIN file_metrics prev ON prev.repo_id = curr.repo_id AND prev.file_path = curr.file_path
         AND prev.snapshot_month = $${n + 2}
       JOIN repositories r ON r.id = curr.repo_id
       WHERE r.org_id = $1${repoId ? ` AND r.id = $2` : ''}
         AND curr.snapshot_month = $${n + 1}
         AND curr.lines_of_code > prev.lines_of_code AND prev.lines_of_code > 10
       ORDER BY growth_pct DESC LIMIT 10`,
      [...p, latestMonth, prevMonth]
    ),

    // Most complex files
    db.query(
      `SELECT fm.file_path, fm.cyclomatic_complexity, fm.lines_of_code,
              fm.function_count, fm.language, r.full_name as repo_name
       FROM file_metrics fm ${repoJoin} AND fm.snapshot_month = $${n + 1}
         AND fm.cyclomatic_complexity > 5
       ORDER BY fm.cyclomatic_complexity DESC LIMIT 15`,
      [...p, latestMonth]
    ),

    // Refactor candidates
    db.query(
      `SELECT fm.file_path, fm.cyclomatic_complexity, fm.lines_of_code, fm.language,
              r.full_name as repo_name,
              COALESCE(fgs.churn_score, 0) as churn_score,
              COALESCE(fgs.commits_30d, 0) as commits_30d,
              fgs.last_commit_date,
              (LEAST(fm.lines_of_code / 10, 50) + LEAST(fm.cyclomatic_complexity, 50) + COALESCE(fgs.churn_score, 0) / 2)::int as refactor_score
       FROM file_metrics fm
       JOIN repositories r ON r.id = fm.repo_id
       LEFT JOIN file_git_stats fgs ON fgs.repo_id = fm.repo_id AND fgs.file_path = fm.file_path
       WHERE r.org_id = $1${repoId ? ` AND r.id = $2` : ''}
         AND fm.snapshot_month = $${n + 1}
         AND (fm.lines_of_code > 150 OR fm.cyclomatic_complexity > 15)
       ORDER BY refactor_score DESC LIMIT 10`,
      [...p, latestMonth]
    ),

    // 6-month history
    db.query(
      `SELECT rqs.snapshot_month,
              ROUND(AVG(rqs.avg_complexity)::numeric, 1) as avg_complexity,
              SUM(rqs.total_files) as total_files,
              SUM(rqs.total_loc) as total_loc,
              SUM(rqs.files_over_complexity_50) as files_over_threshold
       FROM repo_quality_summary rqs
       JOIN repositories r ON r.id = rqs.repo_id
       WHERE r.org_id = $1${repoId ? ` AND r.id = $2` : ''}
         AND rqs.snapshot_month >= DATE_TRUNC('month', NOW() - INTERVAL '5 months')
       GROUP BY rqs.snapshot_month ORDER BY rqs.snapshot_month ASC`,
      p
    ),

    // Repos for filter dropdown
    db.query(
      `SELECT DISTINCT r.id, r.full_name
       FROM repositories r
       JOIN file_metrics fm ON fm.repo_id = r.id
       WHERE r.org_id = $1 ORDER BY r.full_name`,
      [orgId]
    ),
  ]);

  const summary     = summaryRes.rows[0]     || {};
  const prevSummary = prevSummaryRes.rows[0] || {};

  const complexityTrend = prevSummary.avg_complexity && summary.avg_complexity
    ? Math.round(((Number(summary.avg_complexity) - Number(prevSummary.avg_complexity)) / Number(prevSummary.avg_complexity)) * 100)
    : null;

  // Auto alerts
  const alerts: string[] = [];
  const growing = topGrowingRes.rows;
  const complex = complexRes.rows;
  if (growing[0] && Number(growing[0].growth_pct) > 80) {
    alerts.push(`${growing[0].file_path} grew ${growing[0].growth_pct}% in size this month`);
  }
  if (complex[0] && Number(complex[0].cyclomatic_complexity) > 80) {
    alerts.push(`${complex[0].file_path} has complexity score of ${complex[0].cyclomatic_complexity} — consider refactoring`);
  }
  if (Number(summary.files_over_c50) > 5) {
    alerts.push(`${summary.files_over_c50} files have high complexity (>50) — schedule a refactoring sprint`);
  }

  res.json({
    has_data: true,
    latest_month: latestMonth,
    summary: {
      avg_complexity:          Number(summary.avg_complexity)  || 0,
      total_files:             Number(summary.total_files)     || 0,
      total_loc:               Number(summary.total_loc)       || 0,
      files_over_500_loc:      Number(summary.files_over_500)  || 0,
      files_over_complexity_50: Number(summary.files_over_c50) || 0,
      complexity_trend:        complexityTrend,
    },
    top_growing:        topGrowingRes.rows,
    complex_files:      complexRes.rows,
    refactor_candidates: refactorRes.rows,
    history:            historyRes.rows,
    repos:              reposRes.rows,
    alerts,
  });
};

// ── Insights Report ───────────────────────────────────────────────────────────

export const getInsightsReport = async (req: AuthRequest, res: Response) => {
  const orgId = req.orgId!;

  const [
    orgRes, silosRes, engineersRes, atRiskRes, summaryRes,
    prStatsRes, avgReviewRes, complexFilesRes, reposRes,
  ] = await Promise.all([
    db.query(
      `SELECT github_org_name, created_at FROM organizations WHERE id = $1`,
      [orgId]
    ),
    db.query(
      `SELECT fgs.file_path, fgs.bus_factor, fgs.primary_owner_name,
              fgs.primary_owner_pct, fgs.knowledge_risk_score, r.full_name as repo_name
       FROM file_git_stats fgs
       JOIN repositories r ON r.id = fgs.repo_id
       WHERE r.org_id = $1 AND fgs.bus_factor = 1
       ORDER BY fgs.knowledge_risk_score DESC LIMIT 10`,
      [orgId]
    ),
    db.query(
      `SELECT fgs.primary_owner_email as email, fgs.primary_owner_name as name,
              COUNT(*) as files_owned,
              AVG(fgs.primary_owner_pct) as avg_ownership_pct,
              COUNT(CASE WHEN fgs.bus_factor = 1 THEN 1 END) as sole_owner_files
       FROM file_git_stats fgs
       JOIN repositories r ON r.id = fgs.repo_id
       WHERE r.org_id = $1 AND fgs.primary_owner_email != 'unknown'
       GROUP BY fgs.primary_owner_email, fgs.primary_owner_name
       ORDER BY files_owned DESC LIMIT 8`,
      [orgId]
    ),
    db.query(
      `SELECT fgs.file_path, fgs.bus_factor, fgs.knowledge_risk_score,
              fgs.primary_owner_name, fgs.churn_score, fgs.incident_count,
              r.full_name as repo_name
       FROM file_git_stats fgs
       JOIN repositories r ON r.id = fgs.repo_id
       WHERE r.org_id = $1
       ORDER BY fgs.knowledge_risk_score DESC LIMIT 10`,
      [orgId]
    ),
    db.query(
      `SELECT rgs.avg_bus_factor, rgs.knowledge_silo_count, rgs.orphaned_files_count,
              r.full_name as repo_name
       FROM repo_git_summary rgs
       JOIN repositories r ON r.id = rgs.repo_id
       WHERE r.org_id = $1`,
      [orgId]
    ),
    db.query(
      `SELECT COUNT(*) as total,
              COUNT(CASE WHEN risk_level = 'critical' THEN 1 END) as critical,
              COUNT(CASE WHEN risk_level = 'high' THEN 1 END) as high,
              COUNT(CASE WHEN risk_level = 'medium' THEN 1 END) as medium
       FROM pull_requests
       WHERE org_id = $1 AND pr_created_at > NOW() - INTERVAL '30 days' AND status = 'analyzed'`,
      [orgId]
    ),
    db.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (analyzed_at - pr_created_at))) as avg_seconds
       FROM pull_requests
       WHERE org_id = $1 AND analyzed_at IS NOT NULL AND pr_created_at > NOW() - INTERVAL '30 days'`,
      [orgId]
    ),
    // Most complex files from latest code quality snapshot
    db.query(
      `SELECT fm.file_path, fm.cyclomatic_complexity, fm.lines_of_code, r.full_name as repo_name
       FROM file_metrics fm
       JOIN repositories r ON r.id = fm.repo_id
       WHERE r.org_id = $1
         AND fm.snapshot_month = (
           SELECT MAX(fm2.snapshot_month) FROM file_metrics fm2
           JOIN repositories r2 ON r2.id = fm2.repo_id WHERE r2.org_id = $1
         )
       ORDER BY fm.cyclomatic_complexity DESC LIMIT 5`,
      [orgId]
    ),
    db.query(
      `SELECT id, full_name, status FROM repositories WHERE org_id = $1 ORDER BY full_name`,
      [orgId]
    ),
  ]);

  const org = orgRes.rows[0] || {};
  const prStats = prStatsRes.rows[0] || { total: 0, critical: 0, high: 0, medium: 0 };
  const totalPRs = Number(prStats.total);
  const criticalPct = totalPRs > 0 ? Math.round((Number(prStats.critical) / totalPRs) * 100) : 0;
  const highPct     = totalPRs > 0 ? Math.round((Number(prStats.high) / totalPRs) * 100) : 0;

  const avgBusFactor = summaryRes.rows.length > 0
    ? Math.round((summaryRes.rows.reduce((s: number, r: any) => s + parseFloat(r.avg_bus_factor || 0), 0) / summaryRes.rows.length) * 10) / 10
    : 0;
  const totalSilos   = silosRes.rows.length;
  const totalOrphans = summaryRes.rows.reduce((s: number, r: any) => s + (r.orphaned_files_count || 0), 0);
  const knowledgeRiskScore = Math.min(Math.max(Math.round((totalSilos * 5) + (totalOrphans * 2) + ((3 - avgBusFactor) * 10)), 0), 100);

  const avgReviewMinutes = Math.round((avgReviewRes.rows[0]?.avg_seconds || 0) / 60);

  // Generate prioritised action items
  const actions: string[] = [];
  if (totalSilos > 0) {
    const topSilo = silosRes.rows[0];
    actions.push(
      topSilo
        ? `Schedule knowledge transfer for "${topSilo.file_path}" — only ${topSilo.primary_owner_name} knows it`
        : `Schedule knowledge transfer sessions for ${totalSilos} single-owner files`
    );
  }
  if (avgBusFactor < 2) {
    actions.push(`Bus factor critical (avg ${avgBusFactor}) — start pair-programming on high-risk services`);
  }
  if (criticalPct > 20) {
    actions.push(`${criticalPct}% of recent PRs are critical risk — tighten code review requirements`);
  }
  const mostComplex = complexFilesRes.rows[0];
  if (mostComplex && Number(mostComplex.cyclomatic_complexity) > 50) {
    actions.push(`Refactor "${mostComplex.file_path}" — complexity score ${mostComplex.cyclomatic_complexity} is dangerously high`);
  }
  const topEngineer = engineersRes.rows[0];
  if (topEngineer && Number(topEngineer.sole_owner_files) > 10) {
    actions.push(`${topEngineer.name} is sole owner of ${topEngineer.sole_owner_files} files — critical key-person dependency`);
  }
  if (actions.length < 3) {
    actions.push('Run monthly knowledge transfer sessions for high-risk services');
    actions.push('Add code review coverage requirements for files with bus factor 1');
  }

  res.json({
    generated_at:    new Date().toISOString(),
    org_name:        org.github_org_name || 'Your Organization',
    repos:           reposRes.rows,
    pr_stats: {
      total_30d:            totalPRs,
      critical_30d:         Number(prStats.critical),
      high_30d:             Number(prStats.high),
      medium_30d:           Number(prStats.medium),
      critical_pct:         criticalPct,
      high_pct:             highPct,
      avg_review_minutes:   avgReviewMinutes,
    },
    knowledge_risk: {
      avg_bus_factor:        avgBusFactor,
      knowledge_silo_count:  totalSilos,
      orphaned_files_count:  totalOrphans,
      knowledge_risk_score:  knowledgeRiskScore,
      top_silos:             silosRes.rows,
      engineer_coverage:     engineersRes.rows,
      highest_risk_files:    atRiskRes.rows,
    },
    code_health: {
      complex_files:         complexFilesRes.rows,
    },
    action_items: actions.slice(0, 5),
  });
};

// ── Manual PR Re-analyze ──────────────────────────────────────────────────────

export const reanalyzePR = async (req: AuthRequest, res: Response) => {
  try {
    const { prId } = req.params;
    const orgId    = req.orgId!;

    const prRes = await db.query(
      `SELECT p.*, r.full_name
       FROM pull_requests p
       JOIN repositories r ON r.id = p.repo_id
       WHERE p.id = $1 AND p.org_id = $2`,
      [prId, orgId]
    );

    if (prRes.rows.length === 0) {
      return res.status(404).json({ error: 'PR not found' });
    }

    const pr = prRes.rows[0];

    // Reset status so UI shows it's being re-analyzed
    await db.query(`UPDATE pull_requests SET status = 'analyzing' WHERE id = $1`, [prId]);

    await analysisQueue.add('analyze', {
      repoId:       pr.repo_id,
      orgId,
      prNumber:     pr.pr_number,
      prTitle:      pr.title,
      prUrl:        pr.github_pr_url,
      repoFullName: pr.full_name,
      action:       'opened',
    }, {
      // Use timestamp suffix so it's never deduped with the original job
      jobId:    `reanalyze-${pr.repo_id}-${pr.pr_number}-${Date.now()}`,
      attempts:  3,
      backoff:  { type: 'exponential', delay: 5000 },
    });

    logger.info(`[Admin] PR #${pr.pr_number} queued for re-analysis by admin`);
    res.json({ queued: true, prNumber: pr.pr_number });
  } catch (err: any) {
    logger.error({ err }, '[Admin] reanalyzePR error');
    res.status(500).json({ error: 'Failed to queue re-analysis' });
  }
};

// ── Dependency Graph ──────────────────────────────────────────────────────────

export const getDependencyGraph = async (req: AuthRequest, res: Response) => {
  const orgId = req.orgId!;
  try {
    const { dependencyGraphService } = await import('../../services/dependencyGraphService');
    const graph = await dependencyGraphService.getOrgGraph(orgId);
    res.json(graph);
  } catch (err: any) {
    logger.error({ err }, '[Admin] getDependencyGraph failed');
    res.status(500).json({ error: 'Failed to load dependency graph' });
  }
};

export const findExperts = async (req: AuthRequest, res: Response) => {
  const orgId = req.orgId!;
  const topic = String(req.query['topic'] || '').trim();
  if (!topic) return res.status(400).json({ error: 'topic query param required' });
  try {
    const { dependencyGraphService } = await import('../../services/dependencyGraphService');
    const result = await dependencyGraphService.findExperts(orgId, topic);
    res.json(result);
  } catch (err: any) {
    logger.error({ err }, '[Admin] findExperts failed');
    res.status(500).json({ error: 'Failed to find experts' });
  }
};

export const getCrossRepoImpact = async (req: AuthRequest, res: Response) => {
  const { prId } = req.params;
  try {
    const { dependencyGraphService } = await import('../../services/dependencyGraphService');
    const impacts = await dependencyGraphService.getCrossRepoImpact(prId);
    res.json({ impacts });
  } catch (err: any) {
    logger.error({ err }, '[Admin] getCrossRepoImpact failed');
    res.status(500).json({ error: 'Failed to compute cross-repo impact' });
  }
};

// ── Bug Magnets ───────────────────────────────────────────────────────────────

export const getBugMagnets = async (req: AuthRequest, res: Response) => {
  const orgId  = req.orgId!;
  const repoId = req.query.repoId as string | undefined;

  const params: any[] = [orgId];
  let repoFilter = '';
  if (repoId) {
    params.push(repoId);
    repoFilter = `AND r.id = $${params.length}`;
  }

  const [filesRes, summaryRes, reposRes] = await Promise.all([
    db.query(`
      SELECT fgs.file_path,
             fgs.incident_count, fgs.revert_count,
             fgs.churn_score, fgs.last_commit_date,
             fgs.primary_owner_name, fgs.primary_owner_email,
             fgs.knowledge_risk_score, fgs.total_commits,
             fgs.commits_30d, fgs.commits_90d, fgs.file_age_days,
             r.full_name as repo_name, r.id as repo_id,
             ROUND(fgs.incident_count::numeric / GREATEST(fgs.total_commits, 1) * 100, 1) as bug_density_pct
      FROM file_git_stats fgs
      JOIN repositories r ON r.id = fgs.repo_id
      WHERE r.org_id = $1 ${repoFilter}
        AND (fgs.incident_count > 0 OR fgs.revert_count > 0)
      ORDER BY (fgs.incident_count + fgs.revert_count * 2) DESC
      LIMIT 30
    `, params),
    db.query(`
      SELECT SUM(fgs.incident_count)  as total_incidents,
             SUM(fgs.revert_count)    as total_reverts,
             COUNT(CASE WHEN fgs.incident_count >= 5 THEN 1 END) as hotspot_count,
             ROUND(AVG(fgs.incident_count)::numeric, 1) as avg_incidents,
             COUNT(DISTINCT fgs.repo_id) as repos_affected
      FROM file_git_stats fgs
      JOIN repositories r ON r.id = fgs.repo_id
      WHERE r.org_id = $1 ${repoFilter}
        AND fgs.incident_count > 0
    `, params),
    db.query(
      `SELECT id, full_name FROM repositories WHERE org_id = $1 AND status = 'ready' ORDER BY full_name`,
      [orgId]
    ),
  ]);

  res.json({
    files:   filesRes.rows,
    summary: summaryRes.rows[0] || {},
    repos:   reposRes.rows,
  });
};

// ── Review Velocity ───────────────────────────────────────────────────────────

export const getVelocity = async (req: AuthRequest, res: Response) => {
  const orgId    = req.orgId!;
  const days     = Math.min(Number(req.query['days'] || 90), 180) || 90;
  const interval = `${days} days`;

  const [summaryRes, perRepoRes, perReviewerRes, reposRes] = await Promise.all([

    // Overall summary
    db.query(`
      SELECT COUNT(*) as total_prs,
             COUNT(CASE WHEN p.first_review_at IS NOT NULL THEN 1 END) as prs_with_review,
             ROUND(AVG(CASE WHEN p.first_review_at IS NOT NULL
               THEN EXTRACT(EPOCH FROM (p.first_review_at - p.pr_created_at)) / 3600 END)::numeric, 1) as avg_hours_to_review,
             ROUND(AVG(CASE WHEN p.merged_at IS NOT NULL
               THEN EXTRACT(EPOCH FROM (p.merged_at - p.pr_created_at)) / 3600 END)::numeric, 1) as avg_hours_to_merge,
             ROUND(MIN(CASE WHEN p.first_review_at IS NOT NULL
               THEN EXTRACT(EPOCH FROM (p.first_review_at - p.pr_created_at)) / 3600 END)::numeric, 1) as fastest_review_hours
      FROM pull_requests p
      JOIN repositories r ON r.id = p.repo_id
      WHERE r.org_id = $1
        AND p.pr_created_at > NOW() - INTERVAL '${interval}'
        AND p.status = 'analyzed'
    `, [orgId]),

    // Per repo
    db.query(`
      SELECT r.full_name as repo_name, r.id as repo_id,
             COUNT(p.id) as total_prs,
             COUNT(CASE WHEN p.first_review_at IS NOT NULL THEN 1 END) as prs_reviewed,
             ROUND(AVG(CASE WHEN p.first_review_at IS NOT NULL
               THEN EXTRACT(EPOCH FROM (p.first_review_at - p.pr_created_at)) / 3600 END)::numeric, 1) as avg_hours_to_review,
             ROUND(AVG(CASE WHEN p.merged_at IS NOT NULL
               THEN EXTRACT(EPOCH FROM (p.merged_at - p.pr_created_at)) / 3600 END)::numeric, 1) as avg_hours_to_merge
      FROM repositories r
      LEFT JOIN pull_requests p ON p.repo_id = r.id
        AND p.pr_created_at > NOW() - INTERVAL '${interval}'
        AND p.status = 'analyzed'
      WHERE r.org_id = $1
      GROUP BY r.id, r.full_name
      ORDER BY avg_hours_to_review DESC NULLS LAST
    `, [orgId]),

    // Per reviewer (who reviewed first, their speed)
    db.query(`
      SELECT p.first_reviewer_login,
             COUNT(*) as prs_reviewed,
             ROUND(AVG(EXTRACT(EPOCH FROM (p.first_review_at - p.pr_created_at)) / 3600)::numeric, 1) as avg_hours_to_review,
             ROUND(MIN(EXTRACT(EPOCH FROM (p.first_review_at - p.pr_created_at)) / 3600)::numeric, 1) as fastest_hours,
             ROUND(MAX(EXTRACT(EPOCH FROM (p.first_review_at - p.pr_created_at)) / 3600)::numeric, 1) as slowest_hours
      FROM pull_requests p
      JOIN repositories r ON r.id = p.repo_id
      WHERE r.org_id = $1
        AND p.first_reviewer_login IS NOT NULL
        AND p.pr_created_at > NOW() - INTERVAL '${interval}'
      GROUP BY p.first_reviewer_login
      ORDER BY avg_hours_to_review ASC
    `, [orgId]),

    db.query(
      `SELECT id, full_name FROM repositories WHERE org_id = $1 AND status = 'ready' ORDER BY full_name`,
      [orgId]
    ),
  ]);

  res.json({
    days,
    summary:      summaryRes.rows[0] || {},
    per_repo:     perRepoRes.rows,
    per_reviewer: perReviewerRes.rows,
    repos:        reposRes.rows,
  });
};
