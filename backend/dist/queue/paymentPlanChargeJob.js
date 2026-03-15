"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startPaymentPlanChargeJob = startPaymentPlanChargeJob;
exports.stopPaymentPlanChargeJob = stopPaymentPlanChargeJob;
const bullmq_1 = require("bullmq");
const stripe_1 = __importDefault(require("stripe"));
const dunningQueue_1 = require("./dunningQueue");
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const encryption_1 = require("../lib/encryption");
const QUEUE_NAME = 'payment-plan-charge';
const LOG_MODULE = 'paymentPlanChargeJob';
let chargeQueue = null;
let chargeWorker = null;
function getChargeQueue() {
    if (!chargeQueue) {
        chargeQueue = new bullmq_1.Queue(QUEUE_NAME, { connection: (0, dunningQueue_1.getRedisConnection)() });
        chargeQueue.on('error', (err) => {
            (0, logger_1.logError)(LOG_MODULE, 'queue', 'Charge queue connection issue', err);
        });
    }
    return chargeQueue;
}
async function getDueInstallments() {
    const result = await database_1.pool.query(`
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
  `);
    return result.rows;
}
async function chargeInstallment(inst) {
    const method = 'chargeInstallment';
    if (!inst.stripe_api_key_encrypted) {
        (0, logger_1.logInfo)(LOG_MODULE, method, 'No Stripe key — skipping installment', { planId: inst.plan_id });
        return;
    }
    const apiKey = (0, encryption_1.decryptField)(inst.stripe_api_key_encrypted);
    const stripe = new stripe_1.default(apiKey);
    try {
        // Find or create Stripe customer for the email
        const customers = await stripe.customers.list({ email: inst.customer_email, limit: 1 });
        if (!customers.data.length) {
            (0, logger_1.logInfo)(LOG_MODULE, method, 'No Stripe customer found — skipping', { email: inst.customer_email });
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
            (0, logger_1.logInfo)(LOG_MODULE, method, 'No payment method — skipping', { customerId: stripeCustomer.id });
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
        await database_1.pool.query(`
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
        await database_1.pool.query(`INSERT INTO payments (invoice_id, company_id, amount, currency, payment_method, paid_at, stripe_charge_id, status)
       VALUES ($1, $2, $3, 'USD', 'stripe', NOW(), $4, 'succeeded')`, [inst.invoice_id, inst.company_id, inst.amount, pi.id]);
        (0, logger_1.logInfo)(LOG_MODULE, method, 'Installment charged successfully', {
            planId: inst.plan_id,
            amount: inst.amount,
            paymentIntentId: pi.id,
        });
    }
    catch (err) {
        (0, logger_1.logError)(LOG_MODULE, method, 'Installment charge failed', err, {
            planId: inst.plan_id,
            amount: inst.amount,
        });
        // Mark installment as failed in installments array for visibility
        await database_1.pool.query(`
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
async function runPaymentPlanCharges() {
    const method = 'runPaymentPlanCharges';
    (0, logger_1.logInfo)(LOG_MODULE, method, 'Starting payment plan charge run');
    const dueInstallments = await getDueInstallments();
    (0, logger_1.logInfo)(LOG_MODULE, method, `Found ${dueInstallments.length} due installments`);
    let charged = 0;
    let failed = 0;
    for (const inst of dueInstallments) {
        try {
            await chargeInstallment(inst);
            charged++;
        }
        catch {
            failed++;
        }
    }
    const result = { processed: dueInstallments.length, charged, failed };
    (0, logger_1.logInfo)(LOG_MODULE, method, 'Payment plan charge run complete', result);
    return result;
}
function startPaymentPlanChargeJob() {
    try {
        const connection = (0, dunningQueue_1.getRedisConnection)();
        chargeWorker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
            (0, logger_1.logInfo)(LOG_MODULE, 'worker', 'Processing charge job', { jobId: job.id });
            return runPaymentPlanCharges();
        }, { connection, concurrency: 1 });
        chargeWorker.on('completed', (job, result) => {
            (0, logger_1.logInfo)(LOG_MODULE, 'worker', 'Charge job completed', { jobId: job.id, ...result });
        });
        chargeWorker.on('failed', (job, err) => {
            (0, logger_1.logError)(LOG_MODULE, 'worker', 'Charge job failed', err, { jobId: job?.id });
        });
        chargeWorker.on('error', (err) => {
            (0, logger_1.logError)(LOG_MODULE, 'worker', 'Charge worker connection issue', err);
        });
        scheduleChargeJob();
        (0, logger_1.logInfo)(LOG_MODULE, 'startPaymentPlanChargeJob', 'Payment plan charge job started (runs daily at 09:00 UTC)');
    }
    catch (err) {
        (0, logger_1.logError)(LOG_MODULE, 'startPaymentPlanChargeJob', 'Failed to start payment plan charge job', err);
    }
}
async function scheduleChargeJob() {
    try {
        const queue = getChargeQueue();
        await queue.removeRepeatable('payment-plan-charge', { pattern: '0 9 * * *' });
        await queue.add('payment-plan-charge', {}, {
            repeat: { pattern: '0 9 * * *' }, // 9:00 AM UTC daily
            jobId: 'payment-plan-charge-cron',
        });
        (0, logger_1.logInfo)(LOG_MODULE, 'scheduleChargeJob', 'Payment plan charge cron scheduled (09:00 AM UTC daily)');
    }
    catch (err) {
        (0, logger_1.logError)(LOG_MODULE, 'scheduleChargeJob', 'Failed to schedule charge job', err);
    }
}
async function stopPaymentPlanChargeJob() {
    try {
        await chargeWorker?.close();
        await chargeQueue?.close();
        (0, logger_1.logInfo)(LOG_MODULE, 'stop', 'Payment plan charge job stopped');
    }
    catch (err) {
        (0, logger_1.logError)(LOG_MODULE, 'stop', 'Error stopping payment plan charge job', err);
    }
}
