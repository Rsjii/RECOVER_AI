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

// ─── CashOS Cash Digest (Primary) ────────────────────────────────────────────

export interface CashDigestData {
  companyName: string;
  clarityScore: number;
  cashBalance: number;
  overdueTotal: number;
  overdueCount: number;
  billingErrorCount: number;
  billingErrorImpact: number;
  runwayDays: number;
  forecast30Day: number;
  topAtRisk: Array<{ name: string; amount: number; daysOverdue: number }>;
}

/**
 * Send CashOS daily cash digest to Slack
 * Shows: Cash Clarity Score, cash position, AR at risk, billing errors, top debtors
 */
export async function sendCashOSDigest(data: CashDigestData, webhookUrl: string): Promise<void> {
  const method = 'sendCashOSDigest';

  const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
    return `$${Math.round(n)}`;
  };

  const scoreEmoji = data.clarityScore >= 80 ? '🟢' : data.clarityScore >= 60 ? '🟡' : '🔴';
  const runwayEmoji = data.runwayDays > 90 ? '🟢' : data.runwayDays > 30 ? '🟡' : '🔴';

  const topRiskText = data.topAtRisk.length > 0
    ? data.topAtRisk.map(c => `• *${c.name}* — ${fmt(c.amount)} (${c.daysOverdue}d overdue)`).join('\n')
    : '• No overdue AR — all clear ✓';

  const date = new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  try {
    await sendSlackMessage(webhookUrl, {
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '☀️  CashOS Daily Digest' },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${data.companyName}*  ·  ${date}`,
          },
        },
        { type: 'divider' },
        // Cash Clarity Score + key metrics
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `${scoreEmoji}  *Cash Clarity Score*\n*${data.clarityScore}/100*`,
            },
            {
              type: 'mrkdwn',
              text: `💰  *Cash Balance*\n*${fmt(data.cashBalance)}*`,
            },
            {
              type: 'mrkdwn',
              text: `⚠️  *AR at Risk*\n*${fmt(data.overdueTotal)}* (${data.overdueCount} inv)`,
            },
            {
              type: 'mrkdwn',
              text: `🔍  *Billing Errors*\n${data.billingErrorCount > 0
                ? `*${data.billingErrorCount} found* — ${fmt(data.billingErrorImpact)}`
                : '*None* ✓'}`,
            },
            {
              type: 'mrkdwn',
              text: `${runwayEmoji}  *Cash Runway*\n*${data.runwayDays > 0 ? data.runwayDays + ' days' : 'N/A'}*`,
            },
            {
              type: 'mrkdwn',
              text: `🔮  *30-Day Forecast*\n*${fmt(data.forecast30Day)}*`,
            },
          ],
        },
        { type: 'divider' },
        // Top at-risk
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Top At-Risk Customers*\n${topRiskText}`,
          },
        },
        // Action buttons (only if there's overdue AR)
        ...(data.overdueCount > 0 ? [{
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: '📧  Approve Dunning' },
              style: 'primary',
              action_id: 'approve_dunning',
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: '📊  View Dashboard' },
              url: `${process.env.FRONTEND_URL || 'https://app.recoverai.com'}/dashboard`,
              action_id: 'view_dashboard',
            },
          ],
        }] as object[] : []),
      ],
    });

    logInfo(LOG_MODULE, method, 'CashOS digest sent to Slack', {
      company: data.companyName,
      score: data.clarityScore,
    });
  } catch (error) {
    logError(LOG_MODULE, method, 'Failed to send CashOS digest to Slack', error);
  }
}

// ─── Payment Alert ────────────────────────────────────────────────────────────

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

// ─── Legacy: kept for backward compat ─────────────────────────────────────────

/**
 * @deprecated Use sendCashOSDigest instead
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
    logWarn(LOG_MODULE, method, 'No Slack webhook URL configured — skipping');
    return;
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: params.currency || 'USD',
    }).format(n);

  try {
    await sendSlackMessage(webhookUrl, {
      text: `📊 CashOS Daily Digest`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '📊 CashOS Daily Digest' },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Total Owed:*\n${fmt(params.totalOwed)}` },
            { type: 'mrkdwn', text: `*Recovered:*\n${fmt(params.totalRecovered)}` },
            { type: 'mrkdwn', text: `*Recovery Rate:*\n${params.recoveryRate}%` },
            { type: 'mrkdwn', text: `*Overdue Invoices:*\n${params.overdueCount}` },
          ],
        },
      ],
    });
    logInfo(LOG_MODULE, method, 'Legacy digest sent');
  } catch (error) {
    logError(LOG_MODULE, method, 'Failed to send legacy digest', error);
  }
}
