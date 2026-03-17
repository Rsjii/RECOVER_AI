-- ============================================================
-- RecoverAI - Complete Database Schema
-- All tables use IF NOT EXISTS (safe to run multiple times)
-- ============================================================

-- Extensions (Supabase has these by default, no-op if already exists)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- COMPANIES (RecoverAI customers - founders who use our app)
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                       VARCHAR NOT NULL,
  email                      VARCHAR NOT NULL UNIQUE,
  owner_id                   UUID,  -- set after user is created

  -- Integration credentials (all encrypted at rest)
  stripe_api_key_encrypted   TEXT,
  stripe_account_id          VARCHAR,
  stripe_last_synced_at      TIMESTAMPTZ,
  slack_webhook_url_encrypted TEXT,

  quickbooks_realm_id        VARCHAR,
  quickbooks_access_token_encrypted TEXT,
  quickbooks_refresh_token_encrypted TEXT,

  chargebee_site             VARCHAR,
  chargebee_api_key_encrypted TEXT,

  -- Subscription & Billing (RecoverAI platform SaaS)
  subscription_status        VARCHAR(50) DEFAULT 'trial',  -- trial | active | past_due | canceled
  lemon_squeezy_customer_id  VARCHAR(255),

  -- Preferences
  timezone                   VARCHAR DEFAULT 'UTC',
  preferred_currency         VARCHAR(3) DEFAULT 'USD',
  dunning_strategy           JSONB DEFAULT '{"num_emails": 5, "days_between": 7, "approval_required": false}',

  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USERS (login accounts)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email         VARCHAR NOT NULL UNIQUE,
  password_hash VARCHAR NOT NULL,
  first_name    VARCHAR NOT NULL,
  last_name     VARCHAR NOT NULL,
  role          VARCHAR(20) DEFAULT 'member',     -- owner | member | viewer
  is_active     BOOLEAN DEFAULT true,
  last_login    TIMESTAMPTZ,
  reset_token   VARCHAR(255),
  reset_token_expires TIMESTAMPTZ,
  email_verified BOOLEAN DEFAULT false,
  otp_code      VARCHAR(6),
  otp_expires   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Add owner_id FK after users table exists (idempotent)
DO $$
BEGIN
  ALTER TABLE companies ADD CONSTRAINT fk_companies_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ============================================================
-- CUSTOMERS (their customers who owe money)
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            VARCHAR NOT NULL,
  email           VARCHAR NOT NULL,
  company_name    VARCHAR,
  phone           VARCHAR,
  payment_history JSONB DEFAULT '{"on_time_rate": 0, "avg_days_late": 0, "total_invoices": 0, "total_paid": 0}',
  industry        VARCHAR,
  notes           TEXT,
  do_not_email    BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, email)
);

-- ============================================================
-- INVOICES (unpaid invoices - the core of everything)
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount      DECIMAL(12, 2) NOT NULL,
  currency    VARCHAR(3) DEFAULT 'USD',
  due_date    TIMESTAMPTZ NOT NULL,
  issued_date TIMESTAMPTZ NOT NULL,
  status      VARCHAR(20) DEFAULT 'unpaid',   -- unpaid | paid | arranged | disputed | uncollectable
  risk_score  INT DEFAULT 0,                  -- 0-100 (higher = more urgent)
  source      VARCHAR(20) NOT NULL,           -- stripe | quickbooks | chargebee | manual
  source_id   VARCHAR(100),                   -- external invoice ID
  notes                TEXT,
  dunning_paused_until TIMESTAMPTZ DEFAULT NULL,
  dunning_stopped      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, source, source_id)
);

-- ============================================================
-- PAYMENT PLANS (installment agreements)
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  status      VARCHAR(20) DEFAULT 'active',   -- active | completed | defaulted
  installments JSONB NOT NULL DEFAULT '[]',   -- [{amount, due_date, paid, stripe_payment_intent_id}]
  total_amount DECIMAL(12, 2),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EMAIL LOGS (every email sent by agent)
