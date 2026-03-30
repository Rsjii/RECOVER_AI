import { pool } from '../config/database';
import { logInfo, logError } from '../utils/logger';

const MODULE = 'PayablesModel';

export interface Payable {
  id: string;
  company_id: string;
  vendor_name: string;
  amount: number;
  due_date: string; // ISO date
  category: 'payroll' | 'rent' | 'cloud' | 'marketing' | 'other';
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Create a new payable (bill)
 */
export async function createPayable(
  company_id: string,
  vendor_name: string,
  amount: number,
  due_date: string,
  category: string = 'other',
  notes?: string
): Promise<Payable> {
  try {
    const result = await pool.query<Payable>(
      `INSERT INTO payables (company_id, vendor_name, amount, due_date, category, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [company_id, vendor_name, amount, due_date, category, notes || null]
    );

    logInfo(MODULE, 'createPayable', 'Payable created', {
      company_id,
      vendor_name,
      amount,
      due_date,
      category,
    });

    return result.rows[0];
  } catch (err: unknown) {
    logError(MODULE, 'createPayable', err instanceof Error ? err.message : String(err));
    throw err;
  }
}

/**
 * Get all payables for a company
 */
export async function listPayables(company_id: string): Promise<Payable[]> {
  try {
    const result = await pool.query<Payable>(
      `SELECT * FROM payables WHERE company_id = $1 ORDER BY due_date ASC`,
      [company_id]
    );

    return result.rows;
  } catch (err: unknown) {
    logError(MODULE, 'listPayables', err instanceof Error ? err.message : String(err));
    throw err;
  }
}

/**
 * Get payables grouped by week
 */
export async function getPayablesSummary(
  company_id: string
): Promise<{
  this_week: number;
  next_week: number;
  in_30_days: number;
  items: Payable[];
}> {
  try {
    const result = await pool.query<Payable>(
      `SELECT * FROM payables
       WHERE company_id = $1
       AND due_date >= CURRENT_DATE
       ORDER BY due_date ASC`,
      [company_id]
    );

    const items = result.rows;
    const today = new Date();
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const twoWeeksFromNow = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    let this_week = 0;
    let next_week = 0;
    let in_30_days = 0;

    for (const item of items) {
      const dueDate = new Date(item.due_date);

      if (dueDate <= weekFromNow) {
        this_week += item.amount;
      } else if (dueDate <= twoWeeksFromNow) {
        next_week += item.amount;
      } else if (dueDate <= thirtyDaysFromNow) {
        in_30_days += item.amount;
      }
    }

    return {
      this_week: Math.round(this_week * 100) / 100,
      next_week: Math.round(next_week * 100) / 100,
      in_30_days: Math.round(in_30_days * 100) / 100,
      items,
    };
  } catch (err: unknown) {
    logError(MODULE, 'getPayablesSummary', err instanceof Error ? err.message : String(err));
    throw err;
  }
}

/**
 * Update a payable
 */
export async function updatePayable(
  payable_id: string,
  company_id: string,
  updates: Partial<Omit<Payable, 'id' | 'company_id' | 'created_at'>>
): Promise<Payable> {
  try {
    const setClauses: string[] = [];
    const values: unknown[] = [payable_id, company_id];
    let paramIndex = 3;

    if (updates.vendor_name !== undefined) {
      setClauses.push(`vendor_name = $${paramIndex++}`);
      values.push(updates.vendor_name);
    }
    if (updates.amount !== undefined) {
      setClauses.push(`amount = $${paramIndex++}`);
      values.push(updates.amount);
    }
    if (updates.due_date !== undefined) {
      setClauses.push(`due_date = $${paramIndex++}`);
      values.push(updates.due_date);
    }
    if (updates.category !== undefined) {
      setClauses.push(`category = $${paramIndex++}`);
      values.push(updates.category);
    }
    if (updates.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`);
      values.push(updates.notes);
    }

    setClauses.push(`updated_at = NOW()`);

    const query = `UPDATE payables
                   SET ${setClauses.join(', ')}
                   WHERE id = $1 AND company_id = $2
                   RETURNING *`;

    const result = await pool.query<Payable>(query, values);

    if (result.rows.length === 0) {
      throw new Error('Payable not found or access denied');
    }

    logInfo(MODULE, 'updatePayable', 'Payable updated', { payable_id, company_id });

    return result.rows[0];
  } catch (err: unknown) {
    logError(MODULE, 'updatePayable', err instanceof Error ? err.message : String(err));
    throw err;
  }
}

/**
 * Delete a payable
 */
export async function deletePayable(payable_id: string, company_id: string): Promise<void> {
  try {
    const result = await pool.query(
      `DELETE FROM payables WHERE id = $1 AND company_id = $2`,
      [payable_id, company_id]
    );

    if (result.rowCount === 0) {
      throw new Error('Payable not found or access denied');
    }

    logInfo(MODULE, 'deletePayable', 'Payable deleted', { payable_id, company_id });
  } catch (err: unknown) {
    logError(MODULE, 'deletePayable', err instanceof Error ? err.message : String(err));
    throw err;
  }
}
