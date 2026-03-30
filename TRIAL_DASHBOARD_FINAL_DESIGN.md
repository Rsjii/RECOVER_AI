# CashOS Trial Dashboard — FINAL UI/UX DESIGN
**Status**: DESIGN DOCUMENT | **Date**: 2026-03-30

---

## EXECUTIVE SUMMARY

Trial dashboard is **CASH-FOCUSED**, single-page vertical scroll layout (no tabs). All sections use **Collapsible Cards** for expandability.

**Hero Section** → **Core Features** → **Scenarios** → **Bills** → **Forecast** → **Risks & Insights**

---

## 🎯 SIDEBAR NAVIGATION — TRIAL vs PAID (CRITICAL DECISION)

### **TRIAL USER SIDEBAR (4 visible tabs)**
```
CashOS — Free Trial (10 days remaining)

✅ WORKSPACE
   ├─ 📊 Dashboard (cash-focused hero)
   ├─ 📋 Invoices (read-only from Stripe)
   └─ [👥 Customers] HIDDEN (AR recovery feature)

❌ OPERATIONS (Entire section hidden)
   ├─ [⚡ Activity] HIDDEN (paid feature)
   ├─ [📈 Reports] HIDDEN (paid feature)
   └─ [✉️ Email Queue] HIDDEN (paid feature)

⚠️ BUSINESS
   └─ 💳 Billing (read-only, shows upgrade CTA)

✅ ADMIN
   └─ ⚙️ Settings (integrations config)
```

---

### **PAID USER SIDEBAR (All 9 tabs visible)**
```
CashOS — Active ($3.5K/month)

✅ WORKSPACE
   ├─ 📊 Dashboard (all features unlocked)
   ├─ 📋 Invoices (with dunning, export)
   └─ 👥 Customers (AR recovery, risk scoring)

✅ OPERATIONS
   ├─ ⚡ Activity (agent/dunning tracking)
   ├─ 📈 Reports (advanced analytics)
   └─ ✉️ Email Queue (campaign management)

✅ BUSINESS
   └─ 💳 Billing (manage subscription)

✅ ADMIN
   ├─ ⚙️ Settings (all config)
   └─ 🔐 Admin (if user is admin)
```

---

### **WHY THIS STRUCTURE?**

**Trial users hidden tabs**: Customers, Activity, Reports, Email Queue
- ❌ These are AR recovery features (not cash forecasting)
- ❌ These are paid-only features
- ✅ Hiding them keeps trial experience clean & focused

**Trial users visible tabs**: Dashboard, Invoices, Billing, Settings
- ✅ Dashboard: Core value (cash visibility + forecast)
- ✅ Invoices: Shows pending payments from Stripe
- ✅ Billing: Trial countdown + upgrade CTA
- ✅ Settings: Integrations (Stripe OAuth, QB setup)

---

## COMPONENT INVENTORY (What Exists)

### ✅ READY TO USE (Already built)
| Component | Location | Purpose | Trial Use |
|-----------|----------|---------|-----------|
| PayablesTracker | dashboard/ | Add/edit/delete bills | ✅ Core feature |
| WeeklyUpdateForm | dashboard/ | Adjust assumptions | ✅ Core feature |
| CashFlowSection | dashboard/ | Forecast + runway | ✅ Can use |
| RunwayWidget | dashboard/ | Weeks until $0 | ✅ In hero |
| CashPositionWidget | dashboard/ | Cash balance | ✅ In hero |
| WhatIfWidget | dashboard/ | 3 scenarios | ✅ Core feature |
| CashLeakageWidget | dashboard/ | Cash burn analysis | ⚠️ Maybe optional |
| CollapsibleSection | dashboard/ | Expandable cards | ✅ Layout wrapper |

### ❌ DON'T USE (AR recovery)
- KPIBanner, RecoveryFunnelInteractive, BusinessImpactGrid
- AtRiskCustomersSection, AgentActivitySection, VoiceStatsCard
- DashboardDetailTabs, RiskDriversSection

---

## FINAL TRIAL DASHBOARD LAYOUT

### **PAGE STRUCTURE: Single-Page Vertical Scroll**

