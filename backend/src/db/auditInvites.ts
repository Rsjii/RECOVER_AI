import { pool } from '../config/database';
import crypto from 'crypto';
import { logInfo, logError } from '../utils/logger';

const MODULE = 'auditInvites';

/**
 * Generate a secure random token for audit invites
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new audit invite for cold outreach or website form
 * @param params - { email?, expiresAt?, createdByUserId?, createdByType }
 * @returns { token, link }
 */
export async function createAuditInvite(params: {
  email?: string;
  expiresAt?: Date;
  createdByUserId?: string;
  createdByType?: 'admin' | 'website';
}): Promise<{ token: string; link: string }> {
  const token = generateToken();
  const expiresAt = params.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days default
  const createdByType = params.createdByType || 'admin';

  try {
    const result = await pool.query(
      `INSERT INTO audit_invites (token, invited_email, expires_at, created_by_user_id, created_by_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, token`,
      [token, params.email || null, expiresAt, params.createdByUserId || null, createdByType]
    );

    const link = `${process.env.FRONTEND_URL || 'https://recoverai.com'}/audit?invite=${token}`;
    logInfo(MODULE, 'createAuditInvite', `Created invite for ${params.email || 'anonymous'}`, { token: token.slice(0, 8) });

    return { token, link };
  } catch (err: any) {
    logError(MODULE, 'createAuditInvite', 'Failed to create invite', err);
    throw err;
  }
}

/**
 * Validate an audit invite token
 * @param token - the invite token from URL (?invite=xxx)
 * @returns { valid, email, expired }
 */
export async function validateAuditInvite(token: string): Promise<{
  valid: boolean;
  email?: string;
  expired: boolean;
}> {
  try {
    const result = await pool.query(
      `SELECT token, invited_email, expires_at, used_at FROM audit_invites
       WHERE token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return { valid: false, expired: false };
    }

    const invite = result.rows[0];

    // Check if already used
    if (invite.used_at) {
      return { valid: false, expired: false };
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    if (now > expiresAt) {
      return { valid: true, email: invite.invited_email, expired: true };
    }

    // Valid and not expired
    return { valid: true, email: invite.invited_email, expired: false };
  } catch (err: any) {
    logError(MODULE, 'validateAuditInvite', 'Failed to validate invite', err);
    throw err;
  }
}

/**
 * Mark an audit invite as used (after pilot creation)
 * @param token - the invite token
 */
export async function markAuditInviteAsUsed(token: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE audit_invites SET used_at = NOW() WHERE token = $1`,
      [token]
    );

    logInfo(MODULE, 'markAuditInviteAsUsed', 'Marked invite as used', { token: token.slice(0, 8) });
  } catch (err: any) {
    logError(MODULE, 'markAuditInviteAsUsed', 'Failed to mark invite as used', err);
    throw err;
  }
}

/**
 * Get audit invite details
 * @param token - the invite token
 */
export async function getAuditInvite(token: string): Promise<{
  id: string;
  token: string;
  invited_email?: string;
  created_at: string;
  expires_at: string;
  used_at?: string;
} | null> {
  try {
    const result = await pool.query(
      `SELECT id, token, invited_email, created_at, expires_at, used_at FROM audit_invites
       WHERE token = $1`,
      [token]
    );

    return result.rows[0] || null;
  } catch (err: any) {
    logError(MODULE, 'getAuditInvite', 'Failed to get invite', err);
    throw err;
  }
}

/**
 * List all audit invites (admin dashboard)
 */
export async function listAuditInvites(filters?: {
  status?: 'pending' | 'used' | 'expired';
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  try {
    let query = `SELECT id, token, invited_email, created_at, expires_at, used_at, created_by_type
                 FROM audit_invites`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.status === 'pending') {
      query += ` WHERE used_at IS NULL AND expires_at > NOW()`;
    } else if (filters?.status === 'used') {
      query += ` WHERE used_at IS NOT NULL`;
    } else if (filters?.status === 'expired') {
      query += ` WHERE expires_at <= NOW()`;
    }

    query += ` ORDER BY created_at DESC`;

    if (filters?.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(filters.limit);
    }

    if (filters?.offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(filters.offset);
    }

    const result = await pool.query(query, params);
    return result.rows;
  } catch (err: any) {
    logError(MODULE, 'listAuditInvites', 'Failed to list invites', err);
    throw err;
  }
}
