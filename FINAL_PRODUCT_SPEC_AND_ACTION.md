# CashOS FINAL PRODUCT SPEC — Audit → Trial → Paid Flow
**Status**: READY TO EXECUTE | **Date**: 2026-03-30

---

# PART 1: WHAT TO BUILD (And What NOT To Build)

## ✅ BUILD THIS (Audit → Trial → Paid MVP)

### **AUDIT FLOW** (Free Entry Point)
```
User lands → "Start Free Audit"
├─ Signup (email + password)
├─ OTP verification
├─ "Connect Stripe" (OAuth)
├─ Auto-analyze invoices
└─ See audit results + "Start 14-Day Trial" CTA

Status: ✅ DONE (GenerateAudit.tsx + backend)
Need: Just polish UI, ensure data flows correctly
```

### **TRIAL FLOW** (14 Days, No Credit Card)

```
User clicks "Start Trial"
├─ Backend: Sets trial_active stage + trial_ends_at (14d from now)
├─ Frontend: Refresh auth context (company data)
├─ Navigate to /dashboard
└─ Show FULL CASH OS EXPERIENCE

Features ENABLED in Trial:
├─ 💰 CashPositionWidget (Hero, top of page)
│  └─ Real-time cash balance, runway in weeks, status badge
├─ 📊 13-Week Forecast Chart
│  └─ Auto-calculated, shows when cash = $0
├─ 🎯 3 Scenario Buttons (Interactive)
│  ├─ "Growth -20%" → shows new runway
│  ├─ "Growth -50%" → shows worst case
│  └─ "Hire 5 people" → shows impact
├─ 💸 Payables Tracker
│  └─ Add/edit/delete bills, grouped by week
├─ 📋 Invoice Health (Read-Only)
│  └─ From Stripe: Unpaid, overdue, DSO
├─ ✉️ Weekly Update Form
│  └─ Adjust growth rate, payroll, expenses
├─ 📧 Daily Email Digest (Optional)
│  └─ Cash position + forecast + bills due
└─ [Prominent] "Upgrade to SEED Tier - $2.5K/month" button

Status: ✅ MOSTLY DONE (components exist, need polish + gating)
Need:
  - Dashboard reorganization (cash hero)
  - Feature gating (hide paid-only features)
  - Trial banner (days remaining)
```

### **PAID FLOW** (After Upgrade via Razorpay)

```
User clicks "Upgrade to SEED Tier"
├─ Redirect to /checkout
├─ Razorpay payment form ($2.5K/month)
├─ On success:
│  ├─ Set company.account_type = 'paid'
│  ├─ Remove trial_ends_at
│  ├─ Remove trial banner
│  └─ Unlock paid features
└─ Redirect to dashboard + "Welcome to SEED" toast

Features NOW UNLOCKED:
├─ QB Integration (start syncing payables)
├─ Email Dunning (send payment reminders)
├─ Advanced Reports (custom date ranges)
├─ Multiple Users (team access)
└─ API Access (programmatic data)

Status: ❌ NOT DONE YET (Razorpay integration needed)
Timeline: Week 2 (after first 3 customers)
```

---

## ❌ DON'T BUILD YET (Phase 2+)

```
❌ QB Integration
├─ Reason: Phase 2 (Month 3-6), not MVP
├─ When: After 3-5 STARTER customers ask for it
├─ Effort: 2-3 weeks, worth waiting
└─ Unlock: $6K/month GROWTH tier

❌ Email Dunning (Smart)
├─ Reason: Phase 2, nice to have
├─ When: Month 3-6
├─ Current: Basic Stripe dunning is enough
└─ Unlock: AR recovery for GROWTH tier

❌ Agentic AI Features
├─ Reason: Phase 3 (Month 6+)
├─ When: After customers are sticky
├─ Examples: Smart payables prioritization, auto-reconciliation
└─ Unlock: Automation upgrade for SCALE tier

❌ Embedded Finance
├─ Reason: Phase 4 (Month 9-12)
├─ When: Customer ready for Series A
├─ Examples: Payment optimization, lending access
└─ Unlock: $12K/month SCALE tier

❌ Advanced Scenarios
├─ Reason: Nobody uses them in trial
├─ When: If customer specifically asks
└─ Reality: 3 buttons are enough

❌ Mobile App
├─ Reason: Desktop only for MVP
└─ When: Year 2+

❌ Slack Integration
├─ Reason: Nice to have, not core
└─ When: Phase 2
```