```
┌─────────────────────────────────────────────────────────────┐
│  [Header: "Dashboard" + Date]                               │
├─────────────────────────────────────────────────────────────┤
│  [SECTION 1: TRIAL BANNER]                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🎉 Trial Active - 12 days remaining [███████░░]  50%   ││
│  │                                  [Upgrade to SEED] →    ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  [SECTION 2: CASH HERO - Always Expanded]                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 💰 CASH POSITION OVERVIEW                               ││
│  ├──────────────────┬──────────────────┬──────────────────┤│
│  │ Available Cash   │ Runway           │ Pending Bills    ││
│  │ $250K            │ 8 weeks          │ $15K due         ││
│  │ ↑ from yesterday │ ⚠️ < 90 days     │ this week        ││
│  └──────────────────┴──────────────────┴──────────────────┘│
│  │ Collection Health: 82% (DSO: 35 days)                    ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  [SECTION 3: BILLING ISSUES (If Any)]                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ⚠️ BILLING ISSUES DETECTED: $25K at Risk                ││
│  ├──────┬──────┬────────┬───────┤                          ││
│  │ Dups │Spikes│Failed  │Gaps   │                          ││
│  │  2   │  1   │  3     │  1    │                          ││
│  │ $4K  │ $8K  │ $10K   │ $3K   │                          ││
│  └──────┴──────┴────────┴───────┘                          ││
│  💡 Fix these first to improve runway                        ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  [SECTION 4: PAYABLES TRACKER - Expandable]                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ▶ 💸 PAYABLES & BILLS                                   ││
│  │   [+ Add Bill] [Summary: $15K due, 3 items]             ││
│  │   [Click to expand: Add/edit/delete bills]              ││
│  │   When expanded:                                        ││
│  │   ├─ THIS WEEK (Mon 3/31 - Sun 4/6)                    ││
│  │   │  ├─ Payroll (Fri 4/4): $8,000 payroll              ││
│  │   │  ├─ AWS (Wed 4/3): $2,500 cloud                    ││
│  │   │  └─ Rent (Mon 3/31): $1,500 rent                   ││
│  │   ├─ NEXT WEEK (Mon 4/7 - Sun 4/13)                    ││
│  │   │  ├─ Payroll (Fri 4/11): $8,000 payroll             ││
│  │   │  └─ Internet (Tue 4/8): $150 other                 ││
│  │   └─ 30+ DAYS                                           ││
│  │      ├─ Annual insurance (Jun 15): $5,000 other         ││
│  │      └─ Office lease (May 1): $3,000 rent               ││
│  │                                                          ││
│  │   [Modal Form: Add/Edit Bill]                           ││
│  │   - Vendor name                                         ││
│  │   - Amount                                              ││
│  │   - Due date                                            ││
│  │   - Category [Payroll/Rent/Cloud/Marketing/Other]       ││
│  │   - Notes                                               ││
│  │   [Save] [Cancel]                                       ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  [SECTION 5: WEEKLY UPDATE FORM - Expandable]               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ▶ 📊 ADJUST FORECAST                                    ││
│  │   [Last updated: Yesterday at 3:45 PM]                 ││
│  │   [Click to expand: Modify assumptions]                ││
│  │   When expanded:                                        ││
│  │   ├─ Growth Rate: [0]% per month                        ││
│  │   │  └─ Affects: Monthly revenue projection             ││
│  │   ├─ Payroll: [$8,000] per month                        ││
│  │   │  └─ Affects: Expense forecast                       ││
│  │   ├─ Other Expenses: [$3,500] per month                 ││
│  │   │  └─ AWS + utilities + contractors                   ││
│  │   ├─ Notes: [Your custom notes here]                    ││
│  │   │  └─ What changed this week?                         ││
│  │   └─ [Save Changes]                                     ││
│  │   💡 Forecast updates automatically when you change     ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  [SECTION 6: 13-WEEK FORECAST CHART - Expandable]           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ▶ 📈 13-WEEK CASH FORECAST                              ││
│  │   [Trend: STABLE ▬] [Next 90d: $245K → $120K]          ││
│  │   When expanded:                                        ││
│  │   ┌─────────────────────────────────────────────────┐  ││
│  │   │  [Chart: Line chart with confidence band]       │  ││
│  │   │   $400K ┤     ╱╲___                             │  ││
│  │   │   $300K ├ ╱╲╱     ╲__                           │  ││
│  │   │   $200K ├                ╲___                   │  ││
│  │   │   $100K ├                    ╲___               │  ││
│  │   │      $0 ├───────────────────────── X (Week 13)  │  ││
│  │   │         └─────────────────────────────────      │  ││
│  │   │          W1  W2  W3 ... W12 W13                 │  ││
│  │   └─────────────────────────────────────────────────┘  ││
│  │                                                          ││
│  │   📌 Runway Status:                                     ││
│  │   • Today: $250K cash, 8 weeks runway                   ││
│  │   • Week 4: $200K cash, 5 weeks runway                  ││
│  │   • Week 8: $100K cash, 1 week runway ⚠️                ││
│  │   • Week 13: $0 cash 🚨                                 ││
│  │                                                          ││
│  │   💡 Start fundraising by Week 8                        ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  [SECTION 7: SCENARIO TESTING - Expandable]                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ▶ 🎯 WHAT-IF SCENARIOS                                  ││
│  │   [Test different growth rates to see impact]          ││
│  │   When expanded:                                        ││
│  │   ┌─────────────────────────────────────────────────┐  ││
│  │   │ [Button] Growth -20%                            │  ││
│  │   │ 📊 Impact: Runway 8w → 6w (lose 2 weeks)        │  ││
│  │   │    Week 8 cash position: $50K (vs $100K)        │  ││
│  │   │    ⚠️ Start fundraising earlier (Week 6)        │  ││
│  │   └─────────────────────────────────────────────────┘  ││
│  │                                                          ││
│  │   ┌─────────────────────────────────────────────────┐  ││
│  │   │ [Button] Growth -50% (Worst Case)              │  ││
│  │   │ 📊 Impact: Runway 8w → 4w (lose 4 weeks) 🚨    │  ││
│  │   │    Week 4 cash position: $0 (critical!)        │  ││
│  │   │    🔴 Start fundraising immediately            │  ││
│  │   └─────────────────────────────────────────────────┘  ││
│  │                                                          ││
│  │   ┌─────────────────────────────────────────────────┐  ││
│  │   │ [Button] Hire 5 Engineers (+$20K/mo payroll)   │  ││
│  │   │ 📊 Impact: Runway 8w → 6w (lose 2 weeks)       │  ││
│  │   │    Extra headcount costs $20K/month            │  ││
│  │   │    Week 8 cash: $50K (requires funding)        │  ││
│  │   └─────────────────────────────────────────────────┘  ││
│  │                                                          ││
│  │   💡 Use these to prepare for board questions          ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  [SECTION 8: RISKS & TOP ACTIONS - Expandable]              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ▶ ⚠️ TOP RISKS FOUND                                    ││
│  │   [3 risks detected from your data]                    ││
│  │   When expanded:                                        ││
│  │   ┌─ 🔴 CRITICAL: $25K billing errors                  ││
│  │   │  └─ 2 duplicate charges + 1 spike detected         ││
│  │   │     Action: Audit invoices, refund errors          ││
│  │   │                                                    ││
│  │   ┌─ 🟠 HIGH: Concentrated revenue                     ││
│  │   │  └─ Top 2 customers = 45% of revenue               ││
│  │   │     Action: Diversify customer base                ││
│  │   │                                                    ││
│  │   └─ 🟡 MEDIUM: 30+ day invoices aging                 ││
│  │      └─ $12K overdue (>30 days)                        ││
│  │         Action: Follow up with customers               ││
│  │                                                         ││
│  │   💡 AI Insights:                                       ││
│  │   • Your cash health is STABLE (good!)                 ││
│  │   • DSO improving: 40d → 35d (trending better)         ││
│  │   • Billing errors costing you $25K/month              ││
│  │   • Recommendation: Audit invoices first, then focus   ││
│  │     on revenue diversification                         ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  [SECTION 9: INVOICE HEALTH (Optional) - Expandable]        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ▶ 📋 INVOICE HEALTH (Read-Only)                         ││
│  │   [Your Stripe invoices snapshot]                       ││
│  │   When expanded:                                        ││
│  │   ├─ Total Invoiced: $450K (all-time)                   ││
│  │   ├─ Unpaid: $75K (17% of total)                        ││
│  │   ├─ Overdue (>30d): $12K (needs attention)             ││
│  │   ├─ DSO (Days Sales Outstanding): 35 days             ││
│  │   │  └─ Industry avg: 40 days (you're doing better!)   ││
│  │   └─ Payment Rate: 83% of invoices paid on time         ││
│  │                                                         ││
│  │   💡 This is read-only in trial. Upgrade for dunning.  ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  [SECTION 10: UPGRADE CARD - Always Visible]                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🚀 READY TO GO DEEPER?                                  │
│  │                                                         │
│  │ Unlock QB integration, team access, and reports        │
│  │                                                         │
│  │ What you'll get:                                        │
│  │ ✅ QB Sync (auto-sync payables from QuickBooks)         │
│  │ ✅ Team Access (invite CFO/co-founder)                 │
│  │ ✅ Advanced Reports (custom dates, PDF export)          │
│  │ ✅ Email Dunning (payment reminders)                    │
│  │ ✅ API Access (integrations)                            │
│  │                                                         │
│  │ Price: $3,500/month                                     │
│  │ (Or $1,000 for first month if you commit 3 months)     │
│  │                                                         │
│  │                    [Upgrade to SEED Tier →]             │
│  │                                                         │
│  │ Questions? We offer 30-min setup call (free)           │
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## DETAILED COMPONENT SPECS

### **SECTION 1: TRIAL BANNER**
```
Status: ✅ EXISTS (TrialCountdown component)
Location: Top of page, below header
Props: trial_ends_at, daysRemaining
Display:
├─ Background: Green (>7d) → Yellow (3-7d) → Red (<3d)
├─ Text: "🎉 Trial Active - X days remaining"
├─ Progress bar: (14 - X) / 14 * 100%
└─ Button: [Upgrade to SEED Tier] → /checkout

