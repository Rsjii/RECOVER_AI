RecoverAI — Complete Production Readiness Plan
Part 1: Real State vs Required State
What Actually Exists (Verified)

BACKEND ✅ 100% COMPLETE
├── 70/70 tests passing
├── 40+ endpoints live
├── Agent loop (6h cron) ✅
├── Stripe/QB/Chargebee integrations ✅
├── AI email generation (Anthropic + OpenAI fallback) ✅
├── BullMQ dunning queue (Resend) ✅
├── Payment plans CRUD ✅
├── Dashboard stats API ✅
├── Multi-tenant isolation ✅
├── Demo data endpoint ✅
└── Billing (LemonSqueezy) ✅

FRONTEND ✅ All pages exist
├── Landing page ✅
├── Dashboard (stats + charts + risk table) ✅
├── Invoices (table + filter + CSV upload) ✅
├── InvoiceDetail (tabs: details/payments/emails/plan) ✅
├── Customers ✅
├── Settings (Integration + Dunning + Slack + General) ✅
├── Reports ✅
├── Activity (email logs + queue stats) ✅
├── Billing ✅
├── Team ✅
├── Compliance / Policy ✅
├── Auth (Login/Signup/Google OAuth/ForgotPassword) ✅
├── Onboarding 5-step wizard ✅
└── Legal pages (Terms/Privacy/Cookie/DPA/Security) ✅
Part 2: Critical Gaps (A-Z Analysis)
🔴 P0 — BLOCKING (Demo breaks without these)
#	Gap	Impact	Where
1	Stripe OAuth callback page MISSING	Customer clicks "Connect Stripe" → redirected to /stripe/oauth/callback → 404!	App.tsx has no route for it
2	Email unsubscribe link	CAN-SPAM + GDPR legal requirement. Emails sent without it are illegal	emailService.ts / AI prompt
3	Recovery timeline data	Reports page chart shows empty (recovery_timeline only fills via daily cron, new users see nothing)	recoveryTimelineJob.ts + Reports.tsx
4	No real email open/click tracking	Dashboard shows 0% engagement forever. Kills demo credibility	resendService.ts / webhook handler
🟠 P1 — HIGH (First customer needs these)
#	Gap	Impact	Where
5	Payment plan auto-charge not wired	Plans created, but installments never auto-charged. Customer thinks plan works but money never collected	paymentPlanService.ts
6	Outcome-based billing calculation	Billing page shows flat plans but never calculates the 1% success fee on recovered amount	billingController.ts / Billing.tsx
7	Agent run visibility	"Run Agent Now" button works but no feedback on what happened (how many emails queued, which invoices)	Dashboard.tsx + agent trigger response
8	Demo data recovery timeline	Demo shows $0 in reports — kills "wow moment" for prospects	demoController.ts
9	QB/Chargebee env vars	Integrations built but missing sandbox credentials. Connect buttons lead to error	.env setup
🟡 P2 — IMPORTANT (B2B SaaS professionalism)
#	Gap	Impact	Where
10	Customer reply handling	Agent keeps emailing customers who reply "I'll pay Friday" — damages relationship	agentLoop.ts
11	Timezone-aware email sending	Emails sent at random hours, looks unprofessional	dunningQueue.ts
12	Invoice sync status / last synced time	User has no idea if Stripe sync is working	Settings.tsx / IntegrationSection.tsx
13	Empty state quality	New user sees blank dashboard — no onboarding nudge after signup	Dashboard.tsx
14	Error boundary on lazy pages	Chunk load failure = white screen	App.tsx
15	Email preview before send	Modal exists but only in InvoiceDetail, not triggered from agent flow	EmailPreviewModal.tsx
🟢 P3 — NICE-TO-HAVE (Post-launch competitive moat)
#	Gap	Impact	Where
16	Smart email timing (timezone-aware)	15% better open rate	dunningQueue.ts
17	A/B testing email copy	Builds data moat	New abTestService.ts
18	SMS reminders	Multi-channel recovery	Twilio integration
19	Predictive recovery date	Dashboard "forecast"	AI + history data
20	Bulk actions (mark paid, export, bulk email)	Power user efficiency	BulkActions.tsx
Part 3: System Architecture Diagram

