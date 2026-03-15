import { findInvoiceById, updateInvoiceStatus } from '../db/invoices';
import {
  createPaymentPlan,
  findPaymentPlanById,
  findPaymentPlanByInvoice,
  updatePaymentPlanStatus,
  Installment,
} from '../db/paymentPlans';
import { decryptField } from '../lib/encryption';
import { findCompanyById } from '../db/companies';
import { PaymentPlanRow } from '../types/database';
import { logError, logInfo, logWarn } from '../utils/logger';
import Stripe from 'stripe';
import { pool } from '../config/database';

const LOG_MODULE = 'paymentPlanService';

function getStripeClient(apiKey: string): Stripe {
  return new Stripe(apiKey, { apiVersion: '2026-02-25.clover' });
}

export async function createPlanForInvoice(
  invoiceId: string,
  companyId: string,
  numInstallments: number
): Promise<PaymentPlanRow> {
  const method = 'createPlanForInvoice';

  const invoice = await findInvoiceById(invoiceId, companyId);
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.status === 'paid') throw new Error('Invoice already paid');

  const existing = await findPaymentPlanByInvoice(invoiceId, companyId);
  if (existing && existing.status === 'active') {
    logWarn(LOG_MODULE, method, 'Active plan already exists', { invoiceId, planId: existing.id });
    throw new Error('An active payment plan already exists for this invoice');
  }

  const total = Number(invoice.amount);
  const installmentAmount = Math.round((total / numInstallments) * 100) / 100;
  const now = new Date();

  const installments: Installment[] = Array.from({ length: numInstallments }, (_, i) => {
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + (i + 1) * 30);
    return {
      amount:
        i === numInstallments - 1
          ? Math.round((total - installmentAmount * (numInstallments - 1)) * 100) / 100
          : installmentAmount,
      due_date: dueDate.toISOString(),
      paid: false,
    };
  });

  const plan = await createPaymentPlan({ invoiceId, installments, totalAmount: total });

  await updateInvoiceStatus(invoiceId, companyId, 'arranged');

  logInfo(LOG_MODULE, method, 'Payment plan created', {
    planId: plan.id,
    invoiceId,
    numInstallments,
    total,
  });

  return plan;
}

export async function chargeInstallment(
  planId: string,
  installmentIndex: number,
  companyId: string,
  stripeCustomerId: string,
  paymentMethodId: string
): Promise<{ paymentIntentId: string; status: string }> {
  const method = 'chargeInstallment';

  const company = await findCompanyById(companyId);
  if (!company?.stripe_api_key_encrypted) {
    throw new Error('No Stripe API key configured for this company');
  }

  const stripeKey = decryptField(company.stripe_api_key_encrypted);
  const stripe = getStripeClient(stripeKey);

  const plan = await findPaymentPlanById(planId, companyId);
  if (!plan) throw new Error('Payment plan not found');

  const installments: Installment[] = plan.installments as any;
  const installment = installments[installmentIndex];

  if (!installment) throw new Error(`Installment index ${installmentIndex} not found`);
  if (installment.paid) throw new Error('Installment already paid');

  const amountCents = Math.round(installment.amount * 100);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    customer: stripeCustomerId,
    payment_method: paymentMethodId,
    confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
  });

  logInfo(LOG_MODULE, method, 'Stripe payment intent created', {
    planId,
    installmentIndex,
    paymentIntentId: paymentIntent.id,
    status: paymentIntent.status,
  });

  await pool.query(
    `UPDATE payment_plans
     SET installments = jsonb_set(
       installments,
       ARRAY[$1::text],
       (installments->$2::int) || '{"paid":true}'::jsonb || jsonb_build_object('stripe_payment_intent_id', $3),
       false
     ),
     updated_at = NOW()
     WHERE id = $4`,
    [String(installmentIndex), installmentIndex, paymentIntent.id, planId]
  );

  const updatedInstallments: Installment[] = installments.map((inst, i) =>
    i === installmentIndex ? { ...inst, paid: true } : inst
  );

  if (updatedInstallments.every(inst => inst.paid)) {
    await updatePaymentPlanStatus(planId, companyId, 'completed');
    logInfo(LOG_MODULE, method, 'All installments paid — plan completed', { planId });
  }

  return { paymentIntentId: paymentIntent.id, status: paymentIntent.status };
}
