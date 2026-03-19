import { pool } from '../config/database';
import { logInfo, logError } from '../utils/logger';

const MODULE = 'CashPositionService';

export interface CashPosition {
  currentBalance: number;        // manually entered cash balance
  balance30: number;             // projected cash in 30 days
  balance60: number;             // projected cash in 60 days
  balance90: number;             // projected cash in 90 days
  pendingInvoices30: number;     // AR expected to be collected in 30 days
  pendingInvoices60: number;     // AR expected in 60 days
  pendingInvoices90: number;     // AR expected in 90 days
  invoiceCount: number;          // total open invoices included
  asOfDate: string;              // ISO date string
}

/**
 * Calculate 30/60/90 day cash position projections.
 * Formula: current_balance + (invoices_due × payment_probability_per_customer)
 * Payment probability defaults to 0.65 if no history available.
 */
export async function getCashPosition(companyId: string): Promise<CashPosition> {
  try {
    // Get current cash balance from companies table
    const companyResult = await pool.query(
      `SELECT COALESCE(cash_balance_usd, 0) AS cash_balance FROM companies WHERE id = $1`,
      [companyId]
    );
    const currentBalance = parseFloat(companyResult.rows[0]?.cash_balance || '0');

    // Get payment probability per customer (paid / total in last 12 months)
    const probabilityResult = await pool.query(
      `SELECT
         customer_id,
         COUNT(*)::FLOAT AS total,
         COUNT(CASE WHEN status = 'paid' THEN 1 END)::FLOAT AS paid
       FROM invoices
       WHERE company_id = $1
         AND created_at > NOW() - INTERVAL '12 months'
       GROUP BY customer_id`,
      [companyId]
    );

    const probabilityMap: Record<string, number> = {};
    for (const row of probabilityResult.rows) {
      probabilityMap[row.customer_id] = row.total > 0 ? row.paid / row.total : 0.65;
    }

    // Get all open invoices with due dates
    const invoicesResult = await pool.query(
      `SELECT
         i.id,
         i.customer_id,
         i.amount,
         i.due_date,
         CEIL(EXTRACT(EPOCH FROM (i.due_date - NOW())) / 86400)::INT AS days_until_due
       FROM invoices i
       WHERE i.company_id = $1
         AND i.status = 'unpaid'
         AND i.dunning_stopped = FALSE
         AND i.due_date > NOW()
       ORDER BY i.due_date ASC`,
      [companyId]
    );

    let pending30 = 0;
    let pending60 = 0;
    let pending90 = 0;

    for (const inv of invoicesResult.rows) {
      const prob = probabilityMap[inv.customer_id] ?? 0.65;
      const expectedAmount = parseFloat(inv.amount) * prob;
      const days = inv.days_until_due;

      if (days <= 30) {
        pending30 += expectedAmount;
        pending60 += expectedAmount;
        pending90 += expectedAmount;
      } else if (days <= 60) {
        pending60 += expectedAmount;
        pending90 += expectedAmount;
      } else if (days <= 90) {
        pending90 += expectedAmount;
      }
    }

    const result: CashPosition = {
      currentBalance,
      balance30: Math.round((currentBalance + pending30) * 100) / 100,
      balance60: Math.round((currentBalance + pending60) * 100) / 100,
      balance90: Math.round((currentBalance + pending90) * 100) / 100,
      pendingInvoices30: Math.round(pending30 * 100) / 100,
      pendingInvoices60: Math.round(pending60 * 100) / 100,
      pendingInvoices90: Math.round(pending90 * 100) / 100,
      invoiceCount: invoicesResult.rows.length,
      asOfDate: new Date().toISOString(),
    };

    logInfo(MODULE, 'getCashPosition', 'Cash position calculated', {
      companyId,
      balance30: result.balance30,
      balance90: result.balance90,
    });

    return result;
  } catch (err: unknown) {
    logError(MODULE, 'getCashPosition', err instanceof Error ? err.message : String(err));
    return {
      currentBalance: 0,
      balance30: 0,
      balance60: 0,
      balance90: 0,
      pendingInvoices30: 0,
      pendingInvoices60: 0,
      pendingInvoices90: 0,
      invoiceCount: 0,
      asOfDate: new Date().toISOString(),
    };
  }
}

/**
 * Update the company's manually entered cash balance.
 */
export async function updateCashBalance(companyId: string, balanceUsd: number): Promise<void> {
  await pool.query(
    `UPDATE companies SET cash_balance_usd = $1, updated_at = NOW() WHERE id = $2`,
    [balanceUsd, companyId]
  );
  logInfo(MODULE, 'updateCashBalance', 'Cash balance updated', { companyId, balanceUsd });
}
