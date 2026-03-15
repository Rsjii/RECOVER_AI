"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPlanForInvoice = createPlanForInvoice;
exports.chargeInstallment = chargeInstallment;
const invoices_1 = require("../db/invoices");
const paymentPlans_1 = require("../db/paymentPlans");
const encryption_1 = require("../lib/encryption");
const companies_1 = require("../db/companies");
const logger_1 = require("../utils/logger");
const stripe_1 = __importDefault(require("stripe"));
const database_1 = require("../config/database");
const LOG_MODULE = 'paymentPlanService';
function getStripeClient(apiKey) {
    return new stripe_1.default(apiKey, { apiVersion: '2026-02-25.clover' });
}
async function createPlanForInvoice(invoiceId, companyId, numInstallments) {
    const method = 'createPlanForInvoice';
    const invoice = await (0, invoices_1.findInvoiceById)(invoiceId, companyId);
    if (!invoice)
        throw new Error('Invoice not found');
    if (invoice.status === 'paid')
        throw new Error('Invoice already paid');
    const existing = await (0, paymentPlans_1.findPaymentPlanByInvoice)(invoiceId, companyId);
    if (existing && existing.status === 'active') {
        (0, logger_1.logWarn)(LOG_MODULE, method, 'Active plan already exists', { invoiceId, planId: existing.id });
        throw new Error('An active payment plan already exists for this invoice');
    }
    const total = Number(invoice.amount);
    const installmentAmount = Math.round((total / numInstallments) * 100) / 100;
    const now = new Date();
    const installments = Array.from({ length: numInstallments }, (_, i) => {
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + (i + 1) * 30);
        return {
            amount: i === numInstallments - 1
                ? Math.round((total - installmentAmount * (numInstallments - 1)) * 100) / 100
                : installmentAmount,
            due_date: dueDate.toISOString(),
            paid: false,
        };
    });
    const plan = await (0, paymentPlans_1.createPaymentPlan)({ invoiceId, installments, totalAmount: total });
    await (0, invoices_1.updateInvoiceStatus)(invoiceId, companyId, 'arranged');
    (0, logger_1.logInfo)(LOG_MODULE, method, 'Payment plan created', {
        planId: plan.id,
        invoiceId,
        numInstallments,
        total,
    });
    return plan;
}
async function chargeInstallment(planId, installmentIndex, companyId, stripeCustomerId, paymentMethodId) {
    const method = 'chargeInstallment';
    const company = await (0, companies_1.findCompanyById)(companyId);
    if (!company?.stripe_api_key_encrypted) {
        throw new Error('No Stripe API key configured for this company');
    }
    const stripeKey = (0, encryption_1.decryptField)(company.stripe_api_key_encrypted);
    const stripe = getStripeClient(stripeKey);
    const plan = await (0, paymentPlans_1.findPaymentPlanById)(planId, companyId);
    if (!plan)
        throw new Error('Payment plan not found');
    const installments = plan.installments;
    const installment = installments[installmentIndex];
    if (!installment)
        throw new Error(`Installment index ${installmentIndex} not found`);
    if (installment.paid)
        throw new Error('Installment already paid');
    const amountCents = Math.round(installment.amount * 100);
    const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        customer: stripeCustomerId,
        payment_method: paymentMethodId,
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    });
    (0, logger_1.logInfo)(LOG_MODULE, method, 'Stripe payment intent created', {
        planId,
        installmentIndex,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
    });
    await database_1.pool.query(`UPDATE payment_plans
     SET installments = jsonb_set(
       installments,
       ARRAY[$1::text],
       (installments->$2::int) || '{"paid":true}'::jsonb || jsonb_build_object('stripe_payment_intent_id', $3),
       false
     ),
     updated_at = NOW()
     WHERE id = $4`, [String(installmentIndex), installmentIndex, paymentIntent.id, planId]);
    const updatedInstallments = installments.map((inst, i) => i === installmentIndex ? { ...inst, paid: true } : inst);
    if (updatedInstallments.every(inst => inst.paid)) {
        await (0, paymentPlans_1.updatePaymentPlanStatus)(planId, companyId, 'completed');
        (0, logger_1.logInfo)(LOG_MODULE, method, 'All installments paid — plan completed', { planId });
    }
    return { paymentIntentId: paymentIntent.id, status: paymentIntent.status };
}
