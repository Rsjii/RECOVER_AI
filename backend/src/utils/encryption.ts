import crypto from 'crypto';
import { config } from '../config/env';

const ALGORITHM = 'aes-256-cbc';
const ENCODING = 'hex';

/**
 * Encrypt sensitive data (credentials, tokens, etc.)
 * Uses AES-256-CBC with a random IV prepended to output
 */
export function encrypt(plaintext: string): string {
  if (!config.encryptionKey) {
    throw new Error('ENCRYPTION_KEY not configured in environment');
  }

  const key = Buffer.from(config.encryptionKey, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf-8', ENCODING);
  encrypted += cipher.final(ENCODING);

  // Format: IV:ENCRYPTED (IV is prepended for decryption)
  return `${iv.toString(ENCODING)}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 * Extracts IV from input and uses it to decrypt
 */
export function decrypt(encrypted: string): string {
  if (!config.encryptionKey) {
    throw new Error('ENCRYPTION_KEY not configured in environment');
  }

  try {
    const key = Buffer.from(config.encryptionKey, 'hex');
    const parts = encrypted.split(':');

    if (parts.length !== 2) {
      throw new Error('Invalid encrypted format');
    }

    const iv = Buffer.from(parts[0], ENCODING);
    const encryptedText = parts[1];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, ENCODING, 'utf-8');
    decrypted += decipher.final('utf-8');

    return decrypted;
  } catch (err: any) {
    throw new Error(`Decryption failed: ${err.message}`);
  }
}

/**
 * Mask a sensitive value for logging (show only last 4 chars)
 */
export function maskSensitive(value: string | null | undefined): string {
  if (!value) return '[not set]';
  if (value.length <= 4) return '****';
  return `****${value.slice(-4)}`;
}
