# RecoverAI - Complete Implementation Plan & Architecture
**Status:** Ready for Build
**Created:** 2026-03-04
**Build Timeline:** 4 weeks (3.5 weeks MVP + deployment)
**First Customer Target:** Week 4 (2 weeks after MVP completion)

---

## PART 1: EXECUTIVE SUMMARY & DESIGN DECISIONS

### Product Context
**RecoverAI** is a true autonomous agent that recovers unpaid invoices for SaaS companies. Unlike competitors (Upflow, Growfin), it:
- ✅ Autonomously sends dunning emails (no approval needed)
- ✅ Intelligently offers payment plans (risk-adjusted)
- ✅ Tracks payments in real-time
- ✅ Outcome-based pricing ($2.5k base + 1% recovery)

### Technology Stack (Following AI_FINAL_MODEL Patterns)
```
Frontend:
  - React 18 + TypeScript
  - TailwindCSS + Dark theme
  - React Router for navigation
  - Context API for state management

Backend:
  - Node.js + Express
  - PostgreSQL (with pgvector for future ML)
  - Redis (queue caching)
  - Bull/BullMQ (job scheduling)
  - Claude API (AI/reasoning)

Integrations:
  - Stripe API (invoice data, payment plans)
  - QuickBooks API (accounting)
  - Chargebee API (billing)
  - SendGrid (email)
  - Slack API (notifications)

Deployment:
  - Docker + docker-compose
  - Railway/Render (hosting)
  - GitHub Actions (CI/CD)
```

