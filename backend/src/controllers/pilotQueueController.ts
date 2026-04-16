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
        user_rejected_at,
        type,
        phone_number,
        message_preview,
        message_full
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
    // 1. Get the queued item (email or SMS)
    const queuedResult = await pool.query(
      `SELECT
        id,
        invoice_id,
        customer_id,
        recipient_email,
        customer_name,
        phone_number,
        invoice_amount,
        due_date,
        days_overdue,
        email_type,
        attempt_number,
        type,
        subject,
        body,
        message_preview,
        message_full
       FROM pilot_queued_emails
       WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );

    if (queuedResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const queued = queuedResult.rows[0];
    const itemType = queued.type || 'email';

    logInfo(MODULE, 'approveQueuedEmail', `Approving queued ${itemType} for ${queued.customer_name}`);

    // 2. Send the item (email or SMS)
    try {
      if (itemType === 'sms') {
        // SMS: Send via Twilio
        const { sendSMS } = await import('../services/smsService');
        const message = queued.message_full || queued.message_preview;

        logInfo(MODULE, 'approveQueuedEmail', 'Sending SMS', {
          invoiceId: queued.invoice_id,
          phone: queued.phone_number,
        });

        await sendSMS({
          phoneNumber: queued.phone_number,
          message,
          companyId,
          invoiceId: queued.invoice_id,
          customerId: queued.customer_id,
          customerName: queued.customer_name,
        } as any);
      } else {
        // EMAIL: Send via Resend (existing logic)
        const dueDate = queued.due_date || new Date(Date.now() - queued.days_overdue * 24 * 60 * 60 * 1000).toISOString();

        if (queued.subject && queued.body) {
          logInfo(MODULE, 'approveQueuedEmail', 'Sending with user-edited content', {
            invoiceId: queued.invoice_id,
          });

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
      }

      logInfo(MODULE, 'approveQueuedEmail', `${itemType} sent successfully`);
    } catch (sendErr: any) {
      logError(MODULE, 'approveQueuedEmail', `Failed to send ${itemType}`, sendErr);
      return res.status(400).json({ error: `Failed to send ${itemType}: ` + sendErr.message });
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
 * POST /api/pilot-queue/bulk/approve-selected
 * Approve and send selected pending emails (backend batching: 50 items at a time)
 * Request body: { ids: string[] }
 * Max: 500 emails per request, processed in batches of 50
 */
export const bulkApproveSelected = async (req: Request, res: Response) => {
  const { ids } = req.body;
  const companyId = (req as any).companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required and must not be empty' });
  }

  if (ids.length > 500) {
    return res.status(400).json({ error: 'Maximum 500 emails per request' });
  }

  try {
    const BATCH_SIZE = 50;
    let sentCount = 0;
    let failedCount = 0;
    const errors: any[] = [];

    logInfo(MODULE, 'bulkApproveSelected', `Starting bulk approve with ${ids.length} emails in batches of ${BATCH_SIZE}`);

    // Process in batches of 50
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batchIds = ids.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(ids.length / BATCH_SIZE);

      try {
        // Get items (emails or SMS) for this batch
        const itemResult = await pool.query(
          `SELECT
            id,
            invoice_id,
            customer_id,
            recipient_email,
            phone_number,
            customer_name,
            invoice_amount,
            due_date,
            days_overdue,
            email_type,
            attempt_number,
            type,
            subject,
            body,
            message_preview,
            message_full
           FROM pilot_queued_emails
           WHERE company_id = $1 AND id = ANY($2::uuid[]) AND status = 'pending'`,
          [companyId, batchIds]
        );

        const items = itemResult.rows;

        logInfo(MODULE, 'bulkApproveSelected', `Batch ${batchNum}/${totalBatches}: Processing ${items.length} items`);

        // Send all items (email or SMS) in this batch in parallel
        const sendPromises = items.map(async (queued) => {
          try {
            const itemType = queued.type || 'email';

            if (itemType === 'sms') {
              // Send SMS
              const { sendSMS } = await import('../services/smsService');
              const message = queued.message_full || queued.message_preview;

              await sendSMS({
                phoneNumber: queued.phone_number,
                message,
                companyId,
                invoiceId: queued.invoice_id,
                customerId: queued.customer_id,
                customerName: queued.customer_name,
              } as any);
            } else {
              // Send EMAIL
              const dueDate = queued.due_date || new Date(Date.now() - queued.days_overdue * 24 * 60 * 60 * 1000).toISOString();

              if (queued.subject && queued.body) {
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
            }

            await pool.query(
              `UPDATE pilot_queued_emails SET status = 'sent', sent_at = NOW() WHERE id = $1`,
              [queued.id]
            );

            sentCount++;
          } catch (err: any) {
            failedCount++;
            errors.push({ item_id: queued.id, customer: queued.customer_name, error: err.message });
            logError(MODULE, 'bulkApproveSelected', `Failed to send item to ${queued.customer_name}`, err);
          }
        });

        await Promise.all(sendPromises);
      } catch (batchErr: any) {
        logError(MODULE, 'bulkApproveSelected', `Batch ${batchNum} failed`, batchErr);
        batchIds.forEach((id) => {
          errors.push({ email_id: id, error: batchErr.message });
          failedCount++;
        });
      }
    }

    logInfo(MODULE, 'bulkApproveSelected', `Completed: ${sentCount} sent, ${failedCount} failed`);

    return res.json({
      message: `Approved ${sentCount} emails`,
      sent_count: sentCount,
      failed_count: failedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    logError(MODULE, 'bulkApproveSelected', 'Failed to process bulk approve', err);
    return res.status(400).json({ error: err.message });
  }
};

/**
 * POST /api/pilot-queue/bulk/reject-selected
 * Reject selected pending emails (backend batching: 50 items at a time)
 * Request body: { ids: string[] }
 * Max: 500 emails per request, processed in batches of 50
 */
export const bulkRejectSelected = async (req: Request, res: Response) => {
  const { ids } = req.body;
  const companyId = (req as any).companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required and must not be empty' });
  }

  if (ids.length > 500) {
    return res.status(400).json({ error: 'Maximum 500 emails per request' });
  }

  try {
    const BATCH_SIZE = 50;
    let rejectedCount = 0;
    let failedCount = 0;
    const errors: any[] = [];

    logInfo(MODULE, 'bulkRejectSelected', `Starting bulk reject with ${ids.length} emails in batches of ${BATCH_SIZE}`);

    // Process in batches of 50
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batchIds = ids.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(ids.length / BATCH_SIZE);

      try {
        // Get emails for this batch
        const emailResult = await pool.query(
          `SELECT
            id,
            invoice_id,
            email_type
           FROM pilot_queued_emails
           WHERE company_id = $1 AND id = ANY($2::uuid[]) AND status = 'pending'`,
          [companyId, batchIds]
        );

        const emails = emailResult.rows;

        logInfo(MODULE, 'bulkRejectSelected', `Batch ${batchNum}/${totalBatches}: Processing ${emails.length} emails`);

        // Update and create tracking in parallel
        const rejectPromises = emails.map(async (email) => {
          try {
            await pool.query(
              `UPDATE pilot_queued_emails SET status = 'rejected', user_rejected_at = NOW() WHERE id = $1`,
              [email.id]
            );

            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            await pool.query(
              `INSERT INTO rejection_tracking (company_id, invoice_id, email_type, expires_at)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT DO NOTHING`,
              [companyId, email.invoice_id, email.email_type, expiresAt]
            );

            rejectedCount++;
          } catch (err: any) {
            failedCount++;
            errors.push({ email_id: email.id, error: err.message });
            logError(MODULE, 'bulkRejectSelected', `Failed to reject email ${email.id}`, err);
          }
        });

        await Promise.all(rejectPromises);
      } catch (batchErr: any) {
        logError(MODULE, 'bulkRejectSelected', `Batch ${batchNum} failed`, batchErr);
        batchIds.forEach((id) => {
          errors.push({ email_id: id, error: batchErr.message });
          failedCount++;
        });
      }
    }

    logInfo(MODULE, 'bulkRejectSelected', `Completed: ${rejectedCount} rejected, ${failedCount} failed`);

    return res.json({
      message: `Rejected ${rejectedCount} emails`,
      rejected_count: rejectedCount,
      failed_count: failedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    logError(MODULE, 'bulkRejectSelected', 'Failed to process bulk reject', err);
    return res.status(400).json({ error: err.message });
  }
};

/**
 * POST /api/pilot-queue/bulk/move-to-pending-selected
 * Move selected rejected emails back to pending (backend batching: 50 items at a time)
 * Request body: { ids: string[] }
 * Max: 500 emails per request, processed in batches of 50
 */
export const bulkMoveToPendingSelected = async (req: Request, res: Response) => {
  const { ids } = req.body;
  const companyId = (req as any).companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required and must not be empty' });
  }

  if (ids.length > 500) {
    return res.status(400).json({ error: 'Maximum 500 emails per request' });
  }

  try {
    const BATCH_SIZE = 50;
    let movedCount = 0;
    let failedCount = 0;
    const errors: any[] = [];

    logInfo(MODULE, 'bulkMoveToPendingSelected', `Starting bulk move with ${ids.length} emails in batches of ${BATCH_SIZE}`);

    // Process in batches of 50
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batchIds = ids.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(ids.length / BATCH_SIZE);

      try {
        // Get emails for this batch
        const emailResult = await pool.query(
          `SELECT
            id,
            invoice_id,
            email_type
           FROM pilot_queued_emails
           WHERE company_id = $1 AND id = ANY($2::uuid[]) AND status = 'rejected'`,
          [companyId, batchIds]
        );

        const emails = emailResult.rows;

        logInfo(MODULE, 'bulkMoveToPendingSelected', `Batch ${batchNum}/${totalBatches}: Processing ${emails.length} emails`);

        // Update and delete in parallel
        const movePromises = emails.map(async (email) => {
          try {
            await pool.query(
              `UPDATE pilot_queued_emails SET status = 'pending' WHERE id = $1`,
              [email.id]
            );

            await pool.query(
              `DELETE FROM rejection_tracking WHERE company_id = $1 AND invoice_id = $2 AND email_type = $3`,
              [companyId, email.invoice_id, email.email_type]
            );

            movedCount++;
          } catch (err: any) {
            failedCount++;
            errors.push({ email_id: email.id, error: err.message });
            logError(MODULE, 'bulkMoveToPendingSelected', `Failed to move email ${email.id}`, err);
          }
        });

        await Promise.all(movePromises);
      } catch (batchErr: any) {
        logError(MODULE, 'bulkMoveToPendingSelected', `Batch ${batchNum} failed`, batchErr);
        batchIds.forEach((id) => {
          errors.push({ email_id: id, error: batchErr.message });
          failedCount++;
        });
      }
    }

    logInfo(MODULE, 'bulkMoveToPendingSelected', `Completed: ${movedCount} moved, ${failedCount} failed`);

    return res.json({
      message: `Moved ${movedCount} emails to pending`,
      moved_count: movedCount,
      failed_count: failedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    logError(MODULE, 'bulkMoveToPendingSelected', 'Failed to process bulk move-to-pending', err);
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

/**
 * POST /api/pilot-queue/test/populate
 * TEST ENDPOINT: Populate queue with sample email + SMS items (staging only)
 * Requires: ?count=1 (default 1) to create that many email+SMS pairs
 * Example: POST /api/pilot-queue/test/populate?count=3
 * Creates: 3 email items + 3 SMS items in pending state (SHADOW mode)
 */
export const testPopulateQueue = async (req: Request, res: Response) => {
  const companyId = (req as any).companyId;
  const count = Math.min(parseInt((req.query.count as string) || '1'), 10); // Max 10 pairs

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logInfo(MODULE, 'testPopulateQueue', `Creating ${count} test email+SMS pairs`, { companyId });

    // Get or create test customer
    const customerResult = await pool.query(
      `SELECT id FROM customers WHERE company_id = $1 AND name ILIKE '%Test Customer%' LIMIT 1`,
      [companyId]
    );

    let customerId: string;

    if (customerResult.rows.length === 0) {
      // Create test customer
      const createCustomer = await pool.query(
        `INSERT INTO customers (company_id, name, email, phone)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [companyId, 'Test Customer (Auto)', 'test@example.com', '+1-415-555-1234']
      );
      customerId = createCustomer.rows[0].id;
      logInfo(MODULE, 'testPopulateQueue', 'Created test customer', { customerId });
    } else {
      customerId = customerResult.rows[0].id;
    }

    // Create NEW test invoice each call (so each call can populate with fresh items)
    const createInvoice = await pool.query(
      `INSERT INTO invoices (company_id, customer_id, amount, currency, issued_date, due_date, status, source, notes)
       VALUES ($1, $2, $3, $4, NOW(), NOW() - INTERVAL '15 days', $5, $6, $7)
       RETURNING id`,
      [companyId, customerId, 5000, 'USD', 'unpaid', 'manual', `Test Invoice (Auto) - ${Date.now()}`]
    );
    const invoiceId = createInvoice.rows[0].id;
    logInfo(MODULE, 'testPopulateQueue', 'Created test invoice', { invoiceId });

    // Create email + SMS items
    const created: any[] = [];

    // Test Data: Create 3 emails (dunning tiers) + 2 SMS (escalation)
    // Real flow: Email Tier 1→2→3 (if no response), THEN SMS Tier 1→2 (if email fails)

    // Email Tier 1: First contact (Day 5)
    const emailTier1Type = 'dunning_tier_1';
    await pool.query(
      `INSERT INTO pilot_queued_emails (
        company_id, invoice_id, customer_id,
        recipient_email, customer_name, invoice_amount, days_overdue,
        email_type, type, subject, body, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        companyId,
        invoiceId,
        customerId,
        'test@example.com',
        'Test Customer (Auto)',
        5000,
        5, // Day 5: First email
        emailTier1Type,
        'email',
        '[TEST] Payment Reminder - Invoice #1001',
        '<p>Hi Test Customer,</p><p>Our records show that Invoice #1001 for $5,000 is now due. Please remit payment at your earliest convenience.</p><p>Thank you!</p>',
        'pending',
      ]
    );
    const email1Res = await pool.query(
      `SELECT id FROM pilot_queued_emails WHERE company_id = $1 AND email_type = $2 ORDER BY created_at DESC LIMIT 1`,
      [companyId, emailTier1Type]
    );
    if (email1Res.rows.length > 0) {
      created.push({ type: 'email', email_type: emailTier1Type, id: email1Res.rows[0].id });
    }

    // Email Tier 2: Second contact (Day 12, if email 1 not responded)
    const emailTier2Type = 'dunning_tier_2';
    await pool.query(
      `INSERT INTO pilot_queued_emails (
        company_id, invoice_id, customer_id,
        recipient_email, customer_name, invoice_amount, days_overdue,
        email_type, type, subject, body, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        companyId,
        invoiceId,
        customerId,
        'test@example.com',
        'Test Customer (Auto)',
        5000,
        12, // Day 12: Second email (7 days after first)
        emailTier2Type,
        'email',
        '[URGENT] Payment Required - Invoice #1001',
        '<p>URGENT: Invoice #1001 is now 12 days overdue. Immediate payment is required.</p><p>Please contact us if payment has already been sent or if you have questions.</p>',
        'pending',
      ]
    );
    const email2Res = await pool.query(
      `SELECT id FROM pilot_queued_emails WHERE company_id = $1 AND email_type = $2 ORDER BY created_at DESC LIMIT 1`,
      [companyId, emailTier2Type]
    );
    if (email2Res.rows.length > 0) {
      created.push({ type: 'email', email_type: emailTier2Type, id: email2Res.rows[0].id });
    }

    // Email Tier 3: Final email escalation (Day 18, if emails 1-2 not responded)
    const emailTier3Type = 'dunning_tier_3';
    await pool.query(
      `INSERT INTO pilot_queued_emails (
        company_id, invoice_id, customer_id,
        recipient_email, customer_name, invoice_amount, days_overdue,
        email_type, type, subject, body, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        companyId,
        invoiceId,
        customerId,
        'test@example.com',
        'Test Customer (Auto)',
        5000,
        18, // Day 18: Final email notice
        emailTier3Type,
        'email',
        '[FINAL] Legal Action Pending - Invoice #1001',
        '<p>FINAL NOTICE: Invoice #1001 is 18 days overdue. This is your final notice before we escalate to legal proceedings.</p><p>Please remit payment immediately or contact us.</p>',
        'pending',
      ]
    );
    const email3Res = await pool.query(
      `SELECT id FROM pilot_queued_emails WHERE company_id = $1 AND email_type = $2 ORDER BY created_at DESC LIMIT 1`,
      [companyId, emailTier3Type]
    );
    if (email3Res.rows.length > 0) {
      created.push({ type: 'email', email_type: emailTier3Type, id: email3Res.rows[0].id });
    }

    // SMS Tier 1: Escalation to SMS (Day 20, after emails 1-3 failed)
    const smsTier1Type = 'sms_tier_1';
    await pool.query(
      `INSERT INTO pilot_queued_emails (
        company_id, invoice_id, customer_id,
        recipient_email, phone_number, customer_name, invoice_amount, days_overdue,
        email_type, type, message_preview, message_full, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        companyId,
        invoiceId,
        customerId,
        'sms@example.com', // Placeholder for SMS items
        '+1-415-555-1234',
        'Test Customer (Auto)',
        5000,
        20, // Day 20: SMS escalation (emails failed)
        smsTier1Type,
        'sms',
        'URGENT: Your $5,000 invoice #1001 is 20 days overdue. Reply STOP to opt out.',
        'URGENT: Your $5000 invoice #1001 is 20 days overdue. Please remit payment immediately or contact our office. Reply STOP to opt out.',
        'pending',
      ]
    );
    const sms1Res = await pool.query(
      `SELECT id FROM pilot_queued_emails WHERE company_id = $1 AND email_type = $2 ORDER BY created_at DESC LIMIT 1`,
      [companyId, smsTier1Type]
    );
    if (sms1Res.rows.length > 0) {
      created.push({ type: 'sms', email_type: smsTier1Type, id: sms1Res.rows[0].id });
    }

    // SMS Tier 2: SMS Retry (Day 27, if SMS tier 1 failed)
    const smsTier2Type = 'sms_tier_2';
    await pool.query(
      `INSERT INTO pilot_queued_emails (
        company_id, invoice_id, customer_id,
        recipient_email, phone_number, customer_name, invoice_amount, days_overdue,
        email_type, type, message_preview, message_full, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        companyId,
        invoiceId,
        customerId,
        'sms@example.com',
        '+1-415-555-1234',
        'Test Customer (Auto)',
        5000,
        27, // Day 27: SMS retry
        smsTier2Type,
        'sms',
        'FINAL: Invoice #1001 ($5K) - 27 days overdue. Legal action pending.',
        'FINAL NOTICE: Invoice #1001 for $5000 is 27 days overdue. This is your final notice before legal action. Contact us immediately. Reply STOP to opt out.',
        'pending',
      ]
    );
    const sms2Res = await pool.query(
      `SELECT id FROM pilot_queued_emails WHERE company_id = $1 AND email_type = $2 ORDER BY created_at DESC LIMIT 1`,
      [companyId, smsTier2Type]
    );
    if (sms2Res.rows.length > 0) {
      created.push({ type: 'sms', email_type: smsTier2Type, id: sms2Res.rows[0].id });
    }

    logInfo(MODULE, 'testPopulateQueue', 'Created test dunning flow: 3 emails + 2 SMS', {});

    return res.json({
      message: 'Created complete dunning flow: 3 emails (tiers 1-3) + 2 SMS (escalation + retry)',
      flow: 'Day 5: Email Tier 1 → Day 12: Email Tier 2 → Day 18: Email Tier 3 → Day 20: SMS Tier 1 → Day 27: SMS Tier 2',
      customer_id: customerId,
      invoice_id: invoiceId,
      created_count: created.length,
      items: created,
    });
  } catch (err: any) {
    logError(MODULE, 'testPopulateQueue', 'Failed to populate test queue', err);
    return res.status(400).json({ error: err.message });
  }
};
