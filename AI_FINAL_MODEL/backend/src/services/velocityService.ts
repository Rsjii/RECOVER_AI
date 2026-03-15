// EngineeringOS Phase 1.5 — Velocity Analytics Service
import { db } from '../config/db';
import { logger } from '../config/logger';

export interface EngineerVelocity {
  github_login: string;
  github_id: string;
  commits_this_week: number;
  commits_prev_week: number;
  change_pct: number | null;
  prs_this_week: number;
  avg_review_turnaround_hours: number | null;
}

export interface TeamVelocity {
  prs_merged_this_week: number;
  prs_merged_prev_week: number;
  prs_merged_change_pct: number | null;
  avg_merge_hours: number | null;
  avg_merge_hours_prev: number | null;
  avg_merge_change_pct: number | null;
  velocity_points_current: number;
  velocity_points_avg_last_3: number;
  velocity_change_pct: number | null;
}

export interface VelocityData {
  team: TeamVelocity;
  engineers: EngineerVelocity[];
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

export const velocityService = {
  async getVelocityData(orgId: string): Promise<VelocityData> {
    try {
      const now = new Date();
      const w1Start = new Date(now.getTime() - 7  * 86400000);
      const w2Start = new Date(now.getTime() - 14 * 86400000);

      // ── Team: PRs merged this week vs prev week ──────────────────────────────
      const prsMergedRes = await db.query(
        `SELECT
           COUNT(*) FILTER (WHERE merged_at >= $2) AS this_week,
           COUNT(*) FILTER (WHERE merged_at >= $3 AND merged_at < $2) AS prev_week,
           AVG(merge_duration_hours) FILTER (WHERE merged_at >= $2) AS avg_hours_this,
           AVG(merge_duration_hours) FILTER (WHERE merged_at >= $3 AND merged_at < $2) AS avg_hours_prev
         FROM github_prs_eos
         WHERE org_id = $1 AND merged_at IS NOT NULL AND merged_at >= $3`,
        [orgId, w1Start.toISOString(), w2Start.toISOString()]
      );
      const pm = prsMergedRes.rows[0];
      const prsThisWeek  = parseInt(pm?.this_week  || '0');
      const prsPrevWeek  = parseInt(pm?.prev_week  || '0');
      const avgHoursThis = pm?.avg_hours_this ? parseFloat(pm.avg_hours_this) : null;
      const avgHoursPrev = pm?.avg_hours_prev ? parseFloat(pm.avg_hours_prev) : null;

      // ── Team: velocity points (current active sprint + avg last 3 closed) ────
      const sprintPtsRes = await db.query(
        `SELECT
           COALESCE(MAX(velocity_points) FILTER (WHERE state = 'active'), 0) AS current_pts,
           COALESCE(AVG(velocity_points) FILTER (WHERE state = 'closed'), 0) AS avg_last_3
         FROM (
           SELECT velocity_points, state
           FROM jira_sprints
           WHERE org_id = $1 AND state IN ('active', 'closed')
           ORDER BY
             CASE WHEN state = 'active' THEN 0 ELSE 1 END,
             end_date DESC NULLS LAST
           LIMIT 4
         ) sub`,
        [orgId]
      );
      const sp = sprintPtsRes.rows[0];
      const velocityCurrent  = Math.round(parseFloat(sp?.current_pts || '0'));
      const velocityAvgLast3 = Math.round(parseFloat(sp?.avg_last_3  || '0'));

      // ── Per-engineer: commits this/prev week ─────────────────────────────────
      const commitRes = await db.query(
        `SELECT
           c.author_login AS github_login,
           c.author_github_id AS github_id,
           COUNT(*) FILTER (WHERE c.timestamp >= $2) AS this_week,
           COUNT(*) FILTER (WHERE c.timestamp >= $3 AND c.timestamp < $2) AS prev_week
         FROM github_commits_eos c
         WHERE c.org_id = $1 AND c.timestamp >= $3
         GROUP BY c.author_login, c.author_github_id
         ORDER BY this_week DESC`,
        [orgId, w1Start.toISOString(), w2Start.toISOString()]
      );

      // ── Per-engineer: PRs this week ───────────────────────────────────────────
      const prByAuthorRes = await db.query(
        `SELECT author_login, COUNT(*) AS cnt
         FROM github_prs_eos
         WHERE org_id = $1 AND merged_at >= $2
         GROUP BY author_login`,
        [orgId, w1Start.toISOString()]
      );
      const prsByAuthor: Record<string, number> = {};
      for (const row of prByAuthorRes.rows) {
        prsByAuthor[row.author_login] = parseInt(row.cnt);
      }

      // ── Per-engineer: avg review turnaround ───────────────────────────────────
      const reviewRes = await db.query(
        `SELECT
           r.reviewer_login,
           AVG(EXTRACT(EPOCH FROM (r.submitted_at - p.created_at)) / 3600)::float AS avg_hours
         FROM github_pr_reviews_eos r
         JOIN github_prs_eos p ON p.id = r.pr_id
         WHERE r.org_id = $1
           AND r.submitted_at >= $2
           AND r.reviewer_login IS NOT NULL
         GROUP BY r.reviewer_login`,
        [orgId, w2Start.toISOString()]
      );
      const reviewMap: Record<string, number> = {};
      for (const row of reviewRes.rows) {
        reviewMap[row.reviewer_login] = Math.round(parseFloat(row.avg_hours));
      }

      const engineers: EngineerVelocity[] = commitRes.rows.map(row => {
        const thisW = parseInt(row.this_week);
        const prevW = parseInt(row.prev_week);
        return {
          github_login: row.github_login || '',
          github_id:    row.github_id    || '',
          commits_this_week: thisW,
          commits_prev_week: prevW,
          change_pct: pctChange(thisW, prevW),
          prs_this_week: prsByAuthor[row.github_login] || 0,
          avg_review_turnaround_hours: reviewMap[row.github_login] ?? null,
        };
      });

      return {
        team: {
          prs_merged_this_week:    prsThisWeek,
          prs_merged_prev_week:    prsPrevWeek,
          prs_merged_change_pct:   pctChange(prsThisWeek, prsPrevWeek),
          avg_merge_hours:         avgHoursThis ? Math.round(avgHoursThis) : null,
          avg_merge_hours_prev:    avgHoursPrev ? Math.round(avgHoursPrev) : null,
          avg_merge_change_pct:    (avgHoursThis && avgHoursPrev) ? pctChange(avgHoursThis, avgHoursPrev) : null,
          velocity_points_current: velocityCurrent,
          velocity_points_avg_last_3: velocityAvgLast3,
          velocity_change_pct:     pctChange(velocityCurrent, velocityAvgLast3),
        },
        engineers,
      };
    } catch (err) {
      logger.error({ err, orgId }, '[Velocity] getVelocityData error');
      return {
        team: {
          prs_merged_this_week: 0, prs_merged_prev_week: 0, prs_merged_change_pct: null,
          avg_merge_hours: null, avg_merge_hours_prev: null, avg_merge_change_pct: null,
          velocity_points_current: 0, velocity_points_avg_last_3: 0, velocity_change_pct: null,
        },
        engineers: [],
      };
    }
  },
};