Code: Already exists, just needs styling refinement
Tailwind: bg-blue-50 dark:bg-blue-900/20, text-blue-900
```

### **SECTION 2: CASH HERO (Always Expanded)**
```
Status: ⚠️ PARTIALLY EXISTS (Need to reorganize)
Location: Right after trial banner
Components:
├─ Card header: "💰 CASH POSITION OVERVIEW"
├─ 4 cards in grid:
│  ├─ Available Cash (from trialAnalysis.available_cash)
│  ├─ Runway (from trialAnalysis.runway_days)
│  ├─ Pending Bills (sum of current week payables)
│  └─ Collection Health (100 - avg_days_late)
└─ Subtext: "Updated X hours ago"

Cards styling:
├─ Card 1 (Blue): Available cash, up/down arrow
├─ Card 2 (Red/Green): Runway with status (red if <60d)
├─ Card 3 (Amber): Bills due this week
└─ Card 4 (Purple): Collection health %

Build: Modify Dashboard.tsx trial mode hero section
Tailwind:
├─ grid grid-cols-1 md:grid-cols-4 gap-4
├─ Card borders: border-blue-200 dark:border-blue-800
└─ Text: text-3xl font-bold
```

### **SECTION 3: BILLING ISSUES (Conditional)**
```
Status: ✅ EXISTS in trial analysis
Location: After hero, if billing_errors.total_value > 0
Data source: trialAnalysis.billing_errors
Display:
├─ Background: bg-orange-50 dark:bg-orange-900/20
├─ Headline: "⚠️ BILLING ISSUES DETECTED: $XXK"
├─ 4 cards in grid:
│  ├─ Duplicates (count + value)
│  ├─ Spikes (count + value)
│  ├─ Failed Payments (count + value)
│  └─ Gaps (count + value)
└─ Hint: "💡 Fix these first to improve runway"

