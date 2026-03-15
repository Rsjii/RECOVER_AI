// EngineeringOS Phase 1.5 — Sprint Health Score Service
// Computes 0–100 weighted score per active sprint from 5 components
import { db } from '../config/db';
import { logger } from '../config/logger';

export type SprintBucket = 'HEALTHY' | 'AT_RISK' | 'CRITICAL';

export interface SprintHealthComponents {
  ticket_completion: number;   // 0-100
  pr_coverage: number;         // 0-100
  velocity_trend: number;      // 0-100
  days_work_ratio: number;     // 0-100
  review_bottleneck: number;   // 0-100
}

export interface SprintHealth {
  sprint_id: string;
  sprint_name: string;
  jira_sprint_id: string;
  project_key: string;
  score: number;
  bucket: SprintBucket;
  days_remaining: number;
  completion_pct: number;
  total_tickets: number;
  completed_tickets: number;
  pr_coverage_pct: number;
  velocity_points: number;
  start_date: string | null;
  end_date: string | null;
  components: SprintHealthComponents;
}

interface SprintData {
  id: string;
  jira_sprint_id: string;
  name: string;
  project_key: string;
  start_date: string | null;
  end_date: string | null;
  total_tickets: number;
  completed_tickets: number;
  velocity_points: number;
}

// Normalised done-status matching — covers Jira's many capitalisation variants
const DONE_STATUS_SQL = `lower(status) IN ('done','closed','resolved','complete','completed')`;

