import cron from 'node-cron';
import { pool } from '../config/database';
import { logError, logInfo } from '../utils/logger';
import resendService from '../services/resendService';
import { config } from '../config/env';

const LOG_MODULE = 'trialExpiryJob';

const APP_URL = config.frontendUrl || 'https://app.recoverai.com';

interface TrialCompanyRow {
  company_id: string;
  company_name: string;
  user_email: string;
  trial_ends_at: string;
}

async function sendTrialWarningEmail(
  email: string,
  companyName: string,
  daysLeft: number
): Promise<void> {
  const urgent = daysLeft <= 1;
  const subject = urgent
    ? `Final notice — your RecoverAI trial expires tomorrow`
    : `Your RecoverAI trial ends in ${daysLeft} days`;

  const bodyText = urgent
    ? `Hi,\n\nYour RecoverAI free trial expires tomorrow. After that, your account will be suspended and the agent will stop recovering invoices.\n\nUpgrade now to keep your AR recovery running:\n${APP_URL}/billing\n\nRecoverAI Team`
    : `Hi,\n\nYour RecoverAI free trial ends in ${daysLeft} days. Upgrade before it expires to keep the agent running without interruption.\n\nView your usage and upgrade:\n${APP_URL}/billing\n\nRecoverAI Team`;

  const bodyHtml = urgent
    ? `<p>Hi,</p>
       <p>Your RecoverAI free trial expires <strong>tomorrow</strong>. After that, your account will be suspended and the agent will stop recovering overdue invoices.</p>
       <p><a href="${APP_URL}/billing" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;margin:16px 0">Upgrade Now →</a></p>
       <p style="color:#6b7280;font-size:14px">RecoverAI Team</p>`
    : `<p>Hi,</p>
       <p>Your RecoverAI free trial ends in <strong>${daysLeft} days</strong>. Upgrade before it expires to keep the agent running without interruption.</p>
       <p>Your recovery activity so far is on your <a href="${APP_URL}/billing">billing page</a>.</p>
       <p><a href="${APP_URL}/billing" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;margin:16px 0">View Plans &amp; Upgrade →</a></p>
       <p style="color:#6b7280;font-size:14px">RecoverAI Team</p>`;

  await resendService.sendEmail({ to: email, subject, bodyText, bodyHtml });
}

async function sendTrialExpiredEmail(email: string, companyName: string): Promise<void> {
  const subject = `Your RecoverAI trial has expired — reactivate to resume recovery`;
  const bodyText = `Hi,\n\nYour RecoverAI free trial has expired. Your account is now suspended and the agent has stopped recovering invoices.\n\nReactivate your account to resume:\n${APP_URL}/billing\n\nRecoverAI Team`;
  const bodyHtml = `<p>Hi,</p>
     <p>Your RecoverAI free trial has expired. Your account is now <strong>suspended</strong> and the recovery agent has stopped.</p>
     <p><a href="${APP_URL}/billing" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;margin:16px 0">Reactivate Account →</a></p>
     <p style="color:#6b7280;font-size:14px">RecoverAI Team</p>`;

  await resendService.sendEmail({ to: email, subject, bodyText, bodyHtml });
}

async function expireTrials(): Promise<void> {
  const method = 'expireTrials';

  // Day 8 warning (trial_ends_at is between 7d 23h and 8d 1h from now = "8 days left")
  const day14Rows = await pool.query<TrialCompanyRow>(
    `SELECT s.company_id, c.name AS company_name, u.email AS user_email, s.trial_ends_at
     FROM subscriptions s
     JOIN companies c ON c.id = s.company_id
     JOIN users u ON u.company_id = s.company_id
     WHERE s.status = 'trialing'
       AND s.trial_ends_at BETWEEN NOW() + interval '7 days 23 hours' AND NOW() + interval '8 days 1 hour'
     LIMIT 500`
  );

  for (const row of day14Rows.rows) {
    try {
      await sendTrialWarningEmail(row.user_email, row.company_name, 8);
      logInfo(LOG_MODULE, method, 'Day-14 warning sent', { companyId: row.company_id, email: row.user_email });
    } catch (err) {
      logError(LOG_MODULE, method, 'Failed to send Day-14 warning', err, { companyId: row.company_id });
    }
  }

  // Day 21 final warning (trial_ends_at is ~1 day away)
  const day21Rows = await pool.query<TrialCompanyRow>(
    `SELECT s.company_id, c.name AS company_name, u.email AS user_email, s.trial_ends_at
     FROM subscriptions s
     JOIN companies c ON c.id = s.company_id
     JOIN users u ON u.company_id = s.company_id
     WHERE s.status = 'trialing'
       AND s.trial_ends_at BETWEEN NOW() + interval '23 hours' AND NOW() + interval '25 hours'
     LIMIT 500`
  );

  for (const row of day21Rows.rows) {
    try {
      await sendTrialWarningEmail(row.user_email, row.company_name, 1);
      logInfo(LOG_MODULE, method, 'Day-21 final warning sent', { companyId: row.company_id, email: row.user_email });
    } catch (err) {
      logError(LOG_MODULE, method, 'Failed to send Day-21 warning', err, { companyId: row.company_id });
    }
  }

  // Day 22: expire trials + send expired email
  const expiredRows = await pool.query<TrialCompanyRow>(
    `UPDATE subscriptions s
     SET status = 'past_due', updated_at = NOW()
     FROM companies c, users u
     WHERE s.company_id = c.id
       AND u.company_id = s.company_id
       AND s.status = 'trialing'
       AND s.trial_ends_at IS NOT NULL
       AND s.trial_ends_at < NOW()
     RETURNING s.company_id, c.name AS company_name, u.email AS user_email, s.trial_ends_at`
  );

  if (expiredRows.rowCount && expiredRows.rowCount > 0) {
    logInfo(LOG_MODULE, method, `Expired ${expiredRows.rowCount} trial(s)`, {
      companyIds: expiredRows.rows.map((r) => r.company_id),
    });

    for (const row of expiredRows.rows) {
      try {
        await sendTrialExpiredEmail(row.user_email, row.company_name);
        logInfo(LOG_MODULE, method, 'Trial expired email sent', { companyId: row.company_id });
      } catch (err) {
        logError(LOG_MODULE, method, 'Failed to send trial expired email', err, { companyId: row.company_id });
      }
    }
  }
}

export function startTrialExpiryJob(): void {
  // Run daily at 01:00 UTC
  cron.schedule('0 1 * * *', () => {
    expireTrials().catch((err) =>
      logError(LOG_MODULE, 'cronRun', 'Trial expiry run failed', err)
    );
  });

  logInfo(LOG_MODULE, 'startTrialExpiryJob', 'Trial expiry job started (runs daily at 01:00 UTC)');
}

export function stopTrialExpiryJob(): void {
  // node-cron tasks stop automatically on process exit
}
