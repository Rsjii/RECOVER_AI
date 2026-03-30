# CashOS Trial Dashboard - Settings/Billing/Invoices Tabs Structure

**Date**: 2026-03-30
**Scope**: Define structure for trial users (simplified experience) vs paid users (full features)

---

## 📋 CURRENT STATE (What Exists)

### 1️⃣ **Settings Tab** (`frontend/src/pages/Settings.tsx`)
**Current Structure**: 4 tabs (for ALL users)
- **Profile** — Your Profile, Company Info, Notifications
- **Integrations** — Stripe, Slack, QB, Chargebee, Twilio configs
- **Automation** — Agent Mode (Shadow/Auto/Paused)
- **Advanced** — (exists but not explored)

**Issues for Trial Users**:
- ❌ Too many config options for trial users (should be read-only/minimal)
- ❌ Automation tab not needed (no dunning in trial)
- ❌ Advanced settings are paid-only

---

### 2️⃣ **Billing Tab** (`frontend/src/pages/Billing.tsx`)
**Current Structure**: 2 tabs (only for PAID users)
- **Subscription** — Current Plan, Next Billing Date
- **Billing History** — Invoices table with export

**For Trial Users**: Shows big banner with:
- Trial countdown + progress bar
- Recovery amount shown
- Pricing info ($2.5K + 1%)
- CTA: "Upgrade to Paid →"

**Issues for Trial Users**:
- ❌ Banner looks outdated (we now have TrialCountdown + UpgradeCard)
- ❌ Should integrate new components
- ⚠️ No read-only view of what they're getting

---

### 3️⃣ **Invoices Tab** (`frontend/src/pages/Invoices.tsx`)
**Current Structure**: Single page with:
- Header + Action buttons (Export, Import CSV, New Invoice, Sync, Schedule)
- FilterBar (status, aging, dunning stage, search)
- InvoiceTable + pagination
- Modals for create/edit

**For Trial Users**: Shows all invoices, but...
- ✅ Can view invoices (read-only)
- ✅ Can filter and export
- ❌ Cannot trigger dunning (paid-only)
- ❌ UI cluttered with paid-only actions

---

## 🎯 PROPOSED STRUCTURE FOR TRIAL USERS

### 1️⃣ **Settings Tab** — SIMPLIFIED
```
Settings / ⚙️

Tabs (2 tabs for trial):
├─ Profile (profile only, minimal)
│  ├─ Your Profile
│  ├─ Company Information
│  └─ Notifications (minimal)
│
└─ Integrations (read-only)
   └─ Connected Services (Stripe synced invoices - READ ONLY)
      └─ "QB Integration coming in paid plan"

Hidden for trial users:
❌ Automation tab (dunning is paid-only)
❌ Advanced tab (api keys, etc - paid-only)
```

---

### 2️⃣ **Billing Tab** — TRIAL-FOCUSED
```
Billing / 💳

For Trial Users (SINGLE VIEW, no tabs):
├─ Trial Banner (using new TrialCountdown + colors)
│  ├─ Green/Yellow/Red countdown based on days left
│  └─ "3 days left" or "10 days left"
│
├─ What You're Getting (Summary card)
│  ├─ ✅ Real-time cash visibility
│  ├─ ✅ Payment tracking
│  ├─ ✅ Cash forecasting
│  ├─ ✅ Risk detection
│  └─ ✅ Team collaboration (coming)
│
└─ UpgradeCard (new component we built!)
   ├─ Features list (QB, Team, Reports, Dunning, API)
   ├─ Pricing: $3.5K/month
   └─ [Upgrade to SEED Tier →]

For Paid Users (2 tabs):
├─ Subscription
└─ Billing History
```

---

### 3️⃣ **Invoices Tab** — TRIAL-SIMPLIFIED
```
Invoices / 📋

For Trial Users (Read-only invoices):
├─ Header
│  └─ "Invoices from Stripe" (read-only label)
│
├─ Action Buttons (LIMITED)
│  ├─ [Export CSV] ✅ allowed
│  ├─ [Sync from Stripe] ✅ allowed
│  └─ ❌ Hide: New Invoice, Import CSV, Schedule Emails (paid-only)
│
├─ FilterBar (functional)
│  └─ Status, Aging, Search (all work)
│
└─ InvoiceTable
   ├─ Show all columns
   ├─ Read-only (cannot edit)
   └─ No bulk actions (Mark Paid, Schedule Dunning)

For Paid Users (Full features):
├─ All action buttons enabled
├─ Bulk actions enabled
└─ Dunning stage filter visible
```

---

## 🔧 IMPLEMENTATION PLAN

### Phase 1: Simplify Settings Tab (1 hour)
- [ ] Hide Automation tab for trial users
- [ ] Hide Advanced tab for trial users
- [ ] Keep Profile + Integrations visible
- [ ] Add feature unlock hints for paid-only sections

### Phase 2: Update Billing Tab (30 min)
- [ ] Remove old trial banner
- [ ] Integrate TrialCountdown component (top)
- [ ] Add "What You're Getting" summary card
- [ ] Integrate UpgradeCard component (bottom)
- [ ] Keep 2 tabs for paid users (no change)

### Phase 3: Simplify Invoices Tab (1.5 hours)
- [ ] Hide action buttons for trial users based on `company.onboardingStage === 'trial_active'`
- [ ] Disable bulk actions for trial users
- [ ] Keep table read-only for trial users
- [ ] Show "read-only" label in header

### Phase 4: Test & Polish (30 min)
- [ ] Test trial flow: all 3 tabs
- [ ] Test paid flow: all features still work
- [ ] Dark mode on all pages
- [ ] Mobile responsive

---

## ✅ FINAL DECISIONS (Based on FINAL_PRODUCT_SPEC_AND_ACTION.md)

### Decision 1: Settings Tab for Trial Users
**DECISION: 2 tabs (Profile + Integrations, read-only)**

**Why**:
- Per spec: Trial has "Invoice Health (Read-Only)" - suggesting read-only experience
- Automation + Advanced are explicitly paid features (dunning, QB, API, team)
- User already connected Stripe during onboarding, good to confirm it's working

**Settings for Trial Users** (2 tabs):
```
1. Profile Tab
   ├─ Your Profile (editable)
   ├─ Company Information (editable)
   └─ Notifications (basic - email digest)

2. Integrations Tab (READ-ONLY)
   ├─ Connected Services (Display only)
   │  ├─ ✅ Stripe Connected
   │  │  └─ Last synced: [timestamp]
   │  ├─ ❌ QB Integration (Locked - "Upgrade to paid")
   │  └─ ❌ Slack (Locked - "Upgrade to paid")
   └─ "Unlock QB, Slack, Twilio in paid plan"
```

**Settings for Paid Users** (4 tabs - NO CHANGE):
- Profile
- Integrations (full edit access)
- Automation (dunning setup)
- Advanced (API keys, webhooks)

---

### Decision 2: Billing Tab for Trial Users
**DECISION: Single-view layout (NO tabs for trial)**

**Why**:
- Per spec: Trial users see "Upgrade to SEED Tier" CTA as prominent feature
- No subscription/billing history to show (trial is free)
- Should focus on: What's included + Why upgrade + Clear pricing

**Billing for Trial Users** (SINGLE VIEW):
```
Section 1: Trial Countdown (top, sticky)
├─ Component: TrialCountdown
├─ Shows: Green/Yellow/Red timer + days remaining
└─ Button: [Upgrade to SEED Tier →]

Section 2: What's Included (summary)
├─ Headline: "Your Free Trial Includes"
├─ Grid of 5 features:
│  ├─ ✅ Real-time Cash Visibility
│  ├─ ✅ 13-Week Forecast
│  ├─ ✅ Scenario Testing (What-If)
│  ├─ ✅ Payables Tracking
│  └─ ✅ Daily Email Digest
└─ Subtext: "No credit card required. Full access for 14 days."

Section 3: Upgrade CTA (bottom)
├─ Component: UpgradeCard
├─ Shows: 5 paid features (QB, Team, Reports, Dunning, API)
├─ Price: $2.5K/month or $1K first month (3-mo commit)
└─ Button: [Upgrade to SEED Tier →]
```

**Billing for Paid Users** (2 tabs - NO CHANGE):
- Subscription (current plan, next billing date)
- Billing History (invoices table)

---

### Decision 3: Invoices Tab for Trial Users
**DECISION: Read-only with limited actions (DISABLE buttons for trial)**

**Why** (as per spec):
- Trial shows "Invoice Health (Read-Only)" = invoices are display-only
- Dunning/scheduling is paid feature
- "New Invoice" and "Import CSV" are paid features

