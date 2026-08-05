---
name: Customer Detail Page - Full A-Z Analysis
type: reference
date: 2026-04-25
---

# Customer Detail Page - Complete Analysis

## Current State

### ✅ What Works
1. **Customer Header** - Shows customer name, company name, total AR, risk score
2. **AR Health Grid** - Shows total AR, collected, pending, overdue breakdown
3. **Risk Assessment Card** - Shows risk score and risk factors
4. **Communication Health** - Shows email/SMS engagement stats
5. **Contact Information** - Shows/edits email and phone
6. **Active Invoices Table** - Shows list of unpaid invoices
7. **Payment Activity Section** - Shows payment timeline
8. **Agent Activity Summary** - Shows dunning activity

### ❌ Issues Found

#### Issue 1: "Pause" Button at Bottom (Line 199-203)
```typescript
<button
  onClick={() => addToast({ type: 'info', message: 'Pause dunning feature coming soon' })}
  className="..."
>
  Pause
</button>
```

**Problem**: 
- Shows "coming soon" message
- BUT pause/stop is **INVOICE-WISE**, not CUSTOMER-WISE
- Users should NOT pause dunning at customer level
- This button is confusing and misleading

**Solution**:
- ❌ **REMOVE this button entirely** - it's not correct functionality
- Pause/stop is done per-invoice, not per-customer
- User should click on individual invoice → navigate to invoice detail → use pause/stop controls

---

## Correct Flow for Pause/Stop

### ❌ WRONG (Current confusing button)
```
Customer Detail Page
  ↓
Click "Pause" button at bottom
  ↓
"Coming soon" message (confusing!)
  ↓
User doesn't know what to do
```

### ✅ CORRECT (What should happen)
```
Customer Detail Page
  ↓
See "Active Invoices" section
  ↓
Click on invoice row
  ↓
Navigate to Invoice Detail page
  ↓
See InvoiceDunningControls (pause/stop buttons)
  ↓
Click pause/stop as needed
```

---

## Active Invoices Table - Deep Dive

**File**: `frontend/src/components/customers/ActiveInvoicesTable.tsx`

**What it shows**:
- List of unpaid invoices for the customer
- Invoice ID, amount, due date, days overdue
- Color-coded by risk level (blue 0-30d, amber 30-60d, red 60d+)
- Dunning stage (if available)

**What it does**:
- Line 72: `onClick={() => navigate(`/invoices/${invoice.id}`)}`
- ✅ Clicking an invoice correctly navigates to invoice detail page
- This is where pause/stop controls should be accessed

**Issue**: 
- ❌ No pause/stop buttons inline in the table
- Users must click into invoice detail to pause
- This is actually CORRECT behavior (pause is invoice-specific)

---

## Architecture Issues to Fix

### Issue 1: Misleading "Pause" Button
**File**: `frontend/src/pages/CustomerDetail.tsx` (lines 198-203)

**Current**:
```typescript
<button
  onClick={() => addToast({ type: 'info', message: 'Pause dunning feature coming soon' })}
  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
>
  Pause
</button>
```

**Why it's wrong**:
1. Users think they can pause dunning for the entire customer
2. Actually, pause is per-invoice
3. Shows "coming soon" when feature already exists (on invoice detail)
4. Creates confusion

**Fix Options**:

**Option A: Remove the button entirely** ✅ RECOMMENDED
- Pause/stop should be accessed from invoice detail
- No need for customer-level pause control

**Option B: Replace with helpful button**
- Change to "View Active Invoices" or "Manage Invoices"
- Links to `/invoices` filtered by customer
- At least directs users to correct place

---

## What ActiveInvoicesTable Should Show

Currently shows:
- ✅ Invoice ID
- ✅ Amount  
- ✅ Due Date
- ✅ Days Overdue
- ✅ Dunning Stage

Could add (optional enhancements):
- 🤔 Pause indicator (⏸️ if paused)
- 🤔 Stop indicator (🛑 if stopped)
- 🤔 "View Details" button
- 🤔 Quick pause/stop actions (but better to go to detail)

**Recommendation**: Keep as-is. Clicking into invoice detail is correct.

---

## Current Data Flow from Customer Detail

```
CustomerDetail.tsx
  ↓
Fetches: /api/customers/{id}/detail
  ├─ customer (name, email, phone, risk_score)
  ├─ arHealth (totalAR, collected, pending, overdue)
  ├─ activeInvoices (list of unpaid invoices)
  ├─ paymentTimeline
  ├─ agentActivity
  └─ ... other stats
  ↓
Renders ActiveInvoicesTable
  ↓
User clicks invoice
  ↓
navigate('/invoices/{invoiceId}')
  ↓
Invoice Detail page loads
  ↓
Shows InvoiceDunningControls
  ├─ Pause button
  ├─ Stop button
  └─ Resume button (if paused)
```

✅ **This flow is correct!**

---

## Summary: Customer Detail Analysis

| Component | Status | Action |
|-----------|--------|--------|
| Customer header | ✅ Works | None |
| AR Health grid | ✅ Works | None |
| Risk assessment | ✅ Works | None |
| Communication health | ✅ Works | None |
| Contact info | ✅ Works | None |
| Active invoices table | ✅ Works | None |
| Payment activity | ✅ Works | None |
| Agent activity | ✅ Works | None |
| **Pause button** | ❌ Confusing | **REMOVE** |
| **Export CSV** | ⏳ Coming soon | OK for now |
| **Notes button** | ⏳ Coming soon | OK for now |

---

## Recommendations

### 🔴 **CRITICAL**: Remove Misleading Pause Button
The "Pause" button at the bottom (line 199-203) is:
- Confusing (pause is per-invoice, not per-customer)
- Misleading (says "coming soon" when feature exists elsewhere)
- Not useful (users should go to invoice detail anyway)

**Action**: Delete lines 198-203

### 🟡 **OPTIONAL**: Improve CTA Bar
Current buttons:
- "View All Invoices" - useful ✅
- "Export CSV" - coming soon (OK)
- "Notes" - coming soon (OK)
- "Pause" - CONFUSING ❌

**Better arrangement**:
```
✅ "View All Invoices" 
✅ "Export CSV" (coming soon)
✅ "Notes" (coming soon)
❌ Remove "Pause" entirely
```

---

## Invoice Detail Page Verification

The pause/stop controls are correctly placed on **Invoice Detail** page:

**File**: `frontend/src/components/invoices/InvoiceDunningControls.tsx`

**Shows**:
- ⏸️ Pause button (input days)
- 🛑 Stop button (permanent)
- ▶️ Resume button (if paused)

**Status**: ✅ **WORKING PERFECTLY**

---

## Conclusion

✅ Customer Detail page is well-designed
✅ Active Invoices table correctly navigates to invoice detail
✅ InvoiceDunningControls on invoice detail has pause/stop
❌ Misleading "Pause" button at bottom needs removal

**Total Changes Needed**: 1 (remove pause button)

This is a **QUICK FIX** - just delete the confusing button.