Styling:
├─ Cards: border-l-4 border-orange-500/yellow-500/red-500/blue-500
├─ Text: text-2xl font-bold
└─ Colors: Different border for each card type

Build: Already in reorganized trial mode
```

### **SECTION 4: PAYABLES TRACKER**
```
Status: ✅ EXISTS (PayablesTracker component)
Location: Core trial feature, 4th section
Component: <PayablesTracker loading={loading} />
Expanded by default: YES
Features:
├─ [+ Add Bill] button at top
├─ Grouped by week:
│  ├─ THIS WEEK
│  ├─ NEXT WEEK
│  └─ 30+ DAYS
├─ Each bill shows: vendor, amount, due_date, category badge
├─ Edit/Delete icons on hover
└─ Total summary: "$15K due, 3 items"

Modal form for add/edit:
├─ Vendor name (text input)
├─ Amount (number input)
├─ Due date (date picker)
├─ Category (select: payroll/rent/cloud/marketing/other)
├─ Notes (textarea)
└─ [Save] [Cancel]

Styling:
├─ CollapsibleSection wrapper with ▶ icon
├─ Cards: bg-gray-50 dark:bg-slate-900
├─ Category badges: color-coded (payroll=purple, rent=blue, etc)
└─ Overdue bills: red text + 🚨 icon

