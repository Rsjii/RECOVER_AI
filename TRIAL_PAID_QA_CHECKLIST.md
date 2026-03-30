# Trial vs Paid Feature Gating — QA Testing Checklist

**Date**: 2026-03-30
**Status**: Ready for QA
**Build**: ✅ Frontend (1198 modules, 13.44s), Backend (tsc clean)

---

## 🧪 TEST PLAN

### Prerequisites
- [ ] Login as trial user (onboardingStage = 'trial_active')
- [ ] Login as paid user (onboardingStage = 'paid_active' or similar)
- [ ] Test both light mode and dark mode

---

## 📊 **DASHBOARD TESTING**

### Trial Mode Dashboard
- [ ] TrialCountdown banner visible at top
- [ ] Cash Position Hero shows: Available Cash, Runway, Bills Due, Collection Health
- [ ] "💸 Payables & Bills" section is collapsible and expanded by default
- [ ] "📊 Adjust Forecast" section is collapsible and collapsed by default
- [ ] "📈 13-Week Cash Forecast" section is collapsible and expanded by default
- [ ] UpgradeCard visible at bottom with: features list, $3.5K/mo pricing, CTA button
- [ ] NO KPIBanner, Recovery Funnel, QBStatus, Billing Optimization, Risk Drivers, etc.
- [ ] Dark mode: All sections have proper dark:bg- classes
- [ ] Mobile: Responsive layout on small screens

### Paid Mode Dashboard
- [ ] KPIBanner visible at top with AR metrics
- [ ] Cash Position Hero visible
- [ ] "💸 Payables & Bills" collapsible (expanded)
- [ ] "📈 13-Week Cash Forecast" collapsible (expanded)
- [ ] "🎯 Recovery Funnel" collapsible
- [ ] "🔄 QB Integration Status" collapsible
- [ ] "⚡ Billing Optimization" collapsible
- [ ] "⚠️ At Risk Customers" collapsible
- [ ] "🔴 Risk Drivers" collapsible
- [ ] "🤖 Agent Activity" collapsible
- [ ] NO UpgradeCard
- [ ] Dark mode works on all sections
- [ ] Mobile responsive

---

## ⚙️ **SETTINGS TAB TESTING**

### Trial Settings
- [ ] Only 3 tabs visible: Profile, Integrations, Security & Account
- [ ] Profile tab shows: name, email, company details (read-only)
- [ ] Integrations tab shows: Stripe ✅, QB/Slack/Twilio with "Read-Only" badge
- [ ] No Automation tab
- [ ] No Advanced settings tab

### Paid Settings
- [ ] All 5+ tabs visible: Profile, Integrations, Automation, Advanced, Security & Account
- [ ] All features enabled (no read-only badges)
- [ ] Full integration management

### Both Modes
- [ ] Dark mode works
- [ ] Mobile responsive
- [ ] Navigation between tabs works smoothly

---

## 💳 **BILLING TAB TESTING**

### Trial Billing
- [ ] TrialCountdown component shows days remaining
- [ ] Color changes: Green (>7d), Yellow (3-7d), Red (<3d)
- [ ] "Your Free Trial Includes" grid shows 5 features:
  - Cash Visibility
  - 13-Week Forecast
  - Scenario Testing
  - Payables Tracker
  - Daily Email Digest
- [ ] UpgradeCard visible with $3.5K/month pricing
- [ ] NO tabs (single page view)

### Paid Billing
- [ ] 2-tab interface: Subscription, Billing History
- [ ] Subscription tab shows plan details
- [ ] Billing History tab shows payment records
- [ ] NO TrialCountdown
- [ ] NO UpgradeCard

### Both Modes
- [ ] Dark mode works
- [ ] Mobile responsive

---

## 📄 **INVOICES TAB TESTING**

### Trial Invoices
- [ ] "🔒 Read-Only (Trial)" badge visible in header
- [ ] "New Invoice" button DISABLED with tooltip: "Upgrade to paid"
- [ ] "Import CSV" button DISABLED with tooltip: "Upgrade to paid"
- [ ] "Export CSV" button ENABLED
- [ ] "Sync from Stripe" button ENABLED
- [ ] NO Dunning filter (no Stage 1-5 options)
- [ ] Aging filters work: 0-30, 31-60, 61-90, 90+ days
- [ ] Status filter works

