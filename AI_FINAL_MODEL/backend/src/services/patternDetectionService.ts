import { db } from '../config/db';
import { logger } from '../config/logger';

export type PatternType = 'stale_pr' | 'silent_engineer' | 'sprint_slip' | 'no_reviewer';
export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface PatternResult {
  patternType: PatternType;
  severity: Severity;
  title: string;
  description: string;
  actionSuggestion: string;
  engineerGithubId?: string;
  prId?: string;
  ticketId?: string;
}

export const patternDetectionService = {
  /** PRs open > N days with no reviewer activity */
  async detectStalePR(orgId: string): Promise<PatternResult[]> {
    const config = await getConfig(orgId);
    const staleDays = config.stale_pr_days ?? 3;

    const { rows } = await db.query(
      `SELECT
         p.id, p.pr_number, p.title, p.author_github_id,
         p.created_at, p.review_comments_count,
         EXTRACT(DAY FROM NOW() - p.created_at)::int AS days_open,
         (SELECT MIN(end_date) FROM jira_sprints js
          WHERE js.org_id = $1 AND js.state = 'active') AS sprint_end
       FROM github_prs_eos p
       WHERE p.org_id = $1
         AND p.state = 'open'
         AND p.created_at < NOW() - ($2 || ' days')::INTERVAL
       ORDER BY p.created_at ASC`,
      [orgId, staleDays]
    );

    return rows.map((row: any) => {
      const daysUntilSprintEnd = row.sprint_end
        ? Math.ceil((new Date(row.sprint_end).getTime() - Date.now()) / 86400000)
        : null;
      const severity: Severity =
        daysUntilSprintEnd !== null && daysUntilSprintEnd <= 2 ? 'HIGH'
        : row.days_open >= staleDays * 2 ? 'HIGH'
        : 'MEDIUM';

      return {
        patternType: 'stale_pr' as PatternType,
        severity,
        title: `Stale PR #${row.pr_number} — ${row.days_open} days open`,
        description: `"${row.title}" has been open for ${row.days_open} days with no review activity.${
          daysUntilSprintEnd !== null ? ` Sprint ends in ${daysUntilSprintEnd} days.` : ''
        }`,
        actionSuggestion: 'Assign a reviewer or discuss priority in standup.',
        engineerGithubId: row.author_github_id,
        prId: row.id,
      };
    });
  },

  /** Engineers with 0 commits in N days who have In Progress Jira tickets */
  async detectSilentEngineer(orgId: string): Promise<PatternResult[]> {
    const config = await getConfig(orgId);
    const silentDays = config.silent_engineer_days ?? 3;

    // Team members with no recent commits
    const { rows: silentMembers } = await db.query(
      `SELECT DISTINCT tmm.github_login, tmm.github_id, tmm.jira_account_id, tmm.jira_display_name
       FROM team_member_mappings tmm
       WHERE tmm.org_id = $1
         AND tmm.jira_account_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM github_commits_eos gc
           WHERE gc.org_id = $1
             AND gc.author_github_id = tmm.github_id
             AND gc.timestamp > NOW() - ($2 || ' days')::INTERVAL
         )`,
      [orgId, silentDays]
    );

    const results: PatternResult[] = [];

    for (const member of silentMembers) {
      // Check if they have In Progress tickets
      const { rows: inProgressTickets } = await db.query(
        `SELECT id, summary FROM jira_tickets
         WHERE org_id = $1
           AND assignee_jira_id = $2
           AND status ILIKE '%in progress%'
         LIMIT 3`,
        [orgId, member.jira_account_id]
      );

      if (inProgressTickets.length > 0) {
        const ticketSummaries = inProgressTickets.map((t: any) => `"${t.summary}"`).join(', ');
        results.push({
          patternType: 'silent_engineer',
          severity: 'MEDIUM',
          title: `${member.jira_display_name || member.github_login} — No commits in ${silentDays}+ days`,
          description: `Has ${inProgressTickets.length} in-progress ticket(s): ${ticketSummaries}, but no commits in ${silentDays} days.`,
          actionSuggestion: 'Check in — are they blocked? Is scope creep affecting delivery?',
          engineerGithubId: member.github_id,
          ticketId: inProgressTickets[0].id,
        });
      }
    }

    return results;
  },

  /** Active sprint ending soon with too many incomplete tickets and no open PRs */
  async detectSprintSlipRisk(orgId: string): Promise<PatternResult[]> {
    const config = await getConfig(orgId);
    const riskThreshold = config.sprint_risk_threshold ?? 40;

    const { rows: sprints } = await db.query(
      `SELECT js.id, js.name, js.end_date, js.total_tickets, js.completed_tickets,
              js.project_key,
              EXTRACT(DAY FROM js.end_date - NOW())::int AS days_remaining
       FROM jira_sprints js
       WHERE js.org_id = $1
         AND js.state = 'active'
         AND js.end_date > NOW()
         AND js.end_date < NOW() + INTERVAL '4 days'
         AND js.total_tickets > 0`,
      [orgId]
    );

    const results: PatternResult[] = [];

    for (const sprint of sprints) {
      const incompletePercent = sprint.total_tickets > 0
        ? Math.round(((sprint.total_tickets - sprint.completed_tickets) / sprint.total_tickets) * 100)
        : 0;

      if (incompletePercent < riskThreshold) continue;

      // Check if there are open PRs (work in flight)
      const { rows: openPRs } = await db.query(
        `SELECT COUNT(*)::int AS cnt FROM github_prs_eos
         WHERE org_id = $1 AND state = 'open'`,
        [orgId]
      );

      const hasPRsInFlight = openPRs[0]?.cnt > 0;

      results.push({
        patternType: 'sprint_slip',
        severity: 'HIGH',
        title: `Sprint "${sprint.name}" — ${incompletePercent}% incomplete, ${sprint.days_remaining} days left`,
        description: `${sprint.total_tickets - sprint.completed_tickets} of ${sprint.total_tickets} tickets not done. ${
          hasPRsInFlight ? 'Some work is in PRs.' : 'No open PRs detected.'
        }`,
        actionSuggestion: 'Review sprint scope — consider descoping low-priority tickets or reallocating engineers.',
      });
    }

    return results;
  },

  /** PRs awaiting review where all team members already have 2+ PRs assigned to review */
  async detectNoReviewerAvailable(orgId: string): Promise<PatternResult[]> {
    const { rows: stalledPRs } = await db.query(
      `SELECT p.id, p.pr_number, p.title, p.author_github_id, p.created_at
       FROM github_prs_eos p
       WHERE p.org_id = $1
         AND p.state = 'open'
         AND p.review_comments_count = 0
         AND NOT EXISTS (
           SELECT 1 FROM github_pr_reviews_eos r WHERE r.pr_id = p.id AND r.state != 'pending'
         )
       ORDER BY p.created_at ASC
       LIMIT 10`,
      [orgId]
    );

    if (stalledPRs.length === 0) return [];

    // Count how many open PRs each reviewer currently has
    const { rows: reviewerLoad } = await db.query(
      `SELECT tmm.github_id, tmm.github_login,
              COUNT(DISTINCT p.id)::int AS assigned_count
       FROM team_member_mappings tmm
       LEFT JOIN github_prs_eos p ON p.org_id = tmm.org_id
         AND p.state = 'open'
         AND p.author_github_id != tmm.github_id
       WHERE tmm.org_id = $1
       GROUP BY tmm.github_id, tmm.github_login`,
      [orgId]
    );

    const allBusy = reviewerLoad.every((r: any) => r.assigned_count >= 2);
    if (!allBusy) return [];

    return stalledPRs.map((pr: any) => ({
      patternType: 'no_reviewer' as PatternType,
      severity: 'MEDIUM',
      title: `PR #${pr.pr_number} needs a reviewer — team is overloaded`,
      description: `"${pr.title}" has no reviewer and all team members have 2+ PRs to review.`,
      actionSuggestion: 'Temporarily expand reviewer pool or prioritize finishing one PR before picking up new work.',
      engineerGithubId: pr.author_github_id,
      prId: pr.id,
    }));
  },

  async runAllPatterns(orgId: string): Promise<PatternResult[]> {
    const [stalePRs, silentEngineers, sprintSlip, noReviewer] = await Promise.all([
      patternDetectionService.detectStalePR(orgId).catch(err => {
        logger.error({ err, orgId }, '[Patterns] detectStalePR failed');
        return [] as PatternResult[];
      }),
      patternDetectionService.detectSilentEngineer(orgId).catch(err => {
        logger.error({ err, orgId }, '[Patterns] detectSilentEngineer failed');
        return [] as PatternResult[];
      }),
      patternDetectionService.detectSprintSlipRisk(orgId).catch(err => {
        logger.error({ err, orgId }, '[Patterns] detectSprintSlipRisk failed');
        return [] as PatternResult[];
      }),
      patternDetectionService.detectNoReviewerAvailable(orgId).catch(err => {
        logger.error({ err, orgId }, '[Patterns] detectNoReviewerAvailable failed');
        return [] as PatternResult[];
      }),
    ]);

    const all = [...stalePRs, ...silentEngineers, ...sprintSlip, ...noReviewer];

    // Sort: HIGH first, then MEDIUM, then LOW
    const severityOrder: Record<Severity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return all.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  },
};

async function getConfig(orgId: string) {
  const { rows } = await db.query(
    `SELECT stale_pr_days, sprint_risk_threshold, silent_engineer_days
     FROM brief_config WHERE org_id = $1`,
    [orgId]
  );
  return rows[0] ?? {};
}
