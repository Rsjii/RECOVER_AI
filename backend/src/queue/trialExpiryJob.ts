import cron from 'node-cron';
import { pool } from '../config/database';
import { logError, logInfo } from '../utils/logger';

const LOG_MODULE = 'trialExpiryJob';

async function expireTrials(): Promise<void> {
  const result = await pool.query<{ company_id: string }>(
    `UPDATE subscriptions
     SET status = 'past_due', updated_at = NOW()
     WHERE status = 'trialing'
       AND trial_ends_at IS NOT NULL
       AND trial_ends_at < NOW()
     RETURNING company_id`
  );

  if (result.rowCount && result.rowCount > 0) {
    logInfo(LOG_MODULE, 'expireTrials', `Expired ${result.rowCount} trial(s)`, {
      companyIds: result.rows.map((r) => r.company_id),
    });
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
