import { Request, Response } from 'express';
import { db } from '../../config/db';
import { logger } from '../../config/logger';

export async function getTeamOverview(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;

    // Single batched query: members + their GitHub stats + Jira stats + sprint status
    const { rows } = await db.query(
      `SELECT
         u.github_username                                   AS github_login,
         u.github_id,
         u.avatar_url,
         tm.role,
         tmm.jira_display_name,
         tmm.jira_account_id,
         tmm.jira_email,
         tmm.is_confirmed                                   AS mapping_confirmed,

         -- Active open PRs authored by this member
         COALESCE(pr_stats.open_prs, 0)::int               AS active_prs,

         -- In-progress Jira tickets
         COALESCE(jira_stats.in_progress, 0)::int          AS tickets_in_progress,

         -- Last commit timestamp
         commit_stats.last_commit                           AS last_commit_at,

         -- Sprint end for nearest active sprint containing their tickets
         sprint_stats.end_date                             AS sprint_end_date,
         sprint_stats.days_remaining                        AS sprint_days_remaining

       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       LEFT JOIN team_member_mappings tmm
         ON tmm.org_id = tm.org_id AND tmm.github_login = u.github_username

       -- Open PR count per member
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS open_prs
         FROM github_prs_eos p
         WHERE p.org_id = tm.org_id
           AND p.author_github_id = u.github_id
           AND p.state = 'open'
       ) pr_stats ON true

       -- In-progress Jira ticket count
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS in_progress
         FROM jira_tickets t
         WHERE t.org_id = tm.org_id
           AND t.assignee_jira_id = tmm.jira_account_id
           AND t.status ILIKE '%in progress%'
       ) jira_stats ON true

       -- Last commit
       LEFT JOIN LATERAL (
         SELECT MAX(c.timestamp) AS last_commit
         FROM github_commits_eos c
         WHERE c.org_id = tm.org_id
           AND c.author_github_id = u.github_id
       ) commit_stats ON true

       -- Nearest active sprint containing their tickets
       LEFT JOIN LATERAL (
         SELECT s.end_date,
                EXTRACT(DAY FROM s.end_date - NOW())::int AS days_remaining
         FROM jira_tickets t
         JOIN jira_sprints s
           ON s.org_id = t.org_id AND s.jira_sprint_id = t.sprint_id
         WHERE t.org_id = tm.org_id
           AND t.assignee_jira_id = tmm.jira_account_id
           AND s.state = 'active'
           AND s.end_date > NOW()
         ORDER BY s.end_date ASC
         LIMIT 1
       ) sprint_stats ON true

       WHERE tm.org_id = $1
       ORDER BY u.github_username`,
      [orgId]
    );

    const members = rows.map((m: any) => {
      let sprintStatus: string | null = null;
      if (m.sprint_days_remaining !== null) {
        sprintStatus = m.sprint_days_remaining <= 2 ? 'at_risk' : 'on_track';
      }

      return {
        github_login:        m.github_login,
        github_id:           m.github_id,
        avatar_url:          m.avatar_url,
        role:                m.role,
        jira_display_name:   m.jira_display_name,
        jira_account_id:     m.jira_account_id,
        is_confirmed:        m.mapping_confirmed,
        active_prs:          m.active_prs,
        tickets_in_progress: m.tickets_in_progress,
        last_commit_at:      m.last_commit_at ?? null,
        sprint_status:       sprintStatus,
      };
    });

    res.json(members);
  } catch (err) {
    logger.error({ err }, '[EosTeam] getTeamOverview error');
    res.status(500).json({ error: 'Failed to get team overview' });
  }
}