┌─────────────────────────────────────────────────────────────────┐
│                    RECOVERAI SYSTEM (2026)                       │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   STRIPE     │   │  QUICKBOOKS  │   │  CHARGEBEE   │
│  (Invoices)  │   │  (Invoices)  │   │ (Subscript.) │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │ webhooks+sync     │ OAuth sync        │ API sync
       └──────────────┬────┘──────────────────┘
                      ▼
          ┌───────────────────────┐
          │   DATA INGESTION      │
          │ POST /stripe/webhook  │   CSV Upload
          │ POST /stripe/sync     │◄──────────────
          │ POST /qb/sync         │
          │ POST /chargebee/sync  │
          └───────────┬───────────┘
                      │
                      ▼
          ┌───────────────────────┐
          │     POSTGRES DB        │
          │  companies (SaaS B2B) │
          │  invoices (core)      │
          │  customers            │
          │  payments             │
          │  email_logs           │
          │  payment_plans        │
          │  recovery_timeline    │
          └───────────┬───────────┘
                      │
        ┌─────────────┼──────────────┐
        ▼             ▼              ▼
┌─────────────┐ ┌──────────┐ ┌────────────────┐
│  RISK SCORE │ │  AGENT   │ │   PAYMENT      │
│  ENGINE     │ │  LOOP    │ │   TRACKING     │
│             │ │  (6h)    │ │                │
│ Claude/GPT  │ │ Decision │ │ Stripe webhook │
│ 0-100 score │ │  tree    │ │ Mark paid      │
│             │ │ 5 stages │ │ Update history │
└──────┬──────┘ └────┬─────┘ └───────┬────────┘
       │             │               │
       └─────────────┼───────────────┘
                     │
        ┌────────────┼───────────────┐
        ▼            ▼               ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│  EMAIL QUEUE │ │ PAYMENT  │ │   SLACK      │
│  (BullMQ)   │ │  PLAN    │ │              │
│             │ │ CREATION │ │ Daily digest │
│ Resend API  │ │          │ │ Payment alert│
│ 5 dunning   │ │ N install│ │              │
│ stages      │ │ Stripe   │ │              │
└──────────────┘ └──────────┘ └──────────────┘
                     │
                     ▼
          ┌───────────────────────┐
          │    REACT DASHBOARD    │
          │                       │
          │ /dashboard - stats    │
          │ /invoices - table     │
          │ /customers - risk     │
          │ /reports - charts     │
          │ /activity - logs      │
          │ /billing - plans      │
          │ /settings - config    │
          └───────────────────────┘
Part 4: User Flows (Current + Missing)
Flow 1: New Customer Onboarding (CURRENT STATE)

Landing Page
    │
    ├──[Start Free Trial]──► Signup ──► Dashboard (empty)
    │                                      │
    │                              [Connect Stripe] 
    │                                      │
    │                          Setup.tsx → Stripe OAuth
    │                                      │
    │                          ❌ /stripe/oauth/callback — 404!
    │                                      ↑
    │                                   BUG #1
    │
    └──[Try Demo]──► POST /api/demo/login ──► Dashboard (with data)
Flow 1 Fixed: New Customer Onboarding

Landing Page
    │
    ├──[Start Free Trial]──► Signup ──► /onboarding (5-step wizard)
    │                                      │
    │                              Step 1: Connect Stripe
    │                                      │
    │                          GET /api/stripe/oauth/authorize
    │                                      │
    │                         Stripe OAuth Consent Screen
    │                                      │
    │                         GET /api/stripe/oauth/callback (backend)
    │                                      │
    │                         ✅ Redirect → /stripe/oauth/callback (frontend)
    │                                      │ [NEW PAGE NEEDED]
    │                         "Connected! 23 invoices found"
    │                                      │
    │                         Onboarding Step 2-5 → Dashboard
    │
    └──[Try Demo]──► POST /api/demo/login ──► Dashboard (wow demo data)
Flow 2: Agent Recovery Flow (COMPLETE)

Cron (every 6h)
    │
    ├── Query: all unpaid invoices WHERE due_date < now
    │
    ├── For each invoice:
    │   ├── days_overdue = (now - due_date) / 86400000
    │   ├── Check emails already sent
    │   ├── Decision tree:
    │   │   ├── day 1  → dunning_1 (friendly)
    │   │   ├── day 7  → dunning_2 (follow-up)
    │   │   ├── day 14 → dunning_3 (urgent) + payment_plan_offer
    │   │   ├── day 30 → dunning_4 (formal)
    │   │   └── day 60 → dunning_5 (final)
    │   │
    │   └── Queue email → BullMQ
    │
    ├── Worker picks job:
    │   ├── AI generates email (Claude/GPT)
    │   ├── Resend sends email
    │   └── email_logs record created
    │
    └── Payment webhook:
        ├── charge.succeeded → mark invoice paid
        ├── Create payment record
        └── Slack alert: "💰 $5,000 from Acme Corp"
