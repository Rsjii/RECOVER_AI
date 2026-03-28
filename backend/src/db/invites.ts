import { pool } from '../config/database';
import crypto from 'crypto';

export interface InviteToken {
  id: string;
  token: string;
  email?: string;
  company_name: string;
  company_domain?: string;
  expires_at: string;
  used_at?: string;
  used_by_email?: string;
  created_by_user_id?: string;
  created_at: string;
}

/**
 * Generate a new invite token for personalized signup (Motion 1)
 * Email is optional (can send without knowing founder's email)
 * company_name is required
 * No research_data stored per user requirement
 */
export async function createInviteToken(
  email: string | undefined,
  company_name: string,
  company_domain: string | undefined,
  created_by_user_id: string,
  expiresIn_days: number = 7
): Promise<InviteToken> {
  const token = crypto.randomBytes(32).toString('hex');
  const expires_at = new Date();
  expires_at.setDate(expires_at.getDate() + expiresIn_days);

  const result = await pool.query(
    `INSERT INTO invite_tokens (token, email, company_name, company_domain, expires_at, created_by_user_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING *`,
    [token, email || null, company_name, company_domain || null, expires_at, created_by_user_id]
  );

  return result.rows[0];
}

/**
 * Get invite token by token string
 * Also validate that it's not expired and not already used
 */
export async function getInviteToken(token: string): Promise<InviteToken | null> {
  const result = await pool.query(
    `SELECT * FROM invite_tokens WHERE token = $1`,
    [token]
  );

  if (result.rows.length === 0) return null;

  const invite = result.rows[0];

  // Check if expired
  if (new Date(invite.expires_at) < new Date()) {
    return null; // Token expired
  }

  // Check if already used
  if (invite.used_at) {
    return null; // Token already used
  }

  return invite;
}

/**
 * Validate token and check if email matches (if email was tied to token)
 */
export async function validateInviteToken(
  token: string,
  signup_email: string
): Promise<{ valid: boolean; reason?: string; invite?: InviteToken }> {
  const invite = await getInviteToken(token);

  if (!invite) {
    return { valid: false, reason: 'Token invalid or expired' };
  }

  // If token has an email tied to it, verify signup email matches
  if (invite.email && invite.email.toLowerCase() !== signup_email.toLowerCase()) {
    return { valid: false, reason: 'Email does not match this invite' };
  }

  return { valid: true, invite };
}

/**
 * Mark token as used
 */
export async function markTokenUsed(
  token: string,
  used_by_email: string
): Promise<void> {
  await pool.query(
    `UPDATE invite_tokens SET used_at = NOW(), used_by_email = $1 WHERE token = $2`,
    [used_by_email, token]
  );
}

/**
 * Link token to created company
 */
export async function linkTokenToCompany(
  token: string,
  company_id: string
): Promise<void> {
  await pool.query(
    `UPDATE invite_tokens SET created_company_id = $1 WHERE token = $2`,
    [company_id, token]
  );
}

/**
 * Get invite tokens created by admin (for tracking)
 */
export async function getAdminInviteTokens(
  created_by_user_id: string,
  limit: number = 50
): Promise<InviteToken[]> {
  const result = await pool.query(
    `SELECT * FROM invite_tokens
     WHERE created_by_user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [created_by_user_id, limit]
  );

  return result.rows;
}

/**
 * Generate verification token for Motion 2 (public audit form)
 */
export async function createVerificationToken(length: number = 32): Promise<string> {
  return crypto.randomBytes(length).toString('hex');
}
