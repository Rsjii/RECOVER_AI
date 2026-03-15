"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertInvoice = upsertInvoice;
exports.createManualInvoice = createManualInvoice;
exports.listInvoices = listInvoices;
exports.findInvoiceById = findInvoiceById;
exports.findInvoiceBySourceId = findInvoiceBySourceId;
exports.updateInvoiceStatus = updateInvoiceStatus;
exports.updateInvoiceRiskScore = updateInvoiceRiskScore;
const database_1 = require("../config/database");
async function upsertInvoice(input) {
    const { companyId, customerId, amount, currency, dueDate, issuedDate, source, sourceId } = input;
    if (sourceId) {
        const existing = await database_1.pool.query('SELECT * FROM invoices WHERE company_id = $1 AND source = $2 AND source_id = $3', [companyId, source, sourceId]);
        if (existing.rows.length > 0) {
            const updated = await database_1.pool.query(`UPDATE invoices SET amount = $1, currency = $2, due_date = $3, updated_at = NOW()
         WHERE id = $4 RETURNING *`, [amount, currency, dueDate, existing.rows[0].id]);
            return { row: updated.rows[0], isNew: false };
        }
    }
    const result = await database_1.pool.query(`INSERT INTO invoices
       (company_id, customer_id, amount, currency, due_date, issued_date, source, source_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'unpaid')
     RETURNING *`, [companyId, customerId, amount, currency, dueDate, issuedDate, source, sourceId || null]);
    return { row: result.rows[0], isNew: true };
}
async function createManualInvoice(input) {
    const { companyId, customerId, amount, currency, dueDate, issuedDate, notes } = input;
    const result = await database_1.pool.query(`INSERT INTO invoices
       (company_id, customer_id, amount, currency, due_date, issued_date, source, source_id, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, 'manual', NULL, 'unpaid', $7)
     RETURNING *`, [companyId, customerId, amount, currency, dueDate, issuedDate, notes || null]);
    return result.rows[0];
}
async function listInvoices(companyId, filters = {}, limit = 50, offset = 0) {
    const conditions = ['i.company_id = $1'];
    const params = [companyId];
    let paramIndex = 2;
    if (filters.status) {
        conditions.push(`i.status = $${paramIndex++}`);
        params.push(filters.status);
    }
    if (filters.customerId) {
        conditions.push(`i.customer_id = $${paramIndex++}`);
        params.push(filters.customerId);
    }
    const where = conditions.join(' AND ');
    const [data, count] = await Promise.all([
        database_1.pool.query(`SELECT i.*, c.name as customer_name, c.email as customer_email
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id
       WHERE ${where}
       ORDER BY i.due_date ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`, [...params, limit, offset]),
        database_1.pool.query(`SELECT COUNT(*) FROM invoices i WHERE ${where}`, params),
    ]);
    return { data: data.rows, total: parseInt(count.rows[0].count) };
}
async function findInvoiceById(id, companyId) {
    const result = await database_1.pool.query(`SELECT i.*, c.name as customer_name, c.email as customer_email
     FROM invoices i
     JOIN customers c ON i.customer_id = c.id
     WHERE i.id = $1 AND i.company_id = $2`, [id, companyId]);
    return result.rows[0] || null;
}
async function findInvoiceBySourceId(sourceId, source, companyId) {
    const params = [sourceId, source];
    let companyFilter = '';
    if (companyId) {
        params.push(companyId);
        companyFilter = ` AND i.company_id = $${params.length}`;
    }
    const result = await database_1.pool.query(`SELECT i.*, c.name as customer_name, c.email as customer_email
     FROM invoices i
     JOIN customers c ON i.customer_id = c.id
     WHERE i.source_id = $1 AND i.source = $2
     ${companyFilter}
     LIMIT 1`, params);
    return result.rows[0] || null;
}
async function updateInvoiceStatus(id, companyId, status) {
    const result = await database_1.pool.query(`UPDATE invoices
     SET status = $1, updated_at = NOW()
     WHERE id = $2
       AND company_id = $3
     RETURNING *`, [status, id, companyId]);
    return result.rows[0];
}
async function updateInvoiceRiskScore(id, companyId, riskScore) {
    await database_1.pool.query(`UPDATE invoices
     SET risk_score = $1, updated_at = NOW()
     WHERE id = $2
       AND company_id = $3`, [riskScore, id, companyId]);
}
