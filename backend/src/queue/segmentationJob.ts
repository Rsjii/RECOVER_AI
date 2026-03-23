import cron from 'node-cron';
import { pool } from '../config/database';
import { calculateCustomerTier } from '../services/riskScoringService';
import { updateCustomerTier } from '../db/customers';
import { logError, logInfo } from '../utils/logger';

const LOG_MODULE = 'segmentationJob';

interface CustomerSegmentRow {
  id: string;
  company_id: string;
  risk_tier: number | null;
  max_risk_score: number;
  max_days_overdue: number;
}

/**
 * Run tier recalculation for all companies.
 * For each customer with active invoices, compute tier from risk_score + DSO.
 * Updates customers.risk_tier and logs changes to customer_tier_history.
 */
async function runSegmentation(): Promise<{ updated: number; unchanged: number; errors: number }> {
  const method = 'runSegmentation';
  logInfo(LOG_MODULE, method, 'Starting customer segmentation run');

  let updated = 0;
  let unchanged = 0;
  let errors = 0;

  try {
    // Single query: all customers with unpaid invoices, their max risk_score and max days overdue
    const result = await pool.query<CustomerSegmentRow>(
      `SELECT
         c.id,
         c.company_id,
         c.risk_tier,
         COALESCE(MAX(i.risk_score), 0)::int AS max_risk_score,
         COALESCE(MAX(
           GREATEST(0, EXTRACT(EPOCH FROM (NOW() - i.due_date)) / 86400)
         ), 0)::int AS max_days_overdue
       FROM customers c
       JOIN invoices i ON i.customer_id = c.id AND i.company_id = c.company_id
       WHERE i.status NOT IN ('paid', 'uncollectable')
       GROUP BY c.id, c.company_id, c.risk_tier`
    );

    logInfo(LOG_MODULE, method, `Processing ${result.rows.length} customers with active invoices`);

    for (const row of result.rows) {
      try {
        const newTier = calculateCustomerTier(row.max_risk_score, row.max_days_overdue);
        const currentTier = row.risk_tier ?? 2;

        if (newTier !== currentTier) {
          await updateCustomerTier(row.id, row.company_id, newTier, 'scheduled_recalculation');
          updated++;
          logInfo(LOG_MODULE, method, 'Tier updated', {
            customerId: row.id,
            oldTier: currentTier,
            newTier,
            riskScore: row.max_risk_score,
            daysOverdue: row.max_days_overdue,
          });
        } else {
          // Still write the updated_at timestamp even if tier unchanged
          await pool.query(
            `UPDATE customers SET risk_tier = $1, risk_tier_updated_at = NOW() WHERE id = $2`,
            [newTier, row.id]
          );
          unchanged++;
        }
      } catch (err) {
        logError(LOG_MODULE, method, 'Error processing customer', err, { customerId: row.id });
        errors++;
      }
    }
  } catch (err) {
    logError(LOG_MODULE, method, 'Fatal error in segmentation run', err);
    errors++;
  }

  const summary = { updated, unchanged, errors };
  logInfo(LOG_MODULE, method, 'Segmentation run complete', summary);
  return summary;
}

/**
 * Start the daily segmentation cron.
 * Runs at 02:00 UTC daily (same window as AR agent sleep cycle).
 * Also runs once 90 seconds after boot to seed initial tiers.
 */
export function startSegmentationJob(): void {
  // Startup run — slight delay so DB connections settle
  setTimeout(() => {
    runSegmentation().catch(err =>
      logError(LOG_MODULE, 'startupRun', 'Startup segmentation failed', err)
    );
  }, 90_000);

  // Daily at 02:00 UTC
  cron.schedule('0 2 * * *', () => {
    runSegmentation().catch(err =>
      logError(LOG_MODULE, 'cronRun', 'Scheduled segmentation failed', err)
    );
  });

  logInfo(LOG_MODULE, 'startSegmentationJob', 'Segmentation job scheduled (daily 02:00 UTC, startup in 90s)');
}

/**
 * Run segmentation synchronously — for manual trigger via admin endpoint.
 */
export async function runSegmentationNow(): Promise<{ updated: number; unchanged: number; errors: number }> {
  logInfo(LOG_MODULE, 'runSegmentationNow', 'Manual segmentation run starting');
  return runSegmentation();
}
