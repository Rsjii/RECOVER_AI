"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPayment = createPayment;
exports.listPaymentsByInvoice = listPaymentsByInvoice;
exports.listPaymentsByCompany = listPaymentsByCompany;
exports.findPaymentByStripeChargeId = findPaymentByStripeChargeId;
exports.countEmailsSentToday = countEmailsSentToday;
const database_1 = require("../config/database");
async function createPayment(input) {
    const { invoiceId, companyId, amount, currency, paymentMethod, paidAt, stripeChargeId, status = 'succeeded', notes, } = input;
    const result = await database_1.pool.query(`INSERT INTO payments
       (invoice_id, company_id, amount, currency, payment_method, paid_at, stripe_charge_id, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`, [invoiceId, companyId, amount, currency, paymentMethod,
        paidAt, stripeChargeId || null, status, notes || null]);
    return result.rows[0];
}
async function listPaymentsByInvoice(invoiceId, companyId) {
    const result = await database_1.pool.query(`SELECT *
     FROM payments
     WHERE invoice_id = $1
       AND company_id = $2
     ORDER BY paid_at DESC`, [invoiceId, companyId]);
    return result.rows;
}
async function listPaymentsByCompany(companyId, limit = 50, offset = 0) {
    const [data, count] = await Promise.all([
        database_1.pool.query('SELECT * FROM payments WHERE company_id = $1 ORDER BY paid_at DESC LIMIT $2 OFFSET $3', [companyId, limit, offset]),
        database_1.pool.query('SELECT COUNT(*) FROM payments WHERE company_id = $1', [companyId]),
    ]);
    return { data: data.rows, total: parseInt(count.rows[0].count) };
}
async function findPaymentByStripeChargeId(stripeChargeId) {
    const result = await database_1.pool.query('SELECT * FROM payments WHERE stripe_charge_id = $1 LIMIT 1', [stripeChargeId]);
    return result.rows[0] || null;
}
async function countEmailsSentToday(companyId) {
    const result = await database_1.pool.query(`SELECT COUNT(*) FROM payments
     WHERE company_id = $1
       AND paid_at >= NOW() - INTERVAL '24 hours'
       AND status = 'succeeded'`, [companyId]);
    return parseInt(result.rows[0].count);
}
