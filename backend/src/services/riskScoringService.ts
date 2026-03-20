import { pool } from '../config/database';
import { redisClient } from '../config/redis';
import { logInfo, logError } from '../utils/logger';

const MODULE = 'RiskScoringService';

export interface RiskSignal {
  type: 'payment_failure_history' | 'card_expiring' | 'amount_spike' | 'inactivity' | 'hard_decline';
  description: string;
  weight: number;
}

export interface AtRiskCustomer {
  customerId: string;
  name: string;
  email: string;
  score: number;           // 0-100
  signals: RiskSignal[];
  invoiceId: string | null;
  invoiceAmount: number | null;
  daysUntilDue: number | null;
  currency: string;
}

/**
 * Score a customer's payment failure risk (0-100).
 * Each of 5 signals contributes 20 points.
 * Score >= 40 = at-risk, >= 60 = high risk (proactive email triggered).
 */
export async function scoreCustomerRisk(
  companyId: string,
  customerId: string
): Promise<{ score: number; signals: RiskSignal[] }> {
  const signals: RiskSignal[] = [];

  try {
    // ✅ Single CTE query — replaces 4 separate round-trips
    const result = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM payments
          WHERE company_id = $1
            AND invoice_id IN (SELECT id FROM invoices WHERE customer_id = $2)
            AND status = 'failed'
            AND paid_at > NOW() - INTERVAL '90 days'
         ) AS failed_count,
         c.card_expires_at,
         c.last_activity_at,
         (SELECT AVG(amount) FROM invoices WHERE customer_id = $2 AND company_id = $1) AS avg_amount,
         (SELECT MAX(amount) FROM invoices WHERE customer_id = $2 AND company_id = $1 AND status = 'unpaid') AS max_unpaid,
         (SELECT COUNT(*) FROM invoices WHERE customer_id = $2 AND company_id = $1 AND last_decline_type = 'hard') AS hard_decline_count
       FROM customers c
       WHERE c.id = $2 AND c.company_id = $1`,
      [companyId, customerId]
    );

    if (result.rows.length === 0) return { score: 0, signals: [] };

    const row = result.rows[0];

    if (parseInt(row.failed_count) > 0) {
      signals.push({ type: 'payment_failure_history', description: 'Failed payment in last 90 days', weight: 20 });
    }
    if (row.card_expires_at) {
      const daysUntilExpiry = Math.ceil((new Date(row.card_expires_at).getTime() - Date.now()) / 86400000);
      if (daysUntilExpiry <= 30 && daysUntilExpiry >= 0) {
        signals.push({ type: 'card_expiring', description: `Card expires in ${daysUntilExpiry} days`, weight: 20 });
      }
    }
    if (row.avg_amount && row.max_unpaid && parseFloat(row.max_unpaid) > parseFloat(row.avg_amount) * 1.4) {
      signals.push({ type: 'amount_spike', description: 'Current invoice 40%+ above average', weight: 20 });
    }
    if (row.last_activity_at) {
      const daysSinceActivity = Math.ceil((Date.now() - new Date(row.last_activity_at).getTime()) / 86400000);
      if (daysSinceActivity >= 21) {
        signals.push({ type: 'inactivity', description: `No activity for ${daysSinceActivity} days`, weight: 20 });
      }
    }
    if (parseInt(row.hard_decline_count) > 0) {
      signals.push({ type: 'hard_decline', description: 'Hard decline on last payment attempt', weight: 20 });
    }

    const score = Math.min(signals.reduce((sum, s) => sum + s.weight, 0), 100);
    return { score, signals };
  } catch (err: unknown) {
    logError(MODULE, 'scoreCustomerRisk', err instanceof Error ? err.message : String(err));
    return { score: 0, signals: [] };
  }
}

/**
 * Get all at-risk customers for a company (score >= 40).
 * Returns sorted by score descending.
 */
export async function getAtRiskCustomers(companyId: string): Promise<AtRiskCustomer[]> {
  const cacheKey = `at-risk:${companyId}`;

  // ✅ Return cached result if fresh (30s TTL)
  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached) as AtRiskCustomer[];
  } catch { /* Redis unavailable — proceed without cache */ }

  try {
    // Fetch all customers with open invoices
    const customersResult = await pool.query(
      `SELECT
         c.id AS customer_id,
         c.name,
         c.email,
         i.id AS invoice_id,
         i.amount AS invoice_amount,
         i.currency,
         CEIL(EXTRACT(EPOCH FROM (i.due_date - NOW())) / 86400)::INT AS days_until_due
       FROM customers c
       JOIN invoices i ON i.customer_id = c.id AND i.company_id = c.company_id
       WHERE c.company_id = $1
         AND i.status = 'unpaid'
         AND i.dunning_stopped = FALSE
         AND c.do_not_email = FALSE
       ORDER BY i.due_date ASC`,
      [companyId]
    );

    // ✅ Score all customers in PARALLEL (not sequential)
    const scored = await Promise.all(
      customersResult.rows.map(async (row) => {
        const { score, signals } = await scoreCustomerRisk(companyId, row.customer_id);
        return { row, score, signals };
      })
    );

    const atRiskList: AtRiskCustomer[] = scored
      .filter(({ score }) => score >= 40)
      .map(({ row, score, signals }) => ({
        customerId: row.customer_id,
        name: row.name,
        email: row.email,
        score,
        signals,
        invoiceId: row.invoice_id,
        invoiceAmount: parseFloat(row.invoice_amount),
        daysUntilDue: row.days_until_due,
        currency: row.currency || 'USD',
      }));

    logInfo(MODULE, 'getAtRiskCustomers', `Found ${atRiskList.length} at-risk customers`, { companyId });

    const sorted = atRiskList.sort((a, b) => b.score - a.score);

    // ✅ Cache result for 30 seconds
    try { await redisClient.setEx(cacheKey, 30, JSON.stringify(sorted)); } catch {}

    return sorted;
  } catch (err: unknown) {
    logError(MODULE, 'getAtRiskCustomers', err instanceof Error ? err.message : String(err));
    return [];
  }
}
