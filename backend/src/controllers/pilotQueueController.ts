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
  const statusParam = (req.query.status as string | undefined) || 'pending';

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Validate status parameter
    const validStatuses = ['pending', 'rejected', 'sent', 'failed'];
    const status = validStatuses.includes(statusParam) ? statusParam : 'pending';

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
        status,
        subject,
        body,
        user_rejected_at
       FROM pilot_queued_emails
       WHERE company_id = $1 AND status = $2
       ORDER BY queued_at DESC
       LIMIT 50`,
      [companyId, status]
    );

    logInfo(MODULE, 'listQueuedEmails', `Retrieved ${result.rows.length} queued emails`, { status });

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
    // 1. Get the queued email record (including user-edited subject/body if present)
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
        attempt_number,
        subject,
        body
       FROM pilot_queued_emails
       WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );

    if (queuedResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const queued = queuedResult.rows[0];

    logInfo(MODULE, 'approveQueuedEmail', `Approving queued email for ${queued.customer_name}`);

    // 2. Send the email (use stored subject/body if edited by user, otherwise regenerate)
    try {
      const dueDate = queued.due_date || new Date(Date.now() - queued.days_overdue * 24 * 60 * 60 * 1000).toISOString();

      // If user edited subject/body, use those; otherwise regenerate via Claude
      if (queued.subject && queued.body) {
        // User edited this email — send with stored content
        logInfo(MODULE, 'approveQueuedEmail', 'Sending with user-edited content', {
          invoiceId: queued.invoice_id,
          hasStoredSubject: !!queued.subject,
        });

        // Send directly without regenerating (uses stored subject + body)
        const result = await emailService.sendDunningEmailDirect({
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
          // User-edited content:
          storedSubject: queued.subject,
          storedBody: queued.body,
        });
      } else {
        // Not edited — regenerate via Claude as usual
        logInfo(MODULE, 'approveQueuedEmail', 'Sending with AI-generated content', {
          invoiceId: queued.invoice_id,
        });

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
      }

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
 * POST /api/pilot-queue/:id/move-to-pending
 * Move a rejected email back to pending (SHADOW mode - for review/edit before approval)
 */
export const moveRejectedToPending = async (req: Request, res: Response) => {
  const { id } = req.params;
  const companyId = (req as any).companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get the email first to verify it exists and get invoice_id + email_type
    const getResult = await pool.query(
      `SELECT id, invoice_id, email_type FROM pilot_queued_emails
       WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );

    if (getResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const email = getResult.rows[0];

    // 1. Update status from rejected to pending
    await pool.query(
      `UPDATE pilot_queued_emails
       SET status = 'pending'
       WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );

    // 2. Delete rejection_tracking block to unblock future sends
    await pool.query(
      `DELETE FROM rejection_tracking
       WHERE invoice_id = $1 AND email_type = $2 AND company_id = $3`,
      [email.invoice_id, email.email_type, companyId]
    );

    logInfo(MODULE, 'moveRejectedToPending', 'Email moved from rejected to pending for review', {
      emailId: id,
      invoiceId: email.invoice_id,
    });

    return res.json({
      message: 'Email moved to pending approval for review and editing',
      email_id: id,
    });
  } catch (err: any) {
    logError(MODULE, 'moveRejectedToPending', 'Failed to move email to pending', err);
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
    // Get all pending emails (including user-edited subject/body)
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
        attempt_number,
        subject,
        body
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
        const dueDate = queued.due_date || new Date(Date.now() - queued.days_overdue * 24 * 60 * 60 * 1000).toISOString();

        // If user edited, use stored content; otherwise regenerate
        if (queued.subject && queued.body) {
          // User edited this email — send with stored content
          await emailService.sendDunningEmailDirect({
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
            storedSubject: queued.subject,
            storedBody: queued.body,
          });
        } else {
          // Not edited — regenerate via Claude
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
        }

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

/**
 * PUT /api/pilot-queue/:id
 * Update subject/body of a queued email (user customization before send)
 */
export const updateQueuedEmail = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { subject, body } = req.body;
  const companyId = (req as any).companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!subject || !body) {
    return res.status(400).json({ error: 'subject and body are required' });
  }

  try {
    const result = await pool.query(
      `UPDATE pilot_queued_emails
       SET subject = $1, body = $2
       WHERE id = $3 AND company_id = $4 AND status = 'pending'
       RETURNING id, subject, body`,
      [subject, body, id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found or cannot be edited (must be pending)' });
    }

    logInfo(MODULE, 'updateQueuedEmail', 'Email updated', { email_id: id });

    return res.json({
      message: 'Email updated successfully',
      data: result.rows[0],
    });
  } catch (err: any) {
    logError(MODULE, 'updateQueuedEmail', 'Failed to update email', err);
    return res.status(400).json({ error: err.message });
  }
};

/**
 * POST /api/pilot-queue/:id/preview
 * Preview a queued email (read-only TO, SUBJECT, MESSAGE)
 */
export const previewQueuedEmail = async (req: Request, res: Response) => {
  const { id } = req.params;
  const companyId = (req as any).companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await pool.query(
      `SELECT
        id,
        recipient_email,
        subject,
        body
       FROM pilot_queued_emails
       WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const email = result.rows[0];

    logInfo(MODULE, 'previewQueuedEmail', 'Email previewed', { email_id: id });

    return res.json({
      data: {
        id: email.id,
        to: email.recipient_email,
        subject: email.subject,
        message: email.body,
      },
    });
  } catch (err: any) {
    logError(MODULE, 'previewQueuedEmail', 'Failed to preview email', err);
    return res.status(400).json({ error: err.message });
  }
};

