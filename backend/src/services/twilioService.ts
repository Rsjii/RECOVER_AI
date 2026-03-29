import twilio from 'twilio';
import { config } from '../config/env';
import { logInfo, logError } from '../utils/logger';
import { pool } from '../config/database';

const MODULE = 'twilioService';

// Initialize Twilio client
const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);

export interface VoiceCallRequest {
  invoiceId: string;
  customerId: string;
  phone: string;
  companyId: string;
  amount: number;
  invoiceNumber: string;
  customerName?: string;
}

export interface VoiceCallResult {
  call_id: string;
  status: string;
  error?: string;
}

/**
 * Initiate an outbound voice call to a debtor
 * Uses TwiML to generate IVR script with DTMF handling
 */
export async function initiateVoiceCall(req: VoiceCallRequest): Promise<VoiceCallResult> {
  try {
    if (!config.twilio.accountSid || !config.twilio.authToken || !config.twilio.phoneNumber) {
      logError(MODULE, 'initiateVoiceCall', 'Twilio credentials missing', {
        hasSid: !!config.twilio.accountSid,
        hasToken: !!config.twilio.authToken,
        hasPhone: !!config.twilio.phoneNumber,
      });
      return {
        call_id: '',
        status: 'failed',
        error: 'Twilio not configured',
      };
    }

    // Format phone number (ensure E.164 format)
    const formattedPhone = req.phone.startsWith('+') ? req.phone : `+1${req.phone.replace(/\D/g, '')}`;

    // Generate TwiML callback URL
    const twimlUrl = `${config.baseUrl}/api/voice/twiml?invoiceId=${req.invoiceId}&amount=${req.amount}&invoiceNumber=${encodeURIComponent(req.invoiceNumber)}`;

    // Initiate call via Twilio REST API
    const call = await twilioClient.calls.create({
      from: config.twilio.phoneNumber!,
      to: formattedPhone,
      url: twimlUrl,
      statusCallback: `${config.baseUrl}/api/voice/status-callback`,
      statusCallbackMethod: 'POST',
      timeout: 45, // Ring for 45 seconds before giving up
    });

    // Log call to database
    await logVoiceCallToDb({
      invoiceId: req.invoiceId,
      customerId: req.customerId,
      companyId: req.companyId,
      phone: formattedPhone,
      twiliCallSid: call.sid,
      callStatus: call.status,
    });

    logInfo(MODULE, 'initiateVoiceCall', 'Voice call initiated', {
      invoiceId: req.invoiceId,
      callSid: call.sid,
      status: call.status,
      phone: formattedPhone,
    });

    return {
      call_id: call.sid,
      status: call.status,
    };
  } catch (error) {
    logError(MODULE, 'initiateVoiceCall', 'Failed to initiate voice call', {
      error: String(error),
      invoiceId: req.invoiceId,
    });
    return {
      call_id: '',
      status: 'failed',
      error: String(error),
    };
  }
}

/**
 * Get call status from Twilio
 */
export async function getCallStatus(callSid: string): Promise<any> {
  try {
    const call = await twilioClient.calls(callSid).fetch();
    return {
      sid: call.sid,
      status: call.status,
      duration: call.duration,
      startTime: call.startTime,
      endTime: call.endTime,
    };
  } catch (error) {
    logError(MODULE, 'getCallStatus', 'Failed to fetch call status', {
      error: String(error),
      callSid,
    });
    throw error;
  }
}

/**
 * Generate TwiML (Twilio Markup Language) for IVR script
 */
