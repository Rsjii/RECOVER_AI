import cron from 'node-cron';
import Stripe from 'stripe';
import { pool } from '../config/database';
import { logError, logInfo } from '../utils/logger';
import { decryptField } from '../lib/encryption';

const LOG_MODULE = 'paymentPlanChargeJob';

interface DueInstallment {
  plan_id: string;
  invoice_id: string;
  company_id: string;
  installment_index: number;
  amount: number;
  stripe_api_key_encrypted: string | null;
  customer_email: string;
  customer_name: string;
}

async function getDueInstallments(): Promise<DueInstallment[]> {
  const result = await pool.query(`
    SELECT
      pp.id            AS plan_id,
      pp.invoice_id,
      i.company_id,
      inst.idx         AS installment_index,
      (inst.value->>'amount')::float AS amount,
      co.stripe_api_key_encrypted,
      cu.email         AS customer_email,
      cu.name          AS customer_name
    FROM payment_plans pp
    JOIN invoices i   ON pp.invoice_id = i.id
    JOIN companies co ON i.company_id = co.id
    JOIN customers cu ON i.customer_id = cu.id,
    LATERAL jsonb_array_elements(pp.installments) WITH ORDINALITY AS inst(value, idx)
    WHERE pp.status = 'active'
      AND (inst.value->>'paid')::boolean = false
      AND (inst.value->>'stripe_payment_intent_id') IS NULL
      AND (inst.value->>'due_date')::date <= CURRENT_DATE
      AND co.stripe_api_key_encrypted IS NOT NULL
      AND i.company_id != '639eb868-e760-4587-8853-58bc380663db'
  `);
  return result.rows;
}

/**
 * Queue a RecoverAI commission invoice item on the company's Stripe account.
 * This is how RecoverAI collects its 1% outcome-based fee:
 *   - Customer payment → goes to company's Stripe account (full amount)
 *   - RecoverAI creates an invoice item on company's Stripe for 1% commission
 *   - Stripe auto-charges company's card monthly via open invoice
 *   - If charge disputed → company cancels the commission invoice manually
 */
async function queueCommissionInvoiceItem(
  inst: DueInstallment,
  paymentIntentId: string,
  stripe: Stripe,
): Promise<void> {
  const method = 'queueCommissionInvoiceItem';
  const COMMISSION_RATE = 0.01; // 1%

  // Find the company (Acme) as a Stripe customer on their own account
  // They must exist in their own Stripe — they use it for billing their customers
  const customers = await stripe.customers.search({
    query: `metadata['recoverai_company_id']:'${inst.company_id}'`,
    limit: 1,
  }).catch(() => ({ data: [] as Stripe.Customer[] }));

  // Fallback: list all and pick first — company is the account owner
  let companyStripeCustomerId: string | undefined = customers.data[0]?.id;

  if (!companyStripeCustomerId) {
    // Create a self-referencing customer entry for the company so we can bill them
    const newCustomer = await stripe.customers.create({
      description: 'RecoverAI commission billing — auto-created',
      metadata: { recoverai_company_id: inst.company_id },
    });
    companyStripeCustomerId = newCustomer.id;
    logInfo(LOG_MODULE, method, 'Created Stripe customer for commission billing', {
      companyId: inst.company_id,
      customerId: companyStripeCustomerId,
    });
  }

  const commissionAmount = Math.round(inst.amount * COMMISSION_RATE * 100); // cents
  if (commissionAmount < 1) {
    logInfo(LOG_MODULE, method, 'Commission too small to invoice (<$0.01) — skipping', {
      planId: inst.plan_id,
      amount: inst.amount,
    });
    return;
  }

  // Add invoice item — batched into next open invoice automatically by Stripe
  await stripe.invoiceItems.create({
    customer: companyStripeCustomerId,
    amount: commissionAmount,
    currency: 'usd',
    description: `RecoverAI Commission (1%) — payment plan installment for invoice ${inst.invoice_id}`,
    metadata: {
      invoice_id: inst.invoice_id,
      plan_id: inst.plan_id,
      payment_intent_id: paymentIntentId,
      recoverai_company_id: inst.company_id,
    },
  });

  logInfo(LOG_MODULE, method, 'Commission invoice item queued on company Stripe', {
    planId: inst.plan_id,
    invoiceId: inst.invoice_id,
    commissionUsd: commissionAmount / 100,
    recoveredUsd: inst.amount,
  });
}