function scoreBucket(score: number): SprintBucket {
  if (score >= 80) return 'HEALTHY';
  if (score >= 50) return 'AT_RISK';
  return 'CRITICAL';
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

export const sprintHealthService = {
  /**
   * Calculate a 0-100 health score for a single sprint.
   * orgWideBottleneck is pre-computed once by getAllActiveSprintScores
   * to avoid re-running the same query N times.
   */
  async calculateSprintScore(
    orgId: string,
    sprint: SprintData,
    orgWideBottleneck: number,
  ): Promise<SprintHealth> {
    const now = new Date();

    const endDate   = sprint.end_date   ? new Date(sprint.end_date)   : null;
    const startDate = sprint.start_date ? new Date(sprint.start_date) : null;
    const daysRemaining = endDate
      ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / 86400000))
      : 999;
    const sprintLenDays = (startDate && endDate)
      ? Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000))
      : 14;
    const daysElapsed = sprintLenDays - daysRemaining;

    const total     = sprint.total_tickets    || 1; // avoid /0
    const completed = sprint.completed_tickets || 0;
    const incomplete = total - completed;

    // ── Component 1: Ticket completion rate (30%) ─────────────────────────────
    const ticketCompletion = clamp((completed / total) * 100);

    // ── Components 2 + 3: run in parallel ────────────────────────────────────
    const [prResult, ptsResult] = await Promise.all([
      // Component 2: PR activity coverage (25%) — incomplete tickets with open PR
      incomplete > 0
        ? db.query(
            `SELECT COUNT(DISTINCT jt.id) AS cnt
             FROM jira_tickets jt
             WHERE jt.org_id = $1
               AND jt.sprint_id = $2
               AND NOT (${DONE_STATUS_SQL})
               AND EXISTS (
                 SELECT 1 FROM github_prs_eos p
                 WHERE p.org_id = $1
                   AND p.state = 'open'
                   AND p.linked_jira_tickets && ARRAY[jt.jira_ticket_id]
               )`,
            [orgId, sprint.jira_sprint_id]
          )
        : Promise.resolve(null),

      // Component 3: Velocity trend (20%) — pts done vs expected by now
      sprint.velocity_points > 0
        ? db.query(
            `SELECT COALESCE(SUM(story_points), 0)::float AS pts_done
             FROM jira_tickets
             WHERE org_id = $1
               AND sprint_id = $2
               AND ${DONE_STATUS_SQL}`,
            [orgId, sprint.jira_sprint_id]
          )
        : Promise.resolve(null),
    ]);

    let prCoverage = 100;
    if (prResult && incomplete > 0) {
      const withPR = parseInt(prResult.rows[0]?.cnt || '0');
      prCoverage = clamp((withPR / incomplete) * 100);
    }

    let velocityTrend = 100;
    if (ptsResult && sprint.velocity_points > 0) {
      const ptsDone     = parseFloat(ptsResult.rows[0]?.pts_done || '0');
      const expectedNow = sprint.velocity_points * (daysElapsed / sprintLenDays);
      velocityTrend     = expectedNow > 0 ? clamp((ptsDone / expectedNow) * 100) : 100;
    }

    // ── Component 4: Days vs work ratio (15%) ─────────────────────────────────
    const workRemainingRatio = incomplete / total;
    const daysRemainingRatio = daysRemaining / sprintLenDays;
    let daysWorkRatio: number;
    if (workRemainingRatio === 0) {
      daysWorkRatio = 100;
    } else if (daysRemainingRatio === 0) {
      daysWorkRatio = 0;
    } else {
      daysWorkRatio = clamp((daysRemainingRatio / workRemainingRatio) * 100);
    }

    // ── Component 5: Review bottleneck (10%) — pre-computed org-wide ──────────
    const reviewBottleneck = orgWideBottleneck;

    // ── Weighted score ────────────────────────────────────────────────────────
    const score = clamp(Math.round(
      ticketCompletion * 0.30 +
      prCoverage       * 0.25 +
      velocityTrend    * 0.20 +
      daysWorkRatio    * 0.15 +
      reviewBottleneck * 0.10
    ));

    return {
      sprint_id:         sprint.id,
      sprint_name:       sprint.name,
      jira_sprint_id:    sprint.jira_sprint_id,
      project_key:       sprint.project_key,
      score,
      bucket:            scoreBucket(score),
      days_remaining:    daysRemaining,
      completion_pct:    Math.round(ticketCompletion),
      total_tickets:     total,
      completed_tickets: completed,
      pr_coverage_pct:   Math.round(prCoverage),
      velocity_points:   sprint.velocity_points,
      start_date:        sprint.start_date,
      end_date:          sprint.end_date,
      components: {
        ticket_completion: Math.round(ticketCompletion),
        pr_coverage:       Math.round(prCoverage),
        velocity_trend:    Math.round(velocityTrend),
        days_work_ratio:   Math.round(daysWorkRatio),
        review_bottleneck: reviewBottleneck,
      },
    };
  },

  async getAllActiveSprintScores(orgId: string): Promise<SprintHealth[]> {
    try {
      // Fetch active sprints + bottleneck count in parallel (one bottleneck query for all sprints)
      const [sprintsRes, bottleneckRes] = await Promise.all([
        db.query(
          `SELECT id, jira_sprint_id, name, project_key, start_date, end_date,
                  total_tickets, completed_tickets, velocity_points
           FROM jira_sprints
           WHERE org_id = $1 AND state = 'active'
           ORDER BY end_date ASC NULLS LAST`,
          [orgId]
        ),
        db.query(
          `SELECT COUNT(*) AS cnt
           FROM github_prs_eos p
           WHERE p.org_id = $1
             AND p.state = 'open'
             AND p.created_at < NOW() - INTERVAL '2 days'
             AND NOT EXISTS (
               SELECT 1 FROM github_pr_reviews_eos r
               WHERE r.pr_id = p.id
                 AND r.submitted_at > NOW() - INTERVAL '2 days'
             )`,
          [orgId]
        ),
      ]);

      if (sprintsRes.rows.length === 0) return [];

      const stalePRs      = parseInt(bottleneckRes.rows[0]?.cnt || '0');
      const orgBottleneck = stalePRs === 0 ? 100 : stalePRs === 1 ? 70 : stalePRs === 2 ? 40 : 0;

      return Promise.all(
        sprintsRes.rows.map(row => this.calculateSprintScore(orgId, row, orgBottleneck))
      );
    } catch (err) {
      logger.error({ err, orgId }, '[SprintHealth] getAllActiveSprintScores error');
      return [];
    }
  },
};
