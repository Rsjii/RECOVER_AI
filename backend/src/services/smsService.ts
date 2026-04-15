import twilio from 'twilio';
import { config } from '../config/env';
import { logInfo, logError } from '../utils/logger';
import { upsertApiUsage } from '../db/apiUsage';
import { decrypt } from '../utils/encryption';

const LOG_MODULE = 'smsService';
const SMS_COST_USD = 0.0075; // Twilio per-SMS cost (US/Canada)

/**
 * Get Twilio client using credentials
 * Supports both RecoverAI's shared Twilio and customer's own Twilio
 */
function getTwilioClient(accountSid: string, authToken: string) {
  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured');
  }
  return twilio(accountSid, authToken);
}

/**
 * Get default RecoverAI Twilio client (fallback)
 */
function getDefaultClient() {
  if (!config.twilio.accountSid || !config.twilio.authToken) {
    throw new Error('RecoverAI Twilio credentials not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)');
  }
  return twilio(config.twilio.accountSid, config.twilio.authToken);
}

export interface SendSMSParams {
  to: string;
  message: string;
  invoiceId: string;
  customerId: string;
  companyId: string;
  companyTwilioAccountSid?: string;      // Customer's Twilio SID (encrypted)
  companyTwilioAuthToken?: string;       // Customer's Twilio Auth Token (encrypted)
  companyTwilioPhoneNumber?: string;     // Customer's Twilio phone number
}

export interface SendSMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  cost: number;
}

/**
 * Send a single SMS via Twilio and track cost.
 * Uses customer's Twilio account if configured, otherwise falls back to RecoverAI's.
 * Never throws — always returns success/failure.
 */
export async function sendSMS(params: SendSMSParams): Promise<SendSMSResult> {
  try {
    let client;
    let fromNumber: string;
    let usesCustomTwilio = false;

    // Determine which Twilio credentials to use
    if (params.companyTwilioAccountSid && params.companyTwilioAuthToken && params.companyTwilioPhoneNumber) {
      try {
        // Use customer's Twilio credentials
        const decryptedSid = decrypt(params.companyTwilioAccountSid);
        const decryptedToken = decrypt(params.companyTwilioAuthToken);
        client = getTwilioClient(decryptedSid, decryptedToken);
        fromNumber = params.companyTwilioPhoneNumber;
        usesCustomTwilio = true;

        logInfo(LOG_MODULE, 'sendSMS', 'Using customer Twilio credentials', {
          companyId: params.companyId,
          fromNumber: fromNumber,
        });
      } catch (decryptErr: any) {
        logError(LOG_MODULE, 'sendSMS', 'Failed to decrypt customer Twilio credentials, falling back to RecoverAI', decryptErr);
        // Fall back to RecoverAI's Twilio
        client = getDefaultClient();
        fromNumber = config.twilio.phoneNumber || '';
      }
    } else {
      // Use RecoverAI's default Twilio
      if (!config.twilio.phoneNumber) {
        return { success: false, error: 'TWILIO_PHONE_NUMBER not configured', cost: 0 };
      }
      client = getDefaultClient();
      fromNumber = config.twilio.phoneNumber;
    }

    logInfo(LOG_MODULE, 'sendSMS', 'Sending SMS', {
      to: params.to,
      invoiceId: params.invoiceId,
      usesCustomTwilio,
    });

    const message = await client.messages.create({
      body: params.message,
      from: fromNumber,
      to: params.to,
    });

    logInfo(LOG_MODULE, 'sendSMS', 'SMS sent', {
      messageId: message.sid,
      status: message.status,
      usesCustomTwilio,
    });

    // Track cost non-blocking
    upsertApiUsage({
      companyId: params.companyId,
      service: 'twilio',
      model: 'sms',
      usageCount: 1,
      costUsd: SMS_COST_USD,
      period: new Date(),
    }).catch(err => logError(LOG_MODULE, 'sendSMS', 'Failed to track SMS cost', err));

    return { success: true, messageId: message.sid, cost: SMS_COST_USD };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logError(LOG_MODULE, 'sendSMS', 'SMS send failed', error);
    return { success: false, error: msg, cost: 0 };
  }
}

/**
 * Validate phone number is in E.164 format (+1XXXXXXXXXX).
 */
export function isValidPhoneNumber(phone: string): boolean {
  return /^\+?[1-9]\d{7,14}$/.test(phone.replace(/[\s\-().]/g, ''));
}

/**
 * Normalize phone to E.164 format. Returns null if not parseable.
 */
export function normalizePhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-().]/g, '');
  // US numbers without country code
  if (/^\d{10}$/.test(cleaned)) return `+1${cleaned}`;
  // Already has +
  if (/^\+\d{8,15}$/.test(cleaned)) return cleaned;
  return null;
}

/**
 * Test Twilio credentials by making a simple API call
 * Returns true if valid, false otherwise
 */
export async function testTwilioCredentials(
  encryptedAccountSid: string,
  encryptedAuthToken: string,
  phoneNumber: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const accountSid = decrypt(encryptedAccountSid);
    const authToken = decrypt(encryptedAuthToken);

    const client = getTwilioClient(accountSid, authToken);

    // Try to fetch account info (lightweight test)
    await client.api.accounts(accountSid).fetch();

    logInfo(LOG_MODULE, 'testTwilioCredentials', 'Twilio credentials valid', {
      phoneNumber: phoneNumber,
    });

    return { valid: true };
  } catch (error: any) {
    const msg = error.message || 'Unknown error';
    logError(LOG_MODULE, 'testTwilioCredentials', 'Twilio credentials invalid', error);
    return { valid: false, error: msg };
  }
}
