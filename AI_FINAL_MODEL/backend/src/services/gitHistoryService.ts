// NOTE: This service computes bus_factor, file ownership, and churn using git log.
// The file-level git stats (file_git_stats table) are still written here.
// PHASE2_DISABLED — bus factor dashboards, code quality pages use this data.
// The data itself is harmless to collect; only the frontend pages showing it are disabled.

import simpleGit from 'simple-git';
import { db } from '../config/db';
import { logger } from '../config/logger';

interface CommitEntry {
  sha: string;
  authorEmail: string;
  authorName: string;
  message: string;
  date: string;
  files: string[];
}

export interface FileGitStat {
  file_path: string;
  total_commits: number;
  commits_30d: number;
  commits_90d: number;
  commits_180d: number;
  bus_factor: number;
  primary_owner_email: string;
  primary_owner_name: string;
  primary_owner_pct: number;
  all_authors: Array<{ email: string; name: string; commits: number; pct: number }>;
  incident_count: number;
  revert_count: number;
  last_commit_date: string | null;
  file_age_days: number;
  churn_score: number;
  knowledge_risk_score: number;
}

const INCIDENT_RE = /\b(fix(ed)?|bugfix|hotfix|urgent|critical|emergency|rollback|broken|crash|exception|error|outage)\b/i;
const REVERT_RE   = /^revert\b/i;

