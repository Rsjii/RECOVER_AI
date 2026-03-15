"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDefaultPlans = ensureDefaultPlans;
exports.listActivePlans = listActivePlans;
exports.getCurrentSubscription = getCurrentSubscription;
exports.upsertCompanySubscription = upsertCompanySubscription;
exports.createBillingInvoice = createBillingInvoice;
exports.listBillingInvoices = listBillingInvoices;
exports.recordUsageEvent = recordUsageEvent;
exports.getUsageRollups = getUsageRollups;
exports.getEntitlements = getEntitlements;
const database_1 = require("../config/database");
async function ensureDefaultPlans() {
    await database_1.pool.query(`INSERT INTO subscription_plans (code, name, base_price_usd, success_fee_percent, billing_interval, features, limits)
     VALUES
       ('starter', 'Starter', 1500, 1.00, 'monthly', '{"billing":true}', '{"users":5}'),
       ('growth', 'Growth', 2500, 1.00, 'monthly', '{"billing":true,"api_access":true}', '{"users":25}'),
       ('enterprise', 'Enterprise', 5000, 0.75, 'monthly', '{"billing":true,"api_access":true,"sso":true}', '{"users":1000}')
     ON CONFLICT (code) DO NOTHING`);
}
async function listActivePlans() {
    const result = await database_1.pool.query(`SELECT id, code, name, base_price_usd, success_fee_percent, billing_interval, features, limits, is_active
     FROM subscription_plans
     WHERE is_active = true
     ORDER BY base_price_usd ASC`);
    return result.rows;
}
async function getCurrentSubscription(companyId) {
    const result = await database_1.pool.query(`SELECT s.id, s.company_id, s.plan_id, s.status, s.stripe_customer_id, s.stripe_subscription_id,
            s.current_period_start, s.current_period_end, s.trial_ends_at,
            p.code AS plan_code, p.name AS plan_name
     FROM subscriptions s
     JOIN subscription_plans p ON p.id = s.plan_id
     WHERE s.company_id = $1
     LIMIT 1`, [companyId]);
    return result.rows[0] || null;
}
async function upsertCompanySubscription(input) {
    const planResult = await database_1.pool.query('SELECT id FROM subscription_plans WHERE code = $1', [input.planCode]);
    if (!planResult.rows[0]) {
        throw new Error(`Unknown plan code: ${input.planCode}`);
    }
    const planId = planResult.rows[0].id;
    await database_1.pool.query(`INSERT INTO subscriptions (
       company_id, plan_id, status, stripe_customer_id, stripe_subscription_id,
       current_period_start, current_period_end, trial_ends_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (company_id) DO UPDATE SET
       plan_id = EXCLUDED.plan_id,
       status = EXCLUDED.status,
       stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
       stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
       current_period_start = COALESCE(EXCLUDED.current_period_start, subscriptions.current_period_start),
       current_period_end = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end),
       trial_ends_at = COALESCE(EXCLUDED.trial_ends_at, subscriptions.trial_ends_at),
       updated_at = NOW()`, [
        input.companyId,
        planId,
        input.status,
        input.stripeCustomerId ?? null,
        input.stripeSubscriptionId ?? null,
        input.periodStart ?? null,
        input.periodEnd ?? null,
        input.trialEndsAt ?? null,
    ]);
}
async function createBillingInvoice(input) {
    await database_1.pool.query(`INSERT INTO billing_invoices (
       company_id, subscription_id, period_start, period_end, base_amount_usd,
       success_fee_amount_usd, total_amount_usd, status, line_items
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [
        input.companyId,
        input.subscriptionId,
        input.periodStart,
        input.periodEnd,
        input.baseAmountUsd,
        input.successFeeAmountUsd,
        input.totalAmountUsd,
        input.status || 'draft',
        JSON.stringify(input.lineItems),
    ]);
}
async function listBillingInvoices(companyId, limit = 20) {
    const result = await database_1.pool.query(`SELECT id, period_start, period_end, base_amount_usd, success_fee_amount_usd, total_amount_usd,
            status, due_at, paid_at, created_at
     FROM billing_invoices
     WHERE company_id = $1
     ORDER BY period_start DESC
     LIMIT $2`, [companyId, limit]);
    return result.rows;
}
async function recordUsageEvent(input) {
    const occurredAt = input.occurredAt || new Date();
    const periodMonth = new Date(Date.UTC(occurredAt.getUTCFullYear(), occurredAt.getUTCMonth(), 1));
    await database_1.pool.query(`INSERT INTO usage_events (company_id, metric_key, quantity, source, occurred_at, metadata)
     VALUES ($1,$2,$3,$4,$5,$6)`, [
        input.companyId,
        input.metricKey,
        input.quantity,
        input.source || 'system',
        occurredAt,
        JSON.stringify(input.metadata || {}),
    ]);
    await database_1.pool.query(`INSERT INTO monthly_usage_rollups (company_id, period_month, metric_key, quantity)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (company_id, period_month, metric_key)
     DO UPDATE SET
       quantity = monthly_usage_rollups.quantity + EXCLUDED.quantity,
       updated_at = NOW()`, [input.companyId, periodMonth, input.metricKey, input.quantity]);
}
async function getUsageRollups(companyId, periodMonth) {
    const month = periodMonth || new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    const result = await database_1.pool.query(`SELECT metric_key, quantity, period_month, updated_at
     FROM monthly_usage_rollups
     WHERE company_id = $1 AND period_month = $2
     ORDER BY metric_key ASC`, [companyId, month]);
    return result.rows;
}
async function getEntitlements(companyId) {
    const result = await database_1.pool.query(`SELECT p.code AS plan_code, p.features, p.limits
     FROM subscriptions s
     JOIN subscription_plans p ON p.id = s.plan_id
     WHERE s.company_id = $1
     LIMIT 1`, [companyId]);
    if (!result.rows[0])
        return null;
    return {
        planCode: result.rows[0].plan_code,
        features: result.rows[0].features || {},
        limits: result.rows[0].limits || {},
    };
}
