import cron from 'node-cron';
import { pool } from '../config/database';
import { logError, logInfo } from '../utils/logger';
import resendService from '../services/resendService';
import { sendCashOSDigest, CashDigestData } from '../services/slackService';
import { decryptField } from '../lib/encryption';

const MODULE = 'dailyDigestJob';

// ─── Data Fetching ──────────────────────────────────────────────────────────

async function getActiveCompanies(): Promise<Array<{
  id: string;
  name: string;
  email: string;
  cash_balance_usd: string;
  slack_webhook_url_encrypted: string | null;
}>> {
  const result = await pool.query(
    `SELECT id, name, email, cash_balance_usd, slack_webhook_url_encrypted
     FROM companies
     WHERE
       -- Active trial users
       trial_status = 'active'
       OR subscription_status = 'active'
       -- Also include companies with invoices synced (demo/pilot)
       OR id IN (SELECT DISTINCT company_id FROM invoices WHERE created_at > NOW() - INTERVAL '90 days')
     ORDER BY created_at ASC`
  );
  return result.rows;
}

async function buildDigestPayload(companyId: string, companyName: string, cashBalanceRaw: string): Promise<CashDigestData | null> {
  try {
    // 1. AR stats
    const arResult = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN status != 'paid' THEN amount ELSE 0 END), 0)              AS ar_total,
         COALESCE(SUM(CASE WHEN status != 'paid' AND due_date < NOW() THEN amount ELSE 0 END), 0) AS overdue_total,
         COUNT(CASE WHEN status != 'paid' AND due_date < NOW() THEN 1 END)                AS overdue_count
       FROM invoices
       WHERE company_id = $1`,
      [companyId]
    );
    const ar = arResult.rows[0];
    const arTotal = parseFloat(ar.ar_total) || 0;
    const overdueTotal = parseFloat(ar.overdue_total) || 0;
    const overdueCount = parseInt(ar.overdue_count) || 0;

    // 2. DSO (days sales outstanding)
    const dsoResult = await pool.query(
      `SELECT
         COALESCE(
           (SUM(CASE WHEN status != 'paid' THEN amount ELSE 0 END) /
            NULLIF(SUM(amount), 0)) *
           COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(due_date, created_at + INTERVAL '30 days') - created_at)) / 86400), 45),
           45
         ) AS dso
       FROM invoices
       WHERE company_id = $1`,
      [companyId]
    );
    const dso = Math.round(parseFloat(dsoResult.rows[0]?.dso) || 45);

    // 3. Billing errors (pending anomalies)
    const errorsResult = await pool.query(
      `SELECT
         COUNT(*) AS error_count,
         COALESCE(SUM(working_capital_impact), 0) AS total_impact
       FROM billing_anomalies
       WHERE company_id = $1 AND status = 'pending'`,
      [companyId]
    );
    const billingErrorCount = parseInt(errorsResult.rows[0]?.error_count) || 0;
    const billingErrorImpact = parseFloat(errorsResult.rows[0]?.total_impact) || 0;

    // 4. Top 3 at-risk customers
    const topAtRiskResult = await pool.query(
      `SELECT
         c.company_name,
         SUM(i.amount)                                                                    AS total_owed,
         MAX(EXTRACT(EPOCH FROM (NOW() - COALESCE(i.due_date, i.created_at))) / 86400)   AS max_days_overdue
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id
       WHERE i.company_id = $1
         AND i.status != 'paid'
         AND i.due_date < NOW()
       GROUP BY c.id, c.company_name
       ORDER BY total_owed DESC
       LIMIT 3`,
      [companyId]
    );

    // 5. Calculate Cash Clarity Score
    const cashBalance = parseFloat(cashBalanceRaw) || 0;

    // Runway: rough estimate — available cash / (monthly AR * 0.6 burn proxy)
    const monthlyBurnProxy = arTotal * 0.3;
    const runwayDays = monthlyBurnProxy > 0
      ? Math.min(365, Math.round(cashBalance / (monthlyBurnProxy / 30)))
      : 90;

    // 30-day cash forecast = current cash + 80% of overdue likely to come in
    const forecast30Day = cashBalance + overdueTotal * 0.8;

    // Score: start at 100, deduct for risks
    let clarityScore = 100;
    if (arTotal > 0) {
      const overdueRatio = overdueTotal / arTotal;
      clarityScore -= Math.min(30, Math.round(overdueRatio * 60)); // -30 max
    }
    if (billingErrorCount > 0) {
      clarityScore -= Math.min(20, billingErrorCount * 4);          // -20 max
    }
    if (dso > 60) {
      clarityScore -= Math.min(20, Math.round((dso - 60) / 2));    // -20 max
    }
    if (runwayDays < 30 && runwayDays > 0) {
      clarityScore -= Math.min(30, 30 - runwayDays);               // -30 max
    }
    clarityScore = Math.max(0, Math.min(100, clarityScore));

    return {
      companyName,
      clarityScore,
      cashBalance,
      overdueTotal,
      overdueCount,
      billingErrorCount,
      billingErrorImpact,
      runwayDays,
      forecast30Day,
      topAtRisk: topAtRiskResult.rows.map((r: any) => ({
        name: r.company_name,
        amount: parseFloat(r.total_owed),
        daysOverdue: Math.round(parseFloat(r.max_days_overdue)),
      })),
    };
  } catch (err) {
    logError(MODULE, 'buildDigestPayload', 'Failed to build payload', err, { companyId });
    return null;
  }
}

// ─── Email Template ─────────────────────────────────────────────────────────

function buildEmailHTML(data: CashDigestData): string {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
    return `$${Math.round(n)}`;
  };

  const scoreColor = data.clarityScore >= 80 ? '#22c55e' : data.clarityScore >= 60 ? '#f59e0b' : '#ef4444';
  const scoreLabel = data.clarityScore >= 80 ? 'Excellent visibility' : data.clarityScore >= 60 ? 'Good — some risks to watch' : 'Needs attention';
  const runwayColor = data.runwayDays > 90 ? '#22c55e' : data.runwayDays > 30 ? '#f59e0b' : '#ef4444';

  const topAtRiskRows = data.topAtRisk.length > 0
    ? data.topAtRisk.map(c => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #1e293b;color:#f1f5f9;font-size:14px">${c.name}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #1e293b;color:#f87171;font-weight:600;font-size:14px">${fmt(c.amount)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:13px">${c.daysOverdue}d overdue</td>
      </tr>`).join('')
    : `<tr><td colspan="3" style="padding:12px 16px;color:#64748b;font-size:14px;text-align:center">No overdue AR — all clear ✓</td></tr>`;

  const frontendUrl = process.env.FRONTEND_URL || 'https://app.recoverai.com';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>CashOS Daily Digest</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">

    <!-- Header -->
    <div style="background:#1e293b;border-radius:16px;padding:28px 32px;margin-bottom:16px;border:1px solid #334155">
      <div style="margin-bottom:4px">
        <span style="color:#6366f1;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase">CashOS</span>
        <span style="color:#475569;font-size:12px;margin-left:12px">${date}</span>
      </div>
      <h1 style="color:#f1f5f9;font-size:20px;font-weight:700;margin:8px 0 0;letter-spacing:-0.01em">Daily Cash Digest</h1>
      <p style="color:#94a3b8;font-size:14px;margin:4px 0 0">${data.companyName}</p>
    </div>

    <!-- Cash Clarity Score -->
    <div style="background:#1e293b;border-radius:16px;padding:32px;margin-bottom:16px;border:1px solid #334155;text-align:center">
      <p style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 12px">Cash Clarity Score</p>
      <div style="font-size:72px;font-weight:800;color:${scoreColor};line-height:1;letter-spacing:-0.03em">${data.clarityScore}</div>
      <p style="color:#64748b;font-size:14px;margin:8px 0 0">/100 &nbsp;·&nbsp; ${scoreLabel}</p>
    </div>

    <!-- 4 Metric Cards (2x2 grid via table for email clients) -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
      <tr>
        <td width="50%" style="padding-right:8px;padding-bottom:16px;vertical-align:top">
          <div style="background:#1e293b;border-radius:16px;padding:20px 24px;border:1px solid #334155">
            <p style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 10px">Cash Balance</p>
            <p style="color:#f1f5f9;font-size:28px;font-weight:700;margin:0;letter-spacing:-0.02em">${fmt(data.cashBalance)}</p>
            <p style="color:#475569;font-size:12px;margin:6px 0 0">Manual entry · <a href="${frontendUrl}/settings" style="color:#6366f1;text-decoration:none">Update</a></p>
          </div>
        </td>
        <td width="50%" style="padding-left:8px;padding-bottom:16px;vertical-align:top">
          <div style="background:#1e293b;border-radius:16px;padding:20px 24px;border:1px solid #334155">
            <p style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 10px">AR at Risk</p>
            <p style="color:#f87171;font-size:28px;font-weight:700;margin:0;letter-spacing:-0.02em">${fmt(data.overdueTotal)}</p>
            <p style="color:#475569;font-size:12px;margin:6px 0 0">${data.overdueCount} overdue invoice${data.overdueCount !== 1 ? 's' : ''}</p>
          </div>
        </td>
      </tr>
      <tr>
        <td width="50%" style="padding-right:8px;vertical-align:top">
          <div style="background:#1e293b;border-radius:16px;padding:20px 24px;border:1px solid #334155">
            <p style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 10px">Billing Errors</p>
            <p style="color:${data.billingErrorCount > 0 ? '#f59e0b' : '#22c55e'};font-size:28px;font-weight:700;margin:0;letter-spacing:-0.02em">
              ${data.billingErrorCount > 0 ? fmt(data.billingErrorImpact) : '✓ None'}
            </p>
            <p style="color:#475569;font-size:12px;margin:6px 0 0">
              ${data.billingErrorCount > 0 ? `${data.billingErrorCount} error${data.billingErrorCount !== 1 ? 's' : ''} found` : 'Billing is clean'}
            </p>
          </div>
        </td>
        <td width="50%" style="padding-left:8px;vertical-align:top">
          <div style="background:#1e293b;border-radius:16px;padding:20px 24px;border:1px solid #334155">
            <p style="color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 10px">Cash Runway</p>
            <p style="color:${runwayColor};font-size:28px;font-weight:700;margin:0;letter-spacing:-0.02em">${data.runwayDays > 0 ? data.runwayDays + 'd' : 'N/A'}</p>
            <p style="color:#475569;font-size:12px;margin:6px 0 0">Forecast: ${fmt(data.forecast30Day)} in 30d</p>
          </div>
        </td>
      </tr>
    </table>

    <!-- Top At-Risk Customers -->
    <div style="background:#1e293b;border-radius:16px;padding:24px;margin-bottom:16px;border:1px solid #334155">
      <p style="color:#94a3b8;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 16px">Top At-Risk Customers</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <thead>
          <tr>
            <th style="text-align:left;color:#475569;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;padding:0 16px 10px">Customer</th>
            <th style="text-align:left;color:#475569;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;padding:0 16px 10px">Amount</th>
            <th style="text-align:left;color:#475569;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;padding:0 16px 10px">Status</th>
          </tr>
        </thead>
        <tbody>
          ${topAtRiskRows}
        </tbody>
      </table>
    </div>

    <!-- CTA -->
    <div style="text-align:center;padding:24px 0 16px">
      <a href="${frontendUrl}/dashboard"
         style="background:#6366f1;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:600;font-size:15px;display:inline-block;letter-spacing:-0.01em">
        View Full Dashboard →
      </a>
    </div>

    <!-- Footer -->
    <p style="color:#334155;font-size:12px;text-align:center;margin:16px 0 0;line-height:1.6">
      CashOS &nbsp;·&nbsp; Cash Operations Platform<br>
      <a href="${frontendUrl}/settings" style="color:#475569;text-decoration:none">Manage digest settings</a>
      &nbsp;·&nbsp;
      <a href="${frontendUrl}/settings" style="color:#475569;text-decoration:none">Unsubscribe</a>
    </p>

  </div>
