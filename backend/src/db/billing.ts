import { pool } from '../config/database';

export interface PlanRow {
  id: string;
  code: string;
  name: string;
  base_price_usd: string;
  success_fee_percent: string;
  billing_interval: 'monthly' | 'annual';
  features: Record<string, unknown>;
  limits: Record<string, unknown>;
  is_active: boolean;
}

export interface SubscriptionRow {
  id: string;
  company_id: string;
  plan_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
}

export async function ensureDefaultPlans(): Promise<void> {
  // Tiered success fee structure:
  // Growth:     5% first $50k, 3% next $100k, 2% above $150k (monthly recovered)
  // Enterprise: 4% first $100k, 2.5% next $200k, 1.5% above $300k
  const growthTiers = JSON.stringify([
    { up_to: 50000,  pct: 5.0 },
    { up_to: 150000, pct: 3.0 },
    { up_to: null,   pct: 2.0 },
  ]);
  const enterpriseTiers = JSON.stringify([
    { up_to: 100000, pct: 4.0 },
    { up_to: 300000, pct: 2.5 },
    { up_to: null,   pct: 1.5 },
  ]);

  await pool.query(
    `INSERT INTO subscription_plans (code, name, base_price_usd, success_fee_percent, billing_interval, features, limits, success_fee_tiers)
     VALUES
       ('phase_0', 'Phase 0 (First Customers)', 0, 5.00, 'monthly',
        '{"stripe":true,"ar_recovery":true,"payment_prediction":true,"cash_position":true}',
        '{"users":5,"invoices_per_month":200}',
        NULL),
       ('growth', 'Growth', 2500, 5.00, 'monthly',
        '{"stripe":true,"quickbooks":true,"ar_recovery":true,"sms":true,"payment_plans":true,"payment_prediction":true,"cash_position":true,"priority_support":true}',
        '{"users":20}',
        $1),
       ('enterprise', 'Enterprise', 5000, 4.00, 'monthly',
        '{"stripe":true,"quickbooks":true,"xero":true,"netsuite":true,"ar_recovery":true,"sms":true,"payment_plans":true,"ap_automation":true,"payment_prediction":true,"cash_position":true,"api_access":true,"white_label":true,"dedicated_am":true}',
        '{"users":1000}',
        $2)
     ON CONFLICT (code) DO UPDATE SET
       base_price_usd       = EXCLUDED.base_price_usd,
       success_fee_percent  = EXCLUDED.success_fee_percent,
       success_fee_tiers    = EXCLUDED.success_fee_tiers,
       features             = EXCLUDED.features,
       limits               = EXCLUDED.limits`,
    [growthTiers, enterpriseTiers]
  );
}

export async function listActivePlans(): Promise<PlanRow[]> {
  const result = await pool.query<PlanRow>(
    `SELECT id, code, name, base_price_usd, success_fee_percent, billing_interval, features, limits, is_active
     FROM subscription_plans
     WHERE is_active = true
     ORDER BY base_price_usd ASC`
  );
  return result.rows;
}

export async function getCurrentSubscription(companyId: string): Promise<(SubscriptionRow & { plan_code: string; plan_name: string }) | null> {
  const result = await pool.query(
    `SELECT s.id, s.company_id, s.plan_id, s.status, s.stripe_customer_id, s.stripe_subscription_id,
            s.current_period_start, s.current_period_end, s.trial_ends_at,
            p.code AS plan_code, p.name AS plan_name
     FROM subscriptions s
     JOIN subscription_plans p ON p.id = s.plan_id
     WHERE s.company_id = $1
     LIMIT 1`,
    [companyId]
  );
  return result.rows[0] || null;
}

