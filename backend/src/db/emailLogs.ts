import { pool } from '../config/database';
import { DunningEmailType, EmailStatus } from '../types/email';

export interface CreateEmailLogInput {
  id?: string;  // Pre-generated UUID for tracking pixel injection before send
  invoiceId: string;
  companyId: string;
  emailType: DunningEmailType;
  recipientEmail: string;
  subject: string;
  body: string;
  sendgridMessageId?: string;
}

export async function createEmailLog(input: CreateEmailLogInput): Promise<string> {
  const result = await pool.query(
    `INSERT INTO email_logs (id, invoice_id, company_id, email_type, recipient_email, subject, body, status, sendgrid_message_id)
     VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, 'sent', $8)
     RETURNING id`,
    [
      input.id || null,
      input.invoiceId,
      input.companyId,
      input.emailType,
      input.recipientEmail,
      input.subject,
      input.body,
      input.sendgridMessageId || null,
    ]
  );
  return result.rows[0].id;
}

export async function markEmailOpened(logId: string): Promise<void> {
  await pool.query(
    `UPDATE email_logs
     SET opened_at = NOW(),
         status = CASE WHEN status IN ('sent', 'delivered') THEN 'opened' ELSE status END
     WHERE id = $1 AND opened_at IS NULL`,
    [logId]
  );
}

export async function markEmailClicked(logId: string): Promise<void> {
  await pool.query(
    `UPDATE email_logs
     SET clicked_at = NOW(),
         opened_at = COALESCE(opened_at, NOW()),
         status = 'clicked'
     WHERE id = $1`,
    [logId]
  );
}

export async function updateEmailStatus(
  sendgridMessageId: string,
  status: EmailStatus,
  field?: 'opened_at' | 'clicked_at'
): Promise<void> {
  const updates: string[] = ['status = $2'];
  const params: unknown[] = [sendgridMessageId, status];

  if (field) {
    updates.push(`${field} = NOW()`);
  }

  await pool.query(
    `UPDATE email_logs SET ${updates.join(', ')} WHERE sendgrid_message_id = $1`,
    params
  );
}

export async function countEmailsSentForInvoice(invoiceId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM email_logs WHERE invoice_id = $1 AND status != 'failed'`,
    [invoiceId]
  );
  return Number(result.rows[0]?.count || 0);
}

export async function listEmailLogs(companyId: string, invoiceId?: string): Promise<any[]> {
  const params: unknown[] = [companyId];
  let query = `SELECT * FROM email_logs WHERE company_id = $1`;

  if (invoiceId) {
    params.push(invoiceId);
    query += ` AND invoice_id = $${params.length}`;
  }

  query += ` ORDER BY sent_at DESC LIMIT 100`;

  const result = await pool.query(query, params);
  return result.rows;
}

export async function getEmailDeliveryStats(companyId: string): Promise<{
  sent: number;
  opened: number;
  clicked: number;
  failed: number;
  bounced: number;
}> {
  const result = await pool.query(
    `SELECT status, COUNT(*)::int AS count
     FROM email_logs
     WHERE company_id = $1
     GROUP BY status`,
    [companyId]
  );

  const stats = { sent: 0, opened: 0, clicked: 0, failed: 0, bounced: 0 };
  for (const row of result.rows) {
    const s = row.status as string;
    if (s === 'sent' || s === 'delivered') stats.sent += row.count;
    else if (s === 'opened') stats.opened = row.count;
    else if (s === 'clicked') stats.clicked = row.count;
    else if (s === 'failed') stats.failed = row.count;
    else if (s === 'bounced') stats.bounced = row.count;
  }
  return stats;
}