### Paid Invoices
- [ ] "New Invoice" button ENABLED
- [ ] "Import CSV" button ENABLED
- [ ] "Export CSV" button ENABLED
- [ ] "Sync from Stripe" button ENABLED
- [ ] Dunning filter visible with all stage options
- [ ] Bulk actions available (Select All, Delete, etc.)
- [ ] NO "Read-Only" badge

### Both Modes
- [ ] Sorting and filtering work
- [ ] Dark mode works
- [ ] Mobile responsive

---

## 🗂️ **SIDEBAR TESTING**

### Trial Sidebar
- [ ] WORKSPACE section: Dashboard, Invoices, Billing, Settings
- [ ] NO Customers tab
- [ ] NO OPERATIONS section at all
- [ ] BUSINESS section: Billing
- [ ] ADMIN section: Settings (+ Admin if isAdmin)
- [ ] Active route highlighting works

### Paid Sidebar
- [ ] WORKSPACE section: Dashboard, Invoices, **Customers**, Billing, Settings
- [ ] OPERATIONS section visible: Activity, **Reports**, Email Queue
- [ ] BUSINESS section: Billing
- [ ] ADMIN section: Settings (+ Admin if isAdmin)
- [ ] Active route highlighting works

### Both Modes
- [ ] Sidebar collapse/expand works
- [ ] Dark mode works
- [ ] Mobile menu works
- [ ] Theme toggle works

---

## 🔄 **NAVIGATION TESTING**

### Trial User Journey
1. [ ] Start at Dashboard → All trial sections visible
2. [ ] Navigate to Invoices → InvoicesTrial (read-only view)
3. [ ] Navigate to Billing → BillingTrial (countdown + upgrade)
4. [ ] Navigate to Settings → Settings_trial (3 tabs only)
5. [ ] Customers tab → NOT visible
6. [ ] Reports tab → NOT visible
7. [ ] Activity tab → NOT visible

### Paid User Journey
1. [ ] Start at Dashboard → All paid sections visible
2. [ ] Navigate to Invoices → Full Invoices (management enabled)
3. [ ] Navigate to Billing → Full Billing (2-tab interface)
4. [ ] Navigate to Settings → Full Settings (5+ tabs)
5. [ ] Customers tab → VISIBLE and clickable
6. [ ] Reports tab → VISIBLE in OPERATIONS
7. [ ] Activity tab → VISIBLE in OPERATIONS

---

## 🎨 **DARK MODE TESTING**

For each tab (Dashboard, Settings, Billing, Invoices):
- [ ] Light mode: Colors visible, text readable
- [ ] Dark mode: `dark:bg-[#111113]`, `dark:text-white`, proper contrast
- [ ] Toggle works smoothly
- [ ] No layout shifts on toggle

---

## 📱 **MOBILE TESTING**

Test on iPhone/Android simulator or actual device:
- [ ] Sidebar collapses on mobile
- [ ] All tabs remain accessible via sidebar
- [ ] Buttons are tap-friendly (min 44px height)
- [ ] Forms are scrollable without overflow
- [ ] Modals/popovers fit on screen
- [ ] Horizontal scrolling for tables (if needed)

---

## 🐛 **BUG CHECKS**

- [ ] No console errors on any page
- [ ] No TypeScript errors (`npm run build` passes)
- [ ] API calls work (check Network tab)
- [ ] No infinite loading states
- [ ] Trial countdown updates in real-time
- [ ] Clicking CTA buttons navigates correctly

---

## ✅ **SIGN-OFF**

| Component | Trial | Paid | Status |
|-----------|-------|------|--------|
| Dashboard | ✓ | ✓ | [ ] |
| Settings | ✓ | ✓ | [ ] |
| Billing | ✓ | ✓ | [ ] |
| Invoices | ✓ | ✓ | [ ] |
| Sidebar | ✓ | ✓ | [ ] |
| Dark Mode | ✓ | ✓ | [ ] |
| Mobile | ✓ | ✓ | [ ] |

**QA Complete**: _____ (Date)
**QA Tester**: _____________________
**Issues Found**: None [ ] / See notes [ ]

---

## 📝 **NOTES**

Any issues or blockers discovered during testing:

```
[Space for notes]
```

---

**Ready for production once all checks pass!** 🚀
