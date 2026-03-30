import { pool } from '../config/database';
import { logInfo, logError } from '../utils/logger';

const MODULE = 'ForecastAssumptionsModel';

export interface ForecastAssumptions {
  id: string;
  company_id: string;
  growth_rate_pct: number;
  payroll_amount_monthly: number | null;
  other_expenses_monthly: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get forecast assumptions for a company (creates if doesn't exist)
 */
export async function getOrCreateAssumptions(company_id: string): Promise<ForecastAssumptions> {
  try {
    const result = await pool.query<ForecastAssumptions>(
      `SELECT * FROM forecast_assumptions WHERE company_id = $1`,
      [company_id]
    );

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    // Create default assumptions
    const insertResult = await pool.query<ForecastAssumptions>(
      `INSERT INTO forecast_assumptions (
        company_id, growth_rate_pct, payroll_amount_monthly,
        other_expenses_monthly, notes
      ) VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [company_id, 0, null, null, null]
    );

    logInfo(MODULE, 'getOrCreateAssumptions', 'Default assumptions created', { company_id });
    return insertResult.rows[0];
  } catch (err: unknown) {
    logError(MODULE, 'getOrCreateAssumptions', err instanceof Error ? err.message : String(err));
    throw err;
  }
}

/**
 * List all assumptions for a company (should only be 1)
 */
export async function listAssumptions(company_id: string): Promise<ForecastAssumptions[]> {
  try {
    const result = await pool.query<ForecastAssumptions>(
      `SELECT * FROM forecast_assumptions WHERE company_id = $1`,
      [company_id]
    );

    return result.rows;
  } catch (err: unknown) {
    logError(MODULE, 'listAssumptions', err instanceof Error ? err.message : String(err));
    throw err;
  }
}

/**
 * Update forecast assumptions
 */
export async function updateAssumptions(
  assumptions_id: string,
  company_id: string,
  updates: Partial<Omit<ForecastAssumptions, 'id' | 'company_id' | 'created_at'>>
): Promise<ForecastAssumptions> {
  try {
    const setClauses: string[] = [];
    const values: unknown[] = [assumptions_id, company_id];
    let paramIndex = 3;

    if (updates.growth_rate_pct !== undefined) {
      setClauses.push(`growth_rate_pct = $${paramIndex++}`);
      values.push(updates.growth_rate_pct);
    }
    if (updates.payroll_amount_monthly !== undefined) {
      setClauses.push(`payroll_amount_monthly = $${paramIndex++}`);
      values.push(updates.payroll_amount_monthly);
    }
    if (updates.other_expenses_monthly !== undefined) {
      setClauses.push(`other_expenses_monthly = $${paramIndex++}`);
      values.push(updates.other_expenses_monthly);
    }
    if (updates.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`);
      values.push(updates.notes);
    }

    setClauses.push(`updated_at = NOW()`);

    const query = `UPDATE forecast_assumptions
                   SET ${setClauses.join(', ')}
                   WHERE id = $1 AND company_id = $2
                   RETURNING *`;

    const result = await pool.query<ForecastAssumptions>(query, values);

    if (result.rows.length === 0) {
      throw new Error('Assumptions not found or access denied');
    }

    logInfo(MODULE, 'updateAssumptions', 'Assumptions updated', { assumptions_id, company_id });

    return result.rows[0];
  } catch (err: unknown) {
    logError(MODULE, 'updateAssumptions', err instanceof Error ? err.message : String(err));
    throw err;
  }
}

/**
 * Create new assumptions (normally only called via getOrCreateAssumptions)
 */
export async function createAssumptions(
  company_id: string,
  growth_rate_pct: number = 0,
  payroll_amount_monthly?: number | null,
  other_expenses_monthly?: number | null,
  notes?: string | null
): Promise<ForecastAssumptions> {
  try {
    const result = await pool.query<ForecastAssumptions>(
      `INSERT INTO forecast_assumptions (
        company_id, growth_rate_pct, payroll_amount_monthly,
        other_expenses_monthly, notes
      ) VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [company_id, growth_rate_pct, payroll_amount_monthly || null, other_expenses_monthly || null, notes || null]
    );

    logInfo(MODULE, 'createAssumptions', 'Assumptions created', { company_id });

    return result.rows[0];
  } catch (err: unknown) {
    logError(MODULE, 'createAssumptions', err instanceof Error ? err.message : String(err));
    throw err;
  }
}
