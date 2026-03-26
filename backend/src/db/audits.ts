import { pool } from '../config/database';

export interface AuditRequest {
  id: string;
  email: string;
  stripe_account_id?: string;
  stripe_access_token?: string;
  status: 'pending' | 'oauth_complete' | 'complete' | 'failed';
  analysis?: any;
  created_at: Date;
  completed_at?: Date;
}

export async function createAuditRequest(data: { token: string; companyName: string; email: string }): Promise<string> {
  const result = await pool.query(
    `INSERT INTO audit_requests (token, company_name, email, status)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [data.token, data.companyName, data.email, 'pending']
  );
  return result.rows[0].id;
}

export async function getAuditRequest(auditId: string): Promise<AuditRequest | null> {
  const result = await pool.query(
    `SELECT * FROM audit_requests WHERE id = $1`,
    [auditId]
  );
  return result.rows[0] || null;
}

export async function updateAuditRequest(
  auditId: string,
  updates: Record<string, any>
): Promise<AuditRequest> {
  const keys = Object.keys(updates);
  const values = Object.values(updates);

  const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
  const query = `UPDATE audit_requests SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;

  const result = await pool.query(query, [...values, auditId]);
  return result.rows[0];
}