/**
 * POST /api/pilot-queue/:id/retry
 * Manually retry a failed email
 */
export const retryQueuedEmail = async (req: Request, res: Response) => {
  const { id } = req.params;
  const companyId = (req as any).companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get the failed email
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
        subject,
        body,
        failure_count
       FROM pilot_queued_emails
       WHERE id = $1 AND company_id = $2 AND status = 'failed'`,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found or not in failed state' });
    }

    const email = result.rows[0];

    // Retry send
    try {
      const dueDate = email.due_date || new Date(Date.now() - email.days_overdue * 24 * 60 * 60 * 1000).toISOString();

      const sendResult = await emailService.sendDunningEmailDirect({
        companyId,
        invoiceId: email.invoice_id,
        customerId: email.customer_id,
        recipientEmail: email.recipient_email,
        customerName: email.customer_name,
        invoiceAmount: email.invoice_amount,
        dueDate,
        daysOverdue: email.days_overdue,
        emailType: email.email_type as any,
        attemptNumber: (email.failure_count || 0) + 1,
        storedSubject: email.subject,
        storedBody: email.body,
      });

      if (sendResult.success) {
        // Mark as sent
        await pool.query(
          `UPDATE pilot_queued_emails
           SET status = 'sent', sent_at = NOW(), failure_count = 0
           WHERE id = $1`,
          [id]
        );

        logInfo(MODULE, 'retryQueuedEmail', 'Email retry successful', { email_id: id });

        return res.json({
          message: 'Email sent successfully',
          email_id: id,
        });
      } else {
        // Schedule next retry
        const nextFailureCount = (email.failure_count || 0) + 1;
        const backoffMinutes = 5 * nextFailureCount;
        const retryAt = new Date();
        retryAt.setMinutes(retryAt.getMinutes() + backoffMinutes);

        await pool.query(
          `UPDATE pilot_queued_emails
           SET status = 'failed', failure_count = $1, last_error = $2, retry_at = $3
           WHERE id = $4`,
          [nextFailureCount, sendResult.error || 'Unknown error', retryAt, id]
        );

        logError(MODULE, 'retryQueuedEmail', 'Email retry failed', { email_id: id, error: sendResult.error });

        return res.status(400).json({
          error: 'Retry failed',
          message: sendResult.error || 'Unknown error',
          nextRetryAt: retryAt.toISOString(),
        });
      }
    } catch (sendErr: any) {
      logError(MODULE, 'retryQueuedEmail', 'Exception during retry', sendErr);
      return res.status(400).json({ error: 'Failed to retry email: ' + sendErr.message });
    }
  } catch (err: any) {
    logError(MODULE, 'retryQueuedEmail', 'Failed to retry email', err);
    return res.status(400).json({ error: err.message });
  }
};
