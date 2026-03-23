import cron from 'node-cron';
import { pool } from '../config/database';
import { runBillingOptimization } from '../services/billingOptimizationService';
import { logInfo, logError } from '../utils/logger';

const MODULE = 'BillingOptimizationJob';

let task: ReturnType<typeof cron.schedule> | null = null;

async function runWeeklyScan(): Promise<void> {
  logInfo(MODULE, 'runWeeklyScan', 'Starting weekly billing optimization scan');
  try {
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM companies
       WHERE subscription_status IN ('trialing', 'active')
       ORDER BY created_at ASC`
    );

    let totalAnomalies = 0;
    let totalImpact = 0;

    for (const { id } of rows) {
      try {
        const result = await runBillingOptimization(id);
        totalAnomalies += result.anomaliesCreated;
        totalImpact += result.totalEstimatedImpact;
      } catch (err) {
        logError(MODULE, 'runWeeklyScan', 'Error scanning company', err, { companyId: id });
      }
    }

    logInfo(MODULE, 'runWeeklyScan', 'Weekly scan complete', {
      companiesScanned: rows.length,
      totalAnomalies,
      totalImpact: Math.round(totalImpact),
    });
  } catch (err) {
    logError(MODULE, 'runWeeklyScan', 'Weekly scan failed', err);
  }
}

export function startBillingOptimizationJob(): void {
  // Run every Sunday at 02:00 UTC
  task = cron.schedule('0 2 * * 0', runWeeklyScan, { timezone: 'UTC' });
  logInfo(MODULE, 'startBillingOptimizationJob', 'Billing optimization job scheduled (weekly Sunday 02:00 UTC)');
}

export function stopBillingOptimizationJob(): void {
  if (task) {
    task.stop();
    task = null;
    logInfo(MODULE, 'stopBillingOptimizationJob', 'Billing optimization job stopped');
  }
}
