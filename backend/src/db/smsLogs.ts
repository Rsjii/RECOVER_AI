import { pool } from '../config/database';
import { SMSLogRow } from '../types/database';

export async function listSMSLogs(companyId: string, invoiceId: string): Promise<SMSLogRow[]> {
  const result = await pool.query(
    `SELECT * FROM sms_logs
     WHERE company_id = $1 AND invoice_id = $2
     ORDER BY sent_at DESC`,
    [companyId, invoiceId]
  );
  return result.rows;
}