export function generateIVRScript(invoiceNumber: string, amount: number): string {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">
    Hi, this is CashOS calling about invoice ${invoiceNumber} for ${formattedAmount}.
  </Say>

  <Gather numDigits="1" action="/api/voice/handle-dtmf" method="POST" timeout="10">
    <Say voice="alice" language="en-US">
      To set up a payment plan, press 1.
      To speak to a representative, press 2.
      To hang up, press 9.
    </Say>
  </Gather>

  <Say voice="alice" language="en-US">Sorry, I didn't hear that.</Say>
  <Hangup/>
</Response>`;
}

/**
 * Log voice call to database
 */
async function logVoiceCallToDb(data: {
  invoiceId: string;
  customerId: string;
  companyId: string;
  phone: string;
  twiliCallSid: string;
  callStatus: string;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO voice_calls (invoice_id, customer_id, company_id, phone, twilio_call_sid, call_status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [data.invoiceId, data.customerId, data.companyId, data.phone, data.twiliCallSid, data.callStatus]
    );
  } catch (error) {
    logError(MODULE, 'logVoiceCallToDb', 'Failed to log voice call', {
      error: String(error),
    });
  }
}

/**
 * Update voice call outcome
 */
export async function updateVoiceCallOutcome(
  callSid: string,
  outcome: string,
  dtmfInput?: string,
  durationSeconds?: number
): Promise<void> {
  try {
    await pool.query(
      `UPDATE voice_calls
       SET outcome = $1, dtmf_input = $2, duration_seconds = $3, call_status = 'completed', completed_at = NOW()
       WHERE twilio_call_sid = $4`,
      [outcome, dtmfInput || null, durationSeconds || null, callSid]
    );

    logInfo(MODULE, 'updateVoiceCallOutcome', 'Voice call outcome updated', {
      callSid,
      outcome,
      dtmfInput,
    });
  } catch (error) {
    logError(MODULE, 'updateVoiceCallOutcome', 'Failed to update voice call outcome', {
      error: String(error),
      callSid,
    });
  }
}

/**
 * Get voice call stats for dashboard
 */
export async function getVoiceCallStats(companyId: string, daysBack: number = 30): Promise<any> {
  try {
    const callsQuery = await pool.query(
      `SELECT
        COUNT(*) as total_calls,
        SUM(CASE WHEN outcome = 'accepted_plan' THEN 1 ELSE 0 END) as accepted_plans,
        SUM(CASE WHEN outcome = 'operator_transfer' THEN 1 ELSE 0 END) as operator_transfers,
        SUM(CASE WHEN outcome = 'no_answer' THEN 1 ELSE 0 END) as no_answers,
        SUM(CASE WHEN outcome = 'failed' THEN 1 ELSE 0 END) as failed_calls,
        AVG(CASE WHEN duration_seconds > 0 THEN duration_seconds ELSE NULL END) as avg_duration_seconds
       FROM voice_calls
       WHERE company_id = $1
         AND created_at >= NOW() - INTERVAL '1 day' * $2`,
      [companyId, daysBack]
    );

    const stats = callsQuery.rows[0];
    const totalCalls = parseInt(stats.total_calls || '0');
    const acceptedPlans = parseInt(stats.accepted_plans || '0');

    return {
      calls_this_month: totalCalls,
      acceptance_rate: totalCalls > 0 ? Math.round((acceptedPlans / totalCalls) * 100) : 0,
      avg_duration_seconds: Math.round(parseFloat(stats.avg_duration_seconds) || 0),
      operator_transfers: parseInt(stats.operator_transfers || '0'),
      no_answers: parseInt(stats.no_answers || '0'),
      failed_calls: parseInt(stats.failed_calls || '0'),
    };
  } catch (error) {
    logError(MODULE, 'getVoiceCallStats', 'Failed to get voice call stats', {
      error: String(error),
    });
    return {
      calls_this_month: 0,
      acceptance_rate: 0,
      avg_duration_seconds: 0,
      operator_transfers: 0,
      no_answers: 0,
      failed_calls: 0,
    };
  }
}

/**
 * Get recent voice calls for a company
 */
export async function getRecentVoiceCalls(companyId: string, limit: number = 10): Promise<any[]> {
  try {
    const result = await pool.query(
      `SELECT vc.*, i.invoice_number, i.amount, c.name as customer_name
       FROM voice_calls vc
       JOIN invoices i ON vc.invoice_id = i.id
       JOIN customers c ON vc.customer_id = c.id
       WHERE vc.company_id = $1
       ORDER BY vc.created_at DESC
       LIMIT $2`,
      [companyId, limit]
    );

    return result.rows;
  } catch (error) {
    logError(MODULE, 'getRecentVoiceCalls', 'Failed to get recent voice calls', {
      error: String(error),
    });
    return [];
  }
}

/**
 * Check if a voice call was already made for this invoice recently
 */
export async function hasRecentVoiceCall(invoiceId: string, hoursBack: number = 24): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM voice_calls
       WHERE invoice_id = $1
         AND created_at >= NOW() - INTERVAL '1 hour' * $2`,
      [invoiceId, hoursBack]
    );

    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    logError(MODULE, 'hasRecentVoiceCall', 'Failed to check recent voice calls', {
      error: String(error),
    });
    return false;
  }
}
