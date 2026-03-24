import { Request, Response } from 'express';
import { generateIVRScript, updateVoiceCallOutcome, getVoiceCallStats, getRecentVoiceCalls } from '../services/twilioService';
import { logInfo, logError } from '../utils/logger';
import { pool } from '../config/database';

const MODULE = 'voiceController';

/**
 * Generate TwiML for incoming voice call (IVR script)
 */
export async function generateTwiML(req: Request, res: Response): Promise<void> {
  try {
    const { invoiceId, amount, invoiceNumber } = req.query;

    if (!invoiceNumber || !amount) {
      res.status(400).send('Missing parameters');
      return;
    }

    const twiml = generateIVRScript(invoiceNumber as string, parseFloat(amount as string));

    res.type('application/xml');
    res.send(twiml);

    logInfo(MODULE, 'generateTwiML', 'TwiML generated', {
      invoiceId,
      invoiceNumber,
    });
  } catch (error) {
    logError(MODULE, 'generateTwiML', 'Failed to generate TwiML', {
      error: String(error),
    });
    res.status(500).send('Error generating TwiML');
  }
}

/**
 * Handle DTMF input from voice call (key presses)
 */
export async function handleDTMF(req: Request, res: Response): Promise<void> {
  try {
    const { Digits, CallSid, InvoiceId } = req.body;

    logInfo(MODULE, 'handleDTMF', 'DTMF input received', {
      digits: Digits,
      callSid: CallSid,
      invoiceId: InvoiceId,
    });

    const digit = Digits || '';

    let outcome = 'no_input';
    let responseXml = '';

    if (digit === '1') {
      // Accept payment plan
      outcome = 'accepted_plan';
      responseXml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Great! We'll send you a payment plan via email. You'll be able to pay in 3 monthly installments.</Say>
  <Hangup/>
</Response>`;

      // Queue payment plan creation (Phase 4)
      // await createPaymentPlanForInvoice(InvoiceId);

    } else if (digit === '2') {
      // Transfer to operator
      outcome = 'operator_transfer';
      responseXml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Transferring you to an operator. Please hold...</Say>
  <Redirect>https://your-twilio-webhook-url.com/api/voice/transfer-operator</Redirect>
</Response>`;

    } else if (digit === '9') {
      // Hangup
      outcome = 'declined';
      responseXml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling. Goodbye.</Say>
  <Hangup/>
</Response>`;

    } else {
      // Invalid input
      responseXml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Invalid input. Hanging up.</Say>
  <Hangup/>
</Response>`;
    }

    // Update voice call outcome
    if (CallSid) {
      await updateVoiceCallOutcome(CallSid, outcome, digit);
    }

    res.type('application/xml');
    res.send(responseXml);
  } catch (error) {
    logError(MODULE, 'handleDTMF', 'Failed to handle DTMF', {
      error: String(error),
    });
    res.status(500).send('Error handling DTMF');
  }
}

/**
 * Handle Twilio status callbacks
 * Called when call status changes (ringing, in-progress, completed, failed, etc.)
 */
export async function handleStatusCallback(req: Request, res: Response): Promise<void> {
  try {
    const { CallSid, CallStatus, Duration } = req.body;

    logInfo(MODULE, 'handleStatusCallback', 'Call status update', {
      callSid: CallSid,
      status: CallStatus,
      duration: Duration,
    });

    // Update call status in database
    if (CallSid) {
      await pool.query(
        `UPDATE voice_calls
         SET call_status = $1, duration_seconds = $2
         WHERE twilio_call_sid = $3`,
        [CallStatus, parseInt(Duration) || 0, CallSid]
      );
    }

    res.status(200).send('OK');
  } catch (error) {
    logError(MODULE, 'handleStatusCallback', 'Failed to handle status callback', {
      error: String(error),
    });
    res.status(200).send('OK'); // Still return 200 to avoid retry loops
  }
}

/**
 * Get voice calling statistics for dashboard
 * GET /api/voice/stats
 */
export async function getVoiceStats(req: Request, res: Response): Promise<void> {
  try {
    const companyId = (req as any).user?.companyId || (req as any).company?.id;

    if (!companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const stats = await getVoiceCallStats(companyId, 30);
    const recentCalls = await getRecentVoiceCalls(companyId, 5);

    res.json({
      stats,
      recent_calls: recentCalls,
    });
  } catch (error) {
    logError(MODULE, 'getVoiceStats', 'Failed to get voice stats', {
      error: String(error),
    });
    res.status(500).json({ error: 'Failed to get voice stats' });
  }
}

/**
 * Test voice call (admin only)
 * POST /api/voice/test-call
 * Body: { phone: "+1234567890", invoiceId: "..." }
 */
export async function testVoiceCall(req: Request, res: Response): Promise<void> {
  try {
    const { phone, invoiceId } = req.body;

    if (!phone || !invoiceId) {
      res.status(400).json({ error: 'Phone and invoiceId required' });
      return;
    }

    // TODO: Queue test call
    // const result = await queueVoiceCall({ phone, invoiceId, ... });

    res.json({
      message: 'Test call queued',
      phone,
      invoiceId,
    });
  } catch (error) {
    logError(MODULE, 'testVoiceCall', 'Failed to queue test call', {
      error: String(error),
    });
    res.status(500).json({ error: 'Failed to queue test call' });
  }
}
