// PHASE2_DISABLED — PR risk analysis + Claude PR review pipeline
// Not part of EngineeringOS Phase 1. Re-enable by setting PHASE2_ENABLED=true.

import { db } from '../config/db';
import { githubService } from './githubService';
import { embeddingService } from './embeddingService';
import { dependencyService } from './dependencyService';
import { calculateRisk } from './riskService';
import { claudeService } from './claudeService';
import { gitHistoryService } from './gitHistoryService';
import { emailService } from './emailService';
import { logger } from '../config/logger';
import { config } from '../config/env';
import { getOrgToken } from '../lib/octokitForOrg';
import { FileChanged } from '../types';

interface EnhancedReviewer {
  email: string;
  name: string;
  reason: string;
  files_owned: number;
  ownership_pct: number;
  rank: number;
  is_architecture_expert: boolean;
}

interface DuplicateFinding {
  file_path: string;
  repo_name: string;
  similarity: number;
  content_preview: string;
}

export const analysisService = {
  async analyzePR(data: {
    repoId: string;
    orgId: string;
    prNumber: number;
    repoFullName: string;
  }): Promise<void> {
    const { repoId, orgId, prNumber, repoFullName } = data;

    const accessToken = await getOrgToken(orgId);
    const [owner, repo] = repoFullName.split('/');

    const prInsert = await db.query(
      `INSERT INTO pull_requests (repo_id, org_id, pr_number, title, status, pr_created_at)
       VALUES ($1,$2,$3,$4,'analyzing',NOW())
       ON CONFLICT (repo_id, pr_number) DO UPDATE SET status = 'analyzing'
       RETURNING id`,
      [repoId, orgId, prNumber, `PR #${prNumber}`]
    );
    const prId = prInsert.rows[0].id;

    try {
      // 1. Fetch PR details + files from GitHub
      const [prDetails, prFiles] = await Promise.all([
        githubService.fetchPRDetails(accessToken, owner, repo, prNumber),
        githubService.fetchPRFiles(accessToken, owner, repo, prNumber),
      ]);

      const filesChanged: FileChanged[] = prFiles.map((f: any) => ({
        path:      f.filename,
        additions: f.additions,
        deletions: f.deletions,
        changes:   f.changes,
      }));

      const changedPaths      = filesChanged.map(f => f.path);
      const totalLinesChanged = filesChanged.reduce((s, f) => s + f.additions + f.deletions, 0);

      // 2. Get affected services + git stats (parallel)
      const [affectedServices, fileGitStats] = await Promise.all([
        dependencyService.getAffectedServices(repoId, changedPaths),
        gitHistoryService.getFileStats(repoId, changedPaths),
      ]);

      // 3. Embed PR for similar PR search
      const embedText = `${prDetails.title} ${prDetails.body || ''} ${changedPaths.join(' ')}`;
      const { embedding } = await embeddingService.generateEmbedding(embedText);
      const embeddingStr   = `[${embedding.join(',')}]`;

      // 4. Find similar past PRs
      const similarRes = await db.query(
        `SELECT id, pr_number, title, pr_state, pr_created_at, source,
                1 - (embedding <=> $1::vector) AS similarity
         FROM pull_requests
         WHERE repo_id = $2 AND id != $3 AND embedding IS NOT NULL
           AND (status = 'analyzed' OR source = 'historical')
         ORDER BY embedding <=> $1::vector
         LIMIT 5`,
        [embeddingStr, repoId, prId]
      );

      const similarPRs = similarRes.rows.map((p: any) => ({
        pr_number:        p.pr_number,
        title:            p.title,
        outcome:          p.pr_state === 'closed' ? 'succeeded' : p.pr_state === 'open' ? 'unknown' : 'closed' as any,
        similarity_score: p.similarity,
        pr_created_at:    p.pr_created_at,
      }));

      // 5. Historical incidents on same files
      const incidentRes = await db.query(
        `SELECT COUNT(*) FROM pull_requests
         WHERE repo_id = $1 AND id != $2
           AND files_changed @> ANY($3::jsonb[])
           AND (ai_analysis ILIKE '%incident%' OR ai_analysis ILIKE '%rollback%' OR ai_analysis ILIKE '%revert%')`,
        [repoId, prId, changedPaths.map(p => JSON.stringify([{ path: p }]))]
      );
      const historicalIncidents = Number(incidentRes.rows[0].count);

      // 6. Per-file git context
      const fileStatsArray = changedPaths
        .map(p => fileGitStats.get(p))
        .filter(Boolean) as any[];

      const maxKnowledgeRisk  = fileStatsArray.length > 0
        ? Math.max(...fileStatsArray.map((s: any) => s.knowledge_risk_score || 0))
        : 0;
      const totalIncidents = fileStatsArray.reduce((sum: number, s: any) => sum + (s.incident_count || 0), 0);

      // 7. Calculate risk
      const { score, level } = calculateRisk({
        filesChanged:        filesChanged.length,
        totalLinesChanged,
        totalLinesInFiles:   totalLinesChanged * 3,
        servicesAffected:    affectedServices.length,
        historicalIncidents: historicalIncidents + totalIncidents,
      });

      const hasCriticalOwnership = fileStatsArray.some((s: any) => s.bus_factor === 1);
      const finalScore = hasCriticalOwnership ? Math.min(score + 15, 100) : score;
      const finalLevel = finalScore >= 76 ? 'critical' : finalScore >= 51 ? 'high' : finalScore >= 26 ? 'medium' : 'low';

      // 8. Suggested reviewers — exclude PR author
      const suggestedReviewers = buildSuggestedReviewers(
        changedPaths, fileGitStats, affectedServices, prDetails.user.login
      );

      // 9. Code duplication detection (non-blocking)
      const duplicateFindings = await findDuplicateCode(prFiles, orgId, repoId).catch(() => []);

      // 10. Extract actual code diff for Claude (top 5 files, added lines only)
      //     This is the key improvement — Claude sees real code, not just file names
      const patchSummary = (prFiles as any[])
        .filter((f: any) => f.patch)
        .slice(0, 5)
        .map((f: any) => {
          const addedLines = (f.patch as string)
            .split('\n')
            .filter((l: string) => l.startsWith('+') && !l.startsWith('+++'))
            .slice(0, 12)
            .join('\n');
          return addedLines.trim() ? `--- ${f.filename} ---\n${addedLines}` : null;
        })
        .filter(Boolean)
        .join('\n\n')
        .slice(0, 2000);

      // 11. Claude analysis (now with actual diff context)
      const { aiAnalysis, recommendations } = await claudeService.generatePRAnalysis({
        prTitle:      prDetails.title,
        prAuthor:     prDetails.user.login,
        prBody:       prDetails.body,
        filesChanged,
        affectedServices,
        similarPRs,
        riskLevel:    finalLevel,
        riskScore:    finalScore,
        fileGitStats: fileStatsArray,
        patchSummary,
      });

      // 12. Save to DB
      await db.query(
        `UPDATE pull_requests SET
           title = $1, author = $2, body = $3, github_pr_url = $4, github_pr_id = $5,
           files_changed = $6, risk_level = $7, risk_score = $8,
           affected_services = $9, similar_prs = $10,
           ai_analysis = $11, recommendations = $12,
           embedding = $13::vector, status = 'analyzed',
           pr_state = $14, pr_created_at = $15, analyzed_at = NOW(),
           suggested_reviewers = $16,
           duplicate_code_findings = $17
         WHERE id = $18`,
        [
          prDetails.title, prDetails.user.login, prDetails.body,
          prDetails.html_url, String(prDetails.id),
          JSON.stringify(filesChanged), finalLevel, finalScore,
          JSON.stringify(affectedServices), JSON.stringify(similarPRs),
          aiAnalysis, JSON.stringify(recommendations),
          embeddingStr,
          prDetails.state, prDetails.created_at,
          JSON.stringify(suggestedReviewers),
          JSON.stringify(duplicateFindings),
          prId,
        ]
      );

      // 13. Post GitHub comment
      const comment = githubService.formatComment({
        prNumber,
        prTitle:           prDetails.title,
        riskLevel:         finalLevel,
        riskScore:         finalScore,
        filesChanged,
        affectedServices,
        similarPRs,
        aiAnalysis,
        recommendations,
        fileGitStats:      Object.fromEntries(fileGitStats),
        suggestedReviewers,
        duplicateFindings,
        dashboardUrl:      config.frontendUrl,
        prId,
      });

      const commentId = await githubService.postComment(accessToken, owner, repo, prNumber, comment);
      await db.query(`UPDATE pull_requests SET github_comment_id = $1 WHERE id = $2`, [commentId, prId]);

      // 14. Track usage
      const month = new Date().toISOString().slice(0, 7);
      await db.query(
        `INSERT INTO usage (org_id, month, prs_analyzed) VALUES ($1,$2,1)
         ON CONFLICT (org_id, month) DO UPDATE SET prs_analyzed = usage.prs_analyzed + 1`,
        [orgId, month]
      );

      // 15. Email notification for high/critical
      if (finalLevel === 'critical' || finalLevel === 'high') {
        emailService.sendPRAnalysisNotification({
          orgId,
          riskLevel:   finalLevel,
          prTitle:     prDetails.title,
          prNumber,
          prUrl:       prDetails.html_url,
          repoName:    repoFullName,
          author:      prDetails.user.login,
          analysisUrl: `${config.frontendUrl}/prs/${prId}`,
        }).catch(() => {});
      }

      logger.info(`[Analysis] PR #${prNumber} analyzed: ${finalLevel.toUpperCase()} (${finalScore}/100)`);
    } catch (err: any) {
      await db.query(`UPDATE pull_requests SET status = 'failed' WHERE id = $1`, [prId]);
      throw err;
    }
  },
};

