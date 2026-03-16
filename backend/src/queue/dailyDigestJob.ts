import cron from 'node-cron';
import { sendDailyDigest } from '../services/slackService';
import { getRecoveryStats } from '../db/dashboard';
import { pool } from '../config/database';
import { logError, logInfo } from '../utils/logger';

async function countEmailsSentToday(companyId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) FROM email_logs
     WHERE company_id = $1
       AND sent_at >= NOW() - INTERVAL '24 hours'`,
    [companyId]
  );
  return parseInt(result.rows[0].count);
}

async function getAllCompanyIds(): Promise<string[]> {
  const result = await pool.query(
    `SELECT DISTINCT company_id FROM invoices WHERE status != 'paid'`
  );
  return result.rows.map((r: any) => r.company_id);
}

async function runDailyDigest(): Promise<void> {
  const method = 'runDailyDigest';
  logInfo('dailyDigestJob', method, 'Processing daily digest');

  const companyIds = await getAllCompanyIds();

  for (const companyId of companyIds) {
    try {
      const stats = await getRecoveryStats(companyId);
      const emailsSentToday = await countEmailsSentToday(companyId);

      const { pool: db } = await import('../config/database');
      const companyResult = await db.query(
        'SELECT slack_webhook_url_encrypted FROM companies WHERE id = $1',
        [companyId]
      );
      const company = companyResult.rows[0];

      let webhookUrl: string | undefined;
      if (company?.slack_webhook_url_encrypted) {
        const { decryptField } = await import('../lib/encryption');
        webhookUrl = decryptField(company.slack_webhook_url_encrypted);
      }

      await sendDailyDigest({
        totalOwed: stats.totalOwed,
        totalRecovered: stats.totalRecovered,
        recoveryRate: stats.recoveryRate,
        overdueCount: stats.overdueCount,
        emailsSentToday,
        webhookUrl,
      });

      logInfo('dailyDigestJob', method, 'Digest sent', { companyId });
    } catch (err) {
      logError('dailyDigestJob', method, 'Failed to send digest for company', err, { companyId });
    }
  }
}

export function startDailyDigestWorker(): void {
  // Run daily at 8:00 AM UTC via cron (no Redis needed)
  cron.schedule('0 8 * * *', () => {
    runDailyDigest().catch(err =>
      logError('dailyDigestJob', 'cronRun', 'Daily digest cron failed', err)
    );
  });

  logInfo('dailyDigestJob', 'startDailyDigestWorker', 'Daily digest started (runs daily at 08:00 UTC via cron)');
}

export function stopDailyDigestWorker(): void {
  // node-cron tasks stop automatically on process exit — nothing to clean up
}
