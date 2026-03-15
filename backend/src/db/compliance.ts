import { pool } from '../config/database';

export async function createComplianceRequest(input: {
  companyId: string;
  requestedByUserId: string;
  requestType: 'export' | 'delete';
  payload?: Record<string, unknown>;
}): Promise<{ id: string }> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO compliance_requests (company_id, requested_by_user_id, request_type, status, payload)
     VALUES ($1,$2,$3,'pending',$4)
     RETURNING id`,
    [input.companyId, input.requestedByUserId, input.requestType, JSON.stringify(input.payload || {})]
  );
  return result.rows[0];
}

export async function markComplianceRequestCompleted(requestId: string, payload?: Record<string, unknown>): Promise<void> {
  await pool.query(
    `UPDATE compliance_requests
     SET status = 'completed', completed_at = NOW(), payload = COALESCE($2::jsonb, payload)
     WHERE id = $1`,
    [requestId, payload ? JSON.stringify(payload) : null]
  );
}

export async function listComplianceRequests(companyId: string): Promise<any[]> {
  const result = await pool.query(
    `SELECT id, request_type, status, requested_at, completed_at, payload
     FROM compliance_requests
     WHERE company_id = $1
     ORDER BY requested_at DESC`,
    [companyId]
  );
  return result.rows;
}

export async function exportCompanyData(companyId: string): Promise<Record<string, unknown>> {
  const [company, users, customers, invoices, payments, emailLogs, auditLogs] = await Promise.all([
    pool.query('SELECT id, name, email, timezone, preferred_currency, created_at FROM companies WHERE id = $1', [companyId]),
    pool.query('SELECT id, email, first_name, last_name, role, is_active, created_at FROM users WHERE company_id = $1', [companyId]),
    pool.query('SELECT id, name, email, company_name, industry, created_at FROM customers WHERE company_id = $1', [companyId]),
    pool.query('SELECT id, customer_id, amount, currency, due_date, status, risk_score, source, created_at FROM invoices WHERE company_id = $1', [companyId]),
    pool.query('SELECT id, invoice_id, amount, currency, payment_method, paid_at, status, created_at FROM payments WHERE company_id = $1', [companyId]),
    pool.query('SELECT id, invoice_id, email_type, recipient_email, status, sent_at FROM email_logs WHERE company_id = $1', [companyId]),
    pool.query('SELECT id, user_id, action, resource_type, resource_id, created_at FROM audit_logs WHERE company_id = $1', [companyId]),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    company: company.rows[0] || null,
    users: users.rows,
    customers: customers.rows,
    invoices: invoices.rows,
    payments: payments.rows,
    emailLogs: emailLogs.rows,
    auditLogs: auditLogs.rows,
  };
}

export async function requestCompanyDeletion(companyId: string): Promise<void> {
  // Soft-delete scope for safety in production would be preferred.
  // For now, we perform a hard delete cascade.
  await pool.query('DELETE FROM companies WHERE id = $1', [companyId]);
}


