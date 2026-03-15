import { Resend } from 'resend';
import { db } from '../config/db';
import { logger } from '../config/logger';
import { config } from '../config/env';

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

export const deliveryService = {
  async sendToSlack(orgId: string, blockKitPayload: object): Promise<boolean> {
    const { rows } = await db.query(
      `SELECT webhook_url FROM slack_connections WHERE org_id = $1 AND is_active = true`,
      [orgId]
    );
    if (!rows[0]?.webhook_url) {
      logger.warn({ orgId }, '[Delivery] No active Slack webhook');
      return false;
    }

    const webhookUrl: string = rows[0].webhook_url;
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(blockKitPayload),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error({ orgId, status: res.status, text }, '[Delivery] Slack webhook failed');
      return false;
    }

    logger.info({ orgId }, '[Delivery] Slack brief sent');
    return true;
  },

  async sendEmail(orgId: string, htmlContent: string, subject: string): Promise<boolean> {
    if (!resend) {
      logger.warn('[Delivery] Resend not configured, skipping email');
      return false;
    }

    // Get CTO email (org creator)
    const { rows } = await db.query(
      `SELECT u.email, o.github_org_name as org_name
       FROM organizations o
       JOIN users u ON u.id = o.created_by
       WHERE o.id = $1`,
      [orgId]
    );

    if (!rows[0]?.email) {
      logger.warn({ orgId }, '[Delivery] No owner email found');
      return false;
    }

    try {
      await resend.emails.send({
        from: config.emailFrom || 'EngineeringOS <brief@resend.dev>',
        to: rows[0].email,
        subject,
        html: htmlContent,
      });
      logger.info({ orgId, to: rows[0].email }, '[Delivery] Email brief sent');
      return true;
    } catch (err) {
      logger.error({ err, orgId }, '[Delivery] Email send failed');
      return false;
    }
  },

  async deliverBrief(orgId: string, briefId: string): Promise<void> {
    // Load brief content
    const { rows } = await db.query(
      `SELECT content_slack, content_email, brief_date FROM daily_briefs WHERE id = $1`,
      [briefId]
    );
    if (!rows[0]) {
      logger.error({ briefId }, '[Delivery] Brief not found');
      return;
    }

    const brief = rows[0];

    // Load delivery config
    const { rows: cfgRows } = await db.query(
      `SELECT slack_enabled, email_enabled FROM brief_config WHERE org_id = $1`,
      [orgId]
    );
    const cfg = cfgRows[0] ?? { slack_enabled: true, email_enabled: false };

    let sentVia: string[] = [];

    if (cfg.slack_enabled && brief.content_slack) {
      const ok = await deliveryService.sendToSlack(orgId, brief.content_slack);
      if (ok) sentVia.push('slack');
    }

    if (cfg.email_enabled && brief.content_email) {
      const dateStr = new Date(brief.brief_date).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
      });
      const ok = await deliveryService.sendEmail(
        orgId,
        brief.content_email,
        `Engineering Brief — ${dateStr}`
      );
      if (ok) sentVia.push('email');
    }

    if (sentVia.length > 0) {
      await db.query(
        `UPDATE daily_briefs SET sent_at = NOW(), sent_via = $2 WHERE id = $1`,
        [briefId, sentVia.join(',')]
      );
    }

    logger.info({ orgId, briefId, sentVia }, '[Delivery] Brief delivery complete');
  },

  /** Send a test Slack message to verify webhook URL */
  async sendSlackTest(webhookUrl: string): Promise<boolean> {
    const payload = {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '✅ *EngineeringOS is connected!* Your daily engineering brief will appear here.',
          },
        },
      ],
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return res.ok;
  },
};
