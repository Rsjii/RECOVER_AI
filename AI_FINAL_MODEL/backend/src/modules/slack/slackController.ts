import { Request, Response } from 'express';
import { db } from '../../config/db';
import { logger } from '../../config/logger';
import { deliveryService } from '../../services/deliveryService';
import { logActivity } from '../../lib/activity';

export async function connectSlack(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const { webhookUrl, channelName } = req.body as { webhookUrl: string; channelName?: string };

    if (!webhookUrl?.startsWith('https://hooks.slack.com/')) {
      return res.status(400).json({ error: 'Invalid Slack webhook URL' });
    }

    await db.query(
      `INSERT INTO slack_connections (org_id, webhook_url, channel_name, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (org_id) DO UPDATE SET
         webhook_url = $2, channel_name = $3, is_active = true, updated_at = NOW()`,
      [orgId, webhookUrl, channelName || '']
    );

    logActivity(orgId, (req as any).user?.id, 'slack_connected', `Connected Slack: ${channelName || 'webhook'}`);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, '[Slack] connect error');
    res.status(500).json({ error: 'Failed to connect Slack' });
  }
}

export async function testSlack(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;

    const conn = await db.query(
      `SELECT webhook_url FROM slack_connections WHERE org_id = $1 AND is_active = true`,
      [orgId]
    );

    if (!conn.rows[0]) return res.status(400).json({ error: 'Slack not connected' });

    const testPayload = {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '✅ *EngineeringOS is connected!*\nYour daily brief will arrive here every morning.',
          },
        },
      ],
    };

    const ok = await deliveryService.sendSlackTest(conn.rows[0].webhook_url);
    if (!ok) return res.status(502).json({ error: 'Slack webhook returned error' });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, '[Slack] test error');
    res.status(500).json({ error: 'Failed to send test message' });
  }
}

export async function getSlackStatus(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const conn = await db.query(
      `SELECT channel_name, is_active, created_at FROM slack_connections WHERE org_id = $1`,
      [orgId]
    );
    res.json({
      connected: !!conn.rows[0]?.is_active,
      channel_name: conn.rows[0]?.channel_name || null,
    });
  } catch (err) {
    logger.error({ err }, '[Slack] getStatus error');
    res.status(500).json({ error: 'Failed to get Slack status' });
  }
}

export async function disconnectSlack(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    await db.query(`DELETE FROM slack_connections WHERE org_id = $1`, [orgId]);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, '[Slack] disconnect error');
    res.status(500).json({ error: 'Failed to disconnect Slack' });
  }
}

// POST /webhooks/slack-actions — handles button clicks from Slack Block Kit
export async function handleSlackAction(req: Request, res: Response) {
  try {
    // Slack sends payload as URL-encoded JSON string in `payload` field
    const rawPayload = req.body?.payload;
    if (!rawPayload) return res.status(400).send('Missing payload');

    const payload = JSON.parse(rawPayload);
    const actions: any[] = payload.actions || [];

    for (const action of actions) {
      // action_id format: "acknowledge:itemId", "dismiss:itemId", "snooze:itemId"
      const [type, itemId] = (action.action_id || '').split(':');
      if (!itemId || !type) continue;

      // JOIN through daily_briefs to prevent cross-org item manipulation
      if (type === 'acknowledge') {
        await db.query(
          `UPDATE brief_items bi SET is_acknowledged = true
           FROM daily_briefs db WHERE bi.brief_id = db.id AND bi.id = $1`,
          [itemId]
        );
      } else if (type === 'dismiss') {
        await db.query(
          `UPDATE brief_items bi SET is_dismissed = true
           FROM daily_briefs db WHERE bi.brief_id = db.id AND bi.id = $1`,
          [itemId]
        );
      } else if (type === 'snooze') {
        const snoozedUntil = new Date();
        snoozedUntil.setDate(snoozedUntil.getDate() + 1);
        snoozedUntil.setHours(8, 0, 0, 0);
        await db.query(
          `UPDATE brief_items bi SET snoozed_until = $1
           FROM daily_briefs db WHERE bi.brief_id = db.id AND bi.id = $2`,
          [snoozedUntil, itemId]
        );
      }

      logger.info({ type, itemId }, '[Slack] Action processed');
    }

    // Slack requires a 200 response within 3 seconds
    res.status(200).send('');
  } catch (err) {
    logger.error({ err }, '[Slack] handleAction error');
    res.status(200).send(''); // always 200 to Slack
  }
}
