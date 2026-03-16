import cron from 'node-cron';
import { pool } from '../config/database';
import { logError, logInfo } from '../utils/logger';

const LOG_MODULE = 'recoveryTimelineJob';

async function getAllActiveCompanyIds(): Promise<string[]> {
  const result = await pool.query(`
    SELECT DISTINCT id FROM companies
    WHERE id IN (
      SELECT DISTINCT company_id FROM invoices
    )
  `);
  return result.rows.map((r: any) => r.id);
}

/**
 * Aggregate daily stats for a company on a specific date and UPSERT into recovery_timeline.
 */
async function aggregateAndUpsertDay(companyId: string, date: Date): Promise<void> {
  const periodDate = date.toISOString().slice(0, 10);  // YYYY-MM-DD
  const dayStart = `${periodDate}T00:00:00.000Z`;
  const dayEnd   = `${periodDate}T23:59:59.999Z`;

  // Aggregate invoices created on this day
  const invoiceStats = await pool.query(`
    SELECT
      COUNT(*)::int                                                         AS invoices_created,
      COALESCE(SUM(amount), 0)::float                                       AS amount_created,
      COUNT(*) FILTER (WHERE status = 'paid')::int                          AS invoices_recovered,
      COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0)::float        AS amount_recovered
    FROM invoices
    WHERE company_id = $1
      AND issued_date BETWEEN $2 AND $3
  `, [companyId, dayStart, dayEnd]);

  // Aggregate payments received on this day (for "recovered" by payment date)
  const paymentStats = await pool.query(`
    SELECT
      COUNT(*)::int                       AS payments_count,
      COALESCE(SUM(p.amount), 0)::float   AS payments_amount,
      COALESCE(
        AVG(
          EXTRACT(EPOCH FROM (p.paid_at - i.issued_date)) / 86400.0
        ), 0
      )::float                            AS avg_days_to_collect
    FROM payments p
    JOIN invoices i ON p.invoice_id = i.id
    WHERE p.company_id = $1
      AND p.paid_at BETWEEN $2 AND $3
      AND p.status = 'succeeded'
  `, [companyId, dayStart, dayEnd]);

  // Aggregate email activity on this day
  const emailStats = await pool.query(`
    SELECT
      COUNT(*)::int                                               AS emails_sent,
      COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::int         AS emails_opened,
      COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::int        AS emails_clicked
    FROM email_logs
    WHERE company_id = $1
      AND sent_at BETWEEN $2 AND $3
  `, [companyId, dayStart, dayEnd]);

  const inv  = invoiceStats.rows[0];
  const pay  = paymentStats.rows[0];
  const eml  = emailStats.rows[0];

  // Use payment-based recovered amounts (more accurate than status-based)
  const amountRecovered = pay.payments_amount > 0
    ? pay.payments_amount
    : inv.amount_recovered;

  await pool.query(`
    INSERT INTO recovery_timeline (
      company_id, period_date, period_type,
      invoices_created, invoices_recovered,
      amount_created, amount_recovered,
      emails_sent, emails_opened, emails_clicked,
      avg_days_to_collect
    ) VALUES ($1, $2, 'daily', $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (company_id, period_date, period_type) DO UPDATE SET
      invoices_created      = EXCLUDED.invoices_created,
      invoices_recovered    = EXCLUDED.invoices_recovered,
      amount_created        = EXCLUDED.amount_created,
      amount_recovered      = EXCLUDED.amount_recovered,
      emails_sent           = EXCLUDED.emails_sent,
      emails_opened         = EXCLUDED.emails_opened,
      emails_clicked        = EXCLUDED.emails_clicked,
      avg_days_to_collect   = EXCLUDED.avg_days_to_collect
  `, [
    companyId,
    periodDate,
    inv.invoices_created,
    inv.invoices_recovered,
    inv.amount_created,
    amountRecovered,
    eml.emails_sent,
    eml.emails_opened,
    eml.emails_clicked,
    pay.avg_days_to_collect,
  ]);
}

/**
 * Run the timeline aggregation: backfill last 7 days for all companies.
 * Idempotent — safe to run multiple times (UPSERT).
 */
async function runTimelineAggregation(): Promise<{ companies: number; daysProcessed: number }> {
  const method = 'runTimelineAggregation';
  logInfo(LOG_MODULE, method, 'Starting recovery timeline aggregation');

  const companyIds = await getAllActiveCompanyIds();
  logInfo(LOG_MODULE, method, `Aggregating timeline for ${companyIds.length} companies`);

  const daysToBackfill = 7;
  let daysProcessed = 0;

  for (const companyId of companyIds) {
    for (let i = 0; i < daysToBackfill; i++) {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - i);

      try {
        await aggregateAndUpsertDay(companyId, date);
        daysProcessed++;
      } catch (err) {
        logError(LOG_MODULE, method, `Failed to aggregate day ${date.toISOString().slice(0, 10)}`, err, { companyId });
      }
    }
  }

  logInfo(LOG_MODULE, method, 'Timeline aggregation complete', {
    companies: companyIds.length,
    daysProcessed,
  });

  return { companies: companyIds.length, daysProcessed };
}

export function startRecoveryTimelineJob(): void {
  // Run on boot after 90s to backfill last 7 days
  setTimeout(() => {
    runTimelineAggregation().catch(err =>
      logError(LOG_MODULE, 'startupRun', 'Startup timeline aggregation failed', err)
    );
  }, 90_000);

  // Run daily at 01:00 AM UTC via cron (no Redis needed)
  cron.schedule('0 1 * * *', () => {
    runTimelineAggregation().catch(err =>
      logError(LOG_MODULE, 'cronRun', 'Daily timeline aggregation failed', err)
    );
  });

  logInfo(LOG_MODULE, 'startRecoveryTimelineJob', 'Recovery timeline job started (runs daily at 01:00 UTC via cron, startup in 90s)');
}

export function stopRecoveryTimelineJob(): void {
  // node-cron tasks stop automatically on process exit — nothing to clean up
}
