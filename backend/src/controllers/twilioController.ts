import { Request, Response } from 'express';
import { pool } from '../config/database';
import { logInfo, logError, logWarn } from '../utils/logger';

const MODULE = 'twilioController';

/**
 * Handle Twilio SMS delivery status webhook
 * POST /api/twilio/webhook/sms-status
 *
 * Twilio sends this when SMS delivery status changes (delivered, failed, etc)
 * Signature verification is optional for MVP, can be enabled in production
 */
export async function handleSMSStatusWebhook(req: Request, res: Response) {
  const method = 'handleSMSStatusWebhook';
  const { MessageSid, MessageStatus, To, ErrorCode } = req.body;

  logInfo(MODULE, method, 'SMS status webhook received', {
    MessageSid,
    MessageStatus,
    To,
    ErrorCode,
  });

  // Validate required fields
  if (!MessageSid || !MessageStatus) {
    logWarn(MODULE, method, 'Missing MessageSid or MessageStatus', { body: req.body });
    return res.status(400).json({ error: 'Missing MessageSid or MessageStatus' });
  }

  try {
    // Find sms_logs entry by twilio_message_sid
    const smsLogResult = await pool.query(
      `SELECT id, invoice_id, company_id FROM sms_logs WHERE twilio_message_sid = $1`,
      [MessageSid]
    );

    if (smsLogResult.rows.length === 0) {
      logWarn(MODULE, method, 'SMS log not found for MessageSid', { MessageSid });
      return res.status(404).json({ error: 'SMS log not found' });
    }

    const smsLog = smsLogResult.rows[0];

    // Update status based on MessageStatus
    if (MessageStatus === 'delivered') {
      await pool.query(
        `UPDATE sms_logs
         SET status = 'delivered', delivered_at = NOW()
         WHERE twilio_message_sid = $1`,
        [MessageSid]
      );

      logInfo(MODULE, method, 'SMS marked as delivered', {
        MessageSid,
        invoiceId: smsLog.invoice_id,
      });
    } else if (MessageStatus === 'failed' || MessageStatus === 'undelivered') {
      const failureReason = ErrorCode ? `Error ${ErrorCode}: ${MessageStatus}` : MessageStatus;

      await pool.query(
        `UPDATE sms_logs
         SET status = 'failed', failed_at = NOW(), failure_reason = $1
         WHERE twilio_message_sid = $2`,
        [failureReason, MessageSid]
      );

      logWarn(MODULE, method, 'SMS marked as failed', {
        MessageSid,
        invoiceId: smsLog.invoice_id,
        reason: failureReason,
      });
    } else {
      // For other statuses (sent, queued, etc), just log
      logInfo(MODULE, method, 'SMS status update', {
        MessageSid,
        status: MessageStatus,
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logError(MODULE, method, 'Failed to update SMS status', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
