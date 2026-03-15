import { Request, Response } from 'express';
import { db } from '../../config/db';
import { logger } from '../../config/logger';
import { weeklyReportService } from '../../services/weeklyReportService';

export async function getWeeklyReports(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const limit = Math.min(parseInt(req.query['limit'] as string || '8'), 52);

    const { rows } = await db.query(
      `SELECT id, week_start, week_end, content_raw, metrics, pattern_summary,
              sent_at, sent_via, created_at
       FROM weekly_reports
       WHERE org_id = $1
       ORDER BY week_start DESC
       LIMIT $2`,
      [orgId, limit]
    );

    res.json(rows);
  } catch (err) {
    logger.error({ err }, '[Reports] getWeeklyReports error');
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
}

export async function getWeeklyReportById(req: Request, res: Response) {
  try {
    const orgId    = (req as any).user?.org_id;
    const reportId = req.params['id'];

    const { rows } = await db.query(
      `SELECT id, week_start, week_end, content_raw, content_slack, content_email,
              metrics, pattern_summary, sent_at, sent_via, created_at
       FROM weekly_reports
       WHERE org_id = $1 AND id = $2`,
      [orgId, reportId]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Report not found' });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, '[Reports] getWeeklyReportById error');
    res.status(500).json({ error: 'Failed to fetch report' });
  }
}

export async function previewWeeklyReport(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;

    const { metrics, patternSummary } = await weeklyReportService.aggregateWeekData(orgId);
    const contentRaw = await weeklyReportService.generateReport(orgId, metrics, patternSummary);

    res.json({ content_raw: contentRaw, metrics, pattern_summary: patternSummary });
  } catch (err) {
    logger.error({ err }, '[Reports] previewWeeklyReport error');
    res.status(500).json({ error: 'Failed to generate preview' });
  }
}
