import { pool } from '../config/database';
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
    // Signal 1: Failed payment in last 90 days
    const failedPayments = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM payments
       WHERE company_id = $1
         AND invoice_id IN (SELECT id FROM invoices WHERE customer_id = $2)
         AND status = 'failed'
         AND paid_at > NOW() - INTERVAL '90 days'`,
      [companyId, customerId]
    );
    if (parseInt(failedPayments.rows[0].cnt) > 0) {
      signals.push({
        type: 'payment_failure_history',
        description: 'Failed payment in last 90 days',
        weight: 20,
      });
    }

    // Signal 2: Card expires within 30 days
    const customer = await pool.query(
      `SELECT card_expires_at, last_activity_at FROM customers WHERE id = $1 AND company_id = $2`,
      [customerId, companyId]
    );
    if (customer.rows.length > 0) {
      const { card_expires_at, last_activity_at } = customer.rows[0];
      if (card_expires_at) {
        const daysUntilExpiry = Math.ceil(
          (new Date(card_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        if (daysUntilExpiry <= 30 && daysUntilExpiry >= 0) {
          signals.push({
            type: 'card_expiring',
            description: `Card expires in ${daysUntilExpiry} days`,
            weight: 20,
          });
        }
      }

      // Signal 4: No activity in last 21 days
      if (last_activity_at) {
        const daysSinceActivity = Math.ceil(
          (Date.now() - new Date(last_activity_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceActivity >= 21) {
          signals.push({
            type: 'inactivity',
            description: `No activity for ${daysSinceActivity} days`,
            weight: 20,
          });
        }
      }
    }

    // Signal 3: Invoice amount > avg by 40%+
    const amountCheck = await pool.query(
      `SELECT
         AVG(amount) AS avg_amount,
         MAX(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END) AS current_unpaid
       FROM invoices
       WHERE customer_id = $1 AND company_id = $2`,
      [customerId, companyId]
    );
    if (amountCheck.rows.length > 0) {
      const { avg_amount, current_unpaid } = amountCheck.rows[0];
      if (avg_amount && current_unpaid && parseFloat(current_unpaid) > parseFloat(avg_amount) * 1.4) {
        signals.push({
          type: 'amount_spike',
          description: `Current invoice 40%+ above average`,
          weight: 20,
        });
      }
    }

    // Signal 5: Hard decline on last attempt
    const declineCheck = await pool.query(
      `SELECT last_decline_type FROM invoices
       WHERE customer_id = $1 AND company_id = $2 AND last_decline_type = 'hard'
       LIMIT 1`,
      [customerId, companyId]
    );
    if (declineCheck.rows.length > 0) {
      signals.push({
        type: 'hard_decline',
        description: 'Hard decline on last payment attempt',
        weight: 20,
      });
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

    const atRiskList: AtRiskCustomer[] = [];

    for (const row of customersResult.rows) {
      const { score, signals } = await scoreCustomerRisk(companyId, row.customer_id);
      if (score >= 40) {
        atRiskList.push({
          customerId: row.customer_id,
          name: row.name,
          email: row.email,
          score,
          signals,
          invoiceId: row.invoice_id,
          invoiceAmount: parseFloat(row.invoice_amount),
          daysUntilDue: row.days_until_due,
          currency: row.currency || 'USD',
        });
      }
    }

    logInfo(MODULE, 'getAtRiskCustomers', `Found ${atRiskList.length} at-risk customers`, { companyId });

    // Sort by score descending
    return atRiskList.sort((a, b) => b.score - a.score);
  } catch (err: unknown) {
    logError(MODULE, 'getAtRiskCustomers', err instanceof Error ? err.message : String(err));
    return [];
  }
}