export const gitHistoryService = {

  // ── Step 1: Parse git log → churn, incidents, dates (commit-level data) ──
  async parseAndStore(repoId: string, tmpDir: string): Promise<void> {
    try {
      const git = simpleGit(tmpDir);

      const logRaw = await git.raw([
        'log',
        '--format=COMMIT%x1f%H%x1f%ae%x1f%an%x1f%s%x1f%ad',
        '--date=short',
        '--name-only',
        '--max-count=500',
      ]);

      const commits = parseGitLog(logRaw);
      if (commits.length === 0) {
        logger.warn(`[GitHistory] No commits found for repo ${repoId}`);
        return;
      }

      const fileMap = new Map<string, CommitEntry[]>();
      for (const commit of commits) {
        for (const file of commit.files) {
          if (!fileMap.has(file)) fileMap.set(file, []);
          fileMap.get(file)!.push(commit);
        }
      }

      // Only process files we actually indexed
      const chunkedRes = await db.query(
        `SELECT DISTINCT file_path FROM code_chunks WHERE repo_id = $1`,
        [repoId]
      );
      const relevantFiles = new Set(chunkedRes.rows.map((r: any) => r.file_path as string));

      const now = new Date();
      const stats: FileGitStat[] = [];

      for (const [filePath, fileCommits] of fileMap.entries()) {
        if (!relevantFiles.has(filePath)) continue;
        stats.push(computeFileStats(filePath, fileCommits, now));
      }

      await db.query(`DELETE FROM file_git_stats WHERE repo_id = $1`, [repoId]);

      const batchSize = 50;
      for (let i = 0; i < stats.length; i += batchSize) {
        const batch = stats.slice(i, i + batchSize);
        await Promise.all(batch.map(s =>
          db.query(
            `INSERT INTO file_git_stats (
              repo_id, file_path,
              total_commits, commits_30d, commits_90d, commits_180d,
              bus_factor, primary_owner_email, primary_owner_name, primary_owner_pct,
              all_authors, incident_count, revert_count, last_commit_date,
              file_age_days, churn_score, knowledge_risk_score
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17)
            ON CONFLICT (repo_id, file_path) DO UPDATE SET
              total_commits        = EXCLUDED.total_commits,
              commits_30d          = EXCLUDED.commits_30d,
              commits_90d          = EXCLUDED.commits_90d,
              commits_180d         = EXCLUDED.commits_180d,
              bus_factor           = EXCLUDED.bus_factor,
              primary_owner_email  = EXCLUDED.primary_owner_email,
              primary_owner_name   = EXCLUDED.primary_owner_name,
              primary_owner_pct    = EXCLUDED.primary_owner_pct,
              all_authors          = EXCLUDED.all_authors,
              incident_count       = EXCLUDED.incident_count,
              revert_count         = EXCLUDED.revert_count,
              last_commit_date     = EXCLUDED.last_commit_date,
              file_age_days        = EXCLUDED.file_age_days,
              churn_score          = EXCLUDED.churn_score,
              knowledge_risk_score = EXCLUDED.knowledge_risk_score,
              updated_at           = NOW()`,
            [
              repoId, s.file_path,
              s.total_commits, s.commits_30d, s.commits_90d, s.commits_180d,
              s.bus_factor, s.primary_owner_email, s.primary_owner_name, s.primary_owner_pct,
              JSON.stringify(s.all_authors),
              s.incident_count, s.revert_count, s.last_commit_date,
              s.file_age_days, s.churn_score, s.knowledge_risk_score,
            ]
          )
        ));
      }

      await storeRepoSummary(repoId, stats, commits);
      await db.query(`UPDATE repositories SET git_stats_indexed_at = NOW() WHERE id = $1`, [repoId]);
      logger.info(`[GitHistory] Stored git stats for ${stats.length} files`);
    } catch (err: any) {
      logger.error({ err }, `[GitHistory] parseAndStore failed for repo ${repoId}`);
    }
  },

  async getFileStats(repoId: string, filePaths: string[]): Promise<Map<string, FileGitStat>> {
    if (filePaths.length === 0) return new Map();
    const res = await db.query(
      `SELECT * FROM file_git_stats WHERE repo_id = $1 AND file_path = ANY($2::text[])`,
      [repoId, filePaths]
    );
    const map = new Map<string, FileGitStat>();
    for (const row of res.rows) map.set(row.file_path, row);
    return map;
  },

  // ── Step 2: PR-wise ownership (runs AFTER historical PRs are indexed) ──────
  // Overwrites git-commit-based ownership with semantically correct PR-level data.
  // "Who merged PRs touching this file" is more meaningful than "who made commits".
  async computeOwnershipFromPRs(repoId: string): Promise<void> {
    try {
      // Count how many PRs each GitHub user has that touched each file
      const res = await db.query(
        `SELECT
           f->>'path'    AS file_path,
           pr.author     AS author,
           COUNT(*)::int AS pr_count
         FROM pull_requests pr,
              jsonb_array_elements(pr.files_changed) f
         WHERE pr.repo_id = $1
           AND pr.author IS NOT NULL
           AND pr.author != 'unknown'
           AND pr.files_changed IS NOT NULL
           AND COALESCE(jsonb_array_length(pr.files_changed), 0) > 0
         GROUP BY f->>'path', pr.author`,
        [repoId]
      );

      if (res.rows.length === 0) {
        logger.info(`[GitHistory] No PR ownership data yet for repo ${repoId} — git-based ownership kept`);
        return;
      }

      // Group rows by file path
      const fileMap = new Map<string, Map<string, number>>();
      for (const row of res.rows) {
        const fp = row.file_path as string;
        if (!fp) continue;
        if (!fileMap.has(fp)) fileMap.set(fp, new Map());
        fileMap.get(fp)!.set(row.author as string, Number(row.pr_count));
      }

      let updated = 0;
      for (const [filePath, authorMap] of fileMap.entries()) {
        const total = [...authorMap.values()].reduce((a, b) => a + b, 0) || 1;

        const allAuthors = [...authorMap.entries()]
          .map(([login, count]) => ({
            email:   login,  // GitHub login stored in email field for reviewer filtering
            name:    login,
            commits: count,  // "commits" here means PR count
            pct:     Math.round((count / total) * 100),
          }))
          .sort((a, b) => b.commits - a.commits)
          .slice(0, 10);

        const primary   = allAuthors[0] || { email: 'unknown', name: 'Unknown', commits: 0, pct: 0 };
        const busFactor = Math.max(allAuthors.filter(a => a.pct >= 10).length, 1);

        // UPSERT:
        // INSERT case  → new file (from this PR), churn/incident fields default to 0
        // UPDATE case  → existing file, recompute knowledge_risk_score using new bus_factor
        //                but keep existing churn/incident values from git log
        await db.query(
          `INSERT INTO file_git_stats
             (repo_id, file_path, bus_factor, primary_owner_email, primary_owner_name,
              primary_owner_pct, all_authors, knowledge_risk_score)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb,
             CASE WHEN $3 = 1 THEN 50 WHEN $3 = 2 THEN 25 WHEN $3 = 3 THEN 10 ELSE 0 END
           )
           ON CONFLICT (repo_id, file_path) DO UPDATE SET
             bus_factor          = EXCLUDED.bus_factor,
             primary_owner_email = EXCLUDED.primary_owner_email,
             primary_owner_name  = EXCLUDED.primary_owner_name,
             primary_owner_pct   = EXCLUDED.primary_owner_pct,
             all_authors         = EXCLUDED.all_authors,
             knowledge_risk_score = LEAST(
               CASE WHEN EXCLUDED.bus_factor = 1 THEN 50
                    WHEN EXCLUDED.bus_factor = 2 THEN 25
                    WHEN EXCLUDED.bus_factor = 3 THEN 10
                    ELSE 0 END
               + LEAST(file_git_stats.incident_count * 5, 30)
               + LEAST(file_git_stats.revert_count   * 10, 20)
               + CASE WHEN file_git_stats.file_age_days > 365 THEN 20
                      WHEN file_git_stats.file_age_days > 180 THEN 10
                      ELSE 0 END
               + LEAST(file_git_stats.commits_30d * 2, 20),
               100
             ),
             updated_at = NOW()`,
          [repoId, filePath, busFactor, primary.email, primary.name, primary.pct,
           JSON.stringify(allAuthors)]
        );
        updated++;
      }

      logger.info(`[GitHistory] PR-wise ownership updated for ${updated} files in repo ${repoId}`);
    } catch (err: any) {
      logger.error({ err }, `[GitHistory] computeOwnershipFromPRs failed for repo ${repoId}`);
    }
  },

    // ── Refresh repo summary from DB (no git clone needed) ───────────────────
  // Called after every PR merge to keep bus factor dashboard fresh.
  async refreshRepoGitSummary(repoId: string): Promise<void> {
    try {
      await db.query(
        `UPDATE repo_git_summary SET
           avg_bus_factor          = (SELECT ROUND(AVG(bus_factor)::numeric, 1) FROM file_git_stats WHERE repo_id = $1),
           knowledge_silo_count    = (SELECT COUNT(*) FROM file_git_stats WHERE repo_id = $1 AND bus_factor = 1),
           orphaned_files_count    = (SELECT COUNT(*) FROM file_git_stats WHERE repo_id = $1 AND file_age_days > 180),
           active_contributors_30d = (
             SELECT COUNT(DISTINCT author) FROM pull_requests
             WHERE repo_id = $1 AND author IS NOT NULL AND author != 'unknown'
               AND pr_created_at > NOW() - INTERVAL '30 days'
           ),
           total_contributors = (
             SELECT COUNT(DISTINCT author) FROM pull_requests
             WHERE repo_id = $1 AND author IS NOT NULL AND author != 'unknown'
           ),
           most_changed_file  = (SELECT file_path FROM file_git_stats WHERE repo_id = $1 ORDER BY total_commits DESC LIMIT 1),
           highest_risk_file  = (SELECT file_path FROM file_git_stats WHERE repo_id = $1 ORDER BY knowledge_risk_score DESC LIMIT 1),
           indexed_at         = NOW()
         WHERE repo_id = $1`,
        [repoId]
      );
      logger.info(`[GitHistory] repo_git_summary refreshed for repo ${repoId}`);
    } catch (err: any) {
      logger.error({ err }, `[GitHistory] refreshRepoGitSummary failed for repo ${repoId}`);
    }
  },

};

