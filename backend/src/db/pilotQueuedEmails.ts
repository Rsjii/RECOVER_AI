/**
 * P0: Email Queue Database Layer (4-State System)
 * States: pending, rejected, sent, failed
 * Supports both SHADOW (user approval) and AUTO (agent autonomous) modes
 */

import { pool } from '../config/database';
import { logInfo, logError } from '../utils/logger';

export interface QueuedEmail {
  id: string;
  company_id: string;
  invoice_id: string;
  customer_id: string;
  recipient_email: string;
  customer_name: string;
  invoice_amount: number;
  days_overdue: number;
  email_type: string;
  status: 'pending' | 'rejected' | 'sent' | 'failed';
  subject: string;
  body: string;
  created_at: string;
  sent_at?: string;
  failure_count: number;
  last_error?: string;
  retry_at?: string;
  user_approved_at?: string;
  user_rejected_at?: string;
  user_edited_at?: string;
  resend_message_id?: string;
  risk_score?: number;
}

// ============================================================
// INSERT: Queue email with full content
// ============================================================
export async function insertQueuedEmail(params: {
  companyId: string;
  invoiceId: string;
  customerId: string;
  recipientEmail: string;
  customerName: string;
  invoiceAmount: number;
  daysOverdue: number;
  dueDate?: string;
  emailType: string;
  subject?: string; // Generated email subject (optional, generated on demand if not provided)
  body?: string;   // Generated email body (optional, generated on demand if not provided)
  riskScore?: number;
}): Promise<string | null> {
  try {
    const result = await pool.query(
      `INSERT INTO pilot_queued_emails
         (company_id, invoice_id, customer_id, recipient_email, customer_name,
          invoice_amount, days_overdue, due_date, email_type, subject, body,
          status, created_at, risk_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13)
       ON CONFLICT (company_id, invoice_id, email_type) WHERE status = 'pending' DO NOTHING
       RETURNING id`,
      [
        params.companyId,
        params.invoiceId,
        params.customerId,
        params.recipientEmail,
        params.customerName,
        params.invoiceAmount,
        params.daysOverdue,
        params.dueDate,
        params.emailType,
        params.subject,
        params.body,
        'pending',
        params.riskScore || null,
      ]
    );

    const id = result.rows[0]?.id || null;
    if (id) {
      logInfo('pilotQueue', 'insert', `Queued email: ${params.emailType}`, {
        invoiceId: params.invoiceId,
        id,
      });
    }
    return id;
  } catch (error) {
    logError('pilotQueue', 'insert', 'Error queuing email', error);
    throw error;
  }
}

// ============================================================
// GET: List pending emails (SHADOW mode - user approval needed)
// ============================================================
export async function getPendingEmails(companyId: string): Promise<QueuedEmail[]> {
  try {
    const result = await pool.query(
      `SELECT *
       FROM pilot_queued_emails
       WHERE company_id = $1 AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 100`,
      [companyId]
    );
    return result.rows as QueuedEmail[];
  } catch (error) {
    logError('pilotQueue', 'getPendingEmails', 'Error fetching pending', error);
    throw error;
  }
}

// ============================================================
// GET: List with filters (Activity tab)
// ============================================================
export async function listQueuedEmailsWithFilters(companyId: string, filters: {
  status?: 'pending' | 'rejected' | 'sent' | 'failed';
  customerId?: string;
  emailType?: string;
  daysOverdueMin?: number;
  daysOverdueMax?: number;
  sortBy?: 'newest' | 'oldest' | 'amount_high' | 'days_desc';
  limit?: number;
  offset?: number;
}): Promise<{ rows: QueuedEmail[]; total: number }> {
  try {
    let whereClause = 'WHERE company_id = $1';
    const params: any[] = [companyId];
    let paramIndex = 2;

    if (filters.status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.customerId) {
      whereClause += ` AND customer_id = $${paramIndex}`;
      params.push(filters.customerId);
      paramIndex++;
    }

    if (filters.emailType) {
      whereClause += ` AND email_type = $${paramIndex}`;
      params.push(filters.emailType);
      paramIndex++;
    }

    if (filters.daysOverdueMin !== undefined) {
      whereClause += ` AND days_overdue >= $${paramIndex}`;
      params.push(filters.daysOverdueMin);
      paramIndex++;
    }

    if (filters.daysOverdueMax !== undefined) {
      whereClause += ` AND days_overdue <= $${paramIndex}`;
      params.push(filters.daysOverdueMax);
      paramIndex++;
    }

    let orderClause = 'ORDER BY created_at DESC';
    if (filters.sortBy === 'oldest') {
      orderClause = 'ORDER BY created_at ASC';
    } else if (filters.sortBy === 'amount_high') {
      orderClause = 'ORDER BY invoice_amount DESC';
    } else if (filters.sortBy === 'days_desc') {
      orderClause = 'ORDER BY days_overdue DESC';
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM pilot_queued_emails ${whereClause}`,
      params
    );

    // Get paginated data
    const dataResult = await pool.query(
      `SELECT * FROM pilot_queued_emails
       ${whereClause}
       ${orderClause}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      rows: dataResult.rows as QueuedEmail[],
      total: parseInt(countResult.rows[0].total || '0'),
    };
  } catch (error) {
    logError('pilotQueue', 'listWithFilters', 'Error fetching with filters', error);
    throw error;
  }
}

// ============================================================
// APPROVE: Immediate send in SHADOW mode
// ============================================================
export async function approveAndSendEmail(
  id: string,
  companyId: string,
  editedSubject?: string,
  editedBody?: string
): Promise<QueuedEmail | null> {
  try {
    // If user edited, update the content
    let updateClause = 'user_approved_at = NOW()';
    const params: any[] = [];

    if (editedSubject) {
      updateClause += ', subject = $1, edited_subject = $1';
      params.push(editedSubject);
    }

    if (editedBody) {
      const paramIdx = editedSubject ? 2 : 1;
      updateClause += `, body = $${paramIdx}, edited_body = $${paramIdx}`;
      params.push(editedBody);
    }

    if (editedSubject || editedBody) {
      updateClause += ', user_edited_at = NOW()';
    }

    const finalIdx = editedSubject && editedBody ? 3 : (editedSubject || editedBody) ? 2 : 1;
    const result = await pool.query(
      `UPDATE pilot_queued_emails
       SET ${updateClause}
       WHERE id = $${finalIdx} AND company_id = $${finalIdx + 1} AND status = 'pending'
       RETURNING *`,
      [...params, id, companyId]
    );

    if (result.rows.length === 0) {
      logError('pilotQueue', 'approve', 'Email not found or not pending', { id, companyId });
      return null;
    }

    logInfo('pilotQueue', 'approve', 'Email approved', { id, companyId });
    return result.rows[0] as QueuedEmail;
  } catch (error) {
    logError('pilotQueue', 'approve', 'Error approving email', error);
    throw error;
  }
}

// ============================================================
// REJECT: Mark rejected + 7-day block
// ============================================================
export async function rejectEmail(id: string, companyId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `UPDATE pilot_queued_emails
       SET status = 'rejected', user_rejected_at = NOW()
       WHERE id = $1 AND company_id = $2 AND status = 'pending'`,
      [id, companyId]
    );

    logInfo('pilotQueue', 'reject', 'Email rejected', { id, companyId });
    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    logError('pilotQueue', 'reject', 'Error rejecting email', error);
    throw error;
  }
}

// ============================================================
// SENT: Mark as sent after Resend API success
// ============================================================
export async function markAsSent(id: string, companyId: string, resendMessageId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `UPDATE pilot_queued_emails
       SET status = 'sent', sent_at = NOW(), resend_message_id = $1
       WHERE id = $2 AND company_id = $3`,
      [resendMessageId, id, companyId]
    );

    logInfo('pilotQueue', 'markSent', 'Email marked sent', { id, companyId, resendMessageId });
    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    logError('pilotQueue', 'markSent', 'Error marking sent', error);
    throw error;
  }
}