// ─── Enhanced Suggested Reviewers ────────────────────────────────────────────

function buildSuggestedReviewers(
  changedPaths: string[],
  fileGitStats: Map<string, any>,
  affectedServices: any[],
  prAuthorLogin: string = ''
): EnhancedReviewer[] {
  const ownerMap = new Map<string, {
    name: string; files: number; maxPct: number; totalPct: number; totalCommits: number;
  }>();

  for (const p of changedPaths) {
    const s = fileGitStats.get(p);
    if (!s || !s.primary_owner_email || s.primary_owner_email === 'unknown') continue;
    const email = s.primary_owner_email;
    if (!ownerMap.has(email)) {
      ownerMap.set(email, { name: s.primary_owner_name || email, files: 0, maxPct: 0, totalPct: 0, totalCommits: 0 });
    }
    const e = ownerMap.get(email)!;
    e.files++;
    e.maxPct = Math.max(e.maxPct, s.primary_owner_pct || 0);
    e.totalPct += s.primary_owner_pct || 0;
    e.totalCommits += s.total_commits || 0;
  }

  const authorLower = prAuthorLogin.toLowerCase();

  return [...ownerMap.entries()]
    .sort((a, b) => b[1].files - a[1].files || b[1].maxPct - a[1].maxPct)
    .filter(([email, { name }]) => {
      if (!authorLower) return true;
      return (
        name.toLowerCase()  !== authorLower &&
        email.toLowerCase() !== authorLower &&
        !email.toLowerCase().startsWith(authorLower + '@') &&
        !email.toLowerCase().startsWith(authorLower + '+')
      );
    })
    .slice(0, 3)
    .map(([email, { name, files, maxPct, totalCommits }], i) => {
      const isArchExpert = files >= 3 || maxPct > 65;
      const roundedPct   = Math.round(maxPct);

      let reason: string;
      if (roundedPct >= 70) {
        reason = `Owns ${roundedPct}% of changed code — primary expert`;
      } else if (isArchExpert) {
        reason = `Architecture expert — worked across ${files} changed file${files > 1 ? 's' : ''}`;
      } else {
        reason = `Contributed to ${files} changed file${files > 1 ? 's' : ''} (${roundedPct}% avg ownership)`;
      }

      return {
        email,
        name,
        reason,
        files_owned:          files,
        ownership_pct:        roundedPct,
        rank:                 i + 1,
        is_architecture_expert: isArchExpert,
      };
    });
}

