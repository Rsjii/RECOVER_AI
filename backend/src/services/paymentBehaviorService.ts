import { pool } from '../config/database';
import { logError, logInfo } from '../utils/logger';

const MODULE = 'paymentBehaviorService';

/**
 * Find the modal (most common) value in an array of numbers.
 */
function findModal(arr: number[]): number {
  const freq: Record<number, number> = {};
  for (const v of arr) freq[v] = (freq[v] || 0) + 1;
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  return parseInt(sorted[0][0]);
}

/**
 * Return the next UTC datetime matching the given dayOfWeek (0=Sun) and hour (0-23).
 * Guarantees at least 1 hour in the future.
 */
function getNextOccurrence(dayOfWeek: number, hour: number): Date {
  const now = new Date();
  const candidate = new Date(now);
  candidate.setUTCHours(hour, 0, 0, 0);

  const currentDay = now.getUTCDay();
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil < 0) daysUntil += 7;
  // If same day but time already passed (or within 1h), push to next week
  if (daysUntil === 0 && candidate.getTime() - now.getTime() < 60 * 60 * 1000) {
    daysUntil = 7;
  }

  candidate.setUTCDate(candidate.getUTCDate() + daysUntil);
  return candidate;
}

/**
 * Determine the optimal time to retry a payment for a given customer.
 *
 * Strategy: look at the last 20 successful payments and find the most common
 * hour-of-day + day-of-week combination. If <3 samples exist, fall back to 24h from now.
 */
export async function getOptimalRetryTime(companyId: string, customerId: string): Promise<Date> {
  const method = 'getOptimalRetryTime';
  try {
    const result = await pool.query(
      `SELECT p.paid_at
       FROM payments p
       JOIN invoices i ON p.invoice_id = i.id
       WHERE i.customer_id = $1
         AND p.company_id = $2
         AND p.status = 'succeeded'
         AND p.paid_at IS NOT NULL
       ORDER BY p.paid_at DESC
       LIMIT 20`,
      [customerId, companyId]
    );

    if (result.rows.length < 3) {
      logInfo(MODULE, method, 'Insufficient payment history — using 24h default', { customerId, samples: result.rows.length });
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    const hours: number[] = [];
    const days: number[] = [];
    for (const row of result.rows) {
      const d = new Date(row.paid_at);
      hours.push(d.getUTCHours());
      days.push(d.getUTCDay());
    }

    const modalHour = findModal(hours);
    const modalDay = findModal(days);
    const optimalTime = getNextOccurrence(modalDay, modalHour);

    logInfo(MODULE, method, 'Optimal retry time computed', {
      customerId,
      samples: result.rows.length,
      modalHour,
      modalDay,
      optimalTime: optimalTime.toISOString(),
    });

    return optimalTime;
  } catch (err) {
    logError(MODULE, method, 'Failed — falling back to 24h default', err);
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
}

/**
 * Extend customers.payment_history JSONB with optimal retry fields.
 * Merges into existing JSONB without overwriting on_time_rate / avg_days_late etc.
 * Non-blocking — never throws.
 */
export async function updateOptimalRetryProfile(companyId: string, customerId: string): Promise<void> {
  const method = 'updateOptimalRetryProfile';
  try {
    const result = await pool.query(
      `SELECT p.paid_at
       FROM payments p
       JOIN invoices i ON p.invoice_id = i.id
       WHERE i.customer_id = $1
         AND p.company_id = $2
         AND p.status = 'succeeded'
         AND p.paid_at IS NOT NULL
       ORDER BY p.paid_at DESC
       LIMIT 20`,
      [customerId, companyId]
    );

    if (result.rows.length < 3) return;

    const hours: number[] = [];
    const days: number[] = [];
    let softDeclineSuccesses = 0;
    let softDeclineAttempts = 0;

    for (const row of result.rows) {
      const d = new Date(row.paid_at);
      hours.push(d.getUTCHours());
      days.push(d.getUTCDay());
    }

    // Count soft decline retry success rate
    const retryResult = await pool.query(
      `SELECT result FROM payment_retries
       WHERE company_id = $1
         AND invoice_id IN (SELECT id FROM invoices WHERE customer_id = $2)`,
      [companyId, customerId]
    );
    for (const r of retryResult.rows) {
      softDeclineAttempts++;
      if (r.result === 'success') softDeclineSuccesses++;
    }

    const modalHour = findModal(hours);
    const modalDay = findModal(days);
    const successRate = softDeclineAttempts > 0
      ? Math.round((softDeclineSuccesses / softDeclineAttempts) * 100)
      : 0;

    await pool.query(
      `UPDATE customers
       SET payment_history = payment_history || $1::jsonb,
           updated_at = NOW()
       WHERE id = $2 AND company_id = $3`,
      [
        JSON.stringify({
          optimal_retry_hour: modalHour,
          optimal_retry_day: modalDay,
          success_rate_after_soft_decline: successRate,
        }),
        customerId,
        companyId,
      ]
    );

    logInfo(MODULE, method, 'Optimal retry profile updated', {
      customerId,
      modalHour,
      modalDay,
      successRate,
    });
  } catch (err) {
    logError(MODULE, method, 'Failed (non-blocking)', err);
  }
}
