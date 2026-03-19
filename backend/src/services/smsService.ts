import twilio from 'twilio';
import { config } from '../config/env';
import { logInfo, logError } from '../utils/logger';
import { upsertApiUsage } from '../db/apiUsage';

const LOG_MODULE = 'smsService';
const SMS_COST_USD = 0.0075; // Twilio per-SMS cost (US/Canada)

function getClient() {
  if (!config.twilio.accountSid || !config.twilio.authToken) {
    throw new Error('Twilio credentials not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)');
  }
  return twilio(config.twilio.accountSid, config.twilio.authToken);
}

export interface SendSMSParams {
  to: string;
  message: string;
  invoiceId: string;
  customerId: string;
  companyId: string;
}

export interface SendSMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  cost: number;
}

/**
 * Send a single SMS via Twilio and track cost.
 * Never throws — always returns success/failure.
 */
export async function sendSMS(params: SendSMSParams): Promise<SendSMSResult> {
  try {
    if (!config.twilio.phoneNumber) {
      return { success: false, error: 'TWILIO_PHONE_NUMBER not configured', cost: 0 };
    }

    logInfo(LOG_MODULE, 'sendSMS', 'Sending SMS', {
      to: params.to,
      invoiceId: params.invoiceId,
    });

    const client = getClient();
    const message = await client.messages.create({
      body: params.message,
      from: config.twilio.phoneNumber,
      to: params.to,
    });

    logInfo(LOG_MODULE, 'sendSMS', 'SMS sent', {
      messageId: message.sid,
      status: message.status,
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
