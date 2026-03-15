"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmailLog = createEmailLog;
exports.markEmailOpened = markEmailOpened;
exports.markEmailClicked = markEmailClicked;
exports.updateEmailStatus = updateEmailStatus;
exports.countEmailsSentForInvoice = countEmailsSentForInvoice;
exports.listEmailLogs = listEmailLogs;
const database_1 = require("../config/database");
async function createEmailLog(input) {
    const result = await database_1.pool.query(`INSERT INTO email_logs (id, invoice_id, company_id, email_type, recipient_email, subject, body, status, sendgrid_message_id)
     VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, 'sent', $8)
     RETURNING id`, [
        input.id || null,
        input.invoiceId,
        input.companyId,
        input.emailType,
        input.recipientEmail,
        input.subject,
        input.body,
        input.sendgridMessageId || null,
    ]);
    return result.rows[0].id;
}
async function markEmailOpened(logId) {
    await database_1.pool.query(`UPDATE email_logs
     SET opened_at = NOW(),
         status = CASE WHEN status IN ('sent', 'delivered') THEN 'opened' ELSE status END
     WHERE id = $1 AND opened_at IS NULL`, [logId]);
}
async function markEmailClicked(logId) {
    await database_1.pool.query(`UPDATE email_logs
     SET clicked_at = NOW(),
         opened_at = COALESCE(opened_at, NOW()),
         status = 'clicked'
     WHERE id = $1`, [logId]);
}
async function updateEmailStatus(sendgridMessageId, status, field) {
    const updates = ['status = $2'];
    const params = [sendgridMessageId, status];
    if (field) {
        updates.push(`${field} = NOW()`);
    }
    await database_1.pool.query(`UPDATE email_logs SET ${updates.join(', ')} WHERE sendgrid_message_id = $1`, params);
}
async function countEmailsSentForInvoice(invoiceId) {
    const result = await database_1.pool.query(`SELECT COUNT(*) as count FROM email_logs WHERE invoice_id = $1 AND status != 'failed'`, [invoiceId]);
    return Number(result.rows[0]?.count || 0);
}
async function listEmailLogs(companyId, invoiceId) {
    const params = [companyId];
    let query = `SELECT * FROM email_logs WHERE company_id = $1`;
    if (invoiceId) {
        params.push(invoiceId);
        query += ` AND invoice_id = $${params.length}`;
    }
    query += ` ORDER BY sent_at DESC LIMIT 100`;
    const result = await database_1.pool.query(query, params);
    return result.rows;
}
