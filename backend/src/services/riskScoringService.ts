import { pool } from '../config/database';
import { redisClient } from '../config/redis';
import { logInfo, logError } from '../utils/logger';

const MODULE = 'RiskScoringService';

export interface RiskSignal {
  type: 'payment_failure_history' | 'card_expiring' | 'amount_spike' | 'inactivity' | 'hard_decline' | 'invoice_aging' | 'multiple_hard_declines';
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
 * Simple CSV import scoring: based only on days overdue.
 * Used during CSV import when we have no payment behavior yet.
 * Once Stripe syncs or payments happen, full scoreCustomerRisk() takes over.
 */
export function scoreCustomerRiskFromDaysOverdue(maxDaysOverdue: number): number {
  if (maxDaysOverdue > 90) return 80;   // Very old → high risk
  if (maxDaysOverdue > 60) return 60;   // Old → medium-high risk
  if (maxDaysOverdue > 30) return 40;   // Getting stale → medium risk
  if (maxDaysOverdue > 0) return 20;    // A few days late → low risk
  return 10;                             // On time or future → minimal risk
}

/**
 * Score a customer's payment failure risk (0-100).
 * Uses 7 signals: payment failures, card expiry, amount spike, inactivity, hard declines, invoice aging, multiple declines.
 * Score >= 40 = at-risk, >= 60 = high risk (proactive email triggered).
 * Called after Stripe sync, payment attempts, or daily recalc — NOT on CSV import.
 */
export async function scoreCustomerRisk(
  companyId: string,
  customerId: string
): Promise<{ score: number; signals: RiskSignal[] }> {
  const signals: RiskSignal[] = [];

  try {
    // ✅ Single CTE query — all signals in one round-trip
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
         (SELECT COUNT(*) FROM invoices WHERE customer_id = $2 AND company_id = $1 AND last_decline_type = 'hard') AS hard_decline_count,
         (SELECT MAX(CEIL(EXTRACT(EPOCH FROM (NOW() - i.due_date)) / 86400)::INT)
          FROM invoices i
          WHERE customer_id = $2 AND company_id = $1 AND status = 'unpaid' AND i.due_date < NOW()
         ) AS max_days_overdue,
         (SELECT COUNT(*) FROM invoices
          WHERE customer_id = $2 AND company_id = $1 AND status = 'unpaid'
            AND due_date < NOW() - INTERVAL '61 days'
         ) AS invoices_90plus_days_overdue,
         (SELECT COUNT(*) FROM invoices
          WHERE customer_id = $2 AND company_id = $1 AND status = 'unpaid'
            AND due_date >= NOW() - INTERVAL '61 days' AND due_date < NOW() - INTERVAL '30 days'
         ) AS invoices_61_to_90_days_overdue
       FROM customers c
       WHERE c.id = $2 AND c.company_id = $1`,
      [companyId, customerId]
    );

    if (result.rows.length === 0) return { score: 0, signals: [] };

    const row = result.rows[0];

    // Signal 1: Payment failures in last 90d
    if (parseInt(row.failed_count) > 0) {
      signals.push({ type: 'payment_failure_history', description: 'Failed payment in last 90 days', weight: 20 });
    }

    // Signal 2: Card expiring soon (within 30 days)
    if (row.card_expires_at) {
      const daysUntilExpiry = Math.ceil((new Date(row.card_expires_at).getTime() - Date.now()) / 86400000);
      if (daysUntilExpiry <= 30 && daysUntilExpiry >= 0) {
        signals.push({ type: 'card_expiring', description: `Card expires in ${daysUntilExpiry} days`, weight: 20 });
      }
    }

    // Signal 3: Amount spike (40%+ above average)
    if (row.avg_amount && row.max_unpaid && parseFloat(row.max_unpaid) > parseFloat(row.avg_amount) * 1.4) {
      signals.push({ type: 'amount_spike', description: 'Current invoice 40%+ above average', weight: 20 });
    }

    // Signal 4: Inactivity (21+ days without activity)
    if (row.last_activity_at) {
      const daysSinceActivity = Math.ceil((Date.now() - new Date(row.last_activity_at).getTime()) / 86400000);
      if (daysSinceActivity >= 21) {
        signals.push({ type: 'inactivity', description: `No activity for ${daysSinceActivity} days`, weight: 20 });
      }
    }

    // Signal 5: Hard decline on payment attempt
    if (parseInt(row.hard_decline_count) > 0) {
      signals.push({ type: 'hard_decline', description: 'Hard decline on last payment attempt', weight: 20 });
    }

    // Signal 6: Invoice aging (91+ days overdue = invoice kab se delay hai)
    const maxDaysOverdue = parseInt(row.max_days_overdue) || 0;
    if (maxDaysOverdue > 90) {
      signals.push({
        type: 'invoice_aging',
        description: `Invoice overdue ${maxDaysOverdue} days — severe aging`,
        weight: 20
      });
    }

    // Signal 7: Multiple hard declines (2+ hard declines = persistent problem)
    if (parseInt(row.hard_decline_count) > 1) {
      signals.push({
        type: 'multiple_hard_declines',
        description: `Multiple hard declines (${row.hard_decline_count}) — persistent payment issues`,
        weight: 20
      });
    }

    // Cap score at 100 (max 7 signals × 20 = 140, but we cap at 100)
    const score = Math.min(signals.reduce((sum, s) => sum + s.weight, 0), 100);

    // ✅ SAVE to database immediately (event-driven)
    try {
      await pool.query(
        `UPDATE customers
         SET customer_risk_score = $1, customer_risk_score_updated_at = NOW()
         WHERE id = $2 AND company_id = $3`,
        [score, customerId, companyId]
      );
      logInfo(MODULE, 'scoreCustomerRisk', 'Risk score saved', { customerId, score, signalCount: signals.length });
    } catch (dbErr) {
      logError(MODULE, 'scoreCustomerRisk', 'Failed to save score to DB', dbErr);
      // Don't throw — continue returning the calculated score
    }

    return { score, signals };
  } catch (err: unknown) {
    logError(MODULE, 'scoreCustomerRisk', err instanceof Error ? err.message : String(err));
    return { score: 0, signals: [] };
  }
}

// ============================================================
// PHASE 3: Tier classification (pure function — no DB calls)
// ============================================================

/**
 * Assign a 1-4 tier to a customer based on risk score + days overdue.
 * Uses a weighted blend: 60% risk score, 40% DSO (capped at 90d).
 *
 *  Tier 1 (Green):  combined < 30  → gentle 7d-gap dunning
 *  Tier 2 (Yellow): combined 30-54 → standard 6d-gap dunning
 *  Tier 3 (Orange): combined 55-74 → aggressive 5d-gap + SMS
 *  Tier 4 (Red):    combined >= 75 → critical: 4d-gap + SMS + voice queue
 */
export function calculateCustomerTier(riskScore: number, daysOverdue: number): 1 | 2 | 3 | 4 {
  const dsoScore = Math.min(100, (daysOverdue / 90) * 100);
  const combined = riskScore * 0.6 + dsoScore * 0.4;

  if (combined < 30) return 1;
  if (combined < 55) return 2;
  if (combined < 75) return 3;
  return 4;
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