Flow 3: Demo Walkthrough (What client sees in sales call)

Prospect clicks "Try Demo"
    │
    ▼
POST /api/demo/login (creates Acme SaaS demo company)
    │
    ▼
Dashboard loads:
├── 💰 Total Owed: $87,400
├── ✅ Recovered: $34,200 (39.1% rate)
├── ⚠️ Overdue: 23 invoices at risk
└── 📊 Avg Collection: 42 days

Charts:
├── Recovery trend (last 30 days) ← needs demo data in recovery_timeline
└── Invoice pipeline (paid/unpaid/arranged)

Top at-risk customers:
├── David Park - TechWave Co - Risk 89 - $12,500 overdue 67 days
├── Jason Torres - CloudGate Inc - Risk 75 - $8,200 overdue 45 days
└── Mike Johnson - BuildRight LLC - Risk 72 - $5,400 overdue 38 days

    │
    ▼
/invoices page:
├── Table sorted by risk score
├── Color-coded (red/yellow/green)
├── Filter by status
└── Click invoice → detail page with AI email preview
Part 5: Complete Implementation Plan
PHASE 1 — P0 Fixes (1-2 days) — Demo-Blocking
Fix 1: Stripe OAuth Callback Page
Problem: Onboarding + Setup redirect to /stripe/oauth/callback but no route exists in App.tsx.

Files to create/edit:

frontend/src/pages/StripeCallback.tsx — NEW page
frontend/src/App.tsx — Add route
StripeCallback.tsx logic:


1. On mount: extract ?code=xxx from URL
2. POST /api/stripe/oauth/callback {code, state}  (backend already handles this)
   WAIT — backend uses GET /api/stripe/oauth/callback (server-side redirect)
   So frontend just needs to handle the redirect_uri
3. Show "Connecting Stripe..." spinner
4. On success: redirect to /onboarding or /dashboard
5. On error: show error message + retry button
Fix 2: Demo Data Recovery Timeline
Problem: Demo dashboard looks good but Reports page shows empty chart (recovery_timeline table empty for new demo company).

Fix: In demoController.ts, after seeding invoices/payments, also seed recovery_timeline with 30 days of historical data.


INSERT INTO recovery_timeline (company_id, date, total_recovered, recovery_count, ...)
VALUES (companyId, today-30, 2400, 2, ...),
       (companyId, today-29, 1800, 1, ...),
       ...
       (companyId, today, 3200, 3, ...)
Fix 3: Email Unsubscribe Link
Problem: CAN-SPAM + GDPR violation. Every email needs unsubscribe link.

Fix in emailService.ts: Add unsubscribe footer to every email body.


<p style="font-size:12px; color:#666; border-top:1px solid #eee; margin-top:20px; padding-top:12px;">
  To unsubscribe from payment reminders, 
  <a href="{{FRONTEND_URL}}/unsubscribe?token={{INVOICE_TOKEN}}">click here</a>.
  This email was sent regarding invoice {{INVOICE_ID}}.
</p>
Need: Simple /unsubscribe page + backend endpoint that marks customer as do_not_email=true.

Fix 4: Agent Trigger Feedback
Problem: "Run Agent Now" button shows generic "queued" message but user wants to know what happened.

Fix: Return summary from agent trigger endpoint:


{
  "emailsQueued": 7,
  "plansOffered": 2,
  "invoicesScanned": 23,
  "skipped": 16
}
PHASE 2 — P1 Fixes (3-4 days) — First Customer
Fix 5: Email Open/Click Tracking
Problem: opened_at and clicked_at fields exist but never populated.

Two-part fix:

A. Tracking pixel in resendService.ts:


<img src="{{BACKEND_URL}}/api/email/track/open?log_id={{EMAIL_LOG_ID}}" 
     width="1" height="1" style="display:none" />
B. Click tracking wrapper:
All links in email body wrapped:


Original: https://stripe.com/pay/abc123
Tracked:  {{BACKEND_URL}}/api/email/track/click?log_id=xxx&redirect=https://stripe.com/pay/abc123
C. Tracking endpoints (backend):


GET /api/email/track/open?log_id=xxx   → update email_logs.opened_at, redirect 1x1 pixel
GET /api/email/track/click?log_id=xxx&redirect=url → update email_logs.clicked_at, redirect to url
Fix 6: Recovery Fee Calculation in Billing
Problem: Billing page shows flat plans but real pricing is $2.5k + 1% of recovery.

Fix in billingController.ts:


