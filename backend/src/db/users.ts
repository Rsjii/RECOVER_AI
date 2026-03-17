import { pool } from '../config/database';
import { UserRow, UserWithCompany } from '../types/database';

export interface CreateUserInput {
  companyId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role?: string;
}

export async function createUser(input: CreateUserInput): Promise<UserRow> {
  const { companyId, email, passwordHash, firstName, lastName, role = 'member' } = input;

  const result = await pool.query(
    `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [companyId, email, passwordHash, firstName, lastName, role, true]
  );

  return result.rows[0];
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function findUserWithCompany(userId: string) {
  const result = await pool.query(
    `SELECT u.id, u.company_id, u.email, u.first_name, u.last_name, u.role, u.email_verified,
            c.name as company_name, c.timezone, c.preferred_currency
     FROM users u
     JOIN companies c ON u.company_id = c.id
     WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function findUserWithCompanyByEmail(email: string) {
  const result = await pool.query(
    `SELECT u.id, u.company_id, u.email, u.password_hash, u.is_active, u.first_name, u.last_name, u.role,
            c.name as company_name, c.timezone, c.preferred_currency
     FROM users u
     JOIN companies c ON u.company_id = c.id
     WHERE u.email = $1`,
    [email]
  );
  return result.rows[0] || null;
}

export async function updateLastLogin(userId: string): Promise<void> {
  await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [userId]);
}

export async function updateUser(userId: string, updates: Record<string, any>): Promise<UserRow> {
  const keys = Object.keys(updates);
  const values = Object.values(updates);

  const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
  const query = `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`;

  const result = await pool.query(query, [...values, userId]);
  return result.rows[0];
}

export async function deactivateUser(userId: string): Promise<void> {
  await pool.query('UPDATE users SET is_active = false WHERE id = $1', [userId]);
}

export async function setResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
  await pool.query(
    'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
    [token, expiresAt, userId]
  );
}

export async function findUserByResetToken(token: string): Promise<UserRow | null> {
  const result = await pool.query(
    'SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
    [token]
  );
  return result.rows[0] || null;
}

export async function updatePassword(userId: string, passwordHash: string): Promise<void> {
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
}

export async function clearResetToken(userId: string): Promise<void> {
  await pool.query('UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = $1', [userId]);
}

export async function setOTP(userId: string, code: string, expiresAt: Date): Promise<void> {
  await pool.query(
    'UPDATE users SET otp_code = $1, otp_expires = $2 WHERE id = $3',
    [code, expiresAt, userId]
  );
}

export async function findUserByOTP(code: string): Promise<UserRow | null> {
  const result = await pool.query(
    'SELECT * FROM users WHERE otp_code = $1 AND otp_expires > NOW()',
    [code]
  );
  return result.rows[0] || null;
}

export async function clearOTP(userId: string): Promise<void> {
  await pool.query('UPDATE users SET otp_code = NULL, otp_expires = NULL, email_verified = true WHERE id = $1', [userId]);
}

export async function markEmailVerified(userId: string): Promise<void> {
  await pool.query('UPDATE users SET email_verified = true WHERE id = $1', [userId]);
}
