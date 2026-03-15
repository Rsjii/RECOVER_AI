"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPaymentPlan = createPaymentPlan;
exports.findPaymentPlanByInvoice = findPaymentPlanByInvoice;
exports.findPaymentPlanById = findPaymentPlanById;
exports.updateInstallmentPaid = updateInstallmentPaid;
exports.updatePaymentPlanStatus = updatePaymentPlanStatus;
exports.listPaymentPlans = listPaymentPlans;
const database_1 = require("../config/database");
async function createPaymentPlan(input) {
    const { invoiceId, installments, totalAmount } = input;
    const result = await database_1.pool.query(`INSERT INTO payment_plans (invoice_id, status, installments, total_amount)
     VALUES ($1, 'active', $2::jsonb, $3)
     RETURNING *`, [invoiceId, JSON.stringify(installments), totalAmount]);
    return result.rows[0];
}
async function findPaymentPlanByInvoice(invoiceId, companyId) {
    const result = await database_1.pool.query(`SELECT pp.*
     FROM payment_plans pp
     JOIN invoices i ON i.id = pp.invoice_id
     WHERE pp.invoice_id = $1
       AND i.company_id = $2
     ORDER BY pp.created_at DESC
     LIMIT 1`, [invoiceId, companyId]);
    return result.rows[0] || null;
}
async function findPaymentPlanById(planId, companyId) {
    const result = await database_1.pool.query(`SELECT pp.*
     FROM payment_plans pp
     JOIN invoices i ON i.id = pp.invoice_id
     WHERE pp.id = $1
       AND i.company_id = $2
     LIMIT 1`, [planId, companyId]);
    return result.rows[0] || null;
}
async function updateInstallmentPaid(planId, installmentIndex, stripePaymentIntentId) {
    // Update the specific installment in the JSONB array
    const result = await database_1.pool.query(`UPDATE payment_plans
     SET installments = jsonb_set(
       installments,
       ARRAY[$1::text],
       installments->$1::int || '{"paid": true}'::jsonb || jsonb_build_object('stripe_payment_intent_id', $2),
       false
     ),
     updated_at = NOW()
     WHERE id = $3
     RETURNING *`, [installmentIndex, stripePaymentIntentId, planId]);
    return result.rows[0];
}
async function updatePaymentPlanStatus(planId, companyId, status) {
    const result = await database_1.pool.query(`UPDATE payment_plans pp
     SET status = $1, updated_at = NOW()
     FROM invoices i
     WHERE pp.id = $2
       AND i.id = pp.invoice_id
       AND i.company_id = $3
     RETURNING pp.*`, [status, planId, companyId]);
    return result.rows[0];
}
async function listPaymentPlans(companyId) {
    const result = await database_1.pool.query(`SELECT pp.*
     FROM payment_plans pp
     JOIN invoices i ON pp.invoice_id = i.id
     WHERE i.company_id = $1
     ORDER BY pp.created_at DESC`, [companyId]);
    return result.rows;
}