// Calculate monthly success fee
const monthlyRecovery = await db.query(`
  SELECT COALESCE(SUM(amount), 0) as total
  FROM payments 
  WHERE company_id = $1 
    AND created_at >= date_trunc('month', CURRENT_DATE)
    AND status = 'succeeded'
`, [companyId]);

const successFee = monthlyRecovery.rows[0].total * 0.01;
// Include in billing response
Fix in Billing.tsx: Show breakdown:


Base fee:       $2,500/mo
Recovery fee:   $450 (1% of $45,000 recovered)
────────────────────────
Total this month: $2,950
Fix 7: Payment Plan Auto-Charge
Problem: Payment plans created with installments JSON but installments never actually charged.

Fix in paymentPlanService.ts: Add cron job that:

Queries all active payment plans WHERE any installment due_date <= now AND paid = false
Creates Stripe Payment Intent for that installment
Updates installment paid = true on success
On failure: marks installment as failed, sends notification email
Fix 8: Integration Status / Last Synced
Problem: Settings page shows connected/disconnected but user doesn't know if sync is working.

Fix in IntegrationSection.tsx: Fetch and show:


Stripe ✅ Connected (stripe@company.com)
Last synced: 2 hours ago | 23 invoices | Sync now
Add last_synced_at column to companies table, update on every sync.

PHASE 3 — P2 Improvements (1 week) — B2B Polish
Improvement 1: Better Empty States with Action CTAs
Current: empty dashboard shows generic "Connect Stripe" message.

Required progression:


No integration → "Connect Stripe to get started" [Connect Stripe]
Has Stripe, no invoices → "Syncing invoices... or upload CSV" [Import CSV]
Has invoices, agent never run → "Run agent to start recovering" [Run Agent Now]  
Agent running, no recoveries → "Agent working — first email sent today"
Has recoveries → Full dashboard (normal)
Improvement 2: Customer Reply Detection / Dispute Handling
Add "Do Not Contact" flag on invoices/customers:

UI: Invoice detail → 3-dot menu → "Mark as Disputed" / "Mark as Uncollectable"
Agent loop: Skip invoices marked disputed/uncollectable
Auto-detect: If invoice status = 'disputed', stop sending emails
Improvement 3: Better Reports Page
Reports page already has chart but needs:

Period selector: 7d / 30d / 90d / 12m (already exists)
Show totals: "You've recovered $142,000 total across 67 invoices"
Per-email-type stats: "Email #3 (payment plan offer) has 68% response rate"
Improvement 4: Activity Feed Real-Time Feel
Activity page shows email logs but feels static. Improvements:

Show agent run history (when it ran, what it did)
Color-coded by email type (friendly=green, urgent=red)
Click email log → expand to see email body that was sent
Real-time updates (poll every 30s or WebSocket)
PHASE 4 — P3 Nice-to-Haves (Post-Launch)
Smart Email Timing

// In dunningQueue.ts, before sending:
const customerTimezone = customer.timezone || 'America/New_York';
const customerHour = new Date().toLocaleString('en-US', {timeZone: customerTimezone, hour: 'numeric', hour12: false});

if (customerHour < 8 || customerHour > 17) {
  // Delay until 9 AM their time
  const delayMs = calculateDelayTo9AM(customerTimezone);
  job.opts.delay = delayMs;
}
A/B Testing Email Copy

// In emailService.ts
const variant = Math.random() < 0.5 ? 'A' : 'B';
const tone = variant === 'A' ? 'professional' : 'empathetic';
await db.emailLogs.create({ ..., ab_variant: variant });

// Track: which variant gets higher payment rate
Part 6: UI Component Inventory + What Needs Building
Currently Built ✅

Pages:
├── Landing.tsx           ✅ (hero, features, testimonials, CTA)
├── Pricing.tsx           ✅ (3 tiers, success fee explainer)
├── Dashboard.tsx         ✅ (4 KPI cards, 2 charts, risk table, "Run Agent")
├── Invoices.tsx          ✅ (table, filters, CSV upload, sync button)
├── InvoiceDetail.tsx     ✅ (tabs: detail/payments/emails/plan)
├── Customers.tsx         ✅ (paginated list)
├── Reports.tsx           ✅ (timeline chart, CSV export, period selector)
├── Activity.tsx          ✅ (email logs + queue stats)
├── Billing.tsx           ✅ (plans, subscription, usage, invoices)
├── Settings.tsx          ✅ (integration + dunning + slack + general)
├── Onboarding.tsx        ✅ (5-step wizard)
└── Auth pages            ✅ (login/signup/forgot/google oauth)

