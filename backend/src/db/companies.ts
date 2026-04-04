import { pool } from '../config/database';
import { CompanyRow } from '../types/database';

export interface CreateCompanyInput {
  name: string;
  email: string;
  timezone?: string;
  preferredCurrency?: string;
}

export async function createCompany(input: CreateCompanyInput): Promise<CompanyRow> {
  const { name, email, timezone = 'UTC', preferredCurrency = 'USD' } = input;

  const result = await pool.query(
    `INSERT INTO companies (name, email, timezone, preferred_currency)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, email, timezone, preferredCurrency]
  );

  return result.rows[0];
}

export async function findCompanyByEmail(email: string): Promise<CompanyRow | null> {
  const result = await pool.query('SELECT * FROM companies WHERE email = $1', [email]);
  return result.rows[0] || null;
}

export async function findCompanyById(companyId: string): Promise<CompanyRow | null> {
  const result = await pool.query(
    'SELECT * FROM companies WHERE id = $1',
    [companyId]
  );
  return result.rows[0] || null;
}

export async function setCompanyOwner(companyId: string, userId: string): Promise<void> {
  await pool.query('UPDATE companies SET owner_id = $1 WHERE id = $2', [userId, companyId]);
}

export async function updateCompany(companyId: string, updates: Record<string, any>): Promise<CompanyRow> {
  const keys = Object.keys(updates);
  const values = Object.values(updates);

  const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
  const query = `UPDATE companies SET ${setClause}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`;

  const result = await pool.query(query, [...values, companyId]);
  return result.rows[0];
}

/**
 * Find company by Slack user ID (via owner relationship)
 * TODO: When Slack user tracking is added to users table, update this query
 */
export async function findCompanyBySlackUserId(slackUserId: string): Promise<CompanyRow | null> {
  // For now, return null - this will be implemented when Slack user IDs are stored
  // Once users table has slack_user_id field, query:
  // SELECT c.* FROM companies c JOIN users u ON c.owner_id = u.id WHERE u.slack_user_id = $1
  return null;
}

/**
 * Find company by Stripe account ID (for account-aware webhook processing)
 * Used when webhook arrives and we need to find which company it belongs to
 */
export async function findCompanyByStripeAccountId(stripeAccountId: string): Promise<CompanyRow | null> {
  const result = await pool.query(
    'SELECT * FROM companies WHERE stripe_account_id = $1 LIMIT 1',
    [stripeAccountId]
  );
  return result.rows[0] || null;
}

/**
 * List all companies with Stripe connected (for cron job auto-sync)
 * Returns only companies that have stripe_api_key_encrypted set
 */
export async function listCompaniesWithStripe(): Promise<CompanyRow[]> {
  const result = await pool.query(
    `SELECT id, name, stripe_api_key_encrypted, stripe_webhook_secret_encrypted
     FROM companies
     WHERE stripe_api_key_encrypted IS NOT NULL
     AND stripe_api_key_encrypted != ''
     ORDER BY updated_at DESC`
  );
  return result.rows;
}
