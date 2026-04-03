import nodemailer, { Transporter } from 'nodemailer';
import { pool } from '../config/database';
import { logInfo, logError, logWarn } from '../utils/logger';
import crypto from 'crypto';

const MODULE = 'smtpService';

interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Cache transports in memory (recreate if config changes)
const transportCache = new Map<string, { transporter: Transporter; configHash: string }>();

/**
 * Encrypt/decrypt using company ID as key (simple but sufficient for MVP)
 */
function encryptValue(value: string, key: string): string {
  // Use SHA256 of key to ensure consistent 32-byte key for aes-256-cbc
  const keyHash = crypto.createHash('sha256').update(key).digest();
  // Generate random IV for each encryption
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyHash, iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  // Return IV + encrypted value
  return iv.toString('hex') + ':' + encrypted;
}

function decryptValue(encryptedWithIv: string, key: string): string {
  // Split IV from encrypted value
  const [ivHex, encrypted] = encryptedWithIv.split(':');
  const keyHash = crypto.createHash('sha256').update(key).digest();
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyHash, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Fetch SMTP config from database
 */
export async function getSMTPConfig(companyId: string): Promise<SMTPConfig | null> {
  try {
    const result = await pool.query(
      `SELECT
         smtp_host, smtp_port, smtp_username_encrypted, smtp_password_encrypted,
         smtp_from_email, smtp_from_name, smtp_enabled
       FROM companies
       WHERE id = $1`,
      [companyId]
    );

    if (result.rows.length === 0 || !result.rows[0].smtp_enabled) {
      return null;
    }

    const row = result.rows[0];

    // Decrypt credentials
    const username = decryptValue(row.smtp_username_encrypted, companyId);
    const password = decryptValue(row.smtp_password_encrypted, companyId);

    return {
      host: row.smtp_host,
      port: row.smtp_port || 587,
      username,
      password,
      fromEmail: row.smtp_from_email,
      fromName: row.smtp_from_name,
    };
  } catch (err) {
    logError(MODULE, 'getSMTPConfig', 'Failed to fetch SMTP config', err);
    return null;
  }
}

/**
 * Get or create nodemailer transporter
 */
function getTransporter(companyId: string, config: SMTPConfig): Transporter {
  // Create hash of config to detect changes
  const configHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(config))
    .digest('hex');

  const cached = transportCache.get(companyId);
  if (cached && cached.configHash === configHash) {
    return cached.transporter;
  }

  // Create new transporter
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465, // true for 465, false for other ports
    auth: {
      user: config.username,
      pass: config.password,
    },
  });

  // Cache it
  transportCache.set(companyId, { transporter, configHash });

  return transporter;
}

/**
 * Send email via SMTP
 */
export async function sendViaSmtp(
  companyId: string,
  to: string,
  subject: string,
  html: string,
  replyTo?: string
): Promise<SendResult> {
  const method = 'sendViaSmtp';

  try {
    const config = await getSMTPConfig(companyId);
    if (!config) {
      return { success: false, error: 'SMTP not configured' };
    }

    const transporter = getTransporter(companyId, config);

    const result = await transporter.sendMail({
      from: `${config.fromName} <${config.fromEmail}>`,
      to,
      subject,
      html,
      replyTo: replyTo || config.fromEmail,
      // Add tracking headers
      headers: {
        'X-RecoverAI-CompanyId': companyId,
      },
    });

    logInfo(MODULE, method, 'Email sent via SMTP', {
      companyId,
      to,
      messageId: result.messageId,
    });

    return { success: true, messageId: result.messageId };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logWarn(MODULE, method, 'SMTP send failed, will fallback to Resend', {
      companyId,
      error: errMsg,
    });

    return { success: false, error: errMsg };
  }
}

/**
 * Test SMTP connection and save verification status
 */
