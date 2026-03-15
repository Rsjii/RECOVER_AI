"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createComplianceRequest = createComplianceRequest;
exports.markComplianceRequestCompleted = markComplianceRequestCompleted;
exports.listComplianceRequests = listComplianceRequests;
exports.exportCompanyData = exportCompanyData;
exports.requestCompanyDeletion = requestCompanyDeletion;
const database_1 = require("../config/database");
async function createComplianceRequest(input) {
    const result = await database_1.pool.query(`INSERT INTO compliance_requests (company_id, requested_by_user_id, request_type, status, payload)
     VALUES ($1,$2,$3,'pending',$4)
     RETURNING id`, [input.companyId, input.requestedByUserId, input.requestType, JSON.stringify(input.payload || {})]);
    return result.rows[0];
}
async function markComplianceRequestCompleted(requestId, payload) {
    await database_1.pool.query(`UPDATE compliance_requests
     SET status = 'completed', completed_at = NOW(), payload = COALESCE($2::jsonb, payload)
     WHERE id = $1`, [requestId, payload ? JSON.stringify(payload) : null]);
}
async function listComplianceRequests(companyId) {
    const result = await database_1.pool.query(`SELECT id, request_type, status, requested_at, completed_at, payload
     FROM compliance_requests
     WHERE company_id = $1
     ORDER BY requested_at DESC`, [companyId]);
    return result.rows;
}
async function exportCompanyData(companyId) {
    const [company, users, customers, invoices, payments, emailLogs, auditLogs] = await Promise.all([
        database_1.pool.query('SELECT id, name, email, timezone, preferred_currency, created_at FROM companies WHERE id = $1', [companyId]),
        database_1.pool.query('SELECT id, email, first_name, last_name, role, is_active, created_at FROM users WHERE company_id = $1', [companyId]),
        database_1.pool.query('SELECT id, name, email, company_name, industry, created_at FROM customers WHERE company_id = $1', [companyId]),
        database_1.pool.query('SELECT id, customer_id, amount, currency, due_date, status, risk_score, source, created_at FROM invoices WHERE company_id = $1', [companyId]),
        database_1.pool.query('SELECT id, invoice_id, amount, currency, payment_method, paid_at, status, created_at FROM payments WHERE company_id = $1', [companyId]),
        database_1.pool.query('SELECT id, invoice_id, email_type, recipient_email, status, sent_at FROM email_logs WHERE company_id = $1', [companyId]),
        database_1.pool.query('SELECT id, user_id, action, resource_type, resource_id, created_at FROM audit_logs WHERE company_id = $1', [companyId]),
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
async function requestCompanyDeletion(companyId) {
    // Soft-delete scope for safety in production would be preferred.
    // For now, we perform a hard delete cascade.
    await database_1.pool.query('DELETE FROM companies WHERE id = $1', [companyId]);
}
