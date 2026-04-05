import { Request, Response } from 'express';
import { logInfo, logError } from '../utils/logger';
import { pool } from '../config/database';
import emailService from '../services/emailService';

const MODULE = 'pilotQueueController';

/**
 * GET /api/pilot-queue
 * List queued emails for pilot company (shadow mode emails awaiting approval)
 */
export const listQueuedEmails = async (req: Request, res: Response) => {
  const companyId = (req as any).companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await pool.query(
      `SELECT
        id,
        invoice_id,
        customer_id,
        recipient_email,
        customer_name,
        invoice_amount,
        days_overdue,
        email_type,
        attempt_number,
        queued_at,
        status
       FROM pilot_queued_emails
       WHERE company_id = $1 AND status IN ('pending', 'approved')
       ORDER BY queued_at DESC
       LIMIT 50`,
      [companyId]
    );

    logInfo(MODULE, 'listQueuedEmails', `Retrieved ${result.rows.length} queued emails`);

    return res.json({
      data: result.rows,
      count: result.rows.length,
    });
  } catch (err: any) {
    logError(MODULE, 'listQueuedEmails', 'Failed to list queued emails', err);
    return res.status(400).json({ error: err.message });
  }
};

/**
 * POST /api/pilot-queue/:id/approve
 * Approve and send a queued email immediately
 */
export const approveQueuedEmail = async (req: Request, res: Response) => {
  const { id } = req.params;
  const companyId = (req as any).companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Get the queued email record
    const queuedResult = await pool.query(
      `SELECT
        id,
        invoice_id,
        customer_id,
        recipient_email,
        customer_name,
        invoice_amount,
        due_date,
        days_overdue,
        email_type,
        attempt_number
       FROM pilot_queued_emails
       WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );

    if (queuedResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const queued = queuedResult.rows[0];

    logInfo(MODULE, 'approveQueuedEmail', `Approving queued email for ${queued.customer_name}`);

    // 2. Send the email via emailService
    try {
      // Use exact due_date stored at queue time (not reconstructed from days_overdue which drifts)
      const dueDate = queued.due_date || new Date(Date.now() - queued.days_overdue * 24 * 60 * 60 * 1000).toISOString();

      await emailService.sendDunningEmail({
        companyId,
        invoiceId: queued.invoice_id,
        customerId: queued.customer_id,
        recipientEmail: queued.recipient_email,
        customerName: queued.customer_name,
        invoiceAmount: queued.invoice_amount,
        dueDate,
        daysOverdue: queued.days_overdue,
        emailType: queued.email_type as any,
        attemptNumber: queued.attempt_number,
      });

      logInfo(MODULE, 'approveQueuedEmail', 'Email sent successfully');
    } catch (emailErr: any) {
      logError(MODULE, 'approveQueuedEmail', 'Failed to send email', emailErr);
      return res.status(400).json({ error: 'Failed to send email: ' + emailErr.message });
    }

    // 3. Mark as sent in database
    await pool.query(
      `UPDATE pilot_queued_emails
       SET status = 'sent', sent_at = NOW()
       WHERE id = $1`,
      [id]
    );

    logInfo(MODULE, 'approveQueuedEmail', 'Email marked as sent');

    return res.json({
      message: 'Email sent successfully',
      email_id: id,
    });
  } catch (err: any) {
    logError(MODULE, 'approveQueuedEmail', 'Failed to approve email', err);
    return res.status(400).json({ error: err.message });
  }
};

/**
 * POST /api/pilot-queue/:id/reject
 * Reject a queued email (don't send it)
 */
export const rejectQueuedEmail = async (req: Request, res: Response) => {
  const { id } = req.params;
  const companyId = (req as any).companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Mark as rejected
    const result = await pool.query(
      `UPDATE pilot_queued_emails
       SET status = 'rejected'
       WHERE id = $1 AND company_id = $2
       RETURNING id`,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    logInfo(MODULE, 'rejectQueuedEmail', 'Email rejected');

    return res.json({
      message: 'Email rejected',
      email_id: id,
    });
  } catch (err: any) {
    logError(MODULE, 'rejectQueuedEmail', 'Failed to reject email', err);
    return res.status(400).json({ error: err.message });
  }
};

/**
 * POST /api/pilot-queue/approve-all
 * Approve and send all pending queued emails
 */
export const approveAllQueuedEmails = async (req: Request, res: Response) => {
  const companyId = (req as any).companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get all pending emails
    const result = await pool.query(
      `SELECT
        id,
        invoice_id,
        customer_id,
        recipient_email,
        customer_name,
        invoice_amount,
        due_date,
        days_overdue,
        email_type,
        attempt_number
       FROM pilot_queued_emails
       WHERE company_id = $1 AND status = 'pending'
       ORDER BY queued_at ASC`,
      [companyId]
    );

    const emails = result.rows;
    let sentCount = 0;
    let failedCount = 0;
    const errors: any[] = [];

    logInfo(MODULE, 'approveAllQueuedEmails', `Processing ${emails.length} emails`);

    // Send each email
    for (const queued of emails) {
      try {
        // Use exact due_date stored at queue time (not reconstructed from days_overdue which drifts)
        const dueDate = queued.due_date || new Date(Date.now() - queued.days_overdue * 24 * 60 * 60 * 1000).toISOString();

        await emailService.sendDunningEmail({
          companyId,
          invoiceId: queued.invoice_id,
          customerId: queued.customer_id,
          recipientEmail: queued.recipient_email,
          customerName: queued.customer_name,
          invoiceAmount: queued.invoice_amount,
          dueDate,
          daysOverdue: queued.days_overdue,
          emailType: queued.email_type as any,
          attemptNumber: queued.attempt_number,
        });

        // Mark as sent
        await pool.query(
          `UPDATE pilot_queued_emails
           SET status = 'sent', sent_at = NOW()
           WHERE id = $1`,
          [queued.id]
        );

        sentCount++;
      } catch (err: any) {
        failedCount++;
        errors.push({
          email_id: queued.id,
          customer: queued.customer_name,
          error: err.message,
        });
        logError(MODULE, 'approveAllQueuedEmails', `Failed to send email to ${queued.customer_name}`, err);
      }
    }

    logInfo(MODULE, 'approveAllQueuedEmails', `Completed: ${sentCount} sent, ${failedCount} failed`);

    return res.json({
      message: `Sent ${sentCount} emails`,
      sent_count: sentCount,
      failed_count: failedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    logError(MODULE, 'approveAllQueuedEmails', 'Failed to process emails', err);
    return res.status(400).json({ error: err.message });
  }
};

/**
 * GET /api/pilot-queue/stats
 * Get statistics about queued emails
 */
export const getQueueStats = async (req: Request, res: Response) => {
  const companyId = (req as any).companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await pool.query(
      `SELECT
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(*) as total,
        SUM(invoice_amount) as total_amount
       FROM pilot_queued_emails
       WHERE company_id = $1`,
      [companyId]
    );

    const row = result.rows[0];
    return res.json({
      data: {
        pending: parseInt(row.pending) || 0,
        approved: parseInt(row.approved) || 0,
        sent: parseInt(row.sent) || 0,
        rejected: parseInt(row.rejected) || 0,
        total: parseInt(row.total) || 0,
        total_amount: parseFloat(row.total_amount) || 0,
      },
    });
  } catch (err: any) {
    logError(MODULE, 'getQueueStats', 'Failed to get stats', err);
    return res.status(400).json({ error: err.message });
  }
};