export async function testSMTPConnection(
  companyId: string,
  config: {
    host: string;
    port: number;
    username: string;
    password: string;
    fromEmail: string;
    fromName: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const method = 'testSMTPConnection';

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.username,
        pass: config.password,
      },
    });

    // Test connection
    await transporter.verify();

    // Send test email
    await transporter.sendMail({
      from: `${config.fromName} <${config.fromEmail}>`,
      to: config.fromEmail, // Send to self as test
      subject: 'RecoverAI SMTP Test',
      html: '<p>Your SMTP configuration is working correctly.</p>',
    });

    // Mark as verified in DB
    await pool.query(
      `UPDATE companies
       SET smtp_verified = true, smtp_last_verified_at = NOW(), smtp_error_message = NULL
       WHERE id = $1`,
      [companyId]
    );

    logInfo(MODULE, method, 'SMTP connection verified', { companyId });

    return { success: true };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);

    // Log error in DB
    await pool.query(
      `UPDATE companies
       SET smtp_verified = false, smtp_error_message = $1
       WHERE id = $2`,
      [errMsg, companyId]
    );

    logError(MODULE, method, 'SMTP verification failed', { companyId, error: errMsg });

    return { success: false, error: errMsg };
  }
}

/**
 * Save SMTP configuration (encrypted)
 */
export async function saveSMTPConfig(
  companyId: string,
  config: {
    host: string;
    port: number;
    username: string;
    password: string;
    fromEmail: string;
    fromName: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const method = 'saveSMTPConfig';

  try {
    // Encrypt credentials
    const encryptedUsername = encryptValue(config.username, companyId);
    const encryptedPassword = encryptValue(config.password, companyId);

    // Save to DB (don't set verified=true yet, will be set by testSMTPConnection)
    await pool.query(
      `UPDATE companies
       SET smtp_host = $1,
           smtp_port = $2,
           smtp_username_encrypted = $3,
           smtp_password_encrypted = $4,
           smtp_from_email = $5,
           smtp_from_name = $6,
           smtp_enabled = false,
           smtp_verified = false,
           smtp_error_message = 'Pending verification'
       WHERE id = $7`,
      [
        config.host,
        config.port,
        encryptedUsername,
        encryptedPassword,
        config.fromEmail,
        config.fromName,
        companyId,
      ]
    );

    // Clear cache
    transportCache.delete(companyId);

    logInfo(MODULE, method, 'SMTP config saved (pending verification)', { companyId });

    return { success: true };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logError(MODULE, method, 'Failed to save SMTP config', { companyId, error: errMsg });

    return { success: false, error: errMsg };
  }
}

/**
 * Get SMTP status for frontend display
 */
export async function getSMTPStatus(companyId: string): Promise<{
  configured: boolean;
  verified: boolean;
  fromEmail?: string;
  fromName?: string;
  host?: string;
  errorMessage?: string;
}> {
  try {
    const result = await pool.query(
      `SELECT smtp_host, smtp_from_email, smtp_from_name, smtp_verified, smtp_error_message, smtp_enabled
       FROM companies
       WHERE id = $1`,
      [companyId]
    );

    if (result.rows.length === 0) {
      return { configured: false, verified: false };
    }

    const row = result.rows[0];

    return {
      configured: row.smtp_enabled || !!row.smtp_host,
      verified: row.smtp_verified,
      fromEmail: row.smtp_from_email,
      fromName: row.smtp_from_name,
      host: row.smtp_host,
      errorMessage: row.smtp_error_message,
    };
  } catch (err) {
    logError(MODULE, 'getSMTPStatus', 'Failed', err);
    return { configured: false, verified: false };
  }
}

/**
 * Disable SMTP (revert to Resend fallback)
 */
export async function disableSMTP(companyId: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE companies
       SET smtp_enabled = false, smtp_verified = false
       WHERE id = $1`,
      [companyId]
    );

    transportCache.delete(companyId);
    logInfo(MODULE, 'disableSMTP', 'SMTP disabled', { companyId });
  } catch (err) {
    logError(MODULE, 'disableSMTP', 'Failed to disable SMTP', err);
  }
}