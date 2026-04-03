/**
 * P1: Shadow mode email queue
 * Stores emails pending approval in pilot mode before sending
 */

import { pool } from '../config/database';
import { DunningEmailJob } from '../types/email';

export async function insertQueuedEmail(job: DunningEmailJob): Promise<string | null> {
  // ON CONFLICT DO NOTHING prevents duplicates when agent re-runs during shadow mode
  // Returns null if this invoice/type is already pending (dedup skipped)
  const result = await pool.query(
    `INSERT INTO pilot_queued_emails
       (company_id, invoice_id, customer_id, recipient_email, customer_name,
        invoice_amount, due_date, days_overdue, email_type, attempt_number, risk_score)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (company_id, invoice_id, email_type) WHERE status = 'pending' DO NOTHING
     RETURNING id`,
    [
      job.companyId,
      job.invoiceId,
      job.customerId,
      job.recipientEmail,
      job.customerName,
      job.invoiceAmount,
      job.dueDate,  // Store exact due_date from invoice (not reconstructed from days_overdue)
      job.daysOverdue,
      job.emailType,
      job.attemptNumber || 1,
      job.riskScore || null,
    ]
  );
  return result.rows[0]?.id || null;  // null = already pending (dedup)
}

export async function listQueuedEmails(companyId: string): Promise<any[]> {
  const result = await pool.query(
    `SELECT pqe.*, i.amount as invoice_amount_fresh, c.name as customer_name_fresh
     FROM pilot_queued_emails pqe
     JOIN invoices i ON pqe.invoice_id = i.id
     JOIN customers c ON pqe.customer_id = c.id
     WHERE pqe.company_id = $1 AND pqe.status = 'pending'
     ORDER BY pqe.queued_at DESC
     LIMIT 50`,
    [companyId]
  );
  return result.rows;
}

export async function approveQueuedEmail(id: string, companyId: string): Promise<void> {
  await pool.query(
    `UPDATE pilot_queued_emails
     SET status = 'approved', approved_at = NOW()
     WHERE id = $1 AND company_id = $2`,
    [id, companyId]
  );
}

export async function rejectQueuedEmail(id: string, companyId: string): Promise<void> {
  await pool.query(
    `UPDATE pilot_queued_emails
     SET status = 'rejected'
     WHERE id = $1 AND company_id = $2`,
    [id, companyId]
  );
}

export async function markQueuedEmailAsSent(id: string, companyId: string): Promise<void> {
  await pool.query(
    `UPDATE pilot_queued_emails
     SET status = 'sent', sent_at = NOW()
     WHERE id = $1 AND company_id = $2`,
    [id, companyId]
  );
}