---

# PART 2: FINALIZED AUDIT → TRIAL → PAID FLOW

## **The Exact User Journey**

### **Day 0: Landing Page**
```
User arrives at landing.cashOS.com

Sees:
├─ Hero: "Know Exactly When You'll Run Out of Cash"
├─ Subheading: "14-day free audit. Real data from Stripe."
├─ CTA: [Start Free Audit]
└─ Social proof: "Used by 50+ seed founders"

Backend: None yet (static landing page)
```

### **Day 0-1: Signup**
```
User clicks [Start Free Audit]
├─ Route: /signup
├─ Form:
│  ├─ Email
│  ├─ Password
│  └─ Company Name
├─ Backend POST /api/auth/signup:
│  ├─ Create user (email, password hashed)
│  ├─ Create company (name, onboarding_stage = 'integrations')
│  ├─ Send OTP email
│  └─ Return auth tokens
├─ Frontend: Store tokens, redirect to /otp
└─ Status: ✅ DONE
```

### **Day 0-1: OTP Verification**
```
User enters OTP from email
├─ Route: /otp
├─ Form: [Enter OTP from email]
├─ Backend POST /api/auth/verify-email:
│  ├─ Validate OTP (10-min expiry)
│  ├─ Update company.onboarding_stage = 'integrations'
│  ├─ Return success
│  └─ Auto-login (refresh tokens)
├─ Frontend:
│  ├─ Store tokens
│  ├─ Update auth context
│  └─ Redirect to /integrations
└─ Status: ✅ DONE
```

### **Day 0-2: Choose Integration**
```
User selects data source
├─ Route: /integrations
├─ Options:
│  ├─ [Connect Stripe] (OAuth)
│  └─ [Upload CSV] (manual invoices)
├─ If Stripe:
│  ├─ OAuth flow → user grants permission
│  ├─ Backend stores encrypted API key
│  ├─ Trigger: stripeService.syncInvoices() in background
│  └─ Takes 5-30 seconds
├─ If CSV:
│  ├─ Upload file
│  ├─ Parse with smart column detection
│  ├─ Create invoices in DB
│  └─ Takes 10-30 seconds
├─ Then: Click [Proceed] → Route to /generate-audit
└─ Status: ✅ DONE (both paths working)
```

### **Day 0-2: Generate Audit Analysis**
```
User clicks [Proceed] → Goes to /generate-audit
├─ Route: /generate-audit
├─ Backend: GET /api/audits/generate
│  ├─ Fetch all invoices from DB
│  ├─ Calculate metrics:
│  │  ├─ Total invoiced, unpaid, overdue
│  │  ├─ Aging buckets (0-30, 31-60, 61-90, 90+)
│  │  ├─ Customer concentration (80/20 rule)
│  │  ├─ High-risk invoices (30+ days, $50K+)
│  │  ├─ Duplicates (smart detection)
│  │  └─ Trend analysis
│  └─ Return JSON with all metrics
├─ Frontend:
│  ├─ Display: "Cash Health Overview" card
│  │  ├─ Total invoiced: $X
│  │  ├─ Unpaid: $Y
│  │  ├─ Overdue: $Z
│  │  ├─ Avg days late: N days
│  │  ├─ Duplicates found: N invoices
│  │  └─ Billing errors: $RISK at risk
│  ├─ Display: "Key Findings"
│  │  ├─ Trend (improving/worsening/stable)
│  │  ├─ Concentration (top 2 customers = X% of revenue)
│  │  ├─ High-risk invoices (N invoices needing attention)
│  │  └─ Top action items
│  └─ CTA: [Start 14-Day Free Trial]
└─ Status: ✅ DONE (metrics working, UI needs polish)
```

### **Day 1: Start Trial**
```
User clicks [Start 14-Day Free Trial]
├─ No credit card required
├─ Backend POST /api/audits/trial/start:
│  ├─ Update company.onboarding_stage = 'trial_active'
│  ├─ Set trial_starts_at = NOW
│  ├─ Set trial_ends_at = NOW + 14 days
│  ├─ Create forecast_assumptions (default values)
│  ├─ Create payables (empty, ready for user input)
│  └─ Return success
├─ Frontend (generateAuditController.ts):
│  ├─ Call GET /api/auth/me (refresh company data)
│  ├─ Update auth context with trial_active stage
│  ├─ Navigate to /dashboard
│  └─ Show success toast: "🎉 Trial activated!"
├─ Landing on /dashboard:
│  ├─ Check onboarding_stage = 'trial_active' ✅
│  ├─ Show FULL dashboard experience
│  └─ Display trial banner (14 days remaining)
└─ Status: ✅ DONE (flow working end-to-end)
```

### **Days 2-14: Trial Experience**
```
User in trial dashboard
├─ CAN USE:
│  ├─ ✅ Cash Position card (real-time balance)
│  ├─ ✅ 13-Week Forecast (auto-calculated)
│  ├─ ✅ 3 Scenario buttons (interactive)
│  ├─ ✅ Payables tracker (add/edit/delete)
│  ├─ ✅ Invoice health (read-only)
│  ├─ ✅ Weekly update form (adjust assumptions)
│  └─ ✅ Daily email (optional)
├─ CANNOT USE (Feature gated):
│  ├─ ❌ QB integration (button disabled)
│  ├─ ❌ Advanced reports (locked)
│  ├─ ❌ Multiple users (invite disabled)
│  └─ ❌ API access (not shown)
├─ SEES (Trial Banner):
│  ├─ Days remaining countdown
│  ├─ Prominent [Upgrade to SEED Tier] button
│  └─ Hint: "Unlock QB sync when you upgrade"
└─ Status: ✅ DASHBOARD DONE (needs polish)
```

### **Day 14: Upgrade Decision**
```
Trial expires in 0 days
├─ Banner turns RED: "⏰ Your trial expires TODAY"
├─ Dashboard becomes READ-ONLY (all features disabled)
├─ User MUST upgrade or lose access
├─ CTA: [Upgrade to SEED Tier - $2.5K/month]
└─ If no action: Account frozen (can still login, no data access)

User clicks [Upgrade]
├─ Route: /checkout
├─ Razorpay payment form
│  ├─ Amount: $2.5K/month
│  ├─ Currency: USD
│  ├─ Description: "CashOS SEED Tier"
│  └─ On success:
│     ├─ Backend updates company.account_type = 'paid'
│     ├─ Backend removes trial_ends_at
│     ├─ Dashboard unlocks all features
│     └─ Email sent: "Welcome to CashOS SEED"
└─ Status: ❌ RAZORPAY NOT DONE YET (Week 2)
```

### **After Upgrade: Paid Experience**
```
User now on GROWTH tier
├─ Same dashboard, UNLOCKED:
│  ├─ ✅ QB Integration button (syncs payables)
│  ├─ ✅ Advanced Reports (custom date ranges)
│  ├─ ✅ Multiple Users (invite team)
│  ├─ ✅ API Access (webhooks, programmatic)
│  └─ ✅ Email Dunning (optional, payment reminders)
├─ New sections visible:
│  ├─ QB Connection status card
│  ├─ Advanced analytics dashboard
│  ├─ Team management section
│  └─ Usage API section
└─ Expansion opportunity: Upgrade to $6K GROWTH or $12K SCALE
```

---

# PART 3: WHAT'S LEFT TO DO (Before First Customer)

## **THIS WEEK (3 Days of Work)**

### **1. Dashboard Reorganization** (6 hours)
```
File: frontend/src/pages/Dashboard.tsx

CURRENT LAYOUT (AR-focused):
├─ KPI Banner (AR metrics)
├─ Recovery timeline
├─ Risk drivers
└─ Dunning analytics

NEW LAYOUT (Cash-focused):
├─ [Conditional] Trial banner (if trial_active)
├─ 💰 CashPositionWidget (HERO - top, big)
│  └─ Real-time balance, runway, status
├─ 📊 13-Week Forecast Chart (second priority)
│  └─ Line chart, runway end date highlighted
├─ 🎯 3 Scenario Buttons (third priority)
│  ├─ [Growth -20%?] [Growth -50%?] [Hire N?]
│  └─ Results update chart above
├─ 💸 PayablesTracker component
│  └─ Bills due this week, next week, 30d
├─ 📋 Invoice Health card (read-only)
│  └─ Total invoiced, unpaid, overdue, DSO
├─ ✉️ Weekly Update Form section
│  └─ [Open Form] → Modal to adjust assumptions
└─ [If paid] QB Status + Advanced Analytics sections

Changes:
├─ Hide AR recovery sections (use feature gating)
├─ Move CashPositionWidget to top
├─ Use CSS Grid (not legacy layout)
├─ Add conditional rendering: trial_active vs paid_active
└─ Dark mode support (already works)

Checklist:
- [ ] CashPositionWidget shows real balance
- [ ] Forecast chart updates when scenarios clicked
- [ ] Payables shows grouped data correctly
- [ ] Invoice health shows Stripe data
- [ ] Weekly form updates forecast
- [ ] All components render without errors
- [ ] Dark mode works
```

### **2. Feature Gating System** (4 hours)
```
File: frontend/src/lib/featureGate.ts (NEW)

export const canUseFeature = (feature: string, company: Company): boolean => {
  const isPaid = company.account_type === 'paid' || company.trial_ends_at === null;
  const isTrial = company.trial_ends_at && new Date(company.trial_ends_at) > new Date();

  const features = {
    'cash_visibility': true,  // Everyone
    'forecast': true,  // Everyone
    'scenarios': true,  // Everyone
    'payables_view': true,  // Everyone
    'payables_persistence': isPaid,  // Paid only
    'invoice_export': isPaid,  // Paid only
    'qb_integration': isPaid,  // Paid only
    'email_dunning': isPaid,  // Paid only
    'advanced_reports': isPaid,  // Paid only
    'multiple_users': isPaid,  // Paid only
    'api_access': isPaid,  // Paid only
  };
  return features[feature] ?? false;
};

Usage in components:
{canUseFeature('qb_integration', company) && <QBStatus />}
{canUseFeature('multiple_users', company) && <InviteTeam />}

Checklist:
- [ ] Feature gating function works
- [ ] Buttons are disabled for trial users
- [ ] Sections are hidden for trial users
- [ ] No API calls if user doesn't have access
- [ ] Error handling if user bypasses gating
```

### **3. Trial Banner + Upgrade CTA** (3 hours)
```
File: frontend/src/components/TrialBanner.tsx (NEW)
File: frontend/src/components/dashboard/UpgradeCard.tsx (NEW)

TrialBanner.tsx:
├─ Shows only if company.trial_ends_at is set
├─ Displays: "🎉 Trial Active - X days remaining"
├─ Shows countdown timer
├─ Prominent [Upgrade to SEED Tier] button
├─ Color changes: Green (>7 days) → Yellow (3-7 days) → Red (<3 days)
└─ On last day: "⏰ Your trial expires TODAY"

UpgradeCard.tsx:
├─ Shows only if trial_active
├─ Headline: "Ready to go deeper?"
├─ Sub: "Unlock QB sync, team access, and advanced reports"
├─ Feature list:
│  ├─ ✅ Real-time QB payables sync
│  ├─ ✅ Invite team members
│  ├─ ✅ Advanced analytics & reports
│  ├─ ✅ Email payment reminders
│  └─ ✅ API access for integrations
├─ Price: "$2.5K/month"
├─ CTA: [Upgrade to SEED Tier - $2.5K/month]
└─ Subtext: "Same features + QB + Team + Reports"

Checklist:
- [ ] Banner shows correct days remaining
- [ ] Banner colors change based on days left
- [ ] Upgrade card shows only in trial
- [ ] Upgrade button works (redirects to /checkout)
- [ ] Dark mode works
```

### **4. Polish Email Digest Template** (2 hours)
```
File: backend/src/templates/emailDigest.ts (UPDATE)

Current: AR recovery focused
New: Cash-focused

Subject: "☀️ Your CashOS Brief — $250K cash, 8 weeks runway"

Content:
├─ Header: "Good morning, [Founder]"
├─ Section 1: Cash Position
│  ├─ "Your cash balance: $250K"
│  ├─ "Updated: 2 hours ago from your bank"
│  └─ "Change from yesterday: +$15K (good!)"
├─ Section 2: Runway
│  ├─ "Runway: 8 weeks until $0"
│  ├─ "Action: Start fundraising by week 6"
│  └─ "Status: Healthy (3-6 month = good)"
├─ Section 3: This Week's Bills
│  ├─ "Total due: $15,000"
│  ├─ "Payroll (Fri): $8,000"
│  ├─ "AWS (Wed): $2,500"
│  └─ "Rent (Mon): $1,500"
├─ Section 4: Invoices
│  ├─ "Unpaid: $47K (from 8 customers)"
│  ├─ "Overdue (>30d): $12K (needs attention)"
│  └─ "DSO: 35 days (industry avg: 40 days)"
├─ Section 5: Forecast Accuracy
│  ├─ "Last week's forecast accuracy: 92%"
│  ├─ "Trend: Improving (+3% from week before)"
│  └─ "Next week's prediction: $245K cash"
├─ CTA: [View Dashboard] [Update Weekly Forecast] [Unsubscribe]
└─ Send time: 09:00 UTC daily

Checklist:
- [ ] Template uses real cash data
- [ ] Template uses real forecast
- [ ] Template shows bills from payables tracker
- [ ] Template shows invoice data from Stripe
- [ ] Unsubscribe link works
- [ ] Dark mode template looks good
```

---

## **Summary: What's Done vs What's Left**

| Component | Status | When |
|-----------|--------|------|
| Audit flow (signup → OTP → Stripe → generate) | ✅ DONE | Use now |
| Trial flow (create trial account) | ✅ DONE | Use now |
| Dashboard components (cash, forecast, scenarios, payables) | ✅ DONE | Use now |
| Trial state sync (company data refresh) | ✅ DONE | Use now |
| Stripe sync + smart CSV detection | ✅ DONE | Use now |
| Dashboard reorganization (cash hero) | ⏳ 6 hours | This week |
| Feature gating (trial vs paid) | ⏳ 4 hours | This week |
| Trial banner + upgrade CTA | ⏳ 3 hours | This week |
| Email digest template (cash-focused) | ⏳ 2 hours | This week |
| Razorpay checkout integration | ❌ NOT DONE | Week 2 (after 3 customers) |
| QB integration | ❌ NOT DONE | Month 3-6 (Phase 2) |
| Email dunning | ❌ NOT DONE | Month 3-6 (Phase 2) |
| Agentic features | ❌ NOT DONE | Month 6+ (Phase 3) |

---

# PART 4: YOUR COLD EMAIL TEMPLATE

## **The Email That Closes Customers**