-- ============================================================
CREATE TABLE IF NOT EXISTS email_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email_type          VARCHAR(50) NOT NULL,    -- dunning_1 | dunning_2 | dunning_3 | dunning_4 | dunning_5 | payment_plan_offer
  recipient_email     VARCHAR NOT NULL,
  subject             VARCHAR NOT NULL,
  body                TEXT NOT NULL,
  sent_at             TIMESTAMPTZ DEFAULT NOW(),
  opened_at           TIMESTAMPTZ,
  clicked_at          TIMESTAMPTZ,
  status              VARCHAR(20) DEFAULT 'sent',  -- sent | delivered | opened | clicked | bounced | failed
  sendgrid_message_id VARCHAR
);

-- ============================================================
-- PAYMENTS (money received)
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  amount           DECIMAL(12, 2) NOT NULL,
  currency         VARCHAR(3) DEFAULT 'USD',
  payment_method   VARCHAR(20) NOT NULL,       -- stripe | ach | wire | check | manual
  paid_at          TIMESTAMPTZ NOT NULL,
  stripe_charge_id VARCHAR,
  status           VARCHAR(20) DEFAULT 'succeeded',  -- pending | succeeded | failed
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EXCHANGE RATES (for multi-currency support)
-- ============================================================
CREATE TABLE IF NOT EXISTS exchange_rates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(3) NOT NULL,
  to_currency   VARCHAR(3) NOT NULL,
  rate          DECIMAL(10, 6) NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_currency, to_currency)
);

-- ============================================================
-- AUDIT LOGS (GDPR compliance + security)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(50) NOT NULL,    -- LOGIN | CREATE | UPDATE | DELETE | EXPORT
  resource_type VARCHAR(50) NOT NULL,   -- user | invoice | customer | settings | integration | session
  resource_id   VARCHAR(100),
  details       JSONB,                   -- Additional context about the action
  changes       JSONB,                   -- { before: {...}, after: {...} }
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INTEGRATION LOGS (sync audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS integration_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration   VARCHAR(50) NOT NULL,   -- stripe | quickbooks | chargebee
  action        VARCHAR(50) NOT NULL,   -- sync | fetch | webhook | error
  status        VARCHAR(20) NOT NULL,   -- success | error
  records_count INT DEFAULT 0,
  error_message TEXT,
  details       JSONB DEFAULT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- API USAGE TRACKING (cost monitoring)
-- ============================================================
CREATE TABLE IF NOT EXISTS api_usage_tracking (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID REFERENCES companies(id) ON DELETE CASCADE,
  service       VARCHAR(50)  NOT NULL,   -- claude | openai | resend
  model         VARCHAR(100) NOT NULL DEFAULT 'unknown',  -- claude-haiku-4-5-20251001 | gpt-4o-mini | etc.
  usage_count   INT NOT NULL DEFAULT 0,
  cost_usd      DECIMAL(10, 4) DEFAULT 0,
  input_tokens  BIGINT NOT NULL DEFAULT 0,
  output_tokens BIGINT NOT NULL DEFAULT 0,
  period        DATE NOT NULL,           -- first day of month (2026-03-01)
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, service, model, period)
);

-- ============================================================
-- PLATFORM DAILY STATS (Redis command snapshots, bandwidth)
-- ============================================================
CREATE TABLE IF NOT EXISTS platform_daily_stats (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL,
  metric_key  VARCHAR(80) NOT NULL,   -- redis_commands_total | redis_commands_daily | redis_bandwidth_bytes_total | redis_bandwidth_bytes_daily
  value       BIGINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, metric_key)
);