### Theme & Visual Design
**✨ LIGHT THEME (Modern SaaS Standard 2026)**
- **Default:** Light/White theme (professional SaaS look)
- **Background:** #ffffff (main), #f9fafb (cards), #f5f5f5 (hover)
- **Text:** #212121 (primary), #616161 (secondary)
- **Borders:** #e5e7eb (normal), #d1d5db (focus)
- **Brand:** Blue (#3b82f6 primary, #2563eb hover)
- **Risk Levels** (High Contrast):
  - 🔴 Critical (90-100): #dc2626 (red-600)
  - 🟠 High (60-89): #ea580c (orange-600)
  - 🟡 Medium (30-59): #ca8a04 (amber-600)
  - 🟢 Low (0-29): #16a34a (green-600)

**🌙 DARK MODE (Optional Toggle)**
- Also supported via `darkMode: 'class'` in Tailwind
- Users can toggle in settings
- Automatic switching based on OS preference (future)

**Typography:**
- Font: Inter + system-ui fallbacks
- Sizes: 12px (xs), 14px (sm), 16px (base), 18px (lg), 20px (xl)
- Weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

---

## PART 1.5: CRITICAL IMPLEMENTATION NOTES (8 Key Decisions)

### 1️⃣ Companies vs Customers (Data Model)
- **Companies** = RecoverAI customers (SaaS founders using our app)
- **Customers** = Their customers who owe money
- Strict data isolation: When John logs in, only see his company's data
- Reference: See CLARIFICATIONS_AND_UPDATES.md Section 1

### 2️⃣ Theme: Light Modern + Dark Mode Toggle
- **Default:** White/light theme (#ffffff, #f9fafb cards) - Modern 2026 SaaS style
- **Optional:** Dark mode toggle in settings
- **Risk colors:** High contrast (red/orange/yellow/green) on both themes
- Not dark-by-default (that was rejected)
- Reference: See CLARIFICATIONS_AND_UPDATES.md Section 2

### 3️⃣ Predefined UI Components
- Centralized NotificationContext (toast, modals, popovers)
- Reusable Modal, Popover, Toast, Badge, Alert components
- Theme context for light/dark toggle
- Error boundaries and loading states included
- Reference: See CLARIFICATIONS_AND_UPDATES.md Section 3

### 4️⃣ Timezone Handling (Global SaaS Support)
- **Rule:** Store ALL timestamps as UTC in database
- Display in company's configured timezone
- Smart email timing: Don't send outside business hours (9 AM - 6 PM company time)
- Configurable in company settings
- Reference: See CLARIFICATIONS_AND_UPDATES.md Section 4

### 5️⃣ Rate Limits + API Cost Tracking
- Rate limiting by endpoint: Auth (strict), API (moderate), Webhooks (generous)
- Cost tracking per service: Claude (~$8/mo), SendGrid ($10/mo), Infrastructure ($100/mo)
- At scale (20 customers): ~$3.24k/month total cost, $60k revenue = 95% margin
- Reference: See CLARIFICATIONS_AND_UPDATES.md Section 5

### 6️⃣ Multi-Currency Support
- Store currency (ISO 4217) with each invoice
- Exchange rates updated daily (via exchangerate-api.com)
- Display in company's preferred currency
- Automatic conversion in dashboards & reports
- Reference: See CLARIFICATIONS_AND_UPDATES.md Section 6

### 7️⃣ State Persistence & OAuth Strategy
- OAuth 2.0 for login (Google/GitHub/email)
- httpOnly cookies for JWT tokens (XSS protection, not localStorage)
- Automatic token refresh on 401
- Session restored from httpOnly cookie on page reload
- No localStorage for sensitive data
- Reference: See CLARIFICATIONS_AND_UPDATES.md Section 7

### 8️⃣ Security & Compliance
- OWASP Top 10 checklist ✅
- AES-256-GCM encryption for sensitive data (API keys)
- Audit logging for GDPR compliance (right to be forgotten)
- CORS, rate limiting, parameterized queries
- No hardcoded secrets (.env with encryption key)
- Reference: See CLARIFICATIONS_AND_UPDATES.md Section 8

---

## PART 2: SYSTEM ARCHITECTURE

### 2.1 High-Level Flow
```
┌─────────────────────────────────────────────────────────────┐
│                   INVOICE DATA SOURCES                       │
│          (Stripe, QB, Chargebee, Manual CSV)               │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              DATA INGESTION LAYER                            │
│  - OAuth connections (Stripe, QB, Chargebee)               │
│  - Hourly sync jobs (Bull queue)                           │
│  - Webhook listeners (real-time payment updates)           │
│  - Normalize & validate invoice data                        │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                 PostgreSQL DATABASE                          │
│  - invoices, customers, payments, email_logs, etc.         │
└────────────────────────────┬────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ RISK SCORING    │  │  AGENT ENGINE   │  │  PAYMENT TRACK  │
│ (Claude API)    │  │ (Claude Claude) │  │ (Stripe Webhook)│
│ Score 0-100     │  │ Generate email  │  │ Update status   │
└─────────────────┘  │ Decide actions  │  │ Notify Slack    │
                     │ No approval     │  │ Re-trigger      │
                     └─────────────────┘  └─────────────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ EMAIL SENDING   │  │ PAYMENT PLAN    │  │   DASHBOARD     │
│ (SendGrid)      │  │  (Stripe)       │  │ (React UI)      │
│ Auto-send       │  │ Auto-charge     │  │ Real-time stats │
└─────────────────┘  └─────────────────┘  └─────────────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                             ▼
                   ┌─────────────────┐
                   │ SLACK DAILY     │
                   │ DIGEST          │
                   │ "$15k recovered" │
                   └─────────────────┘
```

### 2.2 Backend Module Structure
```
src/
├── config/
│   ├── env.ts              (environment variables)
│   ├── logger.ts           (logging setup)
│   └── database.ts         (PostgreSQL connection)
├── middleware/
│   ├── auth.ts             (JWT validation)
│   ├── errorHandler.ts     (error handling)
│   └── rateLimiter.ts      (rate limiting)
├── modules/
│   ├── auth/               (signup, login, OAuth)
│   ├── invoices/           (CRUD, syncing, storage)
│   ├── customers/          (customer data, history)
│   ├── risk-scoring/       (risk calculation engine)
│   ├── email-agent/        (Claude API, email generation)
│   ├── payment-plans/      (terms calculation, Stripe integration)
│   ├── payments/           (tracking, webhooks)
│   ├── slack/              (notifications)
│   ├── integrations/       (Stripe, QB, Chargebee)
│   ├── settings/           (company config)
│   ├── dashboard/          (analytics endpoints)
│   └── reports/            (recovery reports)
├── jobs/
│   ├── queue.ts            (Bull queue setup)
│   ├── syncInvoices.ts     (hourly sync)
│   ├── runDunningAgent.ts  (email agent trigger)
│   ├── trackPayments.ts    (payment status updates)
│   └── dailySlackDigest.ts (Slack notifications)
├── services/
│   ├── claudeService.ts       (Claude API calls)
│   ├── stripeService.ts       (Stripe API calls)
│   ├── qbService.ts           (QuickBooks API)
│   ├── chargebeeService.ts    (Chargebee API)
│   ├── sendgridService.ts     (Email sending)
│   ├── slackService.ts        (Slack API)
│   ├── timezoneService.ts     (UTC ↔ Company timezone)
│   ├── currencyService.ts     (Exchange rates, conversion)
│   ├── encryptionService.ts   (AES-256-GCM encryption)
│   ├── auditService.ts        (Audit logging for compliance)
│   └── costTrackingService.ts (API cost tracking)
├── types/
│   └── index.ts            (TypeScript interfaces)
├── utils/
│   ├── validators.ts       (input validation)
│   └── formatters.ts       (data formatting)
├── app.ts                  (Express setup)
└── server.ts              (start server)
```

### 2.3 Frontend Structure
```
src/
├── components/
│   ├── layout/
│   │   ├── Layout.tsx      (main layout with nav)
│   │   ├── Sidebar.tsx     (navigation sidebar)
│   │   └── Header.tsx      (top bar)
│   ├── ui/
│   │   ├── Button.tsx      (button component)
│   │   ├── Card.tsx        (card component)
│   │   ├── Table.tsx       (table component)
│   │   ├── Modal.tsx       (modal component)
│   │   ├── Badge.tsx       (risk score badge)
│   │   └── LoadingSpinner.tsx
│   ├── dashboard/
│   │   ├── StatsCard.tsx   (AR, recovered, at-risk)
│   │   ├── OverviewChart.tsx (recovery trend)
│   │   └── DSOChart.tsx
│   ├── invoices/
│   │   ├── InvoiceTable.tsx (list invoices)
│   │   └── InvoiceDetail.tsx (detailed view)
│   ├── integration/
│   │   ├── StripeConnect.tsx (Stripe OAuth)
│   │   ├── QuickBooksConnect.tsx
│   │   └── ChargebeeConnect.tsx
│   └── ErrorBoundary.tsx
├── pages/
│   ├── Login.tsx            (login page)
│   ├── Setup.tsx            (org setup)
│   ├── Dashboard.tsx        (overview)
│   ├── Invoices.tsx         (invoice list)
│   ├── Reports.tsx          (recovery reports)
│   └── Settings.tsx         (company settings)
├── contexts/
│   ├── AuthContext.tsx      (auth state)
│   ├── InvoiceContext.tsx   (invoice state)
│   └── AppContext.tsx       (global state)
├── hooks/
│   ├── useAuth.ts          (auth hook)
│   ├── useInvoices.ts      (invoices hook)
│   └── useApi.ts           (API calls)
├── lib/
│   ├── api.ts              (API client)
│   ├── axios.ts            (axios config)
│   └── utils.ts            (utilities)
├── config/
│   └── constants.ts        (API endpoints, colors)
├── App.tsx                  (routing)
├── main.tsx                (entry point)
└── index.css               (global styles)
```

---

## PART 3: DATABASE SCHEMA

### 3.0 IMPORTANT: Companies vs Customers (Explained)

**COMPANIES** = Your SaaS customers (who use RecoverAI)
```sql
Company Example: "Acme Corp"
  Owner: John Smith (john@acmecorp.com)
  Uses RecoverAI to recover money from their customers
  Connects: Their Stripe account, QB account, Chargebee account
```

**CUSTOMERS** = Their SaaS customers (who OWE money TO the company)
```sql
Company: Acme Corp
  └─ Customer 1: "TechStartup Inc" (owes $5k)
  └─ Customer 2: "SaaS Unicorn" (owes $12k)
  └─ Customer 3: "Bootstrap Inc" (owes $2k)
```

**Data Isolation:**
- When John logs in → Only see Acme's data
- When Jane (Saasify founder) logs in → Only see Saasify's data
- NO cross-company data leakage ✅

### 3.1 Core Tables
```sql
-- Companies (RecoverAI customers - the founders using our app)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  email VARCHAR NOT NULL UNIQUE,
  owner_id UUID REFERENCES users(id),

  -- Integration credentials (encrypted)
  stripe_api_key_encrypted TEXT,
  stripe_account_id VARCHAR,
  quickbooks_realm_id VARCHAR,
  chargebee_site VARCHAR,
  slack_webhook_url_encrypted TEXT,

  -- Settings
  timezone VARCHAR DEFAULT 'UTC',  -- "America/New_York", "Europe/London", etc.
  preferred_currency VARCHAR(3) DEFAULT 'USD',  -- For dashboard display
  dunning_strategy JSONB DEFAULT '{"num_emails": 5, "days_between": 7, "approval_required": false}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  email VARCHAR NOT NULL,
  company_name VARCHAR,
  payment_history JSONB DEFAULT '{"on_time_rate": 0, "avg_days_late": 0, "total_invoices": 0}',
  industry VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, email)
);

-- Invoices (unpaid invoices from customers)
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',  -- ISO 4217 code (USD, EUR, GBP, etc.)
  due_date TIMESTAMPTZ NOT NULL,  -- Always stored as UTC
  issued_date TIMESTAMPTZ NOT NULL,  -- Always stored as UTC
  status VARCHAR(20) DEFAULT 'unpaid',  -- unpaid, paid, arranged, disputed, uncollectable
  risk_score INT DEFAULT 0,  -- 0-100
  source VARCHAR(20) NOT NULL,  -- stripe, quickbooks, chargebee, manual
  source_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, source, source_id)
);

-- Payment Plans
CREATE TABLE payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'active',  -- active, completed, defaulted
  installments JSONB NOT NULL,  -- [{amount: 1000, due_date: "2026-04-01", paid: false}]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Logs
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  email_type VARCHAR(50) NOT NULL,  -- dunning_1, dunning_2, dunning_3, etc.
  recipient_email VARCHAR NOT NULL,
  subject VARCHAR NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'sent',  -- sent, delivered, opened, clicked, bounced, failed
  sendgrid_message_id VARCHAR
);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  payment_method VARCHAR(20) NOT NULL,  -- stripe, ach, wire, check, manual
  paid_at TIMESTAMPTZ NOT NULL,
  stripe_charge_id VARCHAR,
  status VARCHAR(20) DEFAULT 'succeeded',  -- pending, succeeded, failed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exchange Rates (for multi-currency support)
CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  rate DECIMAL(10, 6) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_currency, to_currency)
);

-- Audit Logs (GDPR compliance, security)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,  -- login, invoice_created, payment_updated, export_data, stripe_connected
  resource_type VARCHAR(50) NOT NULL,  -- invoice, customer, settings, integration
  resource_id VARCHAR(100),
  changes JSONB,  -- What changed (old → new)
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integration Logs (audit trail for syncs)
CREATE TABLE integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration VARCHAR(50) NOT NULL,  -- stripe, quickbooks, chargebee
  action VARCHAR(50) NOT NULL,  -- sync, fetch, error
  status VARCHAR(20) NOT NULL,  -- success, error
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Usage Tracking (cost tracking)
CREATE TABLE api_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service VARCHAR(50) NOT NULL,  -- claude, stripe, sendgrid, infrastructure
  usage_count INT NOT NULL,
  cost_usd DECIMAL(10, 4),
  period DATE NOT NULL,  -- YYYY-MM format
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2 Indexes for Performance
```sql
-- Invoices
CREATE INDEX idx_invoices_company_status ON invoices(company_id, status);
CREATE INDEX idx_invoices_company_due_date ON invoices(company_id, due_date);
CREATE INDEX idx_invoices_company_risk ON invoices(company_id, risk_score DESC);

-- Customers & relationships
CREATE INDEX idx_customers_company ON customers(company_id);
CREATE INDEX idx_email_logs_invoice ON email_logs(invoice_id);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payment_plans_invoice ON payment_plans(invoice_id);

-- Audit & Compliance
CREATE INDEX idx_audit_logs_company_time ON audit_logs(company_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_integration_logs_company ON integration_logs(company_id, created_at DESC);
```

---

## PART 4: API ENDPOINTS

### Authentication
```
POST /api/auth/signup
  Body: { email, password, company_name }
  Response: { user, company, token }

POST /api/auth/login
  Body: { email, password }
  Response: { user, company, token }

POST /api/auth/refresh
  Response: { token }

GET /api/auth/me
  Response: { user, company }
```

### Integrations (OAuth)
```
POST /api/integrations/stripe/connect
  Body: { stripe_api_key }
  Response: { status: "connected", last_sync: timestamp }

POST /api/integrations/quickbooks/oauth
  Redirect to QB OAuth flow
  Callback: /api/integrations/quickbooks/callback

POST /api/integrations/chargebee/connect
  Body: { chargebee_site, api_key }
  Response: { status: "connected" }

GET /api/integrations/status
  Response: { stripe: {...}, quickbooks: {...}, chargebee: {...} }
```

### Invoices
```
GET /api/invoices
  Query: ?status=unpaid&sort=risk_score&limit=50&offset=0
  Response: { invoices: [...], total, pages }

GET /api/invoices/:id
  Response: { invoice, customer, payments, emails_sent, payment_plan }

POST /api/invoices/manual
  Body: { customer_id, amount, due_date, issued_date }
  Response: { invoice }

POST /api/invoices/csv-upload
  Body: FormData with CSV file
  Response: { imported: 23, errors: [] }

PUT /api/invoices/:id/status
  Body: { status: "paid" | "arranged" | "disputed" }
  Response: { invoice }
```

### Dashboard & Reports
```
GET /api/dashboard
  Response: {
    total_ar: 150000,
    recovered_this_month: 45000,
    at_risk_count: 12,
    dso: 42,
    recovery_rate: 0.68,
    top_customers_by_ar: [...],
    recent_payments: [...]
  }

GET /api/reports/recovery-timeline
  Query: ?period=month|quarter|year
  Response: { timeline: [{ date, recovered, count }] }

GET /api/reports/risk-breakdown
  Response: { critical: 5, high: 12, medium: 25, low: 100 }

GET /api/reports/customer-segment
  Query: ?segment=industry|stage|geography
  Response: { segments: [{ name, count, avg_recovery_rate }] }
```

### Agent & Automation
```
POST /api/agent/run-manual
  Body: { invoice_id }
  Response: { action: "email_sent" | "payment_plan_offered", details }

GET /api/agent/action-history
  Query: ?invoice_id=xxx
  Response: { actions: [{type, timestamp, result}] }

PUT /api/settings/dunning
  Body: { num_emails: 5, days_between: 7, approval_required: false }
  Response: { settings }

GET /api/settings
  Response: { dunning, integrations, slack, notifications }
```

### Webhooks
```
POST /webhooks/stripe
  (Stripe event listener - automatic)
  Triggers: payment updates, invoice events

POST /webhooks/sendgrid
  (Email status updates - automatic)
  Triggers: open, click, bounce tracking
```

---

## PART 5: WEEK-BY-WEEK BUILD PLAN

### WEEK 1: Data Integrations + Database

#### Day 1-2: Project Setup + Database
- [ ] Initialize Node.js + TypeScript backend
- [ ] Set up PostgreSQL with schema
- [ ] Create Express app with middleware (cors, auth, error handling)
- [ ] Configure environment variables (.env.example, .env)
- [ ] Set up logging (Winston or Pino)
- **Deliverable:** Backend server running on localhost:3000, DB initialized

#### Day 3: Authentication Layer
- [ ] Implement JWT auth (signup, login, refresh)
- [ ] Add password hashing (bcrypt)
- [ ] Create auth middleware
- [ ] Implement company/user model
- **Deliverable:** /api/auth/signup and /api/auth/login working

#### Day 4-5: Stripe Integration
- [ ] Get Stripe API keys (test + live)
- [ ] Implement Stripe OAuth flow
- [ ] Create /api/integrations/stripe/connect endpoint
- [ ] Build Stripe invoice syncing:
  - Query stripe.invoices.list()
  - Map Stripe fields to DB schema
  - Store in `invoices` table
- [ ] Create hourly Bull job for sync
- **Deliverable:** Can connect Stripe → Invoices appear in DB

#### Day 6: QuickBooks Integration
- [ ] QB OAuth flow
- [ ] Query QB Invoice API
- [ ] Map QB invoice → invoices table
- [ ] Create QB sync job
- **Deliverable:** Can pull QB invoices, hourly sync working

#### Day 7: Chargebee + Manual CSV
- [ ] Chargebee API integration (list subscriptions)
- [ ] CSV upload endpoint (parse, validate, store)
- [ ] Test with sample data
- **Deliverable:** Three data sources connected, data flowing to DB

---

### WEEK 2: Risk Scoring + Email Agent Engine

#### Day 8-9: Risk Scoring Engine
- [ ] Days overdue calculation (0-30, 30-60, 60-90, 90+)
- [ ] Amount bucketing (<1k, 1-5k, 5-10k, 10k+)
- [ ] Customer payment history aggregation
  - Query payments for customer
  - Calculate avg_days_late, on_time_rate
- [ ] Risk formula:
  ```typescript
  base_score = days_overdue * 15 + amount_bucket * 10;
  history_adjustment = history.on_time_rate > 80 ? -10 : +10;
  final_score = Math.min(100, base_score + history_adjustment);
  ```
- [ ] Create Bull job: Run risk_scoring every 6 hours
- **Deliverable:** Risk scoring 0-100 working on all invoices

#### Day 10-11: Claude API Integration + Email Generation
- [ ] Set up Anthropic API client
- [ ] Create email generation prompts:
  ```
  Dunning Email 1 (Day 0): Friendly reminder
  Dunning Email 2 (Day 5): Getting overdue
  Dunning Email 3 (Day 15): Payment plan offer
  Dunning Email 4 (Day 25): Formal notice
  Dunning Email 5 (Day 40): Escalation
  ```
- [ ] Implement email generation service (claudeService.ts)
- [ ] Tone adjustment based on risk score
- [ ] Test: Generate 5 sample emails, review quality
- **Deliverable:** Email generation working, sounds natural

#### Day 12-13: Payment Plan Agent
- [ ] Payment plan terms prompt (Claude API)
- [ ] Risk-adjusted terms:
  - Risk 0-30: 50/50 (now/30 days)
  - Risk 30-60: 30/70 (now/60 days)
  - Risk 60-90: 20/80 (now/90 days)
  - Risk 90+: 10/90 (now/90 days)
- [ ] Generate payment plan offer emails
- [ ] Test terms generation
- **Deliverable:** Payment plan terms generated correctly

#### Day 14: Autonomous Agent Decision Engine
- [ ] Decision tree (no human approval):
  ```typescript
  if (invoice.status === 'unpaid' && days_overdue > 0) {
    if (days_overdue < 30) sendEmail('dunning_1');
    else if (days_overdue < 60) {
      if (customer_engaged) sendEmail('dunning_2');
      else sendEmail('dunning_2');
    }
    else if (days_overdue < 90) {
      if (risk_score > 70) offerPaymentPlan();
      else sendEmail('dunning_3');
    }
    else sendEmail('dunning_4'), sendEmail('dunning_5');
  }
  ```
- [ ] Create Bull job: runDunningAgent (every 6 hours)
- [ ] Implement sendEmail via SendGrid
- [ ] Log all agent actions to email_logs
- **Deliverable:** Agent runs autonomously, emails sent without approval

---

### WEEK 3: Payment Tracking + Frontend Dashboard

#### Day 15-16: Payment Tracking + Stripe Webhooks
- [ ] Implement /webhooks/stripe endpoint
- [ ] Handle events:
  - charge.succeeded → Mark invoice as paid
  - charge.failed → Log failure, may re-trigger email
  - invoice.payment_failed → Re-trigger agent
- [ ] Update invoice.status = 'paid'
- [ ] Update customer.payment_history
- [ ] Re-score remaining invoices
- [ ] Sync back to QB (if API allows)
- **Deliverable:** Payments detected, status updates, history updated

#### Day 17: Slack Integration
- [ ] Set up Slack webhook URL
- [ ] Create daily digest job (8am):
  ```
  🎉 Recovered $15,234 today
  📈 This week: $89,450 (20 invoices)
  📊 DSO: 38 days (↓ 4 days)
  ```
- [ ] Real-time alerts on payment received
- **Deliverable:** Slack updates working

#### Day 18-19: Frontend - React Setup + Dashboard
- [ ] Initialize React + TypeScript app
- [ ] Set up Tailwind CSS (dark theme)
- [ ] Create Layout component (sidebar, header)
- [ ] Build Dashboard page:
  - Stats cards: Total AR, Recovered, At-Risk, DSO
  - Recovery trend chart (line)
  - Risk breakdown (pie)
- [ ] Build Invoices page:
  - Table: Customer, Amount, Days Overdue, Risk, Status
  - Sorting, filtering, pagination
  - Color-coded risk badges
- [ ] Build Invoice Detail page
- [ ] Create Settings page (integrations)
- **Deliverable:** Dashboard functional, shows AR data

#### Day 20: Authentication + Security
- [ ] JWT auth in React (AuthContext)
- [ ] Protected routes (ProtectedRoute component)
- [ ] API client with interceptors (axios)
- [ ] Secure token storage (localStorage with flags)
- [ ] HTTPS enforcement
- **Deliverable:** Login working, auth flow secure

#### Day 21: Testing + Polish
- [ ] Full end-to-end test:
  1. Create invoice (manual)
  2. Agent sends email
  3. Mock payment
  4. Invoice marked as paid
  5. Dashboard updates
- [ ] Error handling (API failures, retries)
- [ ] Load testing (1000+ invoices)
- [ ] UI polish (animations, responsive)
- **Deliverable:** MVP working end-to-end

---

### WEEK 4: Deployment + First Customer

#### Day 22-23: Deployment Setup
- [ ] Create Dockerfile (backend)
- [ ] Create Dockerfile (frontend)
- [ ] Docker-compose.yml (postgres, redis, backend, frontend)
- [ ] Deploy backend to Railway/Render
- [ ] Deploy frontend to Vercel
- [ ] Set up environment variables (prod)
- [ ] SSL certificate (Let's Encrypt)
- [ ] Domain setup (Route 53)
- **Deliverable:** Live at productiondomain.com

#### Day 24-25: Customer Onboarding
- [ ] Email 50 SaaS founders (personalized)
- [ ] Book demo calls (2-3)
- [ ] Onboarding flow:
  1. Sign up
  2. Click "Connect Stripe"
  3. OAuth → Invoices appear
  4. Agent starts automatically
  5. Slack digest starts
- [ ] First trial customer live
- **Deliverable:** 1-2 customers in trial

#### Day 26-27: Monitoring + Support
- [ ] Monitor agent behavior (emails being sent)
- [ ] Collect feedback from trial customers
- [ ] Iterate on:
  - Email tone/copy
  - Payment plan terms
  - Risk scoring accuracy
- [ ] Bug fixes
- **Deliverable:** First customer happy, iterating

#### Day 28: Analytics + Proof of Concept
- [ ] Build internal metrics dashboard
- [ ] Track customer results:
  - "Customer X: Recovered $Y in Z days"
  - Compare vs baseline
- [ ] Document case study
- [ ] Prepare for sales pitch
- **Deliverable:** Proof of value (data showing recovery)

---

## PART 6: PREDEFINED FRONTEND COMPONENTS & UTILITIES

### 6.0 Notification System (Toast + Modals + Popovers)

**NotificationContext** - Centralized notification management
```typescript
// Usage anywhere in app:
const { addNotification } = useNotification();

// Success toast
addNotification({
  type: 'success',
  title: 'Success!',
  message: 'Invoice synced successfully',
  duration: 5000,  // Auto-dismiss
});

// Error with retry action
addNotification({
  type: 'error',
  title: 'Sync Failed',
  message: 'Could not sync invoices',
  duration: 0,  // Don't auto-dismiss
  action: { label: 'Retry', onClick: handleSync }
});
```

**Predefined Components:**
- `<Toast />` - Auto-dismissing notifications
- `<Modal />` - Reusable dialog component
- `<Popover />` - Dropdown/context menu
- `<Alert />` - Info/warning/error banners
- `<Badge />` - Risk score badges (color-coded)

### 6.1 Theme Context (Light + Dark Mode Toggle)
```typescript
// ThemeContext provides theme state and setter
// Components use: className={theme === 'dark' ? 'dark:bg-neutral-900' : ''}
// OR use TailwindCSS dark: prefix automatically
```

## PART 7: COMPONENT & FEATURE BREAKDOWN

### Frontend Components (React + TypeScript)

#### Layout Components
```tsx
// components/layout/Layout.tsx
- Sidebar (navigation)
- Header (user menu, notifications)
- Main content area

// components/layout/Sidebar.tsx
Navigation items:
  - Dashboard
  - Invoices
  - Reports
  - Settings
  - Help
```

#### Dashboard Page
```tsx
// pages/Dashboard.tsx
- StatsCards:
  - Total AR (large number)
  - Recovered This Month
  - At-Risk Count
  - DSO (Days Sales Outstanding)
- RecoveryTrendChart (line chart)
- RiskBreakdownChart (pie chart)
- RecentPaymentsTable
- TopCustomersTable
```

#### Invoices Page
```tsx
// pages/Invoices.tsx
- FilterBar (status, risk, amount, date range)
- SortOptions
- InvoiceTable:
  Columns: Customer | Amount | Days Overdue | Risk Score | Status | Actions
- Pagination
- BulkActions (manual sync, re-trigger agent)
- InvoiceDetailModal (click row)
```

#### Invoice Detail Modal
```tsx
// components/invoices/InvoiceDetail.tsx
- Customer info
- Invoice details
- Risk score + calculation breakdown
- Emails sent (with open/click tracking)
- Payments received
- Payment plan (if active)
- Agent action history
- Manual payment entry
```

#### Settings Page
```tsx
// pages/Settings.tsx
- IntegrationSection:
  - Stripe connect button
  - QB connect button
  - Chargebee connect button
  - CSV upload
- DunningSettingsSection:
  - Number of emails (1-7)
  - Days between emails
  - Require approval? (toggle)
  - Custom email templates (future)
- SlackIntegrationSection
- Team management (future)
```

#### UI Components (Reusable)
```tsx
// components/ui/Card.tsx - generic card wrapper
// components/ui/Button.tsx - button with variants
// components/ui/Table.tsx - sortable table
// components/ui/Badge.tsx - risk score badge (color-coded)
// components/ui/Modal.tsx - modal dialog
// components/ui/Chart.tsx - wrapper for Recharts
// components/ui/LoadingSpinner.tsx
// components/ui/ErrorMessage.tsx
// components/ui/SuccessMessage.tsx
```

### Backend Services

#### Risk Scoring Service
```typescript
// services/riskScoringService.ts
calculateRiskScore(invoice: Invoice, customer: Customer): number {
  // Days overdue: 0-30 (base 0), 30-60 (+15), 60-90 (+30), 90+ (+45)
  // Amount: <1k (0), 1-5k (+10), 5-10k (+15), 10k+ (+20)
  // History: on_time>80% (-10), 40-80% (0), <40% (+10)
  return Math.min(100, base + history_adjust);
}
```

#### Claude API Service
```typescript
// services/claudeService.ts
generateEmail(
  type: 'dunning_1'|'dunning_2'|...,
  invoice: Invoice,
  customer: Customer,
  riskScore: number
): Promise<{ subject: string; body: string }> {
  // Call Claude API with detailed prompt
  // Return generated email
}

generatePaymentTerms(
  invoice: Invoice,
  riskScore: number
): Promise<{ down_payment: %, terms_days: number }> {
  // Call Claude API with risk-adjusted prompt
  // Return payment plan terms
}
```

#### Email Agent Service
```typescript
// services/emailAgentService.ts
async runDunningAgent(company: Company): Promise<void> {
  const invoices = await getUnpaidInvoices(company.id);

  for (const invoice of invoices) {
    const decision = await makeDecision(invoice);

    if (decision.type === 'send_email') {
      const email = await generateEmail(decision.template, invoice);
      await sendVia SendGrid(email);
      await logEmailSent(invoice.id, email);
    }

    if (decision.type === 'offer_payment_plan') {
      const terms = await generatePaymentTerms(invoice);
      const plan = await createPaymentPlan(invoice, terms);
      const email = await generateEmail('payment_plan_offer', invoice);
      await sendViaS SendGrid(email);
    }
  }
}
```

#### Stripe Service
```typescript
// services/stripeService.ts
async syncInvoices(company: Company): Promise<void> {
  const stripeKey = await decryptKey(company.stripe_api_key);
  const stripe = new Stripe(stripeKey);

  const invoices = await stripe.invoices.list();

  for (const inv of invoices) {
    await upsertInvoice(company.id, {
      amount: inv.amount_due,
      customer_email: inv.customer_email,
      due_date: inv.due_date,
      ...
    });
  }
}
```

---

## PART 7: PHASED ROLLOUT & FEATURE TIERS

### MVP (Week 1-3) ✅
- [x] Invoice ingestion (Stripe, QB, Chargebee, CSV)
- [x] Risk scoring (0-100)
- [x] Autonomous email agent (5-email sequence)
- [x] Payment tracking (Stripe webhooks)
- [x] Payment plan offering
- [x] Simple dashboard
- [x] Slack notifications

### Phase 1.5 (Week 4-6)
- [ ] Email A/B testing
- [ ] SMS integration
- [ ] Smart email timing (business hours)
- [ ] Conversation memory (track customer replies)
- [ ] Xero/NetSuite integration
- [ ] Advanced reporting

### Phase 2 (Month 2-3)
- [ ] CS Agent module (churn prevention upsell)
- [ ] AP Automation module (bill management)
- [ ] Phone/VAPI integration
- [ ] Industry benchmarks
- [ ] Custom email templates
- [ ] API access for partners

---

## PART 8: MONITORING, LOGGING & ALERTING

### What to Monitor
```
Backend Health:
- Server uptime
- API response time (p95, p99)
- Error rate (5xx errors)
- Database query time

Queue Health:
- Job processing time
- Failed jobs
- Queue depth
- Retry attempts

Agent Health:
- Emails sent per hour
- Email failure rate
- Payment plan offers
- Agent decision accuracy

Customer Metrics:
- Recovery rate
- DSO (Days Sales Outstanding)
- Email open rate
- Payment plan acceptance rate
```

### Logging Strategy
```
Level: info (normal ops), warn (degradation), error (failures)
Format: { timestamp, level, context, message }
Destination: File (rotating) + centralized (future: DataDog/New Relic)

Examples:
- "[Stripe Sync] Synced 50 invoices for company_123"
- "[Email Agent] Sent dunning_2 to customer@example.com for invoice_456"
- "[Payment Webhook] Processed charge.succeeded for invoice_456"
- "[Risk Scoring] Updated risk scores for 1000 invoices"
```

---

## PART 9: SECURITY CHECKLIST

- [ ] JWT tokens with expiry (1 hour access, 7 day refresh)
- [ ] Encrypt sensitive data (Stripe keys, QB tokens) at rest
- [ ] HTTPS only (enforce in production)
- [ ] Rate limiting (auth: 5 req/min, API: 100 req/min)
- [ ] CORS configured (only allow frontend domain)
- [ ] SQL injection prevention (use parameterized queries)
- [ ] XSS prevention (React auto-escapes)
- [ ] CSRF protection (if needed)
- [ ] Input validation (email, amount, dates)
- [ ] Error messages don't leak sensitive data
- [ ] Audit logs for sensitive operations
- [ ] No API keys in git (use .env)
- [ ] 2FA for admin accounts (future)

---

## PART 10: DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] Run full test suite (backend + frontend)
- [ ] Load test (1000+ invoices)
- [ ] Security scan (OWASP Top 10)
- [ ] Check environment variables
- [ ] Backup database
- [ ] Review error logs

### Deployment
- [ ] Build Docker images
- [ ] Push to registry
- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Run migrations
- [ ] Verify health check
- [ ] Test critical flows

### Post-Deployment
- [ ] Monitor logs for errors
- [ ] Check response times
- [ ] Verify integrations working
- [ ] Test Slack notifications
- [ ] Manual test: Connect Stripe → Invoice → Email → Payment
- [ ] Get customer feedback

---

## PART 11: GO-TO-MARKET PLAN

### Week 4-5: Launch Outreach
1. **Build List:** 200 SaaS founders ($2-5M ARR)
   - AngelList, Crunchbase, LinkedIn
   - Filters: Founded 2014-2020, B2B SaaS

2. **Personalized Pitch:**
   ```
   Subject: You have $X stuck in unpaid invoices

   Hi [Name],

   Question: Of your $Y ARR, how much is stuck in unpaid invoices?
   Average: 40-50% of revenue.

   Our agent recovers 60-70%. You only pay 1% of recovery.

   Free 2-week trial?
   [Book Call]
   ```

3. **Expected Flow:**
   - Email: 200 → 3-5% response (6-10 conversations)
   - Calls: 6-10 → 50% trial (3-5 trials)
   - Trials: 3-5 → 50-60% conversion (1-2 paid)

### Month 2-3: Sales Process
- Close first 2-3 paid customers
- Document case studies
- Iterate on product based on feedback
- Build case for $10k MRR target

### Month 4+: Scaling
- Hire GTM person (part-time contractor)
- Add upsell modules (CS Agent, AP Automation)
- Expand integrations
- Target Series A (Month 6)

---

## PART 12: SUCCESS METRICS

### MVP Launch (Week 4)
- ✅ Product live
- ✅ 1-2 trial customers
- ✅ Agent autonomously sending emails
- ✅ Slack updates working

### Month 2
- ✅ First paid customer
- ✅ $2-5k MRR
- ✅ Proof of recovery ($X recovered for customer)

### Month 4
- ✅ 4 customers
- ✅ $10k+ MRR (target achieved)
- ✅ Clear case studies

### Month 6
- ✅ 5-10 customers
- ✅ $15-25k MRR
- ✅ Series A ready ($2-3M raise)

---

## PART 13: IMPLEMENTATION NOTES & DECISIONS

### Theme Justification
**Dark theme chosen** (similar to AI_FINAL_MODEL):
- Better for SaaS dashboards (reduced eye strain)
- Modern aesthetic
- High contrast for risk colors (red, orange, yellow, green)
- Indigo brand aligns with Stripe, other fintech tools

### Risk Score Color Coding
- 🟢 Green (0-29): Low risk, paying on time
- 🟡 Yellow (30-59): Medium risk, monitor
- 🟠 Orange (60-89): High risk, prioritize
- 🔴 Red (90-100): Critical, urgent action

### Why Autonomous (No Approval)
- Founders don't have time for approvals
- Email is standardized (not harmful)
- Worst case: Customer unsubscribes (low risk)
- Best case: $X recovered without friction
- Approval model would make product 10x slower

### Bull/BullMQ for Jobs
- Reliable job queue
- Handles retries automatically
- Supports scheduled jobs (hourly sync, daily digest)
- Dashboard for monitoring
- Better than cron jobs (persistent, observable)

### Claude API for Generation
- State-of-the-art reasoning
- Can generate personalized emails
- Can calculate payment terms intelligently
- Can adjust tone based on risk score
- No hallucination concerns (domain-specific)

---

## PART 14: NEXT STEPS (DO THIS FIRST)

### ✅ Step 1: Review This Plan (5 min)
- Read architecture section
- Confirm tech stack aligns
- Agree on theme/colors
- Ask questions before building

### ⏭️ Step 2: Set Up Dev Environment (30 min)
```bash
cd c:\dev\AGENTIC_AR\AI_FINAL_MODEL
npm install
docker-compose up  # Start Postgres + Redis
```

### ⏭️ Step 3: Start Week 1
- Create backend repo structure
- Initialize DB schema
- Get API keys (Stripe, QB, etc.)
- Begin integrations

### ⏭️ Step 4: Daily Tracking
- Mark completed items ✅
- Log blockers/changes
- Adjust plan if needed
- Celebrate wins

---

## APPENDIX A: File Checklist

### Backend Files to Create
```
src/
├── config/env.ts
├── config/logger.ts
├── config/database.ts
├── middleware/auth.ts
├── middleware/errorHandler.ts
├── middleware/rateLimiter.ts
├── modules/auth/authRoutes.ts
├── modules/invoices/invoiceRoutes.ts
├── modules/customers/customerRoutes.ts
├── modules/risk-scoring/riskScoringRoutes.ts
├── modules/email-agent/emailAgentRoutes.ts
├── modules/payment-plans/paymentPlanRoutes.ts
├── modules/payments/paymentRoutes.ts
├── modules/slack/slackRoutes.ts
├── modules/integrations/[stripe|qb|chargebee]Routes.ts
├── modules/settings/settingsRoutes.ts
├── modules/dashboard/dashboardRoutes.ts
├── modules/reports/reportsRoutes.ts
├── services/claudeService.ts
├── services/stripeService.ts
├── services/qbService.ts
├── services/chargebeeService.ts
├── services/sendgridService.ts
├── services/slackService.ts
├── services/riskScoringService.ts
├── services/emailAgentService.ts
├── jobs/queue.ts
├── jobs/syncInvoices.ts
├── jobs/runDunningAgent.ts
├── jobs/trackPayments.ts
├── jobs/dailySlackDigest.ts
├── types/index.ts
├── utils/validators.ts
├── utils/formatters.ts
├── app.ts
└── server.ts
```

### Frontend Files to Create
```
src/
├── components/layout/Layout.tsx
├── components/layout/Sidebar.tsx
├── components/layout/Header.tsx
├── components/ui/Card.tsx
├── components/ui/Button.tsx
├── components/ui/Table.tsx
├── components/ui/Badge.tsx
├── components/ui/Modal.tsx
├── components/ui/Chart.tsx
├── components/dashboard/StatsCard.tsx
├── components/dashboard/RecoveryChart.tsx
├── components/dashboard/RiskChart.tsx
├── components/invoices/InvoiceTable.tsx
├── components/invoices/InvoiceDetail.tsx
├── components/invoices/FilterBar.tsx
├── components/integration/StripeConnect.tsx
├── components/integration/QuickBooksConnect.tsx
├── components/integration/ChargebeeConnect.tsx
├── pages/Login.tsx
├── pages/Setup.tsx
├── pages/Dashboard.tsx
├── pages/Invoices.tsx
├── pages/Reports.tsx
├── pages/Settings.tsx
├── contexts/AuthContext.tsx
├── contexts/InvoiceContext.tsx
├── hooks/useAuth.ts
├── hooks/useInvoices.ts
├── hooks/useApi.ts
├── lib/api.ts
├── lib/axios.ts
├── config/constants.ts
├── App.tsx
├── main.tsx
└── index.css
```

---

**Status:** Ready for Implementation
**Next Action:** Begin Week 1 on 2026-03-04
**Questions?** Review specific section or ask

---

## IMPLEMENTATION STATUS UPDATE (Execution Pass)

### Completed Foundations
- Billing stack scaffolded: plans, subscriptions, billing invoices, usage metering, entitlements APIs.
- Team/RBAC scaffolded: organization members, invitations, role-guarded endpoints.
- Security baseline improved: CSP-enabled helmet profile and readiness/liveness probes.
- Compliance APIs added: tenant data export + deletion request flows.
- Policy engine scaffolding: policy settings + simulation endpoints.
- Public trust pages added: landing, pricing, security, terms, privacy, cookie policy, DPA.

### Operational Docs Added
- `docs/NFR_SLO_BASELINE.md`
- `docs/INCIDENT_RESPONSE_RUNBOOK.md`
- `docs/PILOT_ROLLOUT_PLAYBOOK.md`
- `docs/OPENAPI_V1.yaml`
- `docs/DELIVERY_BACKLOG.md`