Build: ALREADY DONE, just integrate into Dashboard
```

### **SECTION 5: WEEKLY UPDATE FORM**
```
Status: ✅ EXISTS (WeeklyUpdateForm component)
Location: 5th section, below Payables
Component: <WeeklyUpdateForm />
Expanded by default: NO (collapsed initially)
Features:
├─ Collapsed: Shows "Last updated: [timestamp]"
├─ When expanded:
│  ├─ Growth rate % (slider 0-100)
│  ├─ Monthly payroll (currency input)
│  ├─ Other monthly expenses (currency input)
│  ├─ Notes (textarea)
│  └─ [Save Changes] button
├─ On save: Toast + refresh forecast
└─ 💡 Hint: "Forecast updates when you save"

Styling:
├─ CollapsibleSection wrapper
├─ Form inputs: input-field style
├─ Save button: primary action
└─ Subtext: text-gray-500 dark:text-gray-400

Build: ALREADY DONE, just integrate into Dashboard
```

### **SECTION 6: 13-WEEK FORECAST CHART**
```
Status: ⚠️ PARTIALLY EXISTS (Need to integrate CashFlowSection)
Location: 6th section
Components:
├─ Title: "📈 13-WEEK CASH FORECAST"
├─ Subtitle: "Trend: STABLE ▬ Next 90d: $250K → $120K"
├─ Line chart:
│  ├─ X-axis: Week 1 - Week 13
│  ├─ Y-axis: Cash balance ($0 - $400K)
│  ├─ Line: Projected balance
│  ├─ Shade: Confidence band (±10% bounds)
│  └─ Reference line: $0 (when runway ends)
├─ Runway timeline:
│  ├─ Today: $250K, 8 weeks
│  ├─ Week 4: $200K, 5 weeks
│  ├─ Week 8: $100K, 1 week ⚠️
│  └─ Week 13: $0 🚨
└─ 💡 "Start fundraising by Week 8"

Data source:
├─ forecast endpoint (if exists)
├─ Or calculate from: current_balance, growth_rate_pct, payroll, expenses

Styling:
├─ CollapsibleSection wrapper
├─ Chart: ResponsiveContainer with LineChart
├─ Trend color: green (improving) / amber (stable) / red (declining)
├─ Axes labels: text-sm text-gray-600
└─ Legend: Forecast + Confidence band

Build: Use CashFlowSection component but customize for trial
```

### **SECTION 7: SCENARIO TESTING**
```
Status: ⚠️ PARTIALLY EXISTS (WhatIfWidget exists)
Location: 7th section
Components:
├─ CollapsibleSection: "🎯 WHAT-IF SCENARIOS"
├─ 3 buttons in grid (md:grid-cols-3):
│  ├─ [Growth -20%]
│  ├─ [Growth -50%]
│  └─ [Hire 5 Engineers]
├─ Results displayed below each button:
│  ├─ "📊 Impact: Runway 8w → 6w (lose 2 weeks)"
│  ├─ "New cash position: $50K (vs $100K)"
│  └─ "Action: Start fundraising by Week X"
└─ Forecast chart updates on button click

