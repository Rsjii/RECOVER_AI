# RecoverAI - Architecture Diagrams & Flow Charts

## 1. SYSTEM ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + TypeScript)                    │
│  - Dashboard (AR, recovery, DSO, risk breakdown)                        │
│  - Invoices list (with filtering, sorting, detail view)                 │
│  - Settings (integrate Stripe, QB, Chargebee)                           │
│  - Reports (recovery timeline, customer segments)                       │
│  Theme: Dark (#060910) + Indigo brand (#6366f1)                        │
│  Colors: Risk-coded (Red/Orange/Yellow/Green)                           │
└────────────────────────────────┬────────────────────────────────────────┘
                                  │
                                  │ HTTP/REST + WebSocket (future)
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKEND API (Node.js + Express)                      │
│                                                                          │
│  Routes:                                                                │
│  /api/auth              (login, signup, refresh)                       │
│  /api/invoices          (CRUD, sync, filtering)                        │
│  /api/integrations      (Stripe, QB, Chargebee OAuth)                  │
│  /api/dashboard         (stats, trends)                                │
│  /api/reports           (recovery analytics)                           │
│  /api/settings          (company config, dunning strategy)             │
│  /api/agent             (manual trigger, history)                      │
│  /webhooks/stripe       (payment updates)                              │
│  /webhooks/sendgrid     (email tracking)                               │
└────────────────────────────────┬────────────────────────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    ▼             ▼             ▼
         ┌──────────────────┐ ┌──────────────┐ ┌──────────────┐
         │  PostgreSQL      │ │   Redis      │ │  Bull Queue  │
         │  (Invoices,      │ │  (Cache,     │ │ (Jobs:       │
         │   Customers,     │ │   Sessions)  │ │  Sync,       │
         │   Payments,      │ └──────────────┘ │  Dunning,    │
         │   Email Logs)    │                  │  Slack)      │
         └──────────────────┘                  └──────────────┘
                    │
                    └─────────────┬─────────────┘
                                  │
           ┌──────────────────────┼──────────────────────┐
           │                      │                      │
           ▼                      ▼                      ▼
    ┌────────────────┐  ┌───────────────────┐  ┌──────────────────┐
    │ CLAUDE API     │  │ PAYMENT PROCESSOR │  │ EMAIL SERVICE    │
    │ (Risk Score,   │  │ (Stripe Billing)  │  │ (SendGrid)       │
    │  Email Gen,    │  │ (Create plans)    │  │ (Send emails)    │
    │  Terms)        │  │ (Track payments)  │  │ (Track opens)    │
    └────────────────┘  └───────────────────┘  └──────────────────┘
           │                      │                      │
           └──────────────────────┼──────────────────────┘
                                  │
           ┌──────────────────────┼──────────────────────┐
           │                      │                      │
           ▼                      ▼                      ▼
    ┌────────────────┐  ┌───────────────────┐  ┌──────────────────┐
    │ INVOICE SOURCES│  │ EXTERNAL SERVICES │  │ NOTIFICATIONS    │
    │ - Stripe API   │  │ - QuickBooks API  │  │ - Slack API      │
    │ - QB API       │  │ - Chargebee API   │  │ - Email alerts   │
    │ - Chargebee    │  │ - CSV uploads     │  │ - Dashboard      │
    │ - Manual CSV   │  └───────────────────┘  └──────────────────┘
    └────────────────┘
```

---

## 2. DATA FLOW DIAGRAMS

### 2.1 Invoice Ingestion Flow
```
┌──────────────────────────────────────────────────────────────┐
│          Invoice Data Sources (Hourly Sync)                 │
│  Stripe  │  QuickBooks  │  Chargebee  │  Manual CSV         │
└────────────────────┬──────────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────────┐
         │  Data Ingestion Layer     │
         │  - Normalize schema       │
         │  - Validate fields        │
         │  - Deduplicate            │
         └────────────┬──────────────┘
                      │
                      ▼
         ┌──────────────────────────┐
         │  Store in PostgreSQL     │
         │  invoices table          │
         │  {id, amount, due_date,  │
         │   customer, status, ...} │
         └────────────┬─────────────┘
                      │
          ┌───────────┼───────────┐
          │           │           │
          ▼           ▼           ▼
    ┌─────────┐  ┌─────────┐ ┌──────────┐
    │ CACHE   │  │ ENQUEUE │ │ ALERT    │
    │ (Redis) │  │ SCORING │ │ (Slack)  │
    │         │  │ JOB     │ │          │
    └─────────┘  └─────────┘ └──────────┘
```

### 2.2 Risk Scoring Flow
```
┌──────────────────────────────┐
│ Invoice Scoring Job (6h)     │
└────────────────┬─────────────┘
                 │
                 ▼
    ┌────────────────────────┐
    │ For each unpaid        │
    │ invoice:               │
    └────────────┬───────────┘
                 │
    ┌────────────▼──────────────┐
    │ Calculate risk factors:   │
    │ - Days overdue (0-45pts)  │
    │ - Amount (0-20pts)        │
    │ - Customer history        │
    │   (-10 to +10pts)         │
    └────────────┬──────────────┘
                 │
    ┌────────────▼──────────────┐
    │ Risk Score = 0-100        │
    │ (Capped at 100)           │
    └────────────┬──────────────┘
                 │
    ┌────────────▼──────────────┐
    │ Update DB:               │
    │ invoices.risk_score = X  │
    └────────────┬──────────────┘
                 │
    ┌────────────▼──────────────┐
    │ Enqueue dunning agent    │
    │ for high-risk invoices   │
    └──────────────────────────┘
```

### 2.3 Autonomous Dunning Agent Flow
```
┌────────────────────────────────┐
│ Dunning Agent Job (6h)         │
│ (No human approval needed)     │
└────────────────┬───────────────┘
                 │
                 ▼
    ┌────────────────────────────┐
    │ SELECT unpaid invoices     │
    │ WHERE status='unpaid'      │
    └────────────┬───────────────┘
                 │
                 ▼
    ┌────────────────────────────┐
    │ FOR EACH invoice:          │
    │                            │
    │ if days_overdue < 30:      │
    │   → Send Email 1 (friendly)│
    │                            │
    │ if 30-60:                  │
    │   → Send Email 2 (overdue) │
    │                            │
    │ if 60-90:                  │
    │   → Offer payment plan     │
    │   → Send Email 3 + offer   │
    │                            │
    │ if > 90:                   │
    │   → Send Email 4 (formal)  │
    │   → Send Email 5 (escalate)│
    └────────────┬───────────────┘
                 │
    ┌────────────▼─────────────────┐
    │ For each action:             │
    │ 1. Call Claude API           │
    │    → Generate personalized   │
    │      email                   │
    │ 2. Send via SendGrid         │
    │ 3. Log to email_logs         │
    │ 4. Update invoice status     │
    └────────────┬─────────────────┘
                 │
    ┌────────────▼─────────────────┐
    │ Payment plan actions:        │
    │ 1. Generate terms (Claude)   │
    │ 2. Create in Stripe Billing  │
    │ 3. Mark invoice 'arranged'   │
    │ 4. Send payment plan email   │
    └────────────┬─────────────────┘
                 │
    ┌────────────▼─────────────────┐
    │ Log all actions              │
    │ → Dashboard shows history    │
    │ → Slack notified             │
    └─────────────────────────────┘
```

### 2.4 Payment Tracking & Updates
```
┌─────────────────────────────────┐
│ Customer pays invoice via        │
│ email link or payment plan       │
└────────────────┬────────────────┘
                 │
                 ▼
    ┌──────────────────────────┐
    │ Stripe charge.succeeded  │
    │ event triggered          │
    └────────────┬─────────────┘
                 │
    ┌────────────▼──────────────┐
    │ /webhooks/stripe          │
    │ receives event            │
    │ (verify signature)        │
    └────────────┬──────────────┘
                 │
    ┌────────────▼──────────────────┐
    │ 1. Find invoice in DB        │
    │    by stripe_customer_id     │
    │ 2. Update status = 'paid'    │
    │ 3. Record payment amount     │
    │ 4. Update customer history   │
    └────────────┬──────────────────┘
                 │
    ┌────────────▼──────────────────┐
    │ 5. Re-score remaining         │
    │    invoices (better history)  │
    │ 6. Update DSO                 │
    │ 7. Sync back to QB (if API)   │
    └────────────┬──────────────────┘
                 │
    ┌────────────▼──────────────────┐
    │ 8. Send Slack alert:          │
    │    "💰 $5,000 payment from    │
    │     Acme Corp"               │
    │ 9. Update dashboard           │
    │    (real-time)                │
    └───────────────────────────────┘
```

---

## 3. DATABASE SCHEMA RELATIONSHIPS

```
companies (1) ──────────┐
     │                  │
     │ (owns)           │ (processes for)
     │                  │
     ▼                  ▼
customers         invoices
     │                  │
     │ (1:M)            │ (1:M)
     │                  │
     └──────────┬───────┘
                │
                ├─→ payments
                │     │
                │     └─→ email_logs
                │
                └─→ payment_plans
                      │
                      └─→ installments

Integration logs → (tracks all data sync operations)
```

**Key Relationships:**
```
Company 1 → Many Customers
Company 1 → Many Invoices
Customer 1 → Many Invoices
Invoice 1 → Many Emails
Invoice 1 → Many Payments
Invoice 1 → 1 Payment Plan (optional)
```

---

## 4. USER JOURNEY FLOWS

### 4.1 Company Setup & Integration
```
┌──────────────┐
│ 1. Sign up   │
└──────┬───────┘
       │
       ▼
┌──────────────────────────┐
│ 2. Create organization   │
│    (company name, email) │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ 3. Go to Settings page       │
└──────┬───────────────────────┘
       │
       ├─→ Connect Stripe ──┐
       │   (OAuth flow)      │
       │                     │
       ├─→ Connect QB ──────┤
       │   (OAuth flow)      ├─→ 4. Invoices appear
       │                     │    in dashboard
       └─→ Connect Chargebee┘
           (API key)

       ▼
┌──────────────────────────────┐
│ 5. Configure dunning         │
│    (# emails, days between)  │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ 6. Connect Slack             │
│    (for notifications)       │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ 7. Agent runs automatically  │
│    (no further config)       │
└──────────────────────────────┘
```

### 4.2 Invoice Recovery Journey
```
Day 0: Invoice issued
  └─→ Agent detects (unpaid, due today)

Day 1: Overdue 1 day
  └─→ Email 1 sent: "Invoice due"
  └─→ Logged to email_logs
  └─→ Dashboard shows invoice

Day 5: Overdue 5 days
  └─→ Email 2 sent: "Getting overdue"
  └─→ Slack: "📧 Sent dunning email"

Day 15: Overdue 15 days
  └─→ Email 3 sent: "Payment plan offer"
  └─→ Payment plan created
  └─→ Customer clicks link

Day 18: Customer accepts plan
  └─→ Stripe billing setup
  └─→ First payment charged
  └─→ Invoice marked "arranged"
  └─→ Slack: "💰 $5k payment received"

Day 48: Full payment received
  └─→ Invoice marked "paid"
  └─→ Customer history updated
  └─→ Remaining invoices re-scored
  └─→ Dashboard: Recovery complete

Total Recovery: 48 days (vs. 90+ baseline)
Recovery Rate: $50k paid of $50k = 100%
ROI for Company: $50k recovered vs. $2.5k + recovery fee paid
```

---

## 5. AGENT DECISION TREE

```
AGENT_DECISION(invoice):
│
├─ IF invoice.status != 'unpaid': SKIP
│
├─ CALCULATE days_overdue
│
└─ IF days_overdue > 0:
   │
   ├─ IF days_overdue < 30:
   │  └─→ ACTION: Send Email 1 (friendly)
   │     "Invoice due on {due_date}"
   │
   ├─ ELSE IF days_overdue 30-60:
   │  ├─ IF customer_opened_prev_email:
   │  │  └─→ ACTION: Send Email 2 (overdue)
   │  │     "Invoice now overdue by {days}"
   │  └─ ELSE:
   │     └─→ ACTION: Send Email 2 anyway
   │        (escalate even without engagement)
   │
   ├─ ELSE IF days_overdue 60-90:
   │  ├─ IF risk_score > 70 AND no_engagement:
   │  │  └─→ ACTION: Offer Payment Plan
   │  │     Email 3: "Flexible payment options"
   │  │     Offer: "20% now, 80% in 90 days"
   │  │     Create Stripe Payment Plan
   │  └─ ELSE:
   │     └─→ ACTION: Send Email 2 (retry)
   │
   └─ ELSE IF days_overdue > 90:
      ├─→ ACTION: Send Email 4 (formal notice)
      │   "Invoice is {days} days overdue"
      │   "Contact us to resolve"
      │
      └─→ ACTION: Send Email 5 (escalation)
          "Legal proceedings may commence"
          (only send after 40+ days overdue)
```

---

## 6. FRONTEND COMPONENT HIERARCHY

```
App.tsx (Router)
│
├─ Layout.tsx (Main wrapper)
│  ├─ Sidebar.tsx (Navigation)
│  │  ├─ NavItem (Dashboard)
│  │  ├─ NavItem (Invoices)
│  │  ├─ NavItem (Reports)
│  │  └─ NavItem (Settings)
│  │
│  ├─ Header.tsx (Top bar)
│  │  ├─ Logo
│  │  ├─ Search (future)
│  │  └─ UserMenu
│  │
│  └─ Outlet (Page content)
│
├─ Pages:
│  │
│  ├─ Dashboard.tsx
│  │  ├─ StatsCard (AR)
│  │  ├─ StatsCard (Recovered)
│  │  ├─ StatsCard (At-Risk)
│  │  ├─ StatsCard (DSO)
│  │  ├─ RecoveryChart.tsx (Recharts)
│  │  ├─ RiskBreakdownChart.tsx
│  │  ├─ RecentPaymentsTable.tsx
│  │  └─ TopCustomersTable.tsx
│  │
│  ├─ Invoices.tsx
│  │  ├─ FilterBar.tsx
│  │  │  ├─ StatusFilter
│  │  │  ├─ RiskFilter
│  │  │  ├─ AmountFilter
│  │  │  └─ DateRangeFilter
│  │  ├─ SortOptions
│  │  ├─ InvoiceTable.tsx (custom)
│  │  │  ├─ Table Header (sortable)
│  │  │  ├─ Table Row
│  │  │  │  ├─ CustomerName
│  │  │  │  ├─ Amount
│  │  │  │  ├─ DaysOverdue
│  │  │  │  ├─ RiskBadge (color-coded)
│  │  │  │  ├─ Status
│  │  │  │  └─ Actions (detail, manual payment)
│  │  │  └─ Pagination
│  │  └─ InvoiceDetailModal.tsx
│  │     ├─ InvoiceInfo
│  │     ├─ CustomerInfo
│  │     ├─ EmailSentList
│  │     ├─ PaymentsReceivedList
│  │     ├─ PaymentPlanDisplay
│  │     ├─ AgentActionHistory
│  │     └─ ManualPaymentForm
│  │
│  ├─ Reports.tsx
│  │  ├─ RecoveryTimeline (Line chart)
│  │  ├─ RiskBreakdown (Pie chart)
│  │  ├─ CustomerSegmentation (Bar chart)
│  │  ├─ RecoveryRateByIndustry
│  │  └─ DSOTrend
│  │
│  └─ Settings.tsx
│     ├─ IntegrationSection
│     │  ├─ StripeConnect.tsx
│     │  ├─ QuickBooksConnect.tsx
│     │  └─ ChargebeeConnect.tsx
│     ├─ DunningSettingsSection
│     │  ├─ NumEmailsSlider
│     │  ├─ DaysBetweenInput
│     │  ├─ RequireApprovalToggle
│     │  └─ CustomTemplatesLink (future)
│     ├─ SlackIntegration
│     │  └─ SlackWebhookInput
│     └─ TeamManagement (future)
│
├─ UI Components (Reusable)
│  ├─ Card.tsx
│  ├─ Button.tsx (variants: primary, secondary, danger)
│  ├─ Table.tsx (with sorting)
│  ├─ Badge.tsx (risk-coded colors)
│  ├─ Modal.tsx
│  ├─ Input.tsx
│  ├─ Select.tsx
│  ├─ Chart.tsx (wrapper for Recharts)
│  ├─ LoadingSpinner.tsx
│  ├─ ErrorMessage.tsx
│  └─ SuccessMessage.tsx
│
├─ Contexts
│  ├─ AuthContext.tsx (user, token, login/logout)
│  ├─ InvoiceContext.tsx (invoices, refresh, filter)
│  └─ AppContext.tsx (notifications, theme)
│
└─ Hooks
   ├─ useAuth.ts (login, signup, token refresh)
   ├─ useInvoices.ts (fetch, filter, sort)
   ├─ useApi.ts (generic API calls)
   ├─ useLocalStorage.ts
   └─ useNotification.ts
```

---

## 7. STATE MANAGEMENT FLOW

```
AuthContext:
  - user: { id, email, org_id }
  - isAuthenticated: boolean
  - loading: boolean
  - login(): Promise
  - logout(): void
  - refreshToken(): Promise

InvoiceContext:
  - invoices: Invoice[]
  - filters: { status, risk, amount, dateRange }
  - sort: { by, order }
  - pagination: { page, limit, total }
  - fetchInvoices(): Promise
  - setFilters()
  - setSort()

AppContext:
  - notification: { type, message }
  - darkMode: boolean
  - showNotification()
  - dismissNotification()
  - toggleDarkMode()
```

---

## 8. API REQUEST/Response Examples

### Get Invoices
```typescript
// Request
GET /api/invoices?status=unpaid&risk_score=90&limit=50&offset=0

// Response
{
  "data": [
    {
      "id": "inv-001",
      "customer_id": "cust-001",
      "customer_name": "Acme Corp",
      "customer_email": "billing@acme.com",
      "amount": 5000,
      "currency": "USD",
      "due_date": "2026-02-15",
      "issued_date": "2026-02-01",
      "days_overdue": 18,
      "status": "unpaid",
      "risk_score": 75,
      "source": "stripe",
      "created_at": "2026-02-01T10:00:00Z",
      "updated_at": "2026-03-04T14:30:00Z"
    }
  ],
  "total": 127,
  "pages": 3,
  "current_page": 1
}
```

### Send Manual Trigger to Agent
```typescript
// Request
POST /api/agent/run-manual
Body: { invoice_id: "inv-001" }

// Response
{
  "success": true,
  "action_type": "send_email",
  "email_type": "dunning_2",
  "sent_to": "billing@acme.com",
  "subject": "Invoice #INV-001 is now overdue",
  "timestamp": "2026-03-04T15:30:00Z"
}
```

### Get Dashboard Stats
```typescript
// Request
GET /api/dashboard

// Response
{
  "stats": {
    "total_ar": 287500,
    "recovered_this_month": 45000,
    "at_risk_count": 23,
    "dso": 38,
    "recovery_rate": 0.68,
    "emails_sent_today": 12,
    "emails_opened_rate": 0.35
  },
  "recent_payments": [
    {
      "customer": "Acme Corp",
      "amount": 5000,
      "paid_at": "2026-03-04T10:15:00Z",
      "invoice_id": "inv-001",
      "days_overdue": 18
    }
  ],
  "top_customers": [
    {
      "customer_name": "TechCorp Inc",
      "total_ar": 25000,
      "at_risk": 15000
    }
  ]
}
```

---

## 9. ERROR HANDLING FLOW

```
Error Occurs in Backend
│
├─ Validation Error (400)
│  └─→ Return: { code: 'VALIDATION_ERROR', message, fields }
│
├─ Auth Error (401)
│  └─→ Return: { code: 'UNAUTHORIZED', message }
│
├─ Permission Error (403)
│  └─→ Return: { code: 'FORBIDDEN', message }
│
├─ Not Found (404)
│  └─→ Return: { code: 'NOT_FOUND', message }
│
├─ Rate Limit (429)
│  └─→ Return: { code: 'RATE_LIMITED', retry_after }
│
├─ External API Error (5xx)
│  │  (Stripe, QB, Chargebee fails)
│  └─→ Log error
│     Retry with exponential backoff
│     Mark job as failed
│     Send admin alert
│
└─ Server Error (500)
   └─→ Log full stack trace
      Return: { code: 'INTERNAL_ERROR', message: 'Try again later' }

Frontend Error Handling:
│
├─ Network Error
│  └─→ Show: "Unable to connect. Retrying..."
│
├─ API Error (4xx/5xx)
│  └─→ Show: ErrorMessage component with user-friendly text
│
└─ Unknown Error
   └─→ Show: "Something went wrong. Contact support."
```

---

## 10. Deployment Architecture

```
GitHub Repository
│
├─ Push code
│
▼
GitHub Actions
│
├─ Run tests
├─ Lint code
├─ Build Docker images
│  ├─ backend:latest
│  └─ frontend:latest
│
└─ Push to Docker Registry

▼
Railway / Render (Hosting)
│
├─ backend (Node.js)
│  ├─ Environment vars
│  ├─ PostgreSQL connection
│  └─ Redis connection
│
├─ frontend (React)
│  └─ Static hosting (Vercel better)
│
└─ Database & Cache
   ├─ PostgreSQL
   └─ Redis

▼
Production URLs
│
├─ API: api.recoverai.com
├─ Frontend: app.recoverai.com
└─ Health check: /health (every 60s)
```

---

This document complements IMPLEMENTATION_PLAN.md with visual representations and concrete examples.
