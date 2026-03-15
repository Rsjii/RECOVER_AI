import { Request, Response } from 'express';
import { db } from '../../config/db';
import { logger } from '../../config/logger';
import { briefGenerationService } from '../../services/briefGenerationService';
import { patternDetectionService } from '../../services/patternDetectionService';

export async function getTodayBrief(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const today = new Date().toISOString().split('T')[0];

    const brief = await db.query(
      `SELECT * FROM daily_briefs WHERE org_id = $1 AND brief_date = $2`,
      [orgId, today]
    );

    if (!brief.rows[0]) return res.status(404).json({ error: 'No brief for today' });

    const items = await db.query(
      `SELECT * FROM brief_items WHERE brief_id = $1 ORDER BY
         CASE severity WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
         created_at ASC`,
      [brief.rows[0].id]
    );

    res.json({ ...brief.rows[0], items: items.rows });
  } catch (err) {
    logger.error({ err }, '[Briefs] getTodayBrief error');
    res.status(500).json({ error: 'Failed to get today brief' });
  }
}

export async function getBriefHistory(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const limit = Math.min(Number(req.query['limit']) || 7, 30);
    const offset = Number(req.query['offset']) || 0;

    const briefs = await db.query(
      `SELECT b.*,
         (SELECT json_agg(i ORDER BY CASE i.severity WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END)
          FROM brief_items i WHERE i.brief_id = b.id) as items
       FROM daily_briefs b
       WHERE b.org_id = $1
       ORDER BY b.brief_date DESC
       LIMIT $2 OFFSET $3`,
      [orgId, limit, offset]
    );

    res.json(briefs.rows);
  } catch (err) {
    logger.error({ err }, '[Briefs] getBriefHistory error');
    res.status(500).json({ error: 'Failed to get brief history' });
  }
}

export async function getBriefById(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const { briefId } = req.params;

    const brief = await db.query(
      `SELECT * FROM daily_briefs WHERE id = $1 AND org_id = $2`,
      [briefId, orgId]
    );
    if (!brief.rows[0]) return res.status(404).json({ error: 'Brief not found' });

    const items = await db.query(
      `SELECT * FROM brief_items WHERE brief_id = $1 ORDER BY
         CASE severity WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END`,
      [briefId]
    );

    res.json({ ...brief.rows[0], items: items.rows });
  } catch (err) {
    logger.error({ err }, '[Briefs] getBriefById error');
    res.status(500).json({ error: 'Failed to get brief' });
  }
}

export async function previewBrief(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const patterns = await patternDetectionService.runAllPatterns(orgId);

    if (!patterns.length) {
      return res.json({
        brief: null,
        message: 'No patterns detected in last 7 days — team looks healthy!',
        patterns: [],
      });
    }

    const contentRaw = await briefGenerationService.generateBrief(orgId, patterns);
    const saved = await briefGenerationService.saveBrief(orgId, contentRaw, patterns);

    // Mark onboarding step_previewed
    await db.query(
      `INSERT INTO onboarding_state (org_id, step_previewed) VALUES ($1, true)
       ON CONFLICT (org_id) DO UPDATE SET step_previewed = true, updated_at = NOW()`,
      [orgId]
    );

    res.json({ ...saved, items: patterns, preview: true });
  } catch (err) {
    logger.error({ err }, '[Briefs] previewBrief error');
    res.status(500).json({ error: 'Failed to generate preview brief' });
  }
}

export async function acknowledgeItem(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const { itemId } = req.params;

    await db.query(
      `UPDATE brief_items SET is_acknowledged = true
       WHERE id = $1 AND org_id = $2`,
      [itemId, orgId]
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, '[Briefs] acknowledgeItem error');
    res.status(500).json({ error: 'Failed to acknowledge item' });
  }
}

export async function dismissItem(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const { itemId } = req.params;

    await db.query(
      `UPDATE brief_items SET is_dismissed = true
       WHERE id = $1 AND org_id = $2`,
      [itemId, orgId]
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, '[Briefs] dismissItem error');
    res.status(500).json({ error: 'Failed to dismiss item' });
  }
}

export async function snoozeItem(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const { itemId } = req.params;

    // Snooze until tomorrow 8am
    const snoozedUntil = new Date();
    snoozedUntil.setDate(snoozedUntil.getDate() + 1);
    snoozedUntil.setHours(8, 0, 0, 0);

    await db.query(
      `UPDATE brief_items SET snoozed_until = $1
       WHERE id = $2 AND org_id = $3`,
      [snoozedUntil.toISOString(), itemId, orgId]
    );
    res.json({ ok: true, snoozedUntil });
  } catch (err) {
    logger.error({ err }, '[Briefs] snoozeItem error');
    res.status(500).json({ error: 'Failed to snooze item' });
  }
}