// ============================================================
// FAILED: Mark failed + schedule retry
// ============================================================
export async function markAsFailed(
  id: string,
  companyId: string,
  error: string,
  failureCount: number
): Promise<boolean> {
  try {
    const retryMinutes = 5 * failureCount; // 5, 10, 15
    const retryAt = new Date();
    retryAt.setMinutes(retryAt.getMinutes() + retryMinutes);

    const result = await pool.query(
      `UPDATE pilot_queued_emails
       SET status = 'failed',
           failure_count = $1,
           last_error = $2,
           retry_at = $3
       WHERE id = $4 AND company_id = $5`,
      [failureCount, error, retryAt, id, companyId]
    );

    logInfo('pilotQueue', 'markFailed', `Email failed (retry ${failureCount}/3)`, {
      id,
      companyId,
      error,
      retryAt: retryAt.toISOString(),
    });
    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    logError('pilotQueue', 'markFailed', 'Error marking failed', error);
    throw error;
  }
}

// ============================================================
// GET: All emails pending AUTO mode send
// ============================================================
export async function getPendingForAutoSend(): Promise<QueuedEmail[]> {
  try {
    const result = await pool.query(
      `SELECT pqe.*
       FROM pilot_queued_emails pqe
       JOIN companies c ON pqe.company_id = c.id
       WHERE pqe.status = 'pending'
         AND c.pilot_mode = 'auto'
         AND pqe.created_at <= NOW()
       ORDER BY pqe.created_at ASC
       LIMIT 100`
    );
    return result.rows as QueuedEmail[];
  } catch (error) {
    logError('pilotQueue', 'getPendingForAutoSend', 'Error fetching AUTO pending', error);
    throw error;
  }
}

// ============================================================
// GET: All failed emails ready for retry
// ============================================================
export async function getFailedForRetry(): Promise<QueuedEmail[]> {
  try {
    const result = await pool.query(
      `SELECT *
       FROM pilot_queued_emails
       WHERE status = 'failed'
         AND failure_count < 3
         AND retry_at <= NOW()
       ORDER BY retry_at ASC
       LIMIT 50`
    );
    return result.rows as QueuedEmail[];
  } catch (error) {
    logError('pilotQueue', 'getFailedForRetry', 'Error fetching failed for retry', error);
    throw error;
  }
}

// ============================================================
// GET: Single email by ID
// ============================================================
export async function getQueuedEmailById(id: string, companyId: string): Promise<QueuedEmail | null> {
  try {
    const result = await pool.query(
      `SELECT * FROM pilot_queued_emails WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );
    return result.rows[0] as QueuedEmail || null;
  } catch (error) {
    logError('pilotQueue', 'getById', 'Error fetching email', error);
    throw error;
  }
}

// ============================================================
// BULK: Approve all pending in SHADOW mode
// ============================================================
export async function approveAllPending(companyId: string): Promise<{ approvedCount: number; failedCount: number }> {
  try {
    const result = await pool.query(
      `UPDATE pilot_queued_emails
       SET user_approved_at = NOW()
       WHERE company_id = $1 AND status = 'pending'`,
      [companyId]
    );

    const count = result.rowCount || 0;
    logInfo('pilotQueue', 'approveAll', `Approved ${count} emails`, { companyId });
    return { approvedCount: count, failedCount: 0 };
  } catch (error) {
    logError('pilotQueue', 'approveAll', 'Error bulk approving', error);
    return { approvedCount: 0, failedCount: 1 };
  }
}

// ============================================================
// BULK: Reject all pending in SHADOW mode
// ============================================================
export async function rejectAllPending(companyId: string): Promise<{ rejectedCount: number }> {
  try {
    const result = await pool.query(
      `UPDATE pilot_queued_emails
       SET status = 'rejected', user_rejected_at = NOW()
       WHERE company_id = $1 AND status = 'pending'`,
      [companyId]
    );

    const count = result.rowCount || 0;
    logInfo('pilotQueue', 'rejectAll', `Rejected ${count} emails`, { companyId });
    return { rejectedCount: count };
  } catch (error) {
    logError('pilotQueue', 'rejectAll', 'Error bulk rejecting', error);
    throw error;
  }
}
