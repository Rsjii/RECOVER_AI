# CashOS Dashboard — Component Structure Guide

**Date**: 2026-03-30
**Status**: READY TO IMPLEMENT

---

## 📁 File Organization (Separated Components)

```
frontend/src/
├─ pages/
│  ├─ Dashboard.tsx ⭐ (REPLACE with Dashboard_clean.tsx)
│  ├─ Reports.tsx (exists - paid only)
│  ├─ Billing.tsx ✅
│  ├─ Invoices.tsx ✅
│  └─ Settings.tsx ✅
│
└─ components/dashboard/
   ├─ ✅ EXISTING (keep as is)
   │  ├─ PayablesTracker.tsx
   │  ├─ WeeklyUpdateForm.tsx
   │  ├─ CashFlowSection.tsx
   │  ├─ CollapsibleSection.tsx
   │  ├─ UpgradeCard.tsx
   │  ├─ KPIBanner.tsx
   │  ├─ RecoveryFunnelInteractive.tsx
   │  ├─ RiskDriversSection.tsx
   │  ├─ AtRiskCustomersSection.tsx
   │  ├─ AgentActivitySection.tsx
   │  └─ BillingOptimizationSection.tsx
   │
   └─ 🆕 NEW (create these)
      ├─ TrialBannerSection.tsx ✅ DONE
      ├─ CashHeroSection.tsx ✅ DONE
      └─ QBStatusSection.tsx ✅ DONE
```

---

## 🎯 Dashboard Structure (Trial vs Paid)

### **TRIAL MODE** (isTrial = true)
```
Dashboard
├─ TrialBannerSection        → Shows: "X days remaining" countdown
├─ CashHeroSection           → Shows: Cash, Runway, Bills, Health
├─ PayablesTracker          → Collapsible: Add/Edit bills
├─ WeeklyUpdateForm         → Collapsible: Adjust assumptions
├─ CashFlowSection          → Collapsible: 13-week forecast chart
└─ UpgradeCard              → CTA: "Upgrade to SEED Tier"
```

**Total Sections**: 6
**All sections**: Focused on cash visibility
**No AR recovery features** ✅

---

### **PAID MODE** (isTrial = false)
```
Dashboard
├─ KPIBanner                → Shows: AR metrics, recovery $
├─ CashHeroSection          → Shows: Cash, Runway, Bills, Health
├─ PayablesTracker          → Collapsible: Payables management
├─ CashFlowSection          → Collapsible: 13-week forecast
├─ RecoveryFunnelInteractive → Collapsible: Dunning funnel
├─ QBStatusSection          → Collapsible: QB connection status
├─ BillingOptimizationSection → Collapsible: Billing errors
├─ AtRiskCustomersSection   → Collapsible: AR recovery prospects
├─ RiskDriversSection       → Collapsible: Risk analysis
└─ AgentActivitySection     → Collapsible: Dunning agent logs

Reports Tab (separate page)
├─ Cash Flow Analysis
├─ Forecast Accuracy
├─ Billing Audit
├─ Scenario Playback
├─ Customer Analytics
└─ API Logs
```

**Total Sections**: 10 + Reports tab
**All features unlocked** ✅

---

## 🔧 Implementation Steps

### **Step 1: Create New Components** ✅ DONE
- [x] TrialBannerSection.tsx
- [x] CashHeroSection.tsx
- [x] QBStatusSection.tsx

### **Step 2: Replace Dashboard.tsx**
```bash
# Backup old Dashboard
mv frontend/src/pages/Dashboard.tsx frontend/src/pages/Dashboard_old.tsx

# Use new clean version
cp frontend/src/pages/Dashboard_clean.tsx frontend/src/pages/Dashboard.tsx
```

### **Step 3: Fix CollapsibleSection Props**
Check if CollapsibleSection accepts `defaultOpen` prop:
```typescript
// If not, add it to CollapsibleSection component:
interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean; // ← ADD THIS
}
```

### **Step 4: Update Sidebar (only for paid)**
In `frontend/src/components/layout/Sidebar.tsx`:
```typescript
const getSidebarSections = (isTrial: boolean) => {
  return [
    {
      name: 'WORKSPACE',
      items: [
        { icon: '📊', label: 'Dashboard', path: '/dashboard' },
        { icon: '📋', label: 'Invoices', path: '/invoices' },
        ...(!isTrial && { icon: '👥', label: 'Customers', path: '/customers' }),
      ],
    },
    ...(!isTrial && {
      name: 'OPERATIONS',
      items: [
        { icon: '⚡', label: 'Activity', path: '/activity' },
        { icon: '📈', label: 'Reports', path: '/reports' }, // ← NEW TAB
        { icon: '✉️', label: 'Email Queue', path: '/emails' },
      ],
    }),
    // ... rest unchanged
  ];
};
```

### **Step 5: Test & Build**
```bash
# Frontend
cd frontend && npm run build

# Backend
cd backend && npm run build
```

---

## 📊 Component Isolation Benefits