// ─── Private helpers ──────────────────────────────────────────────────────────

function parseGitLog(raw: string): CommitEntry[] {
  const SEP = '\x1f';
  const commits: CommitEntry[] = [];
  let current: CommitEntry | null = null;

  for (const line of raw.split('\n')) {
    if (line.startsWith('COMMIT' + SEP)) {
      if (current) commits.push(current);
      const parts = line.split(SEP);
      current = {
        sha:         parts[1] || '',
        authorEmail: (parts[2] || '').toLowerCase().trim(),
        authorName:  parts[3] || '',
        message:     parts[4] || '',
        date:        parts[5] || '',
        files:       [],
      };
    } else if (current && line.trim()) {
      current.files.push(line.trim());
    }
  }
  if (current) commits.push(current);
  return commits;
}

function computeFileStats(filePath: string, commits: CommitEntry[], now: Date): FileGitStat {
  const ms30  = now.getTime() - 30  * 86400000;
  const ms90  = now.getTime() - 90  * 86400000;
  const ms180 = now.getTime() - 180 * 86400000;

  let c30 = 0, c90 = 0, c180 = 0;
  let incidents = 0, reverts = 0;
  let lastDate: string | null = null;

  const authorMap: Record<string, { name: string; count: number }> = {};

  for (const c of commits) {
    const t = new Date(c.date).getTime();
    if (t >= ms30)  c30++;
    if (t >= ms90)  c90++;
    if (t >= ms180) c180++;

    if (INCIDENT_RE.test(c.message)) incidents++;
    if (REVERT_RE.test(c.message))   reverts++;
    if (!lastDate || c.date > lastDate) lastDate = c.date;

    const e = c.authorEmail || 'unknown';
    if (!authorMap[e]) authorMap[e] = { name: c.authorName, count: 0 };
    authorMap[e].count++;
  }

  const total = commits.length || 1;

  const allAuthors = Object.entries(authorMap)
    .map(([email, { name, count }]) => ({
      email, name, commits: count,
      pct: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 10);

  const primary   = allAuthors[0] || { email: 'unknown', name: 'Unknown', commits: 0, pct: 0 };
  const busFactor = Math.max(allAuthors.filter(a => a.pct >= 10).length, 1);

  const fileAgeDays = lastDate
    ? Math.floor((now.getTime() - new Date(lastDate).getTime()) / 86400000)
    : 0;

  const rawChurn   = c30 * 3 + c90 * 1.5 + incidents * 5;
  const churnScore = Math.min(Math.round(rawChurn), 100);

  const ownerRisk  = busFactor === 1 ? 50 : busFactor === 2 ? 25 : busFactor === 3 ? 10 : 0;
  const incRisk    = Math.min(incidents * 5, 30);
  const revRisk    = Math.min(reverts * 10, 20);
  const orphanRisk = fileAgeDays > 365 ? 20 : fileAgeDays > 180 ? 10 : 0;
  const churnRisk  = Math.min(c30 * 2, 20);
  const knowledgeRiskScore = Math.min(ownerRisk + incRisk + revRisk + orphanRisk + churnRisk, 100);

  return {
    file_path: filePath,
    total_commits: total,
    commits_30d: c30, commits_90d: c90, commits_180d: c180,
    bus_factor: busFactor,
    primary_owner_email: primary.email,
    primary_owner_name:  primary.name,
    primary_owner_pct:   primary.pct,
    all_authors: allAuthors,
    incident_count: incidents,
    revert_count:   reverts,
    last_commit_date: lastDate,
    file_age_days:    fileAgeDays,
    churn_score:      churnScore,
    knowledge_risk_score: knowledgeRiskScore,
  };
}

async function storeRepoSummary(repoId: string, stats: FileGitStat[], commits: CommitEntry[]) {
  const now   = new Date();
  const ms30  = now.getTime() - 30 * 86400000;

  const allEmails   = new Set(commits.map(c => c.authorEmail));
  const active30    = new Set(commits.filter(c => new Date(c.date).getTime() >= ms30).map(c => c.authorEmail));
  const siloCount   = stats.filter(s => s.bus_factor === 1).length;
  const orphanCount = stats.filter(s => s.file_age_days > 180).length;
  const avgBus      = stats.length > 0
    ? Math.round((stats.reduce((s, f) => s + f.bus_factor, 0) / stats.length) * 10) / 10
    : 0;
  const sorted  = [...stats].sort((a, b) => b.knowledge_risk_score - a.knowledge_risk_score);
  const byChurn = [...stats].sort((a, b) => b.total_commits - a.total_commits);

  await db.query(
    `INSERT INTO repo_git_summary (
      repo_id, total_commits, active_contributors_30d, total_contributors,
      avg_bus_factor, knowledge_silo_count, orphaned_files_count,
      most_changed_file, highest_risk_file, indexed_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
    ON CONFLICT (repo_id) DO UPDATE SET
      total_commits           = EXCLUDED.total_commits,
      active_contributors_30d = EXCLUDED.active_contributors_30d,
      total_contributors      = EXCLUDED.total_contributors,
      avg_bus_factor          = EXCLUDED.avg_bus_factor,
      knowledge_silo_count    = EXCLUDED.knowledge_silo_count,
      orphaned_files_count    = EXCLUDED.orphaned_files_count,
      most_changed_file       = EXCLUDED.most_changed_file,
      highest_risk_file       = EXCLUDED.highest_risk_file,
      indexed_at              = EXCLUDED.indexed_at`,
    [
      repoId, commits.length, active30.size, allEmails.size,
      avgBus, siloCount, orphanCount,
      byChurn[0]?.file_path || null, sorted[0]?.file_path || null,
    ]
  );
}