</body>
</html>`;
}

function buildEmailText(data: CashDigestData): string {
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const frontendUrl = process.env.FRONTEND_URL || 'https://app.recoverai.com';

  return `CashOS Daily Digest — ${data.companyName}

Cash Clarity Score: ${data.clarityScore}/100
──────────────────────────────
Cash Balance:    ${fmt(data.cashBalance)}
AR at Risk:      ${fmt(data.overdueTotal)} (${data.overdueCount} invoices)
Billing Errors:  ${data.billingErrorCount > 0 ? `${data.billingErrorCount} found — ${fmt(data.billingErrorImpact)} impact` : 'None'}
Cash Runway:     ${data.runwayDays > 0 ? data.runwayDays + ' days' : 'N/A'}
30-Day Forecast: ${fmt(data.forecast30Day)}

Top At-Risk:
${data.topAtRisk.length > 0 ? data.topAtRisk.map(c => `  • ${c.name} — ${fmt(c.amount)} (${c.daysOverdue}d overdue)`).join('\n') : '  • No overdue AR'}

View Dashboard: ${frontendUrl}/dashboard
`;
}

// ─── Main Runner ─────────────────────────────────────────────────────────────

async function runDailyDigest(): Promise<void> {
  const method = 'runDailyDigest';
  logInfo(MODULE, method, 'Starting CashOS daily digest run');

  let companies: Awaited<ReturnType<typeof getActiveCompanies>>;
  try {
    companies = await getActiveCompanies();
  } catch (err) {
    logError(MODULE, method, 'Failed to fetch companies', err);
    return;
  }

  logInfo(MODULE, method, `Processing ${companies.length} companies`);

  for (const company of companies) {
    try {
      const data = await buildDigestPayload(company.id, company.name, company.cash_balance_usd);
      if (!data) continue;

      // 1. Email (primary — always send)
      const dateShort = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      await resendService.sendEmail({
        to: company.email,
        subject: `CashOS Daily — Score ${data.clarityScore}/100 · ${dateShort}`,
        bodyHtml: buildEmailHTML(data),
        bodyText: buildEmailText(data),
        replyTo: 'hello@recoverai.com',
      });

      // 2. Slack (secondary — only if webhook configured)
      if (company.slack_webhook_url_encrypted) {
        try {
          const webhookUrl = decryptField(company.slack_webhook_url_encrypted);
          await sendCashOSDigest(data, webhookUrl);
        } catch (slackErr) {
          logError(MODULE, method, 'Slack digest failed (non-blocking)', slackErr, { companyId: company.id });
        }
      }

      logInfo(MODULE, method, 'Digest sent', {
        companyId: company.id,
        score: data.clarityScore,
        hasSlack: !!company.slack_webhook_url_encrypted,
      });
    } catch (err) {
      logError(MODULE, method, 'Failed digest for company', err, { companyId: company.id });
    }
  }

  logInfo(MODULE, method, `Daily digest complete`, { total: companies.length });
}

// ─── Cron Worker ─────────────────────────────────────────────────────────────

export function startDailyDigestWorker(): void {
  // Every day at 08:00 UTC
  cron.schedule('0 8 * * *', () => {
    runDailyDigest().catch(err =>
      logError(MODULE, 'cronRun', 'Daily digest cron failed', err)
    );
  });

  logInfo(MODULE, 'startDailyDigestWorker', 'CashOS daily digest scheduled (08:00 UTC daily)');
}

export function stopDailyDigestWorker(): void {
  // node-cron stops automatically on process exit
}