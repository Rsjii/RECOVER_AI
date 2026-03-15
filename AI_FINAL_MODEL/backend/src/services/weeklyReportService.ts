// EngineeringOS Phase 1.5 — Weekly Engineering Health Report Service
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../config/db';
import { logger } from '../config/logger';
import { config } from '../config/env';
import { deliveryService } from './deliveryService';
import { sprintHealthService } from './sprintHealthService';
import { velocityService } from './velocityService';

const client = new Anthropic({ apiKey: config.anthropicApiKey });

export interface WeeklyMetrics {
  prs_merged: number;
  prs_merged_change_pct: number | null;
  avg_merge_hours: number | null;
  commits_total: number;
  active_engineers: number;
  patterns_detected: number;
  high_severity_count: number;
  sprint_avg_score: number | null;
  sprints_at_risk: number;
  sprints_critical: number;
  velocity_change_pct: number | null;
}

export interface WeeklySummaryItem {
  type: string;
  count: number;
  severity: string;
}

export interface SavedWeeklyReport {
  id: string;
  weekStart: string;
  weekEnd: string;
  contentRaw: string;
}

export const weeklyReportService = {
  async aggregateWeekData(orgId: string): Promise<{ metrics: WeeklyMetrics; patternSummary: WeeklySummaryItem[] }> {
    const now   = new Date();
    const w1Start = new Date(now.getTime() - 7  * 86400000);
    const w2Start = new Date(now.getTime() - 14 * 86400000);

    const [prRes, commitRes, patternRes, sprintScores, velocityData] = await Promise.all([
      // PRs merged this week vs prev
      db.query(
        `SELECT
           COUNT(*) FILTER (WHERE merged_at >= $2) AS this_week,
           COUNT(*) FILTER (WHERE merged_at >= $3 AND merged_at < $2) AS prev_week,
           AVG(merge_duration_hours) FILTER (WHERE merged_at >= $2) AS avg_hours
         FROM github_prs_eos
         WHERE org_id = $1 AND merged_at IS NOT NULL AND merged_at >= $3`,
        [orgId, w1Start.toISOString(), w2Start.toISOString()]
      ),
      // Commits + active engineers this week
      db.query(
        `SELECT COUNT(*) AS total, COUNT(DISTINCT author_github_id) AS engineers
         FROM github_commits_eos
         WHERE org_id = $1 AND timestamp >= $2`,
        [orgId, w1Start.toISOString()]
      ),
      // Patterns from briefs this week
      db.query(
        `SELECT bi.pattern_type, bi.severity, COUNT(*) AS cnt
         FROM brief_items bi
         JOIN daily_briefs db2 ON db2.id = bi.brief_id
         WHERE bi.org_id = $1 AND db2.brief_date >= $2::date
         GROUP BY bi.pattern_type, bi.severity`,
        [orgId, w1Start.toISOString()]
      ),
      sprintHealthService.getAllActiveSprintScores(orgId),
      velocityService.getVelocityData(orgId),
    ]);

    const pr  = prRes.rows[0];
    const com = commitRes.rows[0];

    const thisWeekPRs  = parseInt(pr?.this_week  || '0');
    const prevWeekPRs  = parseInt(pr?.prev_week  || '0');
    const prChangePct  = prevWeekPRs > 0
      ? Math.round(((thisWeekPRs - prevWeekPRs) / prevWeekPRs) * 100)
      : thisWeekPRs > 0 ? 100 : 0;

    const patternSummary: WeeklySummaryItem[] = patternRes.rows.map(r => ({
      type: r.pattern_type,
      count: parseInt(r.cnt),
      severity: r.severity,
    }));

    const totalPatterns = patternSummary.reduce((s, p) => s + p.count, 0);
    const highSeverity  = patternSummary.filter(p => p.severity === 'HIGH').reduce((s, p) => s + p.count, 0);

    const sprintScoreAvg = sprintScores.length > 0
      ? Math.round(sprintScores.reduce((s, sp) => s + sp.score, 0) / sprintScores.length)
      : null;
    const sprintsAtRisk  = sprintScores.filter(s => s.bucket === 'AT_RISK').length;
    const sprintsCrit    = sprintScores.filter(s => s.bucket === 'CRITICAL').length;

    return {
      metrics: {
        prs_merged:            thisWeekPRs,
        prs_merged_change_pct: prChangePct,
        avg_merge_hours:       pr?.avg_hours ? Math.round(parseFloat(pr.avg_hours)) : null,
        commits_total:         parseInt(com?.total    || '0'),
        active_engineers:      parseInt(com?.engineers || '0'),
        patterns_detected:     totalPatterns,
        high_severity_count:   highSeverity,
        sprint_avg_score:      sprintScoreAvg,
        sprints_at_risk:       sprintsAtRisk,
        sprints_critical:      sprintsCrit,
        velocity_change_pct:   velocityData.team.velocity_change_pct,
      },
      patternSummary,
    };
  },

  async generateReport(orgId: string, metrics: WeeklyMetrics, patternSummary: WeeklySummaryItem[]): Promise<string> {
    const patternText = patternSummary.length > 0
      ? patternSummary.map(p => `- ${p.type.replace(/_/g, ' ')} (${p.severity}): ${p.count} occurrence${p.count !== 1 ? 's' : ''}`).join('\n')
      : '- No patterns detected this week';

    const sprintLine = metrics.sprint_avg_score !== null
      ? `Sprint health average: ${metrics.sprint_avg_score}/100 (${metrics.sprints_at_risk} at-risk, ${metrics.sprints_critical} critical)`
      : 'No active sprints';

    const velocityLine = metrics.velocity_change_pct !== null
      ? `Velocity trend: ${metrics.velocity_change_pct > 0 ? '+' : ''}${metrics.velocity_change_pct}% vs 3-sprint avg`
      : '';

    const prompt = `You are an AI Chief of Staff for a CTO. Write a concise weekly engineering health report (max 200 words). Be direct, factual, and highlight key risks and wins. Write in plain paragraphs, no bullet points.

Weekly metrics:
- PRs merged: ${metrics.prs_merged} (${metrics.prs_merged_change_pct !== null && metrics.prs_merged_change_pct > 0 ? '+' : ''}${metrics.prs_merged_change_pct ?? 0}% vs prev week)
- Avg merge time: ${metrics.avg_merge_hours ?? 'N/A'} hours
- Commits: ${metrics.commits_total} by ${metrics.active_engineers} engineers
- Alerts: ${metrics.high_severity_count} high-severity, ${metrics.patterns_detected} total patterns
- ${sprintLine}
${velocityLine ? `- ${velocityLine}` : ''}

Pattern breakdown:
${patternText}

Write the weekly health report now:`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    return (message.content[0] as any).text ?? '';
  },

  buildSlackPayload(contentRaw: string, metrics: WeeklyMetrics, weekStart: string, weekEnd: string): object {
    const healthEmoji = (metrics.sprints_critical > 0 || metrics.high_severity_count > 0)
      ? '🔴' : metrics.sprints_at_risk > 0 ? '🟡' : '✅';

    const weekLabel = `${new Date(weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(weekEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    const changeLine = metrics.prs_merged_change_pct !== null
      ? ` (${metrics.prs_merged_change_pct > 0 ? '+' : ''}${metrics.prs_merged_change_pct}%)`
      : '';

    return {
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `${healthEmoji} Weekly Engineering Report — ${weekLabel}` },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*PRs Merged*\n${metrics.prs_merged}${changeLine}` },
            { type: 'mrkdwn', text: `*Avg Merge Time*\n${metrics.avg_merge_hours != null ? `${metrics.avg_merge_hours}h` : 'N/A'}` },
            { type: 'mrkdwn', text: `*Active Engineers*\n${metrics.active_engineers}` },
            { type: 'mrkdwn', text: `*High-Severity Alerts*\n${metrics.high_severity_count}` },
          ],
        },
        { type: 'divider' },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: contentRaw },
        },
        ...(metrics.sprint_avg_score !== null ? [{
          type: 'context',
          elements: [{ type: 'mrkdwn', text: `Sprint health: ${metrics.sprint_avg_score}/100 · ${metrics.sprints_at_risk} at-risk · ${metrics.sprints_critical} critical` }],
        }] : []),
      ],
    };
  },

  buildEmailHtml(contentRaw: string, metrics: WeeklyMetrics, weekStart: string, weekEnd: string): string {
    const weekLabel = `${new Date(weekStart).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – ${new Date(weekEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    const changePct = metrics.prs_merged_change_pct;

    return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;background:#060910;color:#e2e8f0;padding:32px;max-width:600px;margin:0 auto">
<h2 style="color:#818cf8;margin-top:0">Weekly Engineering Report</h2>
<p style="color:#64748b;margin-top:-8px">${weekLabel}</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0">
  <tr>
    <td style="padding:12px;background:#0f172a;border:1px solid #1e293b;border-radius:8px;text-align:center">
      <div style="color:#94a3b8;font-size:11px;margin-bottom:4px">PRs MERGED</div>
      <div style="color:#fff;font-size:24px;font-weight:700">${metrics.prs_merged}</div>
      ${changePct !== null ? `<div style="color:${changePct >= 0 ? '#34d399' : '#f87171'};font-size:12px">${changePct > 0 ? '+' : ''}${changePct}%</div>` : ''}
    </td>
    <td style="padding:12px;background:#0f172a;border:1px solid #1e293b;border-radius:8px;text-align:center">
      <div style="color:#94a3b8;font-size:11px;margin-bottom:4px">AVG MERGE TIME</div>
      <div style="color:#fff;font-size:24px;font-weight:700">${metrics.avg_merge_hours != null ? `${metrics.avg_merge_hours}h` : '—'}</div>
    </td>
    <td style="padding:12px;background:#0f172a;border:1px solid #1e293b;border-radius:8px;text-align:center">
      <div style="color:#94a3b8;font-size:11px;margin-bottom:4px">ENGINEERS</div>
      <div style="color:#fff;font-size:24px;font-weight:700">${metrics.active_engineers}</div>
    </td>
    <td style="padding:12px;background:${metrics.high_severity_count > 0 ? '#3b0000' : '#0f172a'};border:1px solid ${metrics.high_severity_count > 0 ? '#7f1d1d' : '#1e293b'};border-radius:8px;text-align:center">
      <div style="color:#94a3b8;font-size:11px;margin-bottom:4px">HIGH ALERTS</div>
      <div style="color:${metrics.high_severity_count > 0 ? '#f87171' : '#fff'};font-size:24px;font-weight:700">${metrics.high_severity_count}</div>
    </td>
  </tr>
</table>
<div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px;margin:16px 0">
  <p style="margin:0;line-height:1.7;color:#cbd5e1">${contentRaw.replace(/\n/g, '<br>')}</p>
</div>
${metrics.sprint_avg_score !== null ? `<p style="color:#64748b;font-size:12px">Sprint health avg: ${metrics.sprint_avg_score}/100 · ${metrics.sprints_at_risk} at-risk · ${metrics.sprints_critical} critical</p>` : ''}
<hr style="border-color:#1e293b;margin:24px 0">
<p style="color:#475569;font-size:11px">EngineeringOS · AI Chief of Staff</p>
</body></html>`;
  },

  async saveReport(orgId: string, weekStart: string, weekEnd: string, contentRaw: string, contentSlack: object, contentEmail: string, metrics: WeeklyMetrics, patternSummary: WeeklySummaryItem[]): Promise<SavedWeeklyReport> {
    const { rows } = await db.query(
      `INSERT INTO weekly_reports
         (org_id, week_start, week_end, content_raw, content_slack, content_email, metrics, pattern_summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (org_id, week_start) DO UPDATE SET
         content_raw   = $4,
         content_slack = $5,
         content_email = $6,
         metrics       = $7,
         pattern_summary = $8,
         created_at    = NOW()
       RETURNING id, week_start, week_end, content_raw`,
      [orgId, weekStart, weekEnd, contentRaw, JSON.stringify(contentSlack), contentEmail, JSON.stringify(metrics), JSON.stringify(patternSummary)]
    );
    return {
      id: rows[0].id,
      weekStart: rows[0].week_start,
      weekEnd:   rows[0].week_end,
      contentRaw: rows[0].content_raw,
    };
  },

  async markSent(reportId: string, via: string) {
    await db.query(
      `UPDATE weekly_reports SET sent_at = NOW(), sent_via = $2 WHERE id = $1`,
      [reportId, via]
    );
  },
};