-- ============================================================
-- INDEXES (performance)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_invoices_company_status   ON invoices(company_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_company_due_date ON invoices(company_id, due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_company_risk     ON invoices(company_id, risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_source_id        ON invoices(source, source_id);

CREATE INDEX IF NOT EXISTS idx_customers_company         ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_email           ON customers(company_id, email);

CREATE INDEX IF NOT EXISTS idx_email_logs_invoice        ON email_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_company        ON email_logs(company_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_invoice          ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_company          ON payments(company_id, paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_plans_invoice     ON payment_plans(invoice_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_company_time   ON audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user           ON audit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_logs_company  ON integration_logs(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token) WHERE reset_token IS NOT NULL;

-- ============================================================
-- RECOVERY TIMELINE (for reports and analytics)
-- ============================================================
CREATE TABLE IF NOT EXISTS recovery_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_date DATE NOT NULL,
  period_type VARCHAR(10) DEFAULT 'daily', -- daily | weekly | monthly
  invoices_created INT DEFAULT 0,
  invoices_recovered INT DEFAULT 0,
  amount_created DECIMAL(12, 2) DEFAULT 0,
  amount_recovered DECIMAL(12, 2) DEFAULT 0,
  emails_sent INT DEFAULT 0,
  emails_opened INT DEFAULT 0,
  emails_clicked INT DEFAULT 0,
  avg_days_to_collect DECIMAL(5, 1) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, period_date, period_type)
);

CREATE INDEX IF NOT EXISTS idx_recovery_timeline ON recovery_timeline(company_id, period_date DESC);

-- ============================================================
-- SUBSCRIPTION PLANS (RecoverAI commercial plans)
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE, -- starter | growth | enterprise
  name VARCHAR(100) NOT NULL,
  base_price_usd DECIMAL(10, 2) NOT NULL DEFAULT 0,
  success_fee_percent DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
  billing_interval VARCHAR(20) NOT NULL DEFAULT 'monthly', -- monthly | annual
  features JSONB NOT NULL DEFAULT '{}',
  limits JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUBSCRIPTIONS (company subscription lifecycle)
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status VARCHAR(20) NOT NULL DEFAULT 'trialing', -- trialing | active | past_due | canceled
  stripe_customer_id VARCHAR(120),
  stripe_subscription_id VARCHAR(120),
  ls_subscription_id VARCHAR(120),
  ls_variant_id VARCHAR(50),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id)
);

-- ============================================================
-- BILLING INVOICES (RecoverAI invoices to SaaS customers)
-- ============================================================
CREATE TABLE IF NOT EXISTS billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  stripe_invoice_id VARCHAR(120),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  base_amount_usd DECIMAL(12, 2) NOT NULL DEFAULT 0,
  success_fee_amount_usd DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_amount_usd DECIMAL(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft | open | paid | void | uncollectible
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  line_items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USAGE EVENTS + ROLLUPS (entitlements and metering)
-- ============================================================
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  metric_key VARCHAR(80) NOT NULL, -- recovered_amount_usd | emails_sent | api_calls ...
  quantity DECIMAL(14, 2) NOT NULL DEFAULT 0,
  source VARCHAR(50) NOT NULL DEFAULT 'system',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS monthly_usage_rollups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_month DATE NOT NULL, -- first day of month
  metric_key VARCHAR(80) NOT NULL,
  quantity DECIMAL(14, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, period_month, metric_key)
);

-- ============================================================
-- TEAM MANAGEMENT (RBAC + invitations)
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member', -- owner | admin | member | viewer
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email VARCHAR NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  invited_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  token VARCHAR(120) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, email)
);

-- ============================================================
-- COMPLIANCE REQUESTS (export + deletion workflows)
-- ============================================================
CREATE TABLE IF NOT EXISTS compliance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requested_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  request_type VARCHAR(30) NOT NULL, -- export | delete
  status VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending | processing | completed | rejected
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'
);

