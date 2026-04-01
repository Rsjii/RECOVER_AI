import { pool } from '../config/database';
import { logInfo, logError, logWarn } from '../utils/logger';
import fetch from 'node-fetch';

const LOG_MODULE = 'slackNotificationService';

/**
 * Slack message block
 */
interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
  };
  [key: string]: any;
}

/**
 * Get company's Slack webhook URL
 */
async function getSlackWebhookUrl(companyId: string): Promise<string | null> {
  try {
    const result = await pool.query(
      `SELECT slack_webhook_url_encrypted FROM companies WHERE id = $1`,
      [companyId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    // TODO: Decrypt the URL using encryption service
    // For now, assume it's plaintext (placeholder)
    return result.rows[0].slack_webhook_url_encrypted;
  } catch (err) {
    logError(LOG_MODULE, 'getSlackWebhookUrl', 'Failed to fetch webhook URL', err);
    return null;
  }
}

/**
 * Post message to Slack
 */
export const slackNotificationService = {
  async postMessage(options: {
    companyId: string;
    channelId: string;
    blocks: SlackBlock[];
    threadTs?: string;
  }): Promise<boolean> {
    const { companyId, channelId, blocks, threadTs } = options;

    try {
      const webhookUrl = await getSlackWebhookUrl(companyId);
      if (!webhookUrl) {
        logWarn(LOG_MODULE, 'postMessage', 'No Slack webhook URL configured', { companyId });
        return false;
      }

      const payload = {
        channel: channelId,
        blocks,
        ...(threadTs && { thread_ts: threadTs }),
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        logError(LOG_MODULE, 'postMessage', 'Slack API error', {
          status: response.status,
          statusText: response.statusText,
        });
        return false;
      }

      logInfo(LOG_MODULE, 'postMessage', 'Message posted to Slack', {
        companyId,
        channelId,
      });
      return true;
    } catch (err) {
      logError(LOG_MODULE, 'postMessage', 'Failed to post message', err);
      return false;
    }
  },

  /**
   * Notify when payment is received
   */
  async notifyPaymentReceived(options: {
    companyId: string;
    invoiceId: string;
    amount: number;
    customerName: string;
    customerId: string;
  }): Promise<void> {
    const { companyId, invoiceId, amount, customerName } = options;

    logInfo(LOG_MODULE, 'notifyPaymentReceived', 'Payment notification', {
      companyId,
      invoiceId,
      amount,
    });

    try {
      // Get payment history for this customer (for learning)
      const paymentHistory = await pool.query(
        `SELECT COUNT(*) as count, AVG(EXTRACT(EPOCH FROM (NOW() - i.due_date)) / 86400) as avg_days_late
         FROM payments p
         JOIN invoices i ON p.invoice_id = i.id
         WHERE i.customer_id = $1`,
        [options.customerId]
      );

      const paymentCount = paymentHistory.rows[0]?.count || 0;
      const avgDaysLate = paymentHistory.rows[0]?.avg_days_late || 0;

      const blocks: SlackBlock[] = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `💰 Payment received!\n*Amount:* $${amount.toLocaleString()}\n*Customer:* ${customerName}\n*Invoice:* #${invoiceId.substring(0, 8)}`,
          },
        },
      ];

      // Add learning insight if available
      if (paymentCount > 0) {
        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `📊 This is their ${paymentCount}${['st', 'nd', 'rd'][paymentCount - 1] || 'th'} payment. Avg: ${Math.round(avgDaysLate)} days late.`,
            },
          ],
        });
      }

      await this.postMessage({
        companyId,
        channelId: 'general', // TODO: Use configured channel
        blocks,
      });
    } catch (err) {
      logError(LOG_MODULE, 'notifyPaymentReceived', 'Failed to send payment notification', err);
    }
  },

  /**
   * Notify when dunning email is sent
   */
  async notifyEmailSent(options: {
    companyId: string;
    invoiceId: string;
    emailType: string;
    status: string;
    customerName: string;
  }): Promise<void> {
    const { companyId, invoiceId, emailType, customerName } = options;

    logInfo(LOG_MODULE, 'notifyEmailSent', 'Email sent notification', {
      companyId,
      invoiceId,
      emailType,
    });

    try {
      // TODO: Get conversion rate for this tier
      // For now, use placeholder
      const conversionRate = 0.35;

      const emailTypeLabel = emailType.replace(/_/g, ' ').toUpperCase();
      const blocks: SlackBlock[] = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📧 ${emailTypeLabel} sent to ${customerName}\n${emailType === 'payment_plan_offer' ? '💼 Payment plan offer' : '📬 Dunning email'}`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `📊 Expected conversion: ${(conversionRate * 100).toFixed(0)}%. Expect payment in 10-15 days.`,
            },
          ],
        },
      ];

      await this.postMessage({
        companyId,
        channelId: 'general', // TODO: Use configured channel
        blocks,
      });
    } catch (err) {
      logError(LOG_MODULE, 'notifyEmailSent', 'Failed to send email notification', err);
    }
  },

  /**
   * Notify when high-risk customer detected
   */
  async notifyHighRisk(options: {
    companyId: string;
    customerId: string;
    customerName: string;
    riskScore: number;
    daysOverdue: number;
    invoiceId: string;
  }): Promise<void> {
    const { companyId, customerName, riskScore, daysOverdue } = options;

    logInfo(LOG_MODULE, 'notifyHighRisk', 'High risk notification', {
      companyId,
      customerName,
      riskScore,
    });

    try {
      const tier = riskScore > 75 ? 3 : riskScore > 50 ? 2 : 1;
      const tierNames = ['Gentle', 'Standard', 'Aggressive'];

      const blocks: SlackBlock[] = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🚨 HIGH RISK ALERT\n*Customer:* ${customerName}\n*Risk Score:* ${riskScore}/100\n*Days Overdue:* ${daysOverdue}`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `📊 Recommend Tier ${tier} (${tierNames[tier - 1]}) strategy. This has highest conversion for your profile.`,
            },
          ],
        },
      ];

      await this.postMessage({
        companyId,
        channelId: 'general', // TODO: Use configured channel
        blocks,
      });
    } catch (err) {
      logError(LOG_MODULE, 'notifyHighRisk', 'Failed to send high risk notification', err);
    }
  },

  /**
   * Send daily summary with learnings
   */
  async sendDailySummary(options: {
    companyId: string;
  }): Promise<void> {
    const { companyId } = options;

    logInfo(LOG_MODULE, 'sendDailySummary', 'Sending daily summary', { companyId });

    try {
      // Fetch metrics for today
      const metrics = await pool.query(`
        SELECT
          COUNT(DISTINCT CASE WHEN el.email_type LIKE 'dunning_%' AND el.sent_at > NOW() - INTERVAL '1 day' THEN el.id END) as emails_sent,
          COUNT(DISTINCT CASE WHEN el.opened_at > NOW() - INTERVAL '1 day' THEN el.id END) as emails_opened,
          COUNT(DISTINCT CASE WHEN p.created_at > NOW() - INTERVAL '1 day' THEN p.id END) as payments_received,
          COALESCE(SUM(CASE WHEN p.created_at > NOW() - INTERVAL '1 day' THEN p.amount ELSE 0 END), 0)::float as amount_recovered
        FROM companies co
        LEFT JOIN email_logs el ON el.company_id = co.id
        LEFT JOIN payments p ON p.company_id = co.id
        WHERE co.id = $1
      `, [companyId]);

      const data = metrics.rows[0] || {};
      const emailsOpened = data.emails_opened || 0;
      const emailsSent = data.emails_sent || 0;
      const openRate = emailsSent > 0 ? ((emailsOpened / emailsSent) * 100).toFixed(0) : 0;

      const blocks: SlackBlock[] = [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📊 *Daily Summary*\n\n📧 *Emails:* ${emailsSent} sent, ${emailsOpened} opened (${openRate}% open rate)\n💰 *Recovered:* $${(data.amount_recovered || 0).toLocaleString()}\n💳 *Payments:* ${data.payments_received || 0}`,
          },
        },
      ];

      await this.postMessage({
        companyId,
        channelId: 'general', // TODO: Use configured channel
        blocks,
      });
    } catch (err) {
      logError(LOG_MODULE, 'sendDailySummary', 'Failed to send daily summary', err);
    }
  },
};