export async function upsertCompanySubscription(input: {
  companyId: string;
  planCode: string;
  status: SubscriptionRow['status'];
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  lsSubscriptionId?: string | null;
  lsVariantId?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  trialEndsAt?: Date | null;
}): Promise<void> {
  const planResult = await pool.query<{ id: string }>('SELECT id FROM subscription_plans WHERE code = $1', [input.planCode]);
  if (!planResult.rows[0]) {
    throw new Error(`Unknown plan code: ${input.planCode}`);
  }
  const planId = planResult.rows[0].id;

  await pool.query(
    `INSERT INTO subscriptions (
       company_id, plan_id, status, stripe_customer_id, stripe_subscription_id,
       ls_subscription_id, ls_variant_id, current_period_start, current_period_end, trial_ends_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (company_id) DO UPDATE SET
       plan_id = EXCLUDED.plan_id,
       status = EXCLUDED.status,
       stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
       stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
       ls_subscription_id = COALESCE(EXCLUDED.ls_subscription_id, subscriptions.ls_subscription_id),
       ls_variant_id = COALESCE(EXCLUDED.ls_variant_id, subscriptions.ls_variant_id),
       current_period_start = COALESCE(EXCLUDED.current_period_start, subscriptions.current_period_start),
       current_period_end = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end),
       trial_ends_at = COALESCE(EXCLUDED.trial_ends_at, subscriptions.trial_ends_at),
       updated_at = NOW()`,
    [
      input.companyId,
      planId,
      input.status,
      input.stripeCustomerId ?? null,
      input.stripeSubscriptionId ?? null,
      input.lsSubscriptionId ?? null,
      input.lsVariantId ?? null,
      input.periodStart ?? null,
      input.periodEnd ?? null,
      input.trialEndsAt ?? null,
    ]
  );
}

export async function createBillingInvoice(input: {
  companyId: string;
  subscriptionId: string | null;
  periodStart: Date;
  periodEnd: Date;
  baseAmountUsd: number;
  successFeeAmountUsd: number;
  totalAmountUsd: number;
  lineItems: Array<Record<string, unknown>>;
  status?: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
}): Promise<void> {
  await pool.query(
    `INSERT INTO billing_invoices (
       company_id, subscription_id, period_start, period_end, base_amount_usd,
       success_fee_amount_usd, total_amount_usd, status, line_items
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      input.companyId,
      input.subscriptionId,
      input.periodStart,
      input.periodEnd,
      input.baseAmountUsd,
      input.successFeeAmountUsd,
      input.totalAmountUsd,
      input.status || 'draft',
      JSON.stringify(input.lineItems),
    ]
  );
}

export async function listBillingInvoices(companyId: string, limit = 20): Promise<any[]> {
  const result = await pool.query(
    `SELECT id, period_start, period_end, base_amount_usd, success_fee_amount_usd, total_amount_usd,
            status, due_at, paid_at, created_at
     FROM billing_invoices
     WHERE company_id = $1
     ORDER BY period_start DESC
     LIMIT $2`,
    [companyId, limit]
  );
  return result.rows;
}

export async function recordUsageEvent(input: {
  companyId: string;
  metricKey: string;
  quantity: number;
  source?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}): Promise<void> {
  const occurredAt = input.occurredAt || new Date();
  const periodMonth = new Date(Date.UTC(occurredAt.getUTCFullYear(), occurredAt.getUTCMonth(), 1));

  await pool.query(
    `INSERT INTO usage_events (company_id, metric_key, quantity, source, occurred_at, metadata)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      input.companyId,
      input.metricKey,
      input.quantity,
      input.source || 'system',
      occurredAt,
      JSON.stringify(input.metadata || {}),
    ]
  );

  await pool.query(
    `INSERT INTO monthly_usage_rollups (company_id, period_month, metric_key, quantity)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (company_id, period_month, metric_key)
     DO UPDATE SET
       quantity = monthly_usage_rollups.quantity + EXCLUDED.quantity,
       updated_at = NOW()`,
    [input.companyId, periodMonth, input.metricKey, input.quantity]
  );
}

export async function getUsageRollups(companyId: string, periodMonth?: Date): Promise<any[]> {
  const month = periodMonth || new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const result = await pool.query(
    `SELECT metric_key, quantity, period_month, updated_at
     FROM monthly_usage_rollups
     WHERE company_id = $1 AND period_month = $2
     ORDER BY metric_key ASC`,
    [companyId, month]
  );
  return result.rows;
}

export async function getEntitlements(companyId: string): Promise<{ planCode: string; features: Record<string, unknown>; limits: Record<string, unknown> } | null> {
  const result = await pool.query(
    `SELECT p.code AS plan_code, p.features, p.limits
     FROM subscriptions s
     JOIN subscription_plans p ON p.id = s.plan_id
     WHERE s.company_id = $1
     LIMIT 1`,
    [companyId]
  );
  if (!result.rows[0]) return null;
  return {
    planCode: result.rows[0].plan_code,
    features: result.rows[0].features || {},
    limits: result.rows[0].limits || {},
  };
}