-- ============================================================
-- POLICY APPROVAL QUEUE (human-in-the-loop governance)
-- ============================================================
CREATE TABLE IF NOT EXISTS policy_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  requested_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  risk_score INT NOT NULL DEFAULT 0,
  days_overdue INT NOT NULL DEFAULT 0,
  reason TEXT,
  decision_note TEXT,
  approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status, current_period_end);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_company_time ON billing_invoices(company_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_company_time ON usage_events(company_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_rollups_company_month ON monthly_usage_rollups(company_id, period_month DESC);
CREATE INDEX IF NOT EXISTS idx_org_members_company ON organization_members(company_id);
CREATE INDEX IF NOT EXISTS idx_invitations_company ON invitations(company_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_requests_company ON compliance_requests(company_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_policy_approvals_company ON policy_approvals(company_id, status, requested_at DESC);

-- ============================================================
-- SESSION TRACKING (device/session revocation)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  refresh_token_hash VARCHAR(128) NOT NULL,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  UNIQUE(user_id, refresh_token_hash)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, revoked_at, expires_at DESC);

-- ============================================================
-- WEBHOOK EVENT STORE (replay protection + idempotency)
-- ============================================================
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL, -- stripe | sendgrid | ...
  event_id VARCHAR(150) NOT NULL,
  event_type VARCHAR(120) NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'received', -- received | processed | ignored | failed
  payload_hash VARCHAR(128),
  error_message TEXT,
  UNIQUE(provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_time ON webhook_events(provider, received_at DESC);

-- ============================================================
-- FEATURE FLAGS (controlled pilot rollouts)
-- ============================================================
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  key VARCHAR(80) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  value JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, key)
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_company ON feature_flags(company_id, key);

-- ============================================================
-- TENANT RLS BASELINE
-- These policies rely on the DB session setting:
--   SET app.current_company_id = '<tenant-uuid>';
-- ============================================================
CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_company_id', true), '')::uuid
$$;

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE api_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_tracking FORCE ROW LEVEL SECURITY;
ALTER TABLE recovery_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_timeline FORCE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events FORCE ROW LEVEL SECURITY;
ALTER TABLE monthly_usage_rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_usage_rollups FORCE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE compliance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE policy_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_approvals FORCE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events FORCE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companies_tenant_isolation ON companies;
CREATE POLICY companies_tenant_isolation ON companies
  USING (id = app.current_company_id())
  WITH CHECK (id = app.current_company_id());

DROP POLICY IF EXISTS users_tenant_isolation ON users;
CREATE POLICY users_tenant_isolation ON users
  USING (company_id = app.current_company_id())
  WITH CHECK (company_id = app.current_company_id());

DROP POLICY IF EXISTS customers_tenant_isolation ON customers;
CREATE POLICY customers_tenant_isolation ON customers
  USING (company_id = app.current_company_id())
  WITH CHECK (company_id = app.current_company_id());

DROP POLICY IF EXISTS invoices_tenant_isolation ON invoices;
CREATE POLICY invoices_tenant_isolation ON invoices
  USING (company_id = app.current_company_id())
  WITH CHECK (company_id = app.current_company_id());

DROP POLICY IF EXISTS payment_plans_tenant_isolation ON payment_plans;
CREATE POLICY payment_plans_tenant_isolation ON payment_plans
  USING (
    EXISTS (
      SELECT 1
      FROM invoices i
      WHERE i.id = payment_plans.invoice_id
        AND i.company_id = app.current_company_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM invoices i
      WHERE i.id = payment_plans.invoice_id
        AND i.company_id = app.current_company_id()
    )
  );

DROP POLICY IF EXISTS email_logs_tenant_isolation ON email_logs;
CREATE POLICY email_logs_tenant_isolation ON email_logs
  USING (company_id = app.current_company_id())
  WITH CHECK (company_id = app.current_company_id());

DROP POLICY IF EXISTS payments_tenant_isolation ON payments;
CREATE POLICY payments_tenant_isolation ON payments
  USING (company_id = app.current_company_id())
  WITH CHECK (company_id = app.current_company_id());

DROP POLICY IF EXISTS audit_logs_tenant_isolation ON audit_logs;
CREATE POLICY audit_logs_tenant_isolation ON audit_logs
  USING (company_id = app.current_company_id())
  WITH CHECK (company_id = app.current_company_id());

DROP POLICY IF EXISTS integration_logs_tenant_isolation ON integration_logs;
CREATE POLICY integration_logs_tenant_isolation ON integration_logs
  USING (company_id = app.current_company_id())
  WITH CHECK (company_id = app.current_company_id());

DROP POLICY IF EXISTS api_usage_tracking_tenant_isolation ON api_usage_tracking;
CREATE POLICY api_usage_tracking_tenant_isolation ON api_usage_tracking
  USING (company_id = app.current_company_id())
  WITH CHECK (company_id = app.current_company_id());

DROP POLICY IF EXISTS recovery_timeline_tenant_isolation ON recovery_timeline;
CREATE POLICY recovery_timeline_tenant_isolation ON recovery_timeline
  USING (company_id = app.current_company_id())
  WITH CHECK (company_id = app.current_company_id());

DROP POLICY IF EXISTS subscriptions_tenant_isolation ON subscriptions;
CREATE POLICY subscriptions_tenant_isolation ON subscriptions
  USING (company_id = app.current_company_id())
  WITH CHECK (company_id = app.current_company_id());

DROP POLICY IF EXISTS billing_invoices_tenant_isolation ON billing_invoices;
CREATE POLICY billing_invoices_tenant_isolation ON billing_invoices
  USING (company_id = app.current_company_id())
  WITH CHECK (company_id = app.current_company_id());

DROP POLICY IF EXISTS usage_events_tenant_isolation ON usage_events;
CREATE POLICY usage_events_tenant_isolation ON usage_events
  USING (company_id = app.current_company_id())
  WITH CHECK (company_id = app.current_company_id());

DROP POLICY IF EXISTS monthly_usage_rollups_tenant_isolation ON monthly_usage_rollups;
CREATE POLICY monthly_usage_rollups_tenant_isolation ON monthly_usage_rollups
  USING (company_id = app.current_company_id())
  WITH CHECK (company_id = app.current_company_id());

DROP POLICY IF EXISTS organization_members_tenant_isolation ON organization_members;
CREATE POLICY organization_members_tenant_isolation ON organization_members
  USING (company_id = app.current_company_id())
  WITH CHECK (company_id = app.current_company_id());

DROP POLICY IF EXISTS invitations_tenant_isolation ON invitations;
CREATE POLICY invitations_tenant_isolation ON invitations
  USING (company_id = app.current_company_id())
  WITH CHECK (company_id = app.current_company_id());

DROP POLICY IF EXISTS compliance_requests_tenant_isolation ON compliance_requests;
CREATE POLICY compliance_requests_tenant_isolation ON compliance_requests
  USING (company_id = app.current_company_id())
  WITH CHECK (company_id = app.current_company_id());

DROP POLICY IF EXISTS policy_approvals_tenant_isolation ON policy_approvals;
CREATE POLICY policy_approvals_tenant_isolation ON policy_approvals
  USING (company_id = app.current_company_id())
  WITH CHECK (company_id = app.current_company_id());

DROP POLICY IF EXISTS user_sessions_tenant_isolation ON user_sessions;
CREATE POLICY user_sessions_tenant_isolation ON user_sessions
  USING (company_id = app.current_company_id())
  WITH CHECK (company_id = app.current_company_id());

DROP POLICY IF EXISTS webhook_events_tenant_isolation ON webhook_events;
CREATE POLICY webhook_events_tenant_isolation ON webhook_events
  USING (company_id IS NULL OR company_id = app.current_company_id())
  WITH CHECK (company_id IS NULL OR company_id = app.current_company_id());

DROP POLICY IF EXISTS feature_flags_tenant_isolation ON feature_flags;
CREATE POLICY feature_flags_tenant_isolation ON feature_flags
  USING (company_id = app.current_company_id())
  WITH CHECK (company_id = app.current_company_id());

CREATE INDEX IF NOT EXISTS idx_invoices_dunning_active
  ON invoices(company_id)
  WHERE dunning_stopped = FALSE AND status NOT IN ('paid', 'uncollectable');

CREATE INDEX IF NOT EXISTS idx_api_usage_company_period
  ON api_usage_tracking(company_id, period DESC);

CREATE INDEX IF NOT EXISTS idx_platform_daily_stats
  ON platform_daily_stats(metric_key, date DESC);