**Invoices for Trial Users** (LIMITED):
```
Header
├─ Title: "Invoices"
├─ Subtitle: "From Stripe (read-only during trial)"
└─ Badge: "🔒 Trial - Upgrade to manage"

Action Buttons (LIMITED):
├─ [Export CSV] ✅ Enabled
├─ [Sync from Stripe] ✅ Enabled
├─ [New Invoice] ❌ DISABLED + Tooltip "Upgrade to paid"
├─ [Import CSV] ❌ DISABLED + Tooltip "Upgrade to paid"
└─ Bulk Actions ❌ HIDDEN

FilterBar (ALL FUNCTIONAL):
├─ Status filter ✅ Works
├─ Aging bucket filter ✅ Works
├─ Search ✅ Works
└─ Refresh ✅ Works

InvoiceTable:
├─ Read-only (no inline editing)
├─ Pagination ✅ Works
├─ Selection checkboxes ❌ HIDDEN (no bulk actions)
└─ "Schedule Dunning" action ❌ HIDDEN
```

**Invoices for Paid Users** (FULL FEATURES - NO CHANGE):
- All buttons enabled
- Bulk actions enabled
- Dunning stage filter visible
- Email scheduling available

---

## 📊 Complete Trial User Tab Navigation

```
User completes onboarding → /dashboard

1. DASHBOARD (main view)
   ├─ Trial Banner (TrialCountdown - top sticky)
   ├─ Cash Position Hero
   ├─ 13-Week Forecast
   ├─ 3 Scenario Buttons
   ├─ Payables Tracker (collapsible)
   ├─ Invoice Health (read-only)
   ├─ Weekly Update Form (collapsible)
   └─ UpgradeCard (bottom)

2. INVOICES (via sidebar)
   ├─ Read-only Stripe invoices
   ├─ Can export & filter
   ├─ Cannot add/import/schedule
   └─ Buttons disabled: "Upgrade to paid"

3. BILLING (via sidebar)
   ├─ TrialCountdown + upgrade CTA (top)
   ├─ What's Included summary (5 features)
   └─ UpgradeCard with pricing (bottom)

4. SETTINGS (via sidebar)
   ├─ Profile tab (editable)
   │  ├─ Your Profile
   │  ├─ Company Info
   │  └─ Email Notifications
   └─ Integrations tab (read-only)
      ├─ ✅ Stripe Connected
      └─ ❌ QB, Slack, Twilio (Locked)
```

---

## 🎯 Implementation Checklist

### Settings Tab (1 hour)
- [ ] Hide Automation tab for trial users
- [ ] Hide Advanced tab for trial users
- [ ] Lock Integrations to read-only view
- [ ] Show "Upgrade to paid" badges on QB/Slack/Twilio
- [ ] Keep Profile fully editable

### Billing Tab (1 hour)
- [ ] Remove old trial banner code
- [ ] Import + render TrialCountdown (top)
- [ ] Create "What's Included" summary card (5 features)
- [ ] Import + render UpgradeCard (bottom)
- [ ] Hide subscription/billing tabs for trial
- [ ] Keep 2 tabs visible for paid users

### Invoices Tab (1.5 hours)
- [ ] Detect trial status: `company.onboardingStage === 'trial_active'`
- [ ] Disable buttons: New Invoice, Import CSV, Bulk Actions
- [ ] Add tooltip to disabled buttons: "Upgrade to paid"
- [ ] Show "read-only during trial" label in header
- [ ] Hide dunning stage filter for trial
- [ ] Keep export, sync, filter, search enabled

### Testing (1 hour)
- [ ] Test trial user: all 3 tabs navigate correctly
- [ ] Test paid user: all features still work
- [ ] Dark mode: all tabs work in dark mode
- [ ] Mobile: all tabs responsive on mobile
- [ ] Button states: hover, disabled, tooltip all visible

---

## 📌 Key Principle: "Read-Only Trial"

Per FINAL_PRODUCT_SPEC_AND_ACTION.md:
> "CANNOT USE (Feature gated):
> ❌ QB integration (button disabled)
> ❌ Advanced reports (locked)
> ❌ Multiple users (invite disabled)
> ❌ API access (not shown)"

Apply same principle here:
- **Settings**: Show read-only integrations, hide automation/advanced
- **Billing**: Show what's included + upgrade CTA, hide subscription details
- **Invoices**: Show invoices (read-only), hide creation/scheduling/bulk actions

---

## STATUS

**Status**: ✅ **DECISIONS LOCKED**

Implementation order:
1. Settings Tab (1 hour)
2. Billing Tab (1 hour)
3. Invoices Tab (1.5 hours)
4. Testing & Polish (1 hour)

**Total: ~4.5 hours**

Ready to build! 🚀