```
Subject: "CashOS — Real cash visibility for founders (2-min demo?)"

---

Hi [Founder Name],

I know you just raised [Series A/Seed in Feb/Q1 2026].

With tight funding and a 6-month Series A process ahead,
I'm guessing you don't have time to manually track cash
in Excel every week.

That's why I built CashOS.

It connects Stripe + QuickBooks + your bank account,
and shows you in ONE dashboard:

├─ Exactly how much cash you have (updated hourly)
├─ Exactly when you'll run out (13-week forecast)
├─ What happens if growth drops 20% or 50%
├─ Which bills you need to pay first (payables prioritization)
└─ Board-ready charts for your next investor meeting

We're giving early access to 10 founders for free.

Would you want a 20-min demo? No sales pitch, just:
- You share screen
- I show the 3-minute setup
- You see your real cash position in real-time

If you like it, you get first month for $500 (normally $3.5K).

[Link to demo calendar]

If not interested, no worries. I'll figure out
why cash forecasting doesn't matter yet 😅

Either way, worth 20 minutes?

Best,
[Your name]
P.S. — We already work with 3 other seed founders who raised in Q4 2025.
All said the same thing: "Wish I built this myself."
```

---

# PART 5: CUSTOMER ACQUISITION ROADMAP

## **Week 1: Book Demos**

```
GOAL: Talk to 30 founders from your list

HOW:
├─ Send cold email to top 50 companies (Series A, seed, B2B SaaS)
├─ Use warm intros where possible (3x higher response)
├─ Expect 10-15% response rate (5-7 replies)
├─ Book 30-min demos with replies
├─ Aim for 5-10 demos booked by Friday
└─ Each demo: "Show 3-minute setup, get feedback, close"

TARGETING:
├─ Series A funded (last 6 months) = cash anxiety
├─ $1M-$5M ARR = can pay $3.5K/month
├─ B2B SaaS = use Stripe + QB
├─ Tech-first founders = adopt quickly
└─ From your 2,000-company list (filter: Series A stage)

SUCCESS METRIC:
├─ 30% demo → closed conversion = 3 customers from 10 demos
└─ Target: 3 customers × $3.5K = $10.5K MRR by Month 1
```

## **Week 2-4: Close 3 Customers**

```
GOAL: Get 3 paid customers ($10.5K MRR)

CLOSING SCRIPT:
├─ After demo: "Does this solve your biggest pain?"
├─ If yes: "Great. I'm offering first 3 customers a deal..."
├─ Offer: "$3.5K/month, but $1K for first month (to get started)"
├─ OR: "First month free if you commit to 3 months"
├─ Get credit card info (use Stripe)
├─ Send onboarding email
├─ First call: 30-min setup
└─ Metric: Did they use it Day 1? (yes = sticky)

WHAT THEY CARE ABOUT:
├─ "How much runway do I have?" (main pain)
├─ "When should I start fundraising?" (board conversation)
├─ "Where is my cash really going?" (operational)
└─ NOT: "How are my AR metrics?" (they'll ask if interested)

IF THEY SAY NO:
├─ "What would make this useful?"
├─ "What feature is missing?"
├─ "What's your biggest cash pain right now?"
├─ Take feedback, iterate, ask again next week
└─ Most rejections are timing (not product)
```

---

# FINAL CHECKLIST: BEFORE FIRST CUSTOMER

**By End of Week 1:**
- [ ] Dashboard reorganized (cash hero, responsive)
- [ ] Feature gating works (trial sees all, hides lock icons)
- [ ] Trial banner shows countdown
- [ ] Upgrade card shows $2.5K/month offer
- [ ] Email template updated (cash metrics)
- [ ] Cold email template ready
- [ ] Founder list filtered (2,000 → 50 Series A targets)
- [ ] 10 emails sent to top targets
- [ ] 5+ demos booked

**By End of Week 2:**
- [ ] 5-10 demos completed
- [ ] Feedback collected (what features matter?)
- [ ] 1-2 customers signed up
- [ ] Razorpay checkout integrated (ready for payment)

**By End of Month 1:**
- [ ] 3 customers at $3.5K/month = $10.5K MRR
- [ ] Testimonials recorded ("Saved me 10 hours/month")
- [ ] Customer usage data analyzed
- [ ] Clear picture of what to build next

---

# SUCCESS = You Have 3 Paying Customers by Month 1

Everything else is execution.

🚀
