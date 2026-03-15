import crypto from 'crypto';
import { config } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;  // 96-bit IV for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Encrypts plaintext using AES-256-GCM.
 * Output format: <iv_hex>:<ciphertext_hex>:<tag_hex>
 * Safe to store in the database.
 */
export function encrypt(plaintext: string): string {
  const key = Buffer.from(config.encryptionKey, 'hex');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY must be 64 hex chars (32 bytes)');

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

/**
 * Decrypts a value produced by encrypt().
 * Throws if the ciphertext is tampered with (auth tag mismatch).
 */
export function decrypt(ciphertext: string): string {
  const key = Buffer.from(config.encryptionKey, 'hex');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY must be 64 hex chars (32 bytes)');

  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted value format');

  const [ivHex, encryptedHex, tagHex] = parts;
  const iv        = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const tag       = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}
