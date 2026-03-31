---
name: RecoverAI STARTER Plan - Complete A-Z Build Checklist
description: All features, APIs, pages, jobs needed for STARTER tier launch. ONLY STARTER - no advanced features
type: project
---

# 🚀 RecoverAI STARTER Plan — Complete A-Z Build Checklist

**Status:** READY FOR BUILD
**Target:** 4-week launch (March 31 → April 28)
**Scope:** STARTER tier only ($1.5k/mo)
**Cutoff:** NO reconciliation, SMS, voice, AP automation, advanced forecasting

---

## PART 1: CORE 3 PILLARS (Hero Features)

### PILLAR 1: CASH POSITION DASHBOARD ✅ (Priority: CRITICAL)

**What User Sees:**
```
💰 CASH POSITION (Real-Time)
├─ Bank Balance: $285,450
├─ + Invoiced Not Paid: $120,300 (8 customers)
├─ - Bills Due (30d): ($95,200)
└─ = Available Cash: $310,550
📊 Runway: 16.2 months until $0
```

#### Backend APIs (5 endpoints)
- [ ] **GET /api/dashboard/cash-position**
  - Input: auth (userId, companyId)
  - Output: { bankBalance, invoicedNotPaid, billsDue30d, availableCash, runwayDays, lastUpdated }
  - Logic: Fetch from invoices table + payables table + integrations (Stripe, QB, Plaid)
  - Cache: Daily (1 hour TTL)