Button styling:
├─ bg-blue-600 dark:bg-blue-700
├─ hover:bg-blue-700
├─ text-white
└─ px-4 py-2 rounded-lg

Result cards:
├─ bg-gray-50 dark:bg-slate-900
├─ border-l-4 border-color (color changes by severity)
├─ Impact text: font-semibold
└─ Action: text-amber-600 or red-600

Build: Use WhatIfWidget component, integrate with CashFlowSection
```

### **SECTION 8: RISKS & AI INSIGHTS**
```
Status: ✅ EXISTS in trial analysis
Location: 8th section
Components:
├─ Title: "⚠️ TOP RISKS FOUND"
├─ Risk list (from trialAnalysis.risks):
│  └─ Each risk:
│     ├─ Severity indicator: ● (color coded)
│     ├─ Title (bold)
│     ├─ Description
│     └─ Action item
├─ AI Insights:
│  ├─ Title: "💡 AI Insights"
│  ├─ Bullet points (from trialAnalysis.insights)
│  └─ Each insight: → [insight text]

Severity colors:
├─ Critical: 🔴 red-600
├─ High: 🟠 orange-600
├─ Medium: 🟡 yellow-600
└─ Low: 🔵 blue-600

Styling:
├─ CollapsibleSection wrapper
├─ Risk cards: bg-gray-50 dark:bg-slate-900, p-3, rounded
├─ Severity dot: w-3 h-3 rounded-full
└─ Text: text-sm text-gray-600

Build: ALREADY DONE in reorganized trial mode
```

### **SECTION 9: INVOICE HEALTH (Optional)**
```
Status: ⚠️ NEEDS TO BE ADDED
Location: 9th section (optional, can skip for MVP)
Components:
├─ Title: "📋 INVOICE HEALTH"
├─ Read-only metrics:
│  ├─ Total Invoiced (lifetime)
│  ├─ Unpaid amount (%)
│  ├─ Overdue (>30d) amount
│  ├─ DSO (Days Sales Outstanding)
│  └─ Payment rate (%)
└─ 💡 "Read-only in trial. Upgrade for dunning."

Data source: TBD (may need new endpoint)

Styling:
├─ CollapsibleSection wrapper
├─ Metric cards: 4-column grid
├─ Values: text-2xl font-bold
└─ Subtext: text-gray-500

Build: Skip for initial MVP, add later
```

### **SECTION 10: UPGRADE CARD**
```
Status: ⏳ NEEDS TO BE CREATED (UpgradeCard component)
Location: 10th section, always visible
Component: <UpgradeCard />
Features:
├─ Background: Gradient or accent color
├─ Headline: "🚀 READY TO GO DEEPER?"
├─ Subheading: "Unlock QB integration, team access, and reports"
├─ Feature list:
│  ├─ ✅ QB Sync (auto-sync payables)
│  ├─ ✅ Team Access (invite CFO/co-founder)
│  ├─ ✅ Advanced Reports (custom dates, PDF)
│  ├─ ✅ Email Dunning (payment reminders)
│  └─ ✅ API Access (integrations)
├─ Price: "$3,500/month"
├─ Alt offer: "$1,000 for first month (3-month commitment)"
├─ Button: [Upgrade to SEED Tier →] → /checkout
└─ Subtext: "Questions? Free 30-min setup call"

Styling:
├─ bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20
├─ border-2 border-blue-200 dark:border-blue-800
├─ rounded-lg p-6
├─ Feature list: ✅ icons
└─ Button: primary action, large