async function chargeInstallment(inst: DueInstallment): Promise<void> {
  const method = 'chargeInstallment';

  if (!inst.stripe_api_key_encrypted) {
    logInfo(LOG_MODULE, method, 'No Stripe key — skipping installment', { planId: inst.plan_id });
    return;
  }

  const apiKey = decryptField(inst.stripe_api_key_encrypted);
  const stripe = new Stripe(apiKey);

  try {
    // Find or create Stripe customer for the email
    const customers = await stripe.customers.list({ email: inst.customer_email, limit: 1 });
    if (!customers.data.length) {
      logInfo(LOG_MODULE, method, 'No Stripe customer found — skipping', { email: inst.customer_email });
      return;
    }
    const stripeCustomer = customers.data[0];

    // Get default payment method
    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomer.id,
      type: 'card',
      limit: 1,
    });
    if (!paymentMethods.data.length) {
      logInfo(LOG_MODULE, method, 'No payment method — skipping', { customerId: stripeCustomer.id });
      return;
    }

    // Create PaymentIntent
    const pi = await stripe.paymentIntents.create({
      amount: Math.round(inst.amount * 100),
      currency: 'usd',
      customer: stripeCustomer.id,
      payment_method: paymentMethods.data[0].id,
      confirm: true,
      description: `Payment plan installment for invoice ${inst.invoice_id}`,
    });

    // Mark installment as paid
    await pool.query(`
      UPDATE payment_plans
      SET installments = (
        SELECT jsonb_agg(
          CASE WHEN ordinality = $1
            THEN value || jsonb_build_object('paid', true, 'stripe_payment_intent_id', $2)
            ELSE value
          END
        )
        FROM jsonb_array_elements(installments) WITH ORDINALITY
      )
      WHERE id = $3
    `, [inst.installment_index, pi.id, inst.plan_id]);

    // Record payment
    await pool.query(
      `INSERT INTO payments (invoice_id, company_id, amount, currency, payment_method, paid_at, stripe_charge_id, status)
       VALUES ($1, $2, $3, 'USD', 'stripe', NOW(), $4, 'succeeded')`,
      [inst.invoice_id, inst.company_id, inst.amount, pi.id]
    );

    logInfo(LOG_MODULE, method, 'Installment charged successfully', {
      planId: inst.plan_id,
      amount: inst.amount,
      paymentIntentId: pi.id,
    });

    // Queue 1% commission invoice item on company's Stripe account (non-blocking)
    // If this fails, payment was still collected — don't roll back
    queueCommissionInvoiceItem(inst, pi.id, stripe).catch((err) => {
      logError(LOG_MODULE, method, 'Commission invoice queuing failed (non-critical)', err, {
        planId: inst.plan_id,
      });
    });

  } catch (err: any) {
    logError(LOG_MODULE, method, 'Installment charge failed', err, {
      planId: inst.plan_id,
      amount: inst.amount,
    });
    // Mark installment as failed in installments array for visibility
    await pool.query(`
      UPDATE payment_plans
      SET installments = (
        SELECT jsonb_agg(
          CASE WHEN ordinality = $1
            THEN value || jsonb_build_object('charge_failed', true, 'charge_error', $2)
            ELSE value
          END
        )
        FROM jsonb_array_elements(installments) WITH ORDINALITY
      )
      WHERE id = $3
    `, [inst.installment_index, err.message || 'charge failed', inst.plan_id]);
  }
}

async function runPaymentPlanCharges(): Promise<{ processed: number; charged: number; failed: number }> {
  const method = 'runPaymentPlanCharges';
  logInfo(LOG_MODULE, method, 'Starting payment plan charge run');

  const dueInstallments = await getDueInstallments();
  logInfo(LOG_MODULE, method, `Found ${dueInstallments.length} due installments`);

  let charged = 0;
  let failed = 0;

  for (const inst of dueInstallments) {
    try {
      await chargeInstallment(inst);
      charged++;
    } catch {
      failed++;
    }
  }

  const result = { processed: dueInstallments.length, charged, failed };
  logInfo(LOG_MODULE, method, 'Payment plan charge run complete', result);
  return result;
}

export function startPaymentPlanChargeJob(): void {
  // Run daily at 09:00 AM UTC via cron (no Redis needed)
  cron.schedule('0 9 * * *', () => {
    runPaymentPlanCharges().catch(err =>
      logError(LOG_MODULE, 'cronRun', 'Daily payment plan charge failed', err)
    );
  });

  logInfo(LOG_MODULE, 'startPaymentPlanChargeJob', 'Payment plan charge job started (runs daily at 09:00 UTC via cron)');
}

export function stopPaymentPlanChargeJob(): void {
  // node-cron tasks stop automatically on process exit — nothing to clean up
}
