"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecoveryStats = getRecoveryStats;
exports.getInvoicePipeline = getInvoicePipeline;
exports.getCustomerRiskList = getCustomerRiskList;
const database_1 = require("../config/database");
async function getRecoveryStats(companyId) {
    const result = await database_1.pool.query(`SELECT
       COUNT(*) as total_invoices,
       COALESCE(SUM(CASE WHEN status != 'paid' THEN amount ELSE 0 END), 0) as total_owed,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_recovered,
       COUNT(CASE WHEN status != 'paid' AND due_date < NOW() THEN 1 END) as overdue_count,
       COALESCE(SUM(CASE WHEN status != 'paid' AND due_date < NOW() THEN amount ELSE 0 END), 0) as overdue_amount
     FROM invoices
     WHERE company_id = $1`, [companyId]);
    const row = result.rows[0];
    const totalOwed = parseFloat(row.total_owed);
    const totalRecovered = parseFloat(row.total_recovered);
    const totalAll = totalOwed + totalRecovered;
    // Avg days to collect (from issued_date to payment)
    const avgResult = await database_1.pool.query(`SELECT AVG(EXTRACT(EPOCH FROM (p.paid_at - i.issued_date)) / 86400) as avg_days
     FROM payments p
     JOIN invoices i ON p.invoice_id = i.id
     WHERE i.company_id = $1 AND p.status = 'succeeded'`, [companyId]);
    return {
        totalInvoices: parseInt(row.total_invoices),
        totalOwed,
        totalRecovered,
        recoveryRate: totalAll > 0 ? Math.round((totalRecovered / totalAll) * 100) : 0,
        avgDaysToCollect: Math.round(parseFloat(avgResult.rows[0]?.avg_days || '0')),
        overdueCount: parseInt(row.overdue_count),
        overdueAmount: parseFloat(row.overdue_amount),
    };
}
async function getInvoicePipeline(companyId) {
    const result = await database_1.pool.query(`SELECT
       status,
       COUNT(*) as count,
       COALESCE(SUM(amount), 0) as total_amount
     FROM invoices
     WHERE company_id = $1
     GROUP BY status`, [companyId]);
    const pipeline = {
        unpaid: 0, arranged: 0, disputed: 0, uncollectable: 0, paid: 0,
        unpaidAmount: 0, arrangedAmount: 0,
    };
    for (const row of result.rows) {
        const count = parseInt(row.count);
        const amount = parseFloat(row.total_amount);
        switch (row.status) {
            case 'unpaid':
                pipeline.unpaid = count;
                pipeline.unpaidAmount = amount;
                break;
            case 'arranged':
                pipeline.arranged = count;
                pipeline.arrangedAmount = amount;
                break;
            case 'disputed':
                pipeline.disputed = count;
                break;
            case 'uncollectable':
                pipeline.uncollectable = count;
                break;
            case 'paid':
                pipeline.paid = count;
                break;
        }
    }
    return pipeline;
}
async function getCustomerRiskList(companyId, limit = 20) {
    const result = await database_1.pool.query(`SELECT
       c.id as customer_id,
       c.name as customer_name,
       c.email as customer_email,
       COUNT(i.id) as unpaid_invoices,
       COALESCE(SUM(i.amount), 0) as total_owed,
       MAX(i.risk_score) as max_risk_score,
       COALESCE(MAX(EXTRACT(EPOCH FROM (NOW() - i.due_date)) / 86400), 0) as oldest_due_days
     FROM customers c
     JOIN invoices i ON i.customer_id = c.id
     WHERE c.company_id = $1
       AND i.status NOT IN ('paid', 'uncollectable')
       AND i.company_id = $1
     GROUP BY c.id, c.name, c.email
     ORDER BY max_risk_score DESC, total_owed DESC
     LIMIT $2`, [companyId, limit]);
    return result.rows.map(row => ({
        customerId: row.customer_id,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        unpaidInvoices: parseInt(row.unpaid_invoices),
        totalOwed: parseFloat(row.total_owed),
        maxRiskScore: parseInt(row.max_risk_score) || 0,
        oldestDueDays: Math.floor(parseFloat(row.oldest_due_days)),
    }));
}
