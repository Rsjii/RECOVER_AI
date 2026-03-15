import { Worker, Queue } from 'bullmq';
import { getRedisConnection } from './dunningQueue';
import { sendDailyDigest } from '../services/slackService';
import { getRecoveryStats } from '../db/dashboard';
import { pool } from '../config/database';
import { logError, logInfo } from '../utils/logger';

const DIGEST_QUEUE = 'daily-digest';

let digestQueue: Queue | null = null;
let digestWorker: Worker | null = null;

function getDigestQueue(): Queue {
  if (!digestQueue) {
    digestQueue = new Queue(DIGEST_QUEUE, { connection: getRedisConnection() });
    digestQueue.on('error', (err: Error) => {
      logError('dailyDigestJob', 'queue', 'Digest queue connection issue', err);
    });
  }
  return digestQueue;
}

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

export function startDailyDigestWorker(): void {
  try {
    const connection = getRedisConnection();

    digestWorker = new Worker(
      DIGEST_QUEUE,
      async (job) => {
        const method = 'dailyDigestWorker';
        logInfo('dailyDigestJob', method, 'Processing daily digest job');

        const companyIds = await getAllCompanyIds();

        for (const companyId of companyIds) {
          try {
            const stats = await getRecoveryStats(companyId);
            const emailsSentToday = await countEmailsSentToday(companyId);

            // Get Slack webhook from company settings
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
      },
      { connection }
    );

    digestWorker.on('failed', (job, err) => {
      logError('dailyDigestJob', 'worker', 'Job failed', err, { jobId: job?.id });
    });

    digestWorker.on('error', (err: Error) => {
      logError('dailyDigestJob', 'worker', 'Worker connection issue', err);
    });

    // Schedule daily at 8:00 AM UTC
    scheduleDaily();

    logInfo('dailyDigestJob', 'startDailyDigestWorker', 'Daily digest worker started');
  } catch (err) {
    logError('dailyDigestJob', 'startDailyDigestWorker', 'Failed to start digest worker', err);
  }
}

async function scheduleDaily(): Promise<void> {
  try {
    const queue = getDigestQueue();
    // Remove existing repeatable job first to avoid duplicates
    await queue.removeRepeatable('daily-digest', { pattern: '0 8 * * *' });
    await queue.add(
      'daily-digest',
      {},
      {
        repeat: { pattern: '0 8 * * *' },  // 8 AM UTC daily
        jobId: 'daily-digest-cron',
      }
    );
    logInfo('dailyDigestJob', 'scheduleDaily', 'Daily digest cron scheduled (8:00 AM UTC)');
  } catch (err) {
    logError('dailyDigestJob', 'scheduleDaily', 'Failed to schedule digest cron', err);
  }
}

export async function stopDailyDigestWorker(): Promise<void> {
  try {
    await digestWorker?.close();
    await digestQueue?.close();
    logInfo('dailyDigestJob', 'stop', 'Daily digest worker stopped');
  } catch (err) {
    logError('dailyDigestJob', 'stop', 'Error stopping digest worker', err);
  }
}