// ─── Code Duplication Detection ──────────────────────────────────────────────

async function findDuplicateCode(
  prFiles: any[],
  orgId: string,
  repoId: string
): Promise<DuplicateFinding[]> {
  const addedLines: string[] = [];
  for (const file of prFiles.slice(0, 8)) {
    if (!file.patch) continue;
    const added = file.patch
      .split('\n')
      .filter((l: string) => l.startsWith('+') && !l.startsWith('+++'))
      .map((l: string) => l.slice(1))
      .join('\n');
    if (added.length > 80) addedLines.push(added.slice(0, 400));
  }

  if (addedLines.length === 0) return [];

  const codeText = addedLines.join('\n---\n').slice(0, 1500);

  try {
    const { embeddingService } = await import('./embeddingService');
    const { embedding } = await embeddingService.generateEmbedding(codeText);
    if (embedding.length !== 1536) return [];

    const embStr       = `[${embedding.join(',')}]`;
    const changedPaths = prFiles.map((f: any) => f.filename);

    const results = await db.query(
      `SELECT cc.file_path, cc.content, r.full_name as repo_name,
              1 - (cc.embedding <=> $1::vector) AS similarity
       FROM code_chunks cc
       JOIN repositories r ON r.id = cc.repo_id
       WHERE r.org_id = $2
         AND 1 - (cc.embedding <=> $1::vector) > 0.88
         AND length(cc.content) > 60
       ORDER BY cc.embedding <=> $1::vector
       LIMIT 8`,
      [embStr, orgId]
    );

    return results.rows
      .filter((r: any) => !changedPaths.some((p: string) =>
        r.file_path.endsWith(p) || p.endsWith(r.file_path)
      ))
      .slice(0, 3)
      .map((r: any) => ({
        file_path:       r.file_path,
        repo_name:       r.repo_name,
        similarity:      Math.round(r.similarity * 100),
        content_preview: (r.content as string).slice(0, 180).replace(/\n/g, ' '),
      }));
  } catch {
    return [];
  }
}
