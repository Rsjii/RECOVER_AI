import { config } from '../config/env';
import { logError, logInfo, logWarn } from '../utils/logger';

const LOG_MODULE = 'slackService';

async function sendSlackMessage(webhookUrl: string, payload: object): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`);
  }
}

/**
 * Send a payment received alert to Slack
 */
export async function sendPaymentAlert(params: {
  customerName: string;
  amount: number;
  currency: string;
  invoiceId: string;
  webhookUrl?: string;
}): Promise<void> {
  const method = 'sendPaymentAlert';
  const webhookUrl = params.webhookUrl || config.slack?.webhookUrl;

  if (!webhookUrl) {
    logWarn(LOG_MODULE, method, 'No Slack webhook URL configured — skipping alert');
    return;
  }

  const amountFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: params.currency || 'USD',
  }).format(params.amount);

  try {
    await sendSlackMessage(webhookUrl, {
      text: `💰 *Payment Received!*`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `💰 *Payment Received*\n*Customer:* ${params.customerName}\n*Amount:* ${amountFormatted}\n*Invoice:* \`${params.invoiceId}\``,
          },
        },
      ],
    });

    logInfo(LOG_MODULE, method, 'Payment alert sent to Slack', {
      customerName: params.customerName,
      amount: params.amount,
    });
  } catch (error) {
    logError(LOG_MODULE, method, 'Failed to send payment alert to Slack', error);
  }
}

/**
 * Send daily recovery digest
 */
export async function sendDailyDigest(params: {
  totalOwed: number;
  totalRecovered: number;
  recoveryRate: number;
  overdueCount: number;
  emailsSentToday: number;
  currency?: string;
  webhookUrl?: string;
}): Promise<void> {
  const method = 'sendDailyDigest';
  const webhookUrl = params.webhookUrl || config.slack?.webhookUrl;

  if (!webhookUrl) {
    logWarn(LOG_MODULE, method, 'No Slack webhook URL configured — skipping digest');
    return;
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: params.currency || 'USD',
    }).format(n);

  try {
    await sendSlackMessage(webhookUrl, {
      text: `📊 RecoverAI Daily Digest`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '📊 RecoverAI Daily Digest' },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Total Owed:*\n${fmt(params.totalOwed)}` },
            { type: 'mrkdwn', text: `*Recovered:*\n${fmt(params.totalRecovered)}` },
            { type: 'mrkdwn', text: `*Recovery Rate:*\n${params.recoveryRate}%` },
            { type: 'mrkdwn', text: `*Overdue Invoices:*\n${params.overdueCount}` },
            { type: 'mrkdwn', text: `*Emails Sent Today:*\n${params.emailsSentToday}` },
          ],
        },
      ],
    });

    logInfo(LOG_MODULE, method, 'Daily digest sent to Slack');
  } catch (error) {
    logError(LOG_MODULE, method, 'Failed to send daily digest to Slack', error);
  }
}
