import { db } from '../config/db';
import { logger } from '../config/logger';
import { jiraService } from './jiraService';

/** Levenshtein distance for fuzzy name matching */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Similarity score 0–1 (1 = identical) */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a.toLowerCase(), b.toLowerCase()) / maxLen;
}

export const teamMappingService = {
  /** Auto-map GitHub org members to Jira users by email (exact) then name (fuzzy) */
  async autoMapMembers(orgId: string) {
    // Get all GitHub org members
    const githubUsers = await db.query(
      `SELECT u.github_username as login, u.github_id as id, u.email
       FROM users u
       JOIN team_members tm ON tm.user_id = u.id
       WHERE tm.org_id = $1`,
      [orgId]
    );

    // Get all Jira users
    let jiraUsers: Array<{ accountId: string; displayName: string; emailAddress?: string }> = [];
    try {
      jiraUsers = await jiraService.getUsers(orgId);
    } catch (err) {
      logger.warn({ err, orgId }, '[TeamMapping] Could not fetch Jira users — skipping auto-map');
      return;
    }

    let mapped = 0;

    for (const gh of githubUsers.rows) {
      // 1. Email exact match
      const byEmail = jiraUsers.find(j =>
        j.emailAddress && gh.email &&
        j.emailAddress.toLowerCase() === gh.email.toLowerCase()
      );

      if (byEmail) {
        await teamMappingService.upsertMapping(orgId, {
          githubLogin: gh.login, githubId: gh.id, githubEmail: gh.email,
          jiraAccountId: byEmail.accountId, jiraDisplayName: byEmail.displayName,
          jiraEmail: byEmail.emailAddress,
          isConfirmed: true, // email match = high confidence
        });
        mapped++;
        continue;
      }

      // 2. Fuzzy name match (threshold 0.8)
      let bestMatch: typeof jiraUsers[0] | null = null;
      let bestScore = 0;

      for (const j of jiraUsers) {
        const score = similarity(gh.login, j.displayName);
        if (score > bestScore && score >= 0.8) {
          bestScore = score;
          bestMatch = j;
        }
      }

      if (bestMatch) {
        await teamMappingService.upsertMapping(orgId, {
          githubLogin: gh.login, githubId: gh.id, githubEmail: gh.email,
          jiraAccountId: bestMatch.accountId, jiraDisplayName: bestMatch.displayName,
          jiraEmail: bestMatch.emailAddress,
          isConfirmed: false, // fuzzy match needs CTO confirmation
        });
        mapped++;
      }
    }

    // Mark team mapping step done if at least 50% matched
    if (githubUsers.rows.length > 0 && mapped / githubUsers.rows.length >= 0.5) {
      await db.query(
        `INSERT INTO onboarding_state (org_id, step_team_mapped) VALUES ($1, true)
         ON CONFLICT (org_id) DO UPDATE SET step_team_mapped = true, updated_at = NOW()`,
        [orgId]
      );
    }

    logger.info({ orgId, total: githubUsers.rows.length, mapped }, '[TeamMapping] Auto-map complete');
  },

  async upsertMapping(orgId: string, data: {
    githubLogin: string; githubId: string; githubEmail?: string;
    jiraAccountId: string; jiraDisplayName: string; jiraEmail?: string;
    isConfirmed: boolean;
  }) {
    await db.query(
      `INSERT INTO team_member_mappings
         (org_id, github_login, github_id, github_email, jira_account_id, jira_display_name, jira_email, is_confirmed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (org_id, github_login) DO UPDATE SET
         jira_account_id = $5, jira_display_name = $6, jira_email = $7,
         is_confirmed = GREATEST(team_member_mappings.is_confirmed, $8),
         mapped_at = NOW()`,
      [orgId, data.githubLogin, data.githubId, data.githubEmail,
       data.jiraAccountId, data.jiraDisplayName, data.jiraEmail, data.isConfirmed]
    );
  },

  async setManualMapping(orgId: string, githubLogin: string, jiraAccountId: string) {
    // Fetch Jira user details
    let jiraDisplayName = '';
    let jiraEmail = '';
    try {
      const users = await jiraService.getUsers(orgId);
      const jiraUser = users.find((u: any) => u.accountId === jiraAccountId);
      jiraDisplayName = jiraUser?.displayName || '';
      jiraEmail = jiraUser?.emailAddress || '';
    } catch { /* continue without details */ }

    const gh = await db.query(
      `SELECT u.github_id as id, u.email FROM users u
       JOIN team_members tm ON tm.user_id = u.id
       WHERE tm.org_id = $1 AND u.github_username = $2`,
      [orgId, githubLogin]
    );

    await db.query(
      `INSERT INTO team_member_mappings
         (org_id, github_login, github_id, github_email, jira_account_id, jira_display_name, jira_email, is_confirmed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true)
       ON CONFLICT (org_id, github_login) DO UPDATE SET
         jira_account_id = $5, jira_display_name = $6, jira_email = $7,
         is_confirmed = true, mapped_at = NOW()`,
      [orgId, githubLogin, gh.rows[0]?.id, gh.rows[0]?.email,
       jiraAccountId, jiraDisplayName, jiraEmail]
    );
  },
};