- [ ] **POST /api/dashboard/cash-position/calculate**
  - Force recalculate (don't use cache)
  - Same output as GET

- [ ] **GET /api/dashboard/cash-position/history**
  - Input: ?days=30 (or 90, 365)
  - Output: [{date, availableCash, runwayDays}, ...]
  - For charting trends

- [ ] **GET /api/invoices/aging-summary**
  - Input: companyId
  - Output: { 0_30: {count, amount}, 30_60: {count, amount}, 60_90: {count, amount}, 90plus: {count, amount} }
  - AR aging breakdown

- [ ] **GET /api/payables/due-soon**
  - Input: companyId, ?days=30
  - Output: [{vendor, amount, dueDate}, ...]
  - Bills due in next N days

#### Frontend UI (Dashboard Page)
- [ ] Cash position card (top, prominent)
  - Show real number + trend (↑/↓ from yesterday)
  - Green/yellow/red indicator (runway < 6 months = red)
  - Click to see details

- [ ] Available cash + runway section
  - Large number display
  - Breakdown: Bank + AR - Bills
  - Runaway calculation (monthly burn / available cash)

- [ ] Alerts section (if applicable)
  - 3 invoices > 60 days overdue
  - Payroll due in X days
  - Upcoming renewals

#### Database Schema
```sql
CREATE TABLE cash_positions (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  date DATE,
  bank_balance DECIMAL(12,2),
  invoiced_not_paid DECIMAL(12,2),
  bills_due_30d DECIMAL(12,2),
  available_cash DECIMAL(12,2),
  runway_days INT,
  calculated_at TIMESTAMP,
  UNIQUE (company_id, date),
  INDEX (company_id, date DESC)
);
```

#### Scheduled Job
- [ ] **Daily Cash Position Calculation** (00:05 UTC)
  - For each company: Calculate cash position
  - Insert into cash_positions table
  - Update dashboard cache

---

### PILLAR 2: 90-DAY CASH FORECAST ✅ (Priority: CRITICAL)

**What User Sees:**
```
📈 90-DAY FORECAST
├─ Optimistic (95% recovery): $330k on Jun 1
├─ Realistic (80% recovery): $310k on Jun 1
├─ Conservative (60% recovery): $290k on Jun 1
└─ ⚠️ BREAKEVEN: Jun 3 (if no new revenue)
```

#### Algorithm (Core Logic)
```
Inputs:
1. Current cash position
2. Historical AR recovery pattern (% paid by day X)
3. Known invoices (from Stripe, QB, CSV)
4. Known payables (bills due)
5. Fixed expenses (from settings: payroll, rent)
6. Variable expenses (from QB or manual)
7. Growth assumptions (new revenue per day)

Day 1-90 Loop:
  Projected_Cash[day] = Projected_Cash[day-1]
                      + Invoiced_Amount[day] * Recovery_Rate[day]
                      - Fixed_Expenses[day]
                      - Variable_Expenses[day]
                      + New_Revenue_Booked[day]

Recovery_Rate[day]:
  - Day 0-7: 5% of overdue invoices paid
  - Day 7-15: 25% more paid
  - Day 15-30: 40% more paid
  - Day 30-60: 70% paid
  - Day 60+: 85% paid (or customer specific)

Output: Array of 90 days with {date, optimistic, realistic, conservative, breakeven}
```

#### Backend APIs (4 endpoints)
- [ ] **GET /api/dashboard/forecast**
  - Input: auth (userId, companyId), ?scenario=realistic
  - Output: [{day: 1, date: "2026-04-01", projectedCash: 310000, runwayDays: 16}, ...]
  - 90 days of forecast data

- [ ] **POST /api/dashboard/forecast/calculate**
  - Force recalculate (don't use cache)
  - Same output as GET

- [ ] **GET /api/dashboard/forecast/scenarios**
  - Input: companyId
  - Output: { optimistic: {projectedCash, breakeven}, realistic: {...}, conservative: {...} }
  - Summary of 3 scenarios

- [ ] **POST /api/dashboard/forecast/scenario-builder**
  - Input: { recoveryRate: 65 (%), payrollIncrease: 10 (%), newRevenuePerDay: 500 }
  - Output: Updated forecast based on custom assumptions
  - Let founder "what if" the forecast

#### Frontend UI (Dashboard Page)
- [ ] 3-scenario line chart (interactive)
  - X-axis: Date (Apr 1 → Jun 30)
  - Y-axis: Cash ($0 → $400k)
  - 3 lines: optimistic (green), realistic (blue), conservative (red)
  - Hover to see exact number
  - Click to zoom/expand

- [ ] Summary cards below chart
  - Optimistic: $330k on Jun 1
  - Realistic: $310k on Jun 1
  - Conservative: $290k on Jun 1
  - Breakeven date highlighted

- [ ] Scenario builder (collapsible)
  - Slider: Recovery % (0-100)
  - Slider: Payroll increase (0-50%)
  - Slider: New revenue/day ($0-$5000)
  - Button: "Recalculate"
  - Shows live forecast update

- [ ] Download button
  - Export 90-day forecast as CSV

#### Database Schema
```sql
CREATE TABLE forecasts (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  forecast_date DATE,
  scenario ENUM('optimistic', 'realistic', 'conservative'),
  day INT,
  projected_cash DECIMAL(12,2),
  runway_days INT,
  breakeven_date DATE,
  calculated_at TIMESTAMP,
  INDEX (company_id, forecast_date, scenario),
  UNIQUE (company_id, forecast_date, scenario, day)
);
```

#### Scheduled Job
- [ ] **Daily Forecast Calculation** (00:15 UTC)
  - For each company: Calculate 3 scenarios
  - Insert into forecasts table
  - Mark old forecasts as stale

---

### PILLAR 3: AR RISK SCORING + DUNNING AUTOMATION ✅ (Priority: CRITICAL)

**Risk Scoring Engine (5-Factor Model)**

#### Factor 1: Days Overdue
- 0-7 days: +10 points
- 8-30 days: +30 points
- 31-60 days: +50 points
- 61+ days: +80 points

#### Factor 2: Invoice Amount (Relative to Customer Avg)
- Normal size: 0 points
- 3x normal: +15 points
- 5x normal: +25 points

#### Factor 3: Customer Payment History
- 100% on-time, never late: -20 points
- 80% on-time, avg 15 days late: +10 points
- 50% on-time, avg 30 days late: +25 points
- <50% on-time, chronic: +40 points
- First invoice: +15 points

#### Factor 4: Company Size (If Enrichment Available)
- Fortune 500: -10 points
- Series B+: 0 points
- Seed startup: +10 points
- Individual/freelancer: +20 points

#### Final Score Calculation
```
Risk Score = Days_Overdue + Amount_Multiplier + History + CompanySize
Capped at 100
Tiers: 0-30 (GREEN), 31-60 (YELLOW), 61-100 (RED)
```

#### Backend APIs (5 endpoints)
- [ ] **POST /api/invoices/calculate-risk-scores**
  - Input: companyId
  - For each invoice: Calculate risk score
  - Insert into invoice_risk_scores table
  - Output: {calculated: 10, avgScore: 45}

- [ ] **GET /api/invoices/risk-scores?companyId=X**
  - Input: companyId, ?filter=RED|YELLOW|GREEN
  - Output: [{invoiceId, customerId, amount, daysOverdue, riskScore, riskTier}, ...]
  - All invoices with risk scores

- [ ] **GET /api/invoices/:id/risk-score**
  - Detailed breakdown for one invoice
  - Output: { riskScore: 72, breakdown: {daysOverdue: 50, amountMult: 15, history: 10, companySize: -3}, tier: "RED" }

- [ ] **GET /api/dashboard/risk-concentration**
  - Top 10 customers by risk score
  - Output: [{customerId, customerName, totalAR, riskScore, invoiceCount}, ...]

- [ ] **POST /api/dashboard/risk-alerts**
  - Input: companyId
  - Get list of RED + YELLOW invoices
  - Output: [{invoiceId, customer, amount, action: "Send Email 3"}, ...]

#### Frontend UI (Dashboard + Invoices Page)
- [ ] Risk badge on each invoice
  - GREEN: "Low Risk" (0-30)
  - YELLOW: "Medium Risk" (31-60)
  - RED: "High Risk" (61-100)
  - Numeric score displayed

- [ ] Invoices list (sortable by risk score)
  - Columns: Customer, Amount, Days Overdue, Risk Score, Status, Action
  - Color-coded rows (green/yellow/red background)

- [ ] Risk concentration chart (pie or bar)
  - Top 10 customers by AR at risk
  - Hover to see details

- [ ] Risk dashboard card
  - "At-Risk AR: $120k (RED: $80k, YELLOW: $40k)"
  - Click to filter

#### Database Schema
```sql
CREATE TABLE invoice_risk_scores (
  id UUID PRIMARY KEY,
  invoice_id UUID REFERENCES invoices(id),
  company_id UUID REFERENCES companies(id),
  risk_score INT,
  risk_tier ENUM('GREEN', 'YELLOW', 'RED'),
  days_overdue INT,
  amount_multiplier FLOAT,
  payment_history_score INT,
  company_size_score INT,
  calculated_at TIMESTAMP,
  INDEX (company_id, invoice_id),
  INDEX (company_id, risk_tier),
  UNIQUE (invoice_id)
);
```

#### Scheduled Job
- [ ] **Daily Risk Score Calculation** (00:30 UTC)
  - For each company: Calculate risk scores for all invoices
  - Update invoice_risk_scores table

---

## PART 2: DUNNING EMAIL SEQUENCES (5-Email Automation)

**Priority: CRITICAL**

### 5 Email Templates (Hardcoded, Personalization Only)

#### Email 1 - Day 7 (Friendly Reminder)
```
Subject: Your Invoice #INV-001 for $5,200 - Due [DUE_DATE]

Hi [CUSTOMER_NAME],

Hope you're having a great week! Just a friendly reminder that
your invoice #INV-001 for $5,200 is now due.

[Details Table]

No rush—if payment's already in the works, ignore this. If you
have questions or need to discuss payment options, just reply.

[Pay Now] [Questions?]

Thanks,
[COMPANY_NAME]
```

#### Email 2 - Day 14 (Reminder Tone)
```
Subject: Reminder: Invoice #INV-001 ($5,200) Now 14 Days Overdue

Hi [CUSTOMER_NAME],

Following up on my previous email—your invoice #INV-001 for
$5,200 is now 14 days overdue.

We understand things get busy. Can you let us know:
1. When can you process payment?
2. Do you need a payment plan?
3. Is there a discrepancy?

Let's get this sorted.

[Pay Now] [Discuss Options]

Best,
[COMPANY_NAME]
```

#### Email 3 - Day 22 (Payment Plan Offer)
```
Subject: Let's Work Out a Payment Plan - Invoice #INV-001

Hi [CUSTOMER_NAME],

Invoice #INV-001 ($5,200) is now 22 days overdue. We'd like to
find a solution that works for you.

**Payment Plan Option:**
- $2,600 due today
- $2,600 due May 20

This keeps your account in good standing.

[Approve Plan] [Pay Full Amount]

[COMPANY_NAME]
```

#### Email 4 - Day 35 (Formal Escalation)
```
Subject: URGENT: Invoice #INV-001 Is 35 Days Overdue - Action Required

[CUSTOMER_NAME],

Your invoice #INV-001 ($5,200) is now significantly overdue
(35 days past due).

Despite our previous reminders, we haven't received payment.
We need to resolve this immediately.

Please:
1. Process payment today, OR
2. Contact us to discuss payment arrangement

This is our final reminder before escalation.

[Pay Immediately] [Contact Us]

[COMPANY_NAME]
Financial Team
```

#### Email 5 - Day 50 (Collections Notice)
```
Subject: FINAL NOTICE - Invoice #INV-001 ($5,200) Will Be Escalated

[CUSTOMER_NAME],

After 50 days without payment, we're escalating invoice #INV-001
($5,200) for collections action.

**Last Chance to Resolve:**
- Full payment: $5,200 by [DATE]
- Payment plan: Contact us immediately

Failure to respond will result in:
- Service suspension
- Collections referral
- Impact to credit

[Pay Now] [Emergency Contact]

[COMPANY_NAME]
Financial Team
```

### Backend APIs (5 endpoints)
- [ ] **POST /api/dunning/trigger**
  - Cron job calls this daily
  - Logic: Find invoices where days_overdue matches email trigger day
  - Create dunning_campaign if doesn't exist
  - Queue email for sending

- [ ] **POST /api/dunning/send-email/:campaignId/:emailNumber**
  - Input: campaignId, emailNumber (1-5)
  - Personalize template: Replace [CUSTOMER_NAME], [INVOICE_ID], [AMOUNT], [COMPANY_NAME]
  - Send via Resend (user's configured sender email)
  - Log email_log record
  - Update dunning_campaign.email_X_sent_at
  - Output: {sent: true, messageId}

- [ ] **GET /api/dunning/campaigns?companyId=X**
  - List all dunning campaigns
  - Output: [{invoiceId, customerName, amount, status, lastEmailSent, nextEmailScheduled}, ...]

- [ ] **POST /api/dunning/pause/:campaignId**
  - User manually pauses campaign (e.g., customer promised payment)
  - Set status = "paused"

- [ ] **POST /api/dunning/resume/:campaignId**
  - Resume paused campaign

- [ ] **POST /api/dunning/mark-completed/:campaignId**
  - User manually marks as paid/resolved
  - Set status = "completed"

### Frontend UI (Dunning Management Tab)
- [ ] Dunning campaigns list
  - Columns: Customer, Invoice, Amount, Status, Last Email, Next Email, Actions
  - Status badge (active/paused/completed)
  - Action buttons: Pause | Resume | Mark Paid | Send Email Now

- [ ] Campaign details (click to expand)
  - Email history (which emails sent, when, open rate, click rate)
  - Manual email trigger button "Send Email 4 Now"
  - Notes field (for customer responses)

#### Database Schema
```sql
CREATE TABLE dunning_campaigns (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  invoice_id UUID REFERENCES invoices(id),
  status ENUM('active', 'paused', 'completed', 'failed'),
  email_1_sent_at TIMESTAMP,
  email_2_sent_at TIMESTAMP,
  email_3_sent_at TIMESTAMP,
  email_4_sent_at TIMESTAMP,
  email_5_sent_at TIMESTAMP,
  last_email_at TIMESTAMP,
  next_email_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP,
  INDEX (company_id, invoice_id),
  INDEX (company_id, status),
  UNIQUE (invoice_id)
);

CREATE TABLE email_logs (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  dunning_campaign_id UUID REFERENCES dunning_campaigns(id),
  invoice_id UUID REFERENCES invoices(id),
  email_number INT,
  recipient_email VARCHAR,
  subject VARCHAR,
  body TEXT,
  sent_at TIMESTAMP,
  resend_message_id VARCHAR,
  status ENUM('sent', 'bounced', 'spam', 'delivered'),
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  replied_at TIMESTAMP,
  reply_text TEXT,
  INDEX (company_id, sent_at DESC),
  INDEX (invoice_id),
  INDEX (dunning_campaign_id)
);
```

#### Scheduled Job
- [ ] **Daily Dunning Trigger** (01:00 UTC)
  - For each company, check invoices
  - If daysOverdue = 7, 14, 22, 35, or 50: trigger dunning_campaigns (if not exists)
  - Queue email for sending

- [ ] **Smart Pause Logic**
  - If email_logs.replied_at exists for recent email → pause campaign
  - Show pause reason in UI: "Customer replied on [DATE]"

---

## PART 3: PAYMENT PLAN TEMPLATES (NOT Stripe Billing API)

**Priority: HIGH**

### 3 Payment Plan Templates (Based on Risk Score)

| Risk Tier | Split | Example |
|-----------|-------|---------|
| GREEN (0-30) | 50/50 | $2,600 today + $2,600 in 30 days |
| YELLOW (31-60) | 40/60 | $2,100 today + $3,100 in 45 days |
| RED (61-100) | 30/70 | $1,560 today + $3,640 in 60 days |

### Backend APIs (4 endpoints)
- [ ] **GET /api/payment-plans/suggested?invoiceId=X**
  - Input: invoiceId (fetch invoice + risk score)
  - Output: [{option: 1, split: "50/50", installment1: {amount, dueDate}, installment2: {amount, dueDate}}, ...]
  - 3 options based on risk tier

- [ ] **POST /api/payment-plans**
  - Input: {invoiceId, option: 1, customerAccepted: true}
  - Create payment_plans record
  - Output: {planId, link: "paymentplan.recoverai.com/accept/XXX"}
  - Send link to customer via dunning email

- [ ] **GET /api/payment-plans?invoiceId=X**
  - List all payment plans for invoice
  - Output: [{planId, option, status, installment1_paid_at, installment2_paid_at}, ...]

- [ ] **POST /api/payment-plans/:planId/accept**
  - Customer clicks "Accept Plan" button
  - Set status = "accepted"
  - Send Slack notification to founder: "Customer [NAME] accepted plan"
  - Output: {accepted: true, instructions: "You can now setup Stripe payment link"}

#### Frontend UI (Payment Plan Management)
- [ ] Suggested plans popup (when viewing RED invoice)
  - Show 3 options
  - Button: "Send Plan to Customer"
  - Copy link: "/accept/[planId]"

- [ ] Payment plans list (in dunning campaign details)
  - Status badge (proposed/accepted/rejected/completed/defaulted)
  - Installment tracking (due date, paid/unpaid)

- [ ] Public acceptance page (/accept/[planId])
  - Show plan terms: "You proposed: $X today, $Y on [DATE]"
  - Button: "I Accept This Plan"
  - After accept: "Plan accepted! We'll follow up on [DATE]"

#### Database Schema
```sql
CREATE TABLE payment_plans (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  invoice_id UUID REFERENCES invoices(id),
  dunning_campaign_id UUID REFERENCES dunning_campaigns(id),
  option INT (1, 2, or 3),
  total_amount DECIMAL(12,2),
  installment_1_amount DECIMAL(12,2),
  installment_1_due_date DATE,
  installment_1_paid_at TIMESTAMP,
  installment_2_amount DECIMAL(12,2),
  installment_2_due_date DATE,
  installment_2_paid_at TIMESTAMP,
  status ENUM('proposed', 'accepted', 'rejected', 'completed', 'defaulted'),
  customer_note TEXT,
  created_at TIMESTAMP,
  INDEX (company_id, invoice_id),
  INDEX (company_id, status)
);
```

#### Scheduled Job
- [ ] **Payment Plan Reminder** (Monday 9 AM, per company timezone)
  - If installment due in 3 days: Send reminder email
  - If installment overdue by 5 days: Send escalation email

---

## PART 4: INTEGRATIONS (STARTER ONLY)

**Priority: CRITICAL (first 3), HIGH (Slack)**

### Integration 1: Stripe OAuth (95% done, needs completion)
- [ ] **Status:** OAuth flow works, needs invoice sync
- [ ] Test: Connect Stripe account, pull invoices
- [ ] Verify: invoices table has Stripe data
- [ ] Webhook: Listen for payment.charge.succeeded → update invoice status

### Integration 2: Manual Stripe Key (99% done)
- [ ] Test: Paste API key, validate, encrypt
- [ ] Verify: Manual key works same as OAuth

### Integration 3: CSV Upload (95% done, needs retest)
- [ ] Test: Upload sample CSV, verify column detection
- [ ] Verify: Duplicate detection works
- [ ] Verify: Fraud prevention (7 layers) working
- [ ] Test: Data appears in invoices list

### Integration 4: Slack (Skeleton exists, needs full implementation)
- [ ] **Slack OAuth Flow**
  - Settings → Integrations → Slack: "Connect Slack"
  - Redirect to Slack OAuth
  - Get workspace token
  - Store encrypted in integrations table
  - Show "✅ Connected" badge

- [ ] **Daily Digest (9 AM user's timezone)**
  - Post to #recoverai channel (or user-chosen channel)
  - Content:
    ```
    📊 RecoverAI Daily Brief

    💰 Cash Position: $310,550 (↑$15,200 from yesterday)
    ⏰ Runway: 16.2 months
    ⚠️ Alert Level: NORMAL ✓

    🎯 Top Actions Today:
    1. Email sent to [Customer A]: Invoice $8k (22 days overdue) - HIGH RISK
    2. Email sent to [Customer B]: Invoice $3.2k (8 days overdue) - GREEN
    3. Payment received: [Customer C] $5k ✓

    💰 This Month So Far:
    - Invoiced: $125,400
    - Recovered: $98,200 (78.3%)
    - Outstanding: $27,200

    📈 90-Day Forecast:
    - Minimum cash: $150k (May 15)
    - Breakeven if no new revenue: Jun 3

    [View Dashboard]
    ```

- [ ] **Slack Commands**
  - `/cash-position` → Returns: "Your cash: $310,550, Runway: 16.2 months"
  - `/forecast` → Returns: 3-scenario summary + link to dashboard
  - `/overdue` → Returns: List of overdue invoices (top 5)
  - `/at-risk` → Returns: List of RED risk invoices

- [ ] **Slack Notifications (Real-Time)**
  - Payment received: "🎉 [Customer Name] paid $5,000 for invoice #INV-001"
  - Payment plan accepted: "✅ [Customer Name] accepted payment plan (2 installments)"
  - High-risk invoice: "🔴 [Customer Name]'s $8,000 invoice is now RED risk (35 days overdue)"

#### Backend APIs (5 endpoints)
- [ ] **POST /api/slack/authorize**
  - Slack OAuth callback
  - Store workspace token
  - Output: {authorized: true}

- [ ] **POST /api/slack/disconnect**
  - Remove Slack integration

- [ ] **POST /api/slack/send-daily-digest**
  - Cron job calls this
  - Gather data: cash, runway, top actions, forecast
  - Post to Slack workspace
  - Output: {sent: true}

- [ ] **POST /api/slack/commands**
  - Handle `/cash-position`, `/forecast`, `/overdue`, `/at-risk`
  - Output: Formatted message

- [ ] **POST /api/slack/notify-payment**
  - Called when payment received
  - Post notification: "🎉 Payment received"

#### Database Schema
```sql
CREATE TABLE integrations (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  type ENUM('stripe', 'quickbooks', 'csv', 'slack', 'plaid'),
  status ENUM('connected', 'disconnected', 'error'),
  oauth_token_encrypted VARCHAR,
  last_synced TIMESTAMP,
  error_message VARCHAR,
  created_at TIMESTAMP,
  UNIQUE (company_id, type)
);
```

---

## PART 5: SETTINGS (Email Customization + Dunning Rules)

**Priority: HIGH**

### Settings Page Tabs (2 of 4 for STARTER)

#### Tab 1: Email Customization
- [ ] **Sender Email**
  - Input: custom@mycompany.com
  - Validate: Domain verification (optional for MVP, just warn)
  - Help text: "Emails will be sent from this address. Must be your domain."

- [ ] **Email Tone**
  - Dropdown: Friendly / Professional / Aggressive
  - Preview each tone for Email 1 (show example)
  - Default: Friendly

- [ ] **Custom Signature**
  - Text area: Free text (default: "[Company Name] Financial Team")
  - Appears at bottom of all dunning emails

- [ ] **Logo Upload**
  - File upload: Company logo
  - Used in email template header (optional)
  - Max 2MB, PNG/JPG

#### Tab 2: Dunning Rules (Customizable Sliders)
- [ ] **Email 1 Trigger Day**
  - Slider: 5-14 days (default: 7)
  - Label: "Send friendly reminder after [X] days overdue"

- [ ] **Email 2 Trigger Day**
  - Slider: 10-21 days (default: 14)

- [ ] **Email 3 Trigger Day**
  - Slider: 15-30 days (default: 22)
  - Note: "Payment plan offer sent at this stage"

- [ ] **Email 4 Trigger Day**
  - Slider: 25-45 days (default: 35)

- [ ] **Email 5 Trigger Day**
  - Slider: 40-60 days (default: 50)

- [ ] **Auto-Pause if Customer Replies**
  - Toggle: ON/OFF (default: ON)
  - Help: "Pause sequence if customer responds to email"

#### Tab 3: Payment Term Splits (Customizable)
- [ ] **Low Risk Split (GREEN, 0-30)**
  - Option: 50/50, 40/60, 30/70, Custom
  - If custom: Sliders for installment 1 & 2 %
  - Due date days: Installment 1 (0), Installment 2 (30) - customizable

- [ ] **Medium Risk Split (YELLOW, 31-60)**
  - Same as above, default 40/60

- [ ] **High Risk Split (RED, 61-100)**
  - Same as above, default 30/70

#### Tab 4: Integrations (View Only for STARTER)
- [ ] **Integration Status**
  - Stripe: Connected ✓ (Disconnect | Re-authorize)
  - CSV: Last uploaded [DATE] (Upload new)
  - Slack: Connected ✓ (Disconnect)
  - QuickBooks: Coming soon
  - Plaid: Coming soon

#### Backend APIs (3 endpoints)
- [ ] **GET /api/settings/company**
  - Output: {companyName, email, timezone, senderEmail, emailTone, customSignature}

- [ ] **PUT /api/settings/company**
  - Input: {senderEmail, emailTone, customSignature, logoUrl}
  - Validate sender email format
  - Output: {updated: true}

- [ ] **PUT /api/settings/dunning-rules**
  - Input: {email1Day, email2Day, email3Day, email4Day, email5Day, autoPauseOnReply}
  - Validate: email1Day < email2Day < ... < email5Day
  - Output: {updated: true}

- [ ] **PUT /api/settings/payment-terms**
  - Input: {lowRiskSplit: "50/50", medRiskSplit: "40/60", highRiskSplit: "30/70"}
  - Output: {updated: true}

#### Database Schema
```sql
CREATE TABLE company_settings (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  sender_email VARCHAR,
  email_tone ENUM('friendly', 'professional', 'aggressive'),
  custom_signature TEXT,
  logo_url VARCHAR,
  email_1_day INT,
  email_2_day INT,
  email_3_day INT,
  email_4_day INT,
  email_5_day INT,
  auto_pause_on_reply BOOLEAN,
  low_risk_split VARCHAR,
  med_risk_split VARCHAR,
  high_risk_split VARCHAR,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE (company_id)
);
```

---

## PART 6: INVOICE MANAGEMENT PAGE

**Priority: HIGH**

### Invoices List View
- [ ] **Columns**
  - Customer Name
  - Invoice ID
  - Amount
  - Due Date
  - Days Overdue
  - Risk Score (with color badge)
  - Status (Unpaid, Paid, Arranged, Disputed)
  - Source (Stripe, CSV, Manual)
  - Last Action (Email 1 sent, Email 3 sent, etc.)

- [ ] **Sorting**
  - By: Days Overdue (desc), Amount (desc), Risk Score (desc), Due Date (asc)

- [ ] **Filtering**
  - Overdue (days >= 1)
  - At Risk (risk score >= 31)
  - Unpaid (status = unpaid)
  - Paid (status = paid)
  - By Risk Tier (GREEN, YELLOW, RED)
  - By Customer
  - By Date Range

- [ ] **Bulk Actions** (Premium, disabled for STARTER trial)
  - Select multiple → "Send Email 2 to Selected"
  - Disabled for trial (grayed out)

### Invoice Details View (Click Row)
- [ ] **Header**
  - Invoice ID, Amount, Status badge, Risk score + tier

- [ ] **Invoice Details**
  - Customer name, email, company
  - Amount, currency
  - Issued date, due date, days overdue
  - Status

- [ ] **Customer History**
  - Total invoices from customer
  - Lifetime paid amount
  - Lifetime overdue amount
  - On-time % (if enough history)
  - Payment history trend (small chart)

- [ ] **Communication Timeline**
  - Email 1 sent [DATE]: open?, click?
  - Email 2 sent [DATE]: open?, click?
  - Payment received [DATE]
  - Payment plan offered [DATE], accepted/rejected?

- [ ] **Actions**
  - Button: "Send Email Now" (dropdown: Email 1-5)
  - Button: "Offer Payment Plan"
  - Button: "Mark as Paid"
  - Button: "Pause Dunning"

#### Backend APIs (4 endpoints)
- [ ] **GET /api/invoices?companyId=X&filter=overdue&limit=50**
  - Paginated list with filtering/sorting

- [ ] **GET /api/invoices/:id**
  - Full invoice detail
  - Include: customer history, payment history, dunning campaign status, email logs

- [ ] **PUT /api/invoices/:id/status**
  - Input: {status: "paid"}
  - Update invoice status
  - Trigger: Mark dunning campaign as completed

- [ ] **DELETE /api/invoices/:id**
  - Delete invoice (soft delete)

---

## PART 7: DASHBOARD PAGE REORGANIZATION

**Priority: CRITICAL (Reorder)**

### Current Order (WRONG)
1. Risk Concentration
2. Recovery Funnel
3. Billing Optimization Alerts
4. Cash Flow Timeline
5. Payables Tracker
6. Weekly Forecast

### NEW Order (CORRECT)
1. **Cash Position Card** (Top, biggest)
2. **90-Day Forecast Chart** (Interactive, 3 scenarios)
3. **Alerts & Actions** (Next 3 things to do)
4. **Invoices at Risk** (Risk concentration - condensed)
5. **Dunning Activity** (Recent emails sent, payment plans, recoveries)
6. **Key Metrics** (This month: invoiced, recovered, outstanding)

### Cards/Sections Detail

#### Section 1: Cash Position (Collapsible, DEFAULT OPEN)
- [ ] Display: Bank + AR - Bills = Available + Runway
- [ ] Metric cards: Big number display
- [ ] Trend: Green arrow if ↑, red if ↓
- [ ] Status indicator: Green (>12mo), yellow (6-12mo), red (<6mo)

#### Section 2: 90-Day Forecast (Collapsible, DEFAULT OPEN)
- [ ] 3-line chart (optimistic/realistic/conservative)
- [ ] Summary cards below
- [ ] Scenario builder (collapsible)
- [ ] Download CSV button

#### Section 3: Alerts & Actions (Collapsible, DEFAULT OPEN)
- [ ] List of recommended actions:
  - "Send Email 2 to [Customer A]: $8k invoice, 22 days overdue"
  - "Payroll due in 8 days: $28k"
  - "Trial ending in 5 days" (if trial)
- [ ] Button: "Take Action" → Opens invoice or settings

#### Section 4: Invoices at Risk (Collapsible)
- [ ] Pie/donut chart: RED vs YELLOW vs GREEN count
- [ ] Table: Top 10 at-risk customers by AR amount
- [ ] Link: "View all invoices"

#### Section 5: Dunning Activity (Collapsible)
- [ ] Last 24h summary:
  - "2 emails sent"
  - "1 payment received: $5,000"
  - "0 payment plans accepted"
- [ ] Trend sparkline (emails sent, recoveries)

#### Section 6: Key Metrics (Collapsible)
- [ ] This month summary (auto-calculated):
  - Invoiced: $125,400
  - Recovered: $98,200 (78.3%)
  - Outstanding: $27,200
- [ ] Month-over-month comparison (if data exists)

---

## PART 8: FRONTEND PAGES CHECKLIST

### Pages to Build/Refine

| Page | Status | Priority | Notes |
|------|--------|----------|-------|
| Landing | NOT DONE | HIGH | Marketing page (convert to paid) |
| Signup | DONE | - | Retest OTP flow |
| Verify Email | DONE | - | Retest |
| Integrations | DONE | - | Add test for CSV, Stripe OAuth |
| Dashboard | 60% | CRITICAL | Reorder sections, add forecast UI |
| Invoices | 50% | CRITICAL | Add risk scoring UI, details view |
| Settings | 60% | HIGH | Add email customization, dunning rules |
| Billing | 70% | HIGH | Upgrade CTA, subscription display |
| Slack Integration | 10% | MEDIUM | Build OAuth flow + status UI |

### Page Details

#### Landing Page (NOT DONE)
- [ ] Marketing headline: "Know Your Cash. Recover AR. Sleep Better."
- [ ] Hero section: Screenshot of dashboard
- [ ] Pain point section: "Founder cash anxiety"
- [ ] 3 pillars section: Cash Position, Forecast, AR Recovery
- [ ] Pricing card: "$1,500/month, 14-day free trial"
- [ ] CTA: "Start Free Trial" → /signup
- [ ] Social proof (later): Case studies, testimonials

#### Dashboard (REFACTOR - Reorder)
- [x] Current code exists
- [ ] Reorder sections: Cash → Forecast → Alerts → Risk → Activity → Metrics
- [ ] Make each section collapsible
- [ ] Fix Forecast UI (chart + scenario builder)
- [ ] Responsive on mobile

#### Invoices (ENHANCE)
- [x] List view exists
- [ ] Add risk scoring UI (color badges)
- [ ] Add filtering/sorting
- [ ] Add details view (click row)
- [ ] Add customer history
- [ ] Add email log timeline

#### Settings (ENHANCE)
- [x] Basic structure exists
- [ ] Tab 1: Email customization (sender, tone, signature, logo)
- [ ] Tab 2: Dunning rules (day sliders, auto-pause toggle)
- [ ] Tab 3: Payment terms (splits customizable)
- [ ] Tab 4: Integrations (status view)

#### Billing (ENHANCE)
- [x] Basic structure exists
- [ ] Add trial countdown (if in trial)
- [ ] Add upgrade CTA: "$1,500/month, upgrade to paid"
- [ ] Add payment method setup (Stripe Checkout)
- [ ] Show current plan: "STARTER ($1.5k/mo)"

---

## PART 9: BACKEND APIs COMPLETE LIST

### Authentication (DONE)
- [x] POST /api/auth/signup
- [x] POST /api/auth/verify-email
- [x] POST /api/auth/login
- [x] POST /api/auth/logout
- [x] POST /api/auth/refresh
- [x] GET /api/auth/me

### Invoices (60% DONE)
- [ ] GET /api/invoices?companyId=X&filter=&sort=&limit=
- [ ] GET /api/invoices/:id
- [ ] POST /api/invoices (manual create)
- [ ] PUT /api/invoices/:id/status
- [ ] DELETE /api/invoices/:id
- [ ] GET /api/invoices/aging-summary

### Risk Scoring (30% DONE)
- [ ] POST /api/invoices/calculate-risk-scores
- [ ] GET /api/invoices/risk-scores
- [ ] GET /api/invoices/:id/risk-score
- [ ] GET /api/dashboard/risk-concentration
- [ ] POST /api/dashboard/risk-alerts

### Dunning (50% DONE)
- [ ] POST /api/dunning/trigger
- [ ] POST /api/dunning/send-email/:campaignId/:emailNumber
- [ ] GET /api/dunning/campaigns
- [ ] POST /api/dunning/pause/:campaignId
- [ ] POST /api/dunning/resume/:campaignId
- [ ] POST /api/dunning/mark-completed/:campaignId

### Payment Plans (40% DONE)
- [ ] GET /api/payment-plans/suggested?invoiceId=X
- [ ] POST /api/payment-plans
- [ ] GET /api/payment-plans?invoiceId=X
- [ ] POST /api/payment-plans/:planId/accept
- [ ] PUT /api/payment-plans/:planId

### Cash Position (40% DONE)
- [ ] GET /api/dashboard/cash-position
- [ ] POST /api/dashboard/cash-position/calculate
- [ ] GET /api/dashboard/cash-position/history

### Forecast (40% DONE)
- [ ] GET /api/dashboard/forecast
- [ ] POST /api/dashboard/forecast/calculate
- [ ] GET /api/dashboard/forecast/scenarios
- [ ] POST /api/dashboard/forecast/scenario-builder

### Slack Integration (10% DONE)
- [ ] POST /api/slack/authorize
- [ ] POST /api/slack/disconnect
- [ ] POST /api/slack/send-daily-digest
- [ ] POST /api/slack/commands
- [ ] POST /api/slack/notify-payment

### Settings (60% DONE)
- [ ] GET /api/settings/company
- [ ] PUT /api/settings/company
- [ ] PUT /api/settings/dunning-rules
- [ ] PUT /api/settings/payment-terms
- [ ] GET /api/settings/integrations

### Integrations (60% DONE)
- [x] Stripe OAuth
- [ ] Stripe OAuth refresh
- [x] CSV upload
- [ ] CSV re-upload
- [ ] Slack OAuth

### Email Logs (20% DONE)
- [ ] GET /api/email-logs?campaignId=X
- [ ] GET /api/email-logs/stats
- [ ] POST /api/email-logs/update-tracking (webhook from Resend)

---

## PART 10: SCHEDULED JOBS (Cron Tasks)

### Daily Jobs (Need to Implement)

| Job | Time (UTC) | Frequency | What It Does |
|-----|-----------|-----------|-------------|
| Calculate Risk Scores | 00:30 | Daily | For each company, score all unpaid invoices |
| Calculate Cash Position | 00:05 | Daily | Aggregate invoices, bills, bank balance |
| Calculate Forecast | 00:20 | Daily | 90-day projection (3 scenarios) |
| Trigger Dunning Emails | 01:00 | Daily | Find invoices at email trigger days, queue emails |
| Send Queued Emails | 01:15 | Every 30min | Send emails via Resend, log delivery |
| Send Slack Digest | 09:00 | Daily | (Per company timezone) |
| Payment Plan Reminders | 09:30 | Daily | If installment due in 3 days, send reminder |

### Job Implementation

#### Job 1: Daily Risk Score Calculation
```
For each company:
  For each unpaid invoice:
    Calculate risk score (5 factors)
    Upsert into invoice_risk_scores
  Log: "Calculated 50 risk scores for company X"
```

#### Job 2: Daily Cash Position Calculation
```
For each company:
  Fetch: Total paid invoices (bank balance)
  Fetch: Total unpaid invoices (AR)
  Fetch: Bills due in 30 days
  Calculate: Available = Bank + AR - Bills
  Calculate: Runway = Available / Monthly Burn
  Upsert into cash_positions
  Log: "Calculated cash for company X: $310k, 16.2 months"
```

#### Job 3: Daily Forecast Calculation
```
For each company:
  Calculate 3 scenarios (optimistic, realistic, conservative)
  For each day in 90 days:
    Project cash based on:
      - Historical recovery % by day
      - Known bills due
      - Fixed/variable expenses
      - New revenue growth
  Insert into forecasts
  Log: "Calculated forecast for company X"
```

#### Job 4: Daily Dunning Trigger
```
For each company:
  Get company settings: email_1_day=7, email_2_day=14, etc.
  For each unpaid invoice:
    If daysOverdue == email_1_day AND no dunning campaign:
      Create dunning_campaign (status=active)
      Queue: send-email with emailNumber=1
    Else if daysOverdue == email_2_day AND email_1_sent_at exists:
      Queue: send-email with emailNumber=2
    ... etc for emails 3, 4, 5
  Log: "Queued 5 dunning emails for company X"
```

#### Job 5: Send Queued Emails (Every 30 min)
```
Get queued emails (status='queued')
For each email:
  Personalize template: [CUSTOMER_NAME], [AMOUNT], etc.
  Send via Resend:
    from: company.settings.senderEmail
    to: invoice.customer.email
    subject/body: templated + personalized
  On success:
    Create email_log record
    Set status='sent'
    Update dunning_campaign.email_X_sent_at
  On failure:
    Retry 3x with exponential backoff
    If failed 3x: Set status='failed', log error
  Log: "Sent 10 dunning emails"
```

#### Job 6: Daily Slack Digest
```
For each company:
  If slack integration connected:
    Gather data:
      - Cash position (today)
      - Runway
      - Top 3 actions (overdue invoices, emails sent, payments received)
      - This month summary (invoiced, recovered, outstanding)
      - 90-day forecast (breakeven date)
    Format as Slack message block (pretty!)
    Post to Slack workspace
  Log: "Sent Slack digest to company X"
```

---

## PART 11: EMAIL INFRASTRUCTURE

### Email Sending (Via Resend)

#### Setup
- [ ] Resend account created
- [ ] Domain added to Resend (support custom domains)
- [ ] DKIM/SPF records verified
- [ ] API key stored in .env

#### User Configuration
- [ ] Settings field: "Sender email" (billing@company.com)
- [ ] Resend validates domain ownership
- [ ] Backend sends via Resend API with:
  - from: user.settings.senderEmail
  - to: invoice.customer.email
  - replyTo: user.company.email (optional)

#### Email Tracking
- [ ] Resend webhooks: delivery, open, click, bounce
- [ ] Backend stores tracking data in email_logs table
- [ ] Dashboard shows: "Email opened 3 hours ago" + "Link clicked"

#### Email Templates
- [ ] All 5 dunning templates hardcoded (not Resend template)
- [ ] Personalization done in code: replace [TOKENS]
- [ ] No dynamic content (keep simple for MVP)

---

## PART 12: SECURITY CHECKLIST

- [ ] HTTPS only (enforce in production)
- [ ] httpOnly cookies for auth tokens
- [ ] CSRF protection on forms
- [ ] SQL injection prevention (parameterized queries everywhere)
- [ ] Rate limiting on auth endpoints (done)
- [ ] Rate limiting on public endpoints (CSV upload, payment plan accept)
- [ ] Email validation (RFC 5322)
- [ ] Password hashing (bcrypt, done)
- [ ] OAuth token encryption (AES-256, store encrypted)
- [ ] API key validation (users can't see each other's data)
- [ ] No secrets in logs
- [ ] No sensitive data in error messages
- [ ] CORS configured correctly (frontend domain only)

---

## PART 13: TESTING CHECKLIST (Manual)

### Onboarding Flow
- [ ] Signup → OTP → Integrations → Dashboard (end-to-end)
- [ ] Trial mode: Dashboard shows trial countdown
- [ ] Paid mode: Can upgrade to STARTER

### Stripe Integration
- [ ] Connect Stripe OAuth → invoices appear
- [ ] Add manual API key → invoices appear
- [ ] Invoices show up in list, have risk scores

### CSV Upload
- [ ] Upload CSV → column auto-detection works
- [ ] Data appears in invoices list
- [ ] Duplicate detection catches duplicates

### Dunning Email Sequence
- [ ] Day 7: Email 1 sent (check email log)
- [ ] Day 14: Email 2 sent (check email log)
- [ ] Email opens tracked (check email_logs.opened_at)
- [ ] Email clicks tracked (check email_logs.clicked_at)
- [ ] Replies captured (check email_logs.replied_at)

### Payment Plans
- [ ] Suggest plans dialog shows for RED invoices
- [ ] Send plan to customer → link works
- [ ] Customer clicks "Accept" → status changes to accepted
- [ ] Slack notification sent to founder

### Cash Position + Forecast
- [ ] Cash position calculates correctly (test with known numbers)
- [ ] Forecast shows 3 scenarios
- [ ] Scenario builder works (change recovery %, see impact)

### Settings
- [ ] Email customization saved
- [ ] Dunning rule sliders work (change days, emails send at new schedule)
- [ ] Payment term splits saved
- [ ] Slack connect/disconnect works

### Dark Mode
- [ ] All pages render correctly in dark mode
- [ ] Text contrast sufficient (a11y)
- [ ] Charts readable (light background)

---

## PART 14: LAUNCH CHECKLIST

### Week 1-2: Core Build
- [ ] All 25 backend APIs working
- [ ] Dashboard reorganized (cash → forecast → alerts)
- [ ] Dunning email sending working
- [ ] Payment plans templates working
- [ ] Slack integration working
- [ ] Settings all customizable
- [ ] Builds passing (frontend + backend)

### Week 3: QA + Deploy
- [ ] Manual testing all flows
- [ ] Load testing (simulate 100 simultaneous users)
- [ ] Security audit (secrets, SQL injection, CORS)
- [ ] Deploy to production (Vercel + Railway)
- [ ] SSL certificates valid
- [ ] Monitoring set up (Sentry, LogRocket)

### Week 4: Marketing + Launch
- [ ] Landing page live
- [ ] Demo video recorded (1 min Loom)
- [ ] Product Hunt profile created
- [ ] Twitter/LinkedIn announcements drafted
- [ ] Email list ready
- [ ] 30 beta users invited
- [ ] Week 4: Public launch (PH, IH, Twitter)

---

## PART 15: SUCCESS METRICS (Track These)

### Launch Week (Week 4)
- [ ] Product Hunt: 200+ upvotes
- [ ] Total signups: 200+
- [ ] Twitter engagement: 500+ (likes + RTs)
- [ ] Demo video views: 300+

### Growth (Weeks 5-12)
- [ ] Trial signups/week: 15-20
- [ ] Trial-to-paid conversion: 18%+
- [ ] Paid customers: 15+ by week 12
- [ ] MRR: $22.5k+ by week 12
- [ ] Email delivery: 95%+
- [ ] Email open rate: 20%+
- [ ] Email click rate: 5%+
- [ ] Payment plan acceptance: 40%+

### Product Metrics
- [ ] Dunning email trigger accuracy: 100%
- [ ] Cash position calculation accuracy: 100%
- [ ] Forecast accuracy (after month 1): 80%+
- [ ] Risk score consistency: 100%
- [ ] Uptime: 99.5%+
- [ ] API response time: <500ms

---

## FINAL SUMMARY

### What Needs to Be Built (A-Z)

**MUST BUILD (Critical Path)**
1. Dashboard reorder (cash → forecast → alerts)
2. Forecast UI + algorithm
3. Email sending (Resend + user config)
4. Dunning campaign logic + triggered sending
5. Payment plan acceptance flow
6. Settings tabs (email, dunning, terms)
7. Slack integration (daily digest + commands)
8. Invoice details + risk UI
9. All scheduled jobs (6 jobs)
10. All backend APIs (25+ endpoints)

**SHOULD BUILD (High)**
1. Landing page
2. CSV retest
3. Stripe OAuth retest
4. Settings Tab 4 (integrations status)
5. Email log UI
6. Trial countdown UI

**CAN SKIP (for now)**
- QB integration
- Plaid integration
- Xero integration
- SMS outreach
- Payment plan Stripe Billing API
- AP automation
- Advanced forecasting
- Revenue recognition
- Multi-currency

---

## IMMEDIATE NEXT STEPS

**This Week:**
1. Create checklist task file for developers
2. Assign priority to each feature
3. Create GitHub issues (one per feature)
4. Start with: Dashboard reorder + Forecast UI + Email sending

**Target:** Week 4 public launch with STARTER tier fully functional.

**Success Criteria:** 15+ paying customers, $22.5k MRR by week 12.