Build: NEW COMPONENT, high priority
```

---

## COMPLETE LAYOUT MAP

```
Dashboard
├─ Header: "Dashboard" + Date + Dark/Light toggle
├─ Trial Banner (if trial_ends_at)
├─ Section 1: Cash Hero (4-card grid)
├─ Section 2: Billing Issues (if any, 4-card grid)
├─ Section 3: Payables Tracker (collapsible)
├─ Section 4: Weekly Update Form (collapsible)
├─ Section 5: 13-Week Forecast (collapsible)
├─ Section 6: Scenario Testing (collapsible)
├─ Section 7: Risks & Insights (collapsible)
├─ Section 8: Invoice Health (collapsible, optional)
└─ Section 9: Upgrade Card (always visible)
```

---

## WHAT TO BUILD (Priority Order)

### **PHASE 1: Layout & Integration (6 hours)**
1. ✅ DONE: Trial Banner reorganization
2. ⏳ NEW: Wrap Payables + Weekly + Forecast in CollapsibleSection
3. ⏳ NEW: Wrap Scenarios in CollapsibleSection
4. ⏳ NEW: Wrap Risks/Insights in CollapsibleSection
5. ⏳ NEW: Invoice Health section (optional, can defer)
6. ⏳ NEW: Create UpgradeCard component
7. ⏳ FIX: Ensure all spacing/padding is consistent

### **PHASE 2: Feature Gating (4 hours)**
1. ⏳ Create featureGate.ts utility
2. ⏳ Hide paid features with "Upgrade to enable" overlay
3. ⏳ Disable paid buttons in trial mode
4. ⏳ Test feature gating logic

### **PHASE 3: Payment & Activation (2+ hours)**
1. ⏳ Create /checkout page with payment form
2. ⏳ Integrate Razorpay (or Stripe for manual)
3. ⏳ On success: Set company.account_type = 'paid'
4. ⏳ Redirect to dashboard with "Paid account" toast

---

## CSS STRUCTURE (Tailwind)

```tailwind
/* Hero Cards */
.hero-card: bg-{color}-50 dark:bg-{color}-900/20 border border-{color}-200 dark:border-{color}-800 rounded-lg p-4

/* Collapsible Sections */
.collapsible-section: space-y-6

/* Trial Banner */
.trial-banner: bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6

/* Card Grid */
.card-grid: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4

/* Dark Mode */
All dark: variants included (dark:bg-slate-900, dark:text-white, etc.)
```

---

## RESPONSIVE DESIGN

```
Mobile (< 768px):
├─ Hero cards: 1 column (full width)
├─ Issue cards: 1 column (full width)
├─ Buttons: Full width, stacked
└─ Charts: Responsive containers

Tablet (768px - 1024px):
├─ Hero cards: 2 columns
├─ Issue cards: 2 columns
├─ Buttons: 2 per row
└─ Charts: 80% container width

Desktop (> 1024px):
├─ Hero cards: 4 columns
├─ Issue cards: 4 columns
├─ Buttons: 3 per row
└─ Charts: Full container width (max-w-7xl)
```

---

## DARK MODE

All sections include dark variants:
- Background: dark:bg-slate-900 or dark:bg-{color}-900/20
- Text: dark:text-white or dark:text-gray-200
- Borders: dark:border-white/[0.05] or dark:border-{color}-800
- Cards: Subtle background change

---

## COMPLETION CHECKLIST

### **Build Tasks**
- [ ] Wrap PayablesTracker in CollapsibleSection
- [ ] Wrap WeeklyUpdateForm in CollapsibleSection
- [ ] Wrap forecast chart in CollapsibleSection
- [ ] Wrap WhatIf in CollapsibleSection
- [ ] Wrap Risks in CollapsibleSection
- [ ] Create UpgradeCard component
- [ ] Style all sections consistently
- [ ] Ensure dark mode works on all sections
- [ ] Test responsive layout on mobile/tablet/desktop
- [ ] Create featureGate.ts utility
- [ ] Apply feature gating to paid features
- [ ] Create /checkout page with payment form

### **Testing**
- [ ] All sections render without errors
- [ ] Trial banner shows correct countdown
- [ ] Payables add/edit/delete works
- [ ] Weekly form submits correctly
- [ ] Scenarios update forecast on button click
- [ ] Collapsible sections expand/collapse smoothly
- [ ] Dark mode toggle works on all sections
- [ ] Mobile responsive on iPhone 12
- [ ] Tablet responsive on iPad
- [ ] Feature gating hides paid features

---

## SUCCESS CRITERIA

✅ Trial users see cash-focused dashboard
✅ All core features present (cash, forecast, scenarios, payables)
✅ Upgrade card is prominent
✅ Feature gating prevents access to paid features
✅ Build passes TypeScript compilation
✅ No console errors
✅ Responsive on mobile/tablet/desktop
✅ Dark mode works
✅ Ready for first customer
