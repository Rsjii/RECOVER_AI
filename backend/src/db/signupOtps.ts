import { pool } from '../config/database';

interface SignupOtpRow {
  email: string;
  otp: string;
  passwordHash: string;
  inviteToken: string | null;
  inviteCompanyName: string | null;
  expiresAt: Date;
}

interface SetSignupOtpOptions {
  inviteToken?: string | null;
  inviteCompanyName?: string | null;
}

/**
 * Creates/replaces the pending signup OTP for an email (TTL checked on read).
 */
export async function setSignupOtp(
  email: string,
  otp: string,
  passwordHash: string,
  ttlSeconds: number,
  options: SetSignupOtpOptions = {}
): Promise<void> {
  const inviteToken = options.inviteToken ?? null;
  const inviteCompanyName = options.inviteCompanyName ?? null;
  await pool.query(
    `INSERT INTO signup_otps (email, otp, password_hash, invite_token, invite_company_name, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + $6 * INTERVAL '1 second')
     ON CONFLICT (email) DO UPDATE SET
       otp = $2, password_hash = $3, invite_token = $4, invite_company_name = $5,
       expires_at = NOW() + $6 * INTERVAL '1 second'`,
    [email, otp, passwordHash, inviteToken, inviteCompanyName, ttlSeconds]
  );
}

/**
 * Updates just the OTP code for an existing pending signup (used by resend), keeping other fields.
 * Returns false if there's no pending signup for this email.
 */
export async function updateSignupOtpCode(email: string, otp: string, ttlSeconds: number): Promise<boolean> {
  const result = await pool.query(
    `UPDATE signup_otps SET otp = $2, expires_at = NOW() + $3 * INTERVAL '1 second' WHERE email = $1`,
    [email, otp, ttlSeconds]
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Reads the pending signup OTP for an email. Returns null if missing or expired.
 */
export async function getSignupOtp(email: string): Promise<SignupOtpRow | null> {
  const result = await pool.query(
    `SELECT email, otp, password_hash, invite_token, invite_company_name, expires_at
     FROM signup_otps WHERE email = $1 AND expires_at > NOW()`,
    [email]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    email: row.email,
    otp: row.otp,
    passwordHash: row.password_hash,
    inviteToken: row.invite_token,
    inviteCompanyName: row.invite_company_name,
    expiresAt: row.expires_at,
  };
}

export async function deleteSignupOtp(email: string): Promise<void> {
  await pool.query(`DELETE FROM signup_otps WHERE email = $1`, [email]);
}