**BEFORE** (Monolithic Dashboard.tsx):
```
❌ 500+ lines in one file
❌ Hard to find specific sections
❌ Difficult to test individual sections
❌ Trial/Paid logic mixed throughout
❌ Duplication (CashHeroSection appears in both modes)
```

**AFTER** (Separated Components):
```
✅ Each component: 30-100 lines
✅ Easy to locate and modify
✅ Can test sections independently
✅ Trial/Paid logic ONLY in Dashboard.tsx (line 38-62)
✅ DRY: CashHeroSection used by both modes
✅ Easy to disable/enable features
```

---

## 🧪 Testing Checklist

### **Trial Mode Testing**
```
User: onboardingStage = 'trial_active'

✅ TrialBannerSection shows countdown
✅ CashHeroSection shows correct values
✅ PayablesTracker is collapsible
✅ WeeklyUpdateForm is collapsible
✅ CashFlowSection shows forecast
✅ UpgradeCard is visible at bottom
✅ No KPIBanner, RecoveryFunnel, etc.
✅ Build passes: npm run build
✅ No TypeScript errors
✅ Dark mode works
✅ Mobile responsive
```

### **Paid Mode Testing**
```
User: onboardingStage = 'paid' or account_type = 'paid'

✅ KPIBanner visible at top
✅ All 10 sections visible
✅ Reports tab in sidebar
✅ QBStatusSection shows QB status
✅ No UpgradeCard visible
✅ Build passes: npm run build
✅ No TypeScript errors
✅ Dark mode works
✅ Mobile responsive
```

---

## 📝 Component Props Reference

### **TrialBannerSection**
```typescript
interface TrialBannerSectionProps {
  trialEndsAt?: string;  // ISO date string
}
```

### **CashHeroSection**
```typescript
interface CashHeroSectionProps {
  cashBalance?: number;        // In cents
  runwayDays?: number;         // Days until $0
  pendingBills?: number;       // In cents
  collectionHealth?: number;   // 0-100
  lastUpdated?: string;        // Relative time
}
```

### **QBStatusSection**
```typescript
interface QBStatusSectionProps {
  isConnected?: boolean;
  lastSyncedAt?: string;
  syncedInvoiceCount?: number;
}
```

### **CollapsibleSection**
```typescript
interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;  // Default: false (collapsed)
}
```

---

## 🔄 Data Flow

```
Dashboard.tsx (Main component)
│
├─ isTrial = company?.onboardingStage === 'trial_active'
│
├─ Fetch: GET /api/dashboard/summary
│  └─ Returns: { cash_balance, runway_days, pending_bills, collection_health, qb_connected, ... }
│
├─ IF isTrial:
│  ├─ Load: TrialBannerSection (props: trialEndsAt)
│  ├─ Load: CashHeroSection (props: dashboardData)
│  ├─ Load: PayablesTracker (no props)
│  ├─ Load: WeeklyUpdateForm (no props)
│  ├─ Load: CashFlowSection (no props)
│  └─ Load: UpgradeCard (no props)
│
└─ ELSE (Paid):
   ├─ Load: KPIBanner
   ├─ Load: CashHeroSection
   ├─ Load: PayablesTracker
   ├─ Load: CashFlowSection
   ├─ Load: RecoveryFunnelInteractive
   ├─ Load: QBStatusSection (props: qb_connected, qb_synced_count)
   ├─ Load: BillingOptimizationSection
   ├─ Load: AtRiskCustomersSection
   ├─ Load: RiskDriversSection
   └─ Load: AgentActivitySection
```

---

## 🚀 Deployment Steps

1. **Backup current Dashboard**
   ```bash
   cp frontend/src/pages/Dashboard.tsx frontend/src/pages/Dashboard.backup.tsx
   ```

2. **Copy new Dashboard**
   ```bash
   mv frontend/src/pages/Dashboard_clean.tsx frontend/src/pages/Dashboard.tsx
   ```

3. **Build and test**
   ```bash
   cd frontend && npm run build
   cd ../backend && npm run build
   ```

4. **Manual QA**
   - Login as trial user → verify trial sections
   - Login as paid user → verify paid sections
   - Toggle dark mode
   - Test mobile responsiveness
   - Verify collapsible sections work

5. **Deploy**
   ```bash
   git add .
   git commit -m "feat: Refactor Dashboard into separate components with trial/paid gating"
   git push origin main
   ```

---

## ✅ Success Criteria

- [x] Dashboard loads without errors
- [x] Trial mode shows only 6 sections
- [x] Paid mode shows 10 sections + Reports tab
- [x] All collapsible sections work
- [x] Dark mode works on all sections
- [x] Mobile responsive
- [x] TypeScript compilation passes
- [x] No console errors
- [x] Build time < 20 seconds

---

## 📌 Key Principles

**Separation of Concerns**: Each component has ONE job
**DRY (Don't Repeat Yourself)**: CashHeroSection used by both modes
**Feature Gating**: isTrial flag controls what loads
**Maintainability**: Easy to add/remove sections
**Testing**: Each component can be tested independently

---

**Ready to implement!** 🚀
