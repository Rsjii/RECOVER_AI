import crypto from 'crypto';
import { pool } from '../config/database';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface SessionRow {
  id: string;
  user_id: string;
  company_id: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
}

export async function createSession(input: {
  userId: string;
  companyId: string;
  refreshToken: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
}): Promise<void> {
  await pool.query(
    `INSERT INTO user_sessions (user_id, company_id, refresh_token_hash, user_agent, ip_address, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id, refresh_token_hash)
     DO UPDATE SET
       user_agent = EXCLUDED.user_agent,
       ip_address = EXCLUDED.ip_address,
       expires_at = EXCLUDED.expires_at,
       revoked_at = NULL`,
    [
      input.userId,
      input.companyId,
      hashToken(input.refreshToken),
      input.userAgent || null,
      input.ipAddress || null,
      input.expiresAt,
    ]
  );
}

export async function isSessionActive(refreshToken: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
     FROM user_sessions
     WHERE refresh_token_hash = $1
       AND revoked_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [hashToken(refreshToken)]
  );
  return !!result.rows[0];
}

export async function findSessionByRefreshToken(refreshToken: string): Promise<SessionRow | null> {
  const result = await pool.query(
    `SELECT id, user_id, company_id, user_agent, ip_address, created_at, expires_at, revoked_at
     FROM user_sessions
     WHERE refresh_token_hash = $1
     LIMIT 1`,
    [hashToken(refreshToken)]
  );
  return result.rows[0] || null;
}

export async function revokeSession(refreshToken: string): Promise<void> {
  await pool.query(
    `UPDATE user_sessions
     SET revoked_at = NOW()
     WHERE refresh_token_hash = $1`,
    [hashToken(refreshToken)]
  );
}

export async function revokeUserSessions(userId: string): Promise<void> {
  await pool.query(
    `UPDATE user_sessions
     SET revoked_at = NOW()
     WHERE user_id = $1
       AND revoked_at IS NULL`,
    [userId]
  );
}

export interface ActiveSessionRow {
  id: string;
  user_id: string;
  company_id: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export async function listActiveSessions(userId: string, companyId: string): Promise<ActiveSessionRow[]> {
  const result = await pool.query<ActiveSessionRow>(
    `SELECT id, user_id, company_id, user_agent, ip_address::text, created_at, expires_at, revoked_at
     FROM user_sessions
     WHERE user_id = $1
       AND company_id = $2
       AND revoked_at IS NULL
       AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [userId, companyId]
  );
  return result.rows;
}

export async function listCompanyActiveSessions(companyId: string): Promise<ActiveSessionRow[]> {
  const result = await pool.query<ActiveSessionRow>(
    `SELECT id, user_id, company_id, user_agent, ip_address::text, created_at, expires_at, revoked_at
     FROM user_sessions
     WHERE company_id = $1
       AND revoked_at IS NULL
       AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [companyId]
  );
  return result.rows;
}

export async function revokeSessionById(sessionId: string, userId: string, companyId: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE user_sessions
     SET revoked_at = NOW()
     WHERE id = $1
       AND user_id = $2
       AND company_id = $3
       AND revoked_at IS NULL
     RETURNING id`,
    [sessionId, userId, companyId]
  );
  return !!result.rows[0];
}

export async function revokeCompanySessionById(sessionId: string, companyId: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE user_sessions
     SET revoked_at = NOW()
     WHERE id = $1
       AND company_id = $2
       AND revoked_at IS NULL
     RETURNING id`,
    [sessionId, companyId]
  );
  return !!result.rows[0];
}

export async function rotateSessionToken(input: {
  refreshToken: string;
  newRefreshToken: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
}): Promise<{ userId: string; companyId: string } | null> {
  const oldHash = hashToken(input.refreshToken);
  const newHash = hashToken(input.newRefreshToken);
  const result = await pool.query<{ user_id: string; company_id: string }>(
    `UPDATE user_sessions
     SET refresh_token_hash = $2,
         user_agent = COALESCE($3, user_agent),
         ip_address = COALESCE($4, ip_address),
         expires_at = $5,
         revoked_at = NULL
     WHERE refresh_token_hash = $1
       AND revoked_at IS NULL
       AND expires_at > NOW()
     RETURNING user_id, company_id`,
    [oldHash, newHash, input.userAgent || null, input.ipAddress || null, input.expiresAt]
  );
  if (!result.rows[0]) return null;
  return { userId: result.rows[0].user_id, companyId: result.rows[0].company_id };
}

export async function rotateSession(input: {
  oldRefreshToken: string;
  newRefreshToken: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
}): Promise<SessionRow> {
  const oldTokenHash = hashToken(input.oldRefreshToken);
  const newTokenHash = hashToken(input.newRefreshToken);

  const result = await pool.query(
    `WITH revoked AS (
       UPDATE user_sessions
       SET revoked_at = NOW()
       WHERE refresh_token_hash = $1
         AND revoked_at IS NULL
         AND expires_at > NOW()
       RETURNING user_id, company_id
     )
     INSERT INTO user_sessions (user_id, company_id, refresh_token_hash, user_agent, ip_address, expires_at)
     SELECT user_id, company_id, $2, $3, $4, $5
     FROM revoked
     RETURNING id, user_id, company_id, user_agent, ip_address, created_at, expires_at, revoked_at`,
    [
      oldTokenHash,
      newTokenHash,
      input.userAgent || null,
      input.ipAddress || null,
      input.expiresAt,
    ]
  );

  if (!result.rows[0]) {
    throw new Error('Session revoked or expired');
  }

  return result.rows[0];
}

export async function revokeUserSessionsForRefreshToken(refreshToken: string): Promise<number> {
  const session = await findSessionByRefreshToken(refreshToken);
  if (!session) {
    return 0;
  }

  const result = await pool.query(
    `UPDATE user_sessions
     SET revoked_at = NOW()
     WHERE user_id = $1
       AND revoked_at IS NULL`,
    [session.user_id]
  );

  return result.rowCount || 0;
}

export async function registerWebhookEvent(input: {
  provider: string;
  eventId: string;
  eventType: string;
  payloadHash?: string;
  companyId?: string;
}): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO webhook_events (provider, event_id, event_type, payload_hash, company_id)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (provider, event_id) DO NOTHING
     RETURNING id`,
    [input.provider, input.eventId, input.eventType, input.payloadHash || null, input.companyId || null]
  );
  return !!result.rows[0];
}

export async function completeWebhookEvent(provider: string, eventId: string): Promise<void> {
  await pool.query(
    `UPDATE webhook_events
     SET status = 'processed', processed_at = NOW()
     WHERE provider = $1 AND event_id = $2`,
    [provider, eventId]
  );
}

export async function failWebhookEvent(provider: string, eventId: string, errorMessage: string): Promise<void> {
  await pool.query(
    `UPDATE webhook_events
     SET status = 'failed', error_message = $3
     WHERE provider = $1 AND event_id = $2`,
    [provider, eventId, errorMessage]
  );
}


