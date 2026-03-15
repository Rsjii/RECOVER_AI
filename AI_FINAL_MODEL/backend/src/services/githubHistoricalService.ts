import { db } from '../config/db';
import { logger } from '../config/logger';
import { getOrgToken } from '../lib/octokitForOrg';
import { Octokit } from '@octokit/rest';

const JIRA_KEY_REGEX = /([A-Z][A-Z0-9]+-\d+)/g;

/** Extract all Jira ticket keys from a string (e.g. PR title, branch, commit message) */
export function extractJiraKeys(text: string): string[] {
  if (!text) return [];
  return [...new Set(Array.from(text.matchAll(JIRA_KEY_REGEX), m => m[1]))];
}

/** Sleep helper for rate limit backoff */
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Respect GitHub rate limits — sleep if remaining < threshold */
async function checkRateLimit(octokit: Octokit) {
  const { data } = await octokit.rateLimit.get();
  const remaining = data.rate.remaining;
  if (remaining < 100) {
    const resetMs = data.rate.reset * 1000 - Date.now();
    logger.warn({ remaining, resetMs }, '[GH Historical] Rate limit low — sleeping');
    await sleep(Math.max(resetMs + 1000, 1000));
  }
}

export const githubHistoricalService = {
  /** Index 180 days of commits for a repo */
  async indexCommits(orgId: string, repoId: string, fullName: string, since: string) {
    const [owner, repo] = fullName.split('/');
    const token = await getOrgToken(orgId);
    const octokit = new Octokit({ auth: token });

    let page = 1;
    let total = 0;

    while (true) {
      await checkRateLimit(octokit);
      const { data: commits } = await octokit.repos.listCommits({
        owner, repo, since, per_page: 100, page,
      });

      if (!commits.length) break;

      for (const c of commits) {
        const jiraKeys = extractJiraKeys(c.commit.message);
        await db.query(
          `INSERT INTO github_commits_eos
             (org_id, repo_id, sha, author_github_id, author_login, author_name, author_email,
              message, timestamp, branch, linked_jira_keys)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'main',$10)
           ON CONFLICT (org_id, sha) DO NOTHING`,
          [
            orgId, repoId, c.sha,
            c.author?.id?.toString() || null,
            c.author?.login || null,
            c.commit.author?.name || null,
            c.commit.author?.email || null,
            c.commit.message,
            c.commit.author?.date || null,
            jiraKeys,
          ]
        );
      }

      total += commits.length;
      if (commits.length < 100) break;
      page++;
      await sleep(100); // 100ms between pages
    }

    logger.info({ orgId, repoId, fullName, total }, '[GH Historical] Commits indexed');
  },

  /** Index 180 days of pull requests for a repo */
  async indexPullRequests(orgId: string, repoId: string, fullName: string, since: string) {
    const [owner, repo] = fullName.split('/');
    const token = await getOrgToken(orgId);
    const octokit = new Octokit({ auth: token });

    let page = 1;
    let total = 0;

    while (true) {
      await checkRateLimit(octokit);
      const { data: prs } = await octokit.pulls.list({
        owner, repo, state: 'all', per_page: 100, page,
        sort: 'updated', direction: 'desc',
      });

      if (!prs.length) break;

      // Stop if all PRs are older than `since`
      const oldestUpdated = prs[prs.length - 1]?.updated_at;
      const shouldStop = oldestUpdated && oldestUpdated < since;

      for (const pr of prs) {
        if (pr.updated_at < since) continue;

        const jiraKeys = [
          ...extractJiraKeys(pr.title),
          ...extractJiraKeys(pr.body || ''),
          ...extractJiraKeys(pr.head.ref), // branch name
        ];

        const mergeDuration = pr.merged_at && pr.created_at
          ? (new Date(pr.merged_at).getTime() - new Date(pr.created_at).getTime()) / 3600000
          : null;

        await db.query(
          `INSERT INTO github_prs_eos
             (org_id, repo_id, pr_number, title, description, author_github_id, author_login,
              state, created_at, merged_at, closed_at, merge_duration_hours,
              linked_jira_tickets, review_comments_count, commits_count, has_reviewer,
              reviewer_ids, head_branch)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
           ON CONFLICT (org_id, repo_id, pr_number) DO UPDATE SET
             state = $8, merged_at = $10, closed_at = $11, linked_jira_tickets = $13,
             review_comments_count = $14, commits_count = $15, indexed_at = NOW()`,
          [
            orgId, repoId, pr.number, pr.title, pr.body,
            pr.user?.id?.toString() || null,
            pr.user?.login || null,
            pr.state,
            pr.created_at, pr.merged_at, pr.closed_at,
            mergeDuration,
            jiraKeys,
            (pr as any).review_comments ?? 0, (pr as any).commits ?? 0,
            (pr.requested_reviewers?.length || 0) > 0,
            pr.requested_reviewers?.map((r: any) => r.login) || [],
            pr.head.ref,
          ]
        );
        total++;
      }

      if (shouldStop || prs.length < 100) break;
      page++;
      await sleep(100);
    }

    logger.info({ orgId, repoId, fullName, total }, '[GH Historical] PRs indexed');
  },

  /** Index PR reviews for all PRs of a repo */
  async indexPRReviews(orgId: string, repoId: string, fullName: string) {
    const [owner, repo] = fullName.split('/');
    const token = await getOrgToken(orgId);
    const octokit = new Octokit({ auth: token });

    // Get all PRs for this repo
    const prs = await db.query(
      `SELECT id, pr_number FROM github_prs_eos WHERE org_id = $1 AND repo_id = $2`,
      [orgId, repoId]
    );

    for (const pr of prs.rows) {
      await checkRateLimit(octokit);
      const { data: reviews } = await octokit.pulls.listReviews({
        owner, repo, pull_number: pr.pr_number,
      });

      for (const r of reviews) {
        await db.query(
          `INSERT INTO github_pr_reviews_eos (pr_id, org_id, reviewer_github_id, reviewer_login, state, submitted_at)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT DO NOTHING`,
          [pr.id, orgId, r.user?.id?.toString(), r.user?.login, r.state?.toLowerCase(), r.submitted_at]
        );
      }

      // Update PR has_reviewer flag
      if (reviews.length > 0) {
        const reviewerIds = [...new Set(reviews.map((r: any) => r.user?.login).filter(Boolean))];
        await db.query(
          `UPDATE github_prs_eos SET has_reviewer = true, reviewer_ids = $1 WHERE id = $2`,
          [reviewerIds, pr.id]
        );
      }

      await sleep(50);
    }

    logger.info({ orgId, repoId, prCount: prs.rows.length }, '[GH Historical] PR reviews indexed');
  },

  /** Aggregate commit diffs into github_files_touched per author */
  async buildFilesTouched(orgId: string, repoId: string) {
    // Derive from commits — files_changed JSONB array
    const commits = await db.query(
      `SELECT sha, author_github_id, author_login, files_changed, timestamp
       FROM github_commits_eos
       WHERE org_id = $1 AND repo_id = $2 AND author_github_id IS NOT NULL`,
      [orgId, repoId]
    );

    const touchMap = new Map<string, { touchCount: number; lastTouched: string }>();

    for (const c of commits.rows) {
      const files: Array<{ filename?: string }> = c.files_changed || [];
      for (const f of files) {
        if (!f.filename) continue;
        const key = `${c.author_github_id}::${f.filename}`;
        const existing = touchMap.get(key);
        if (!existing || c.timestamp > existing.lastTouched) {
          touchMap.set(key, {
            touchCount: (existing?.touchCount || 0) + 1,
            lastTouched: c.timestamp,
          });
        }
      }
    }

    for (const [key, val] of touchMap.entries()) {
      const [authorId, ...fileParts] = key.split('::');
      const filePath = fileParts.join('::');

      const login = commits.rows.find((c: any) => c.author_github_id === authorId)?.author_login;

      await db.query(
        `INSERT INTO github_files_touched (org_id, repo_id, file_path, author_github_id, author_login, touch_count, last_touched_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (org_id, repo_id, file_path, author_github_id) DO UPDATE SET
           touch_count = EXCLUDED.touch_count, last_touched_at = EXCLUDED.last_touched_at, updated_at = NOW()`,
        [orgId, repoId, filePath, authorId, login, val.touchCount, val.lastTouched]
      );
    }

    logger.info({ orgId, repoId, files: touchMap.size }, '[GH Historical] Files touched built');
  },

  /** Bidirectional linking: match PR Jira keys → jira_tickets, update linked_github_prs */
  async linkJiraTickets(orgId: string) {
    // Get all PRs with Jira keys
    const prs = await db.query(
      `SELECT id, pr_number, linked_jira_tickets, repo_id
       FROM github_prs_eos
       WHERE org_id = $1 AND array_length(linked_jira_tickets, 1) > 0`,
      [orgId]
    );

    for (const pr of prs.rows) {
      for (const key of pr.linked_jira_tickets) {
        // Find matching ticket by project_key + ticket number
        const ticket = await db.query(
          `SELECT id, jira_ticket_id, linked_github_prs FROM jira_tickets
           WHERE org_id = $1 AND (jira_ticket_id LIKE $2 OR jira_ticket_id = $2)`,
          [orgId, key]
        );

        if (ticket.rows[0]) {
          const existing: any[] = ticket.rows[0].linked_github_prs || [];
          const prRef = { prId: pr.id, prNumber: pr.pr_number };
          const alreadyLinked = existing.some((e: any) => e.prId === pr.id);
          if (!alreadyLinked) {
            await db.query(
              `UPDATE jira_tickets SET linked_github_prs = $1 WHERE id = $2`,
              [JSON.stringify([...existing, prRef]), ticket.rows[0].id]
            );
          }
        }
      }
    }

    logger.info({ orgId, prs: prs.rows.length }, '[GH Historical] Jira links built');
  },
};