Components:
├── StatsCard             ✅
├── RecoveryChart         ✅
├── RiskBreakdownChart    ✅
├── TopCustomersTable     ✅
├── InvoiceTable          ✅
├── FilterBar             ✅
├── BulkActions           ✅
├── EmailPreviewModal     ✅
├── CSVUploadModal        ✅
├── ManualInvoiceModal    ✅
├── DashboardSkeleton     ✅
└── Toast system          ✅
Needs to be Built ❌

Pages:
├── StripeCallback.tsx        ❌ (handles /stripe/oauth/callback)
└── Unsubscribe.tsx           ❌ (handles /unsubscribe?token=xxx)

Components:
├── AgentRunResult.tsx        ❌ (modal showing agent run summary)
└── InstallmentTracker.tsx    ❌ (payment plan progress in InvoiceDetail)

Backend endpoints:
├── GET /api/email/track/open    ❌
├── GET /api/email/track/click   ❌
└── POST /api/customers/:id/do-not-contact  ❌
Part 7: Launch Checklist
Technical (1-2 days)

[ ] P0: Add /stripe/oauth/callback route + StripeCallback.tsx page
[ ] P0: Seed recovery_timeline in demoController.ts (30 days of data)
[ ] P0: Add unsubscribe link to all emails + /unsubscribe page
[ ] P0: Return agent summary from POST /api/dashboard/agent/trigger
[ ] P1: Email open/click tracking (pixel + click wrapper + 2 endpoints)
[ ] P1: Recovery fee calculation in billing
[ ] P1: Integration last_synced_at tracking
[ ] P1: Payment plan installment auto-charge cron
Configuration (2 hours)

[ ] ANTHROPIC_API_KEY set in production .env
[ ] RESEND_API_KEY set (email sending works)
[ ] STRIPE_CLIENT_ID + STRIPE_CLIENT_SECRET (for OAuth)
[ ] STRIPE_WEBHOOK_SECRET (for payment tracking)
[ ] FRONTEND_URL set correctly (for CORS + OAuth redirects)
[ ] BACKEND_URL set correctly (for QB OAuth callbacks)
[ ] LEMON_SQUEEZY_* keys (for billing)
Demo Prep (30 min)

[ ] Visit /landing → click "Try Demo" → verify dashboard loads with data
[ ] Verify: $87k+ AR shown, charts populated, risk table has 3+ customers
[ ] Click "Run Agent Now" → verify meaningful response message
[ ] Click invoice → verify email preview modal works (shows AI-generated email)
[ ] Reports page → verify timeline chart shows 30 days of data
[ ] Settings → verify Stripe connect button → complete OAuth flow
Go-To-Market (parallel track)

[ ] Apollo.io/Crunchbase: Build list of 300 SaaS founders ($2-5M ARR)
[ ] Cold email template drafted (curiosity hook, no pitch)
[ ] Week 1: 15 emails/day, track replies
[ ] Book: 3-5 demo calls in week 2
[ ] Demo script: show "Try Demo" live → walk through recovery flow
[ ] Pilot offer: "2 weeks free, then $2.5k/mo + 1% of recovery"
Part 8: Priority Build Order (Next 7 Days)

DAY 1 (3 hours):
├── Add StripeCallback.tsx page + route
├── Seed recovery_timeline in demoController
└── Fix agent trigger to return summary

DAY 2 (4 hours):
├── Add unsubscribe link to email template
├── Build /unsubscribe page + POST /api/customers/:id/unsubscribe endpoint
└── Add last_synced_at to integration status display

DAY 3-4 (6 hours):
├── Email open tracking pixel
├── Email click tracking wrapper
└── GET /api/email/track/open + /click endpoints

DAY 5 (3 hours):
├── Recovery fee calculation in billing
└── Update Billing.tsx to show base + success fee breakdown

DAY 6 (2 hours):
├── Improve empty states on Dashboard
└── Polish demo flow (verify end-to-end)

DAY 7:
└── Start cold outreach (300 leads → 15 emails)
Summary
Bottom line: Backend is complete and solid. Frontend has all pages. 4 things block the demo from working:

/stripe/oauth/callback page missing → customer connecting Stripe hits 404
Reports shows empty chart (no recovery_timeline seed data for demo)
No email unsubscribe link → legal violation
Agent trigger returns no useful feedback
Fix those 4 (1-2 days), do the email tracking improvements (2-3 days), and the product is demo-ready for real customers. The NEXT.txt file is right — the product is largely done, the bottleneck is outreach, not code. But fix the 4 blocking bugs first so the demo doesn't embarrass you.