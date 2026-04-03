import { config } from '../config/env';
import { logError, logInfo, logWarn } from '../utils/logger';
import { pool } from '../config/database';

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

// ─── SMART AR TRACKING: Per-Customer AR Status & AI Targeting ─────────────────

/**
 * Smart AR Report: Shows per-customer outstanding AR + AI targeting recommendation
 * This is the intelligence layer: system tells founder WHOM to target, WHEN, and WHY
 */
export interface SmartARData {
  companyId: string;
  companyName: string;
  totalAROutstanding: number;
  customerCount: number;
  customers: Array<{
    id: string;
    name: string;
    email: string;
    invoicesOverdue: number;
    totalOutstanding: number;
    daysOldestOverdue: number;
    lastEmailSent: string | null;
    lastPayment: string | null;
    riskScore: number;
    recommendedAction: 'immediate_contact' | 'payment_plan' | 'escalate' | 'monitor' | 'likely_pays_soon';
    reason: string;
    estimatedRecoveryProbability: number; // 0-100%
  }>;
}

/**
 * Send smart AR tracking report to Slack
 * Shows: Total AR, per-customer breakdown, AI targeting recommendations
 */
export async function sendSmartARReport(data: SmartARData, webhookUrl?: string): Promise<void> {
  const method = 'sendSmartARReport';
  const url = webhookUrl || config.slack?.webhookUrl;

  if (!url) {
    logWarn(LOG_MODULE, method, 'No Slack webhook configured');
    return;
  }

  const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
    return `$${Math.round(n)}`;
  };

  try {
    // Sort customers by outstanding amount (highest first)
    const sorted = [...data.customers].sort((a, b) => b.totalOutstanding - a.totalOutstanding);
    const topCustomers = sorted.slice(0, 10); // Show top 10 only

    // Build action items with AI recommendations
    const actionItems = topCustomers.map(c => {
      const actionEmoji =
        c.recommendedAction === 'immediate_contact' ? '⚡' :
        c.recommendedAction === 'payment_plan' ? '💳' :
        c.recommendedAction === 'escalate' ? '🚨' :
        c.recommendedAction === 'monitor' ? '👁️' :
        '✅';

      return `${actionEmoji} *${c.name}* — ${fmt(c.totalOutstanding)} (${c.daysOldestOverdue}d overdue)\n   *Action:* ${c.recommendedAction.replace(/_/g, ' ')}\n   *Why:* ${c.reason}\n   *Recovery:* ${c.estimatedRecoveryProbability}%`;
    }).join('\n\n');

    await sendSlackMessage(url, {
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '🎯 Smart AR Targeting Report' },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${data.companyName}*\n_AI-powered customer targeting for recovery_`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `💰 *Total AR Outstanding*\n*${fmt(data.totalAROutstanding)}*`,
            },
            {
              type: 'mrkdwn',
              text: `👥 *Customers at Risk*\n*${data.customerCount}*`,
            },
          ],
        },
        { type: 'divider' },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Top Targets (AI Ranked by Recovery Probability):*\n\n${actionItems}`,
          },
        },
        { type: 'divider' },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: '⚡ = Immediate outreach needed | 💳 = Offer payment plan | 🚨 = Legal escalation | 👁️ = Monitor next 3 days | ✅ = Likely pays soon',
            },
          ],
        },
      ],
    });

    logInfo(LOG_MODULE, method, 'Smart AR report sent', {
      companyId: data.companyId,
      totalAR: data.totalAROutstanding,
      customerCount: data.customerCount,
    });
  } catch (error) {
    logError(LOG_MODULE, method, 'Failed to send smart AR report', error);
  }
}

/**
 * Fetch smart AR data from database (per-customer AR + AI targeting logic)
 * This queries: invoices, customers, email_logs, payments, risk scores
 */
export async function fetchSmartARData(companyId: string): Promise<SmartARData | null> {
  const method = 'fetchSmartARData';

  try {
    const result = await pool.query(`
      SELECT
        c.id AS customer_id,
        c.name AS customer_name,
        c.email AS customer_email,
        COUNT(DISTINCT i.id) FILTER (WHERE i.status NOT IN ('paid', 'uncollectable')) AS invoices_overdue,
        COALESCE(SUM(i.amount) FILTER (WHERE i.status NOT IN ('paid', 'uncollectable')), 0)::float AS total_outstanding,
        COALESCE(EXTRACT(DAY FROM NOW() - MIN(i.due_date)) FILTER (WHERE i.status NOT IN ('paid', 'uncollectable')), 0)::int AS days_oldest_overdue,
        MAX(el.created_at) FILTER (WHERE el.email_type LIKE 'dunning_%') AS last_email_sent,
        MAX(p.created_at) AS last_payment_date,
        c.customer_risk_score::int AS avg_risk_score
      FROM customers c
      LEFT JOIN invoices i ON c.id = i.customer_id
      LEFT JOIN email_logs el ON i.id = el.invoice_id
      LEFT JOIN payments p ON c.id = p.customer_id
      WHERE c.company_id = $1
        AND i.status NOT IN ('paid', 'uncollectable')
        AND i.due_date < NOW()
      GROUP BY c.id, c.name, c.email, c.customer_risk_score
      ORDER BY total_outstanding DESC
      LIMIT 50
    `, [companyId]);

    if (result.rows.length === 0) {
      return null;
    }

    // Get company name
    const companyResult = await pool.query('SELECT name FROM companies WHERE id = $1', [companyId]);
    const companyName = companyResult.rows[0]?.name || 'Unknown Company';

    // Calculate total AR
    const totalAR = result.rows.reduce((sum, row) => sum + (row.total_outstanding || 0), 0);

    // AI targeting logic: determine best action per customer
    const customers = result.rows.map(row => {
      const daysOverdue = row.days_oldest_overdue || 0;
      const riskScore = row.avg_risk_score || 50;
      const daysSinceEmail = row.last_email_sent ?
        Math.floor((Date.now() - new Date(row.last_email_sent).getTime()) / (1000 * 60 * 60 * 24)) :
        999;

      // AI decision tree
      let recommendedAction: 'immediate_contact' | 'payment_plan' | 'escalate' | 'monitor' | 'likely_pays_soon';
      let reason: string;
      let recoveryProbability: number;

      if (daysOverdue > 60 && riskScore > 80) {
        recommendedAction = 'escalate';
        reason = 'High risk, very overdue — consider legal action';
        recoveryProbability = 20;
      } else if (daysOverdue > 30 && riskScore > 70) {
        recommendedAction = 'immediate_contact';
        reason = 'Aggressive — needs phone call, not email';
        recoveryProbability = 40;
      } else if (daysOverdue > 15 && !row.last_payment_date) {
        recommendedAction = 'payment_plan';
        reason = 'No recent payments — offer installments';
        recoveryProbability = 65;
      } else if (daysSinceEmail < 3) {
        recommendedAction = 'monitor';
        reason = 'Just contacted — wait for response';
        recoveryProbability = 70;
      } else {
        recommendedAction = 'likely_pays_soon';
        reason = 'Low risk — likely pays soon';
        recoveryProbability = 80;
      }

      return {
        id: row.customer_id,
        name: row.customer_name,
        email: row.customer_email,
        invoicesOverdue: row.invoices_overdue,
        totalOutstanding: row.total_outstanding,
        daysOldestOverdue: row.days_oldest_overdue,
        lastEmailSent: row.last_email_sent,
        lastPayment: row.last_payment_date,
        riskScore: row.avg_risk_score,
        recommendedAction,
        reason,
        estimatedRecoveryProbability: recoveryProbability,
      };
    });

    return {
      companyId,
      companyName,
      totalAROutstanding: totalAR,
      customerCount: customers.length,
      customers,
    };
  } catch (error) {
    logError(LOG_MODULE, method, 'Failed to fetch smart AR data', error);
    return null;
  }
}
