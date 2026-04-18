# Invoice Detail vs Customer Detail — Redesign Spec

## Current Problem
Both pages have IDENTICAL structure (KPI cards → tabs → details). Wrong approach.

---

## Benchmark: How Others Do It

### Stripe (Invoice vs Customer)
**Invoice Page:**
- Linear timeline: Created → Sent → Opened → Paid (or failed)
- Single focus: THIS invoice status
- CTAs: Download PDF, send reminder, mark paid, refund

**Customer Page:**
- Dashboard overview: LTV, subscription status, invoices list
- Trends: Payment velocity, churn risk
- CTAs: Contact, export, bulk operations

### Linear (Issue vs Project)
**Issue Page:**
- Narrow: Title, assignee, status, timeline with comments
- Focus: What's happening RIGHT NOW with THIS issue

**Project Page:**
- Wide: Team, roadmap, all issues, velocity charts
- Focus: How is the team doing as a whole

---

## Proposed Design

### ❌ INVOICE DETAIL PAGE (Current - WRONG)
```
KPI Cards (Amount, Status, Days Overdue, Risk)
├─ Tab: Details
├─ Tab: Payments
├─ Tab: Emails
└─ Tab: Dunning
```

### ✅ INVOICE DETAIL PAGE (Proposed - RIGHT)
```
┌─────────────────────────────────────────┐
│ INVOICE HEADER (Sticky Top)             │
│ Invoice #INV-001 | $32,000 | 25 days   │
│ Status: Pending dunning_2 | Risk: 45/100│
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ VISUAL RECOVERY TIMELINE (Hero)         │
│                                         │
│ Day 0: Invoice created                  │
│ Day 10: ✅ Email sent (opened)          │
│ Day 15: ❌ Email bounced                │
│ Day 20: 📱 SMS sent (no response)       │
│ Day 25: ⏳ Next: Escalate to dunning_2  │
│         (in 2 days)                     │
│                                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ INVOICE DETAILS (Compact Grid)          │
│ Amount: $32,000 | Due: Mar 15           │
│ Customer: TechWave Co | Email: ✅       │
│ Dunning Stage: pending_2 / 4            │
│ Risk Score: 45/100 (Medium)             │
│ Payment Plan: None                      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ AGENT ACTIONS (What's Happening)        │
│ Last Action: Email sent 2 days ago      │
│ Email Status: Sent ✅ / Opened ✅       │
│ Customer Response: None                 │
│ Next Step: SMS in 2 days if unpaid      │
│ Override: [Pause] [Force SMS] [Mark Paid]
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ COMMUNICATION LOG (Minimal)             │
│ Day 10, 09:30 - Email sent: dunning_1  │
│         Recipient: billing@x.com        │
│         Status: ✅ Delivered            │
│         Opens: 1 (Day 11, 14:22)        │
│         Clicks: None                    │
│                                         │
│ Day 15, 14:00 - Email bounced: retry   │
│         Error: "Domain not found"       │
│                                         │
│ Day 20, 08:00 - SMS sent: dunning_1    │
│         +1-555-9012                    │
│         Status: ✅ Delivered            │
│         Read: No                        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ PAYMENT TRACKING (Historical)           │
│ Last payment: $10K on Feb 10 (45 days  │
│              after invoice issued)     │
│ Avg payment time: 45 days              │
│ Reliability: 80% (pays eventually)     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ACTIONS (Bottom CTA Bar)                │
│ [📧 Send Email] [📱 Send SMS]           │
│ [⏸️ Pause] [✅ Mark Paid] [🗑️ Delete]   │
└─────────────────────────────────────────┘
```

**Key Features:**
- ✅ Timeline is VISUAL (shows what happened, when, status)
- ✅ Agent actions PROMINENT (what will happen next?)
- ✅ Single page (no tabs needed)
- ✅ Sticky header (always see invoice status)
- ✅ Clear CTAs (send email, mark paid, pause)

---

### ❌ CUSTOMER DETAIL PAGE (Current - WRONG)
```
KPI Cards (Total Invoices, Unpaid AR, On-Time, Risk)
├─ Tab: Overview
│  ├─ Profile Info (Name, Email, Phone)
│  └─ Payment Behavior (Avg Days Late, Total Paid)
├─ Tab: Invoices
├─ Tab: Emails
└─ (Deleted: Dunning Controls)
```

### ✅ CUSTOMER DETAIL PAGE (Proposed - RIGHT)
```
┌─────────────────────────────────────────┐
│ CUSTOMER HEADER (Sticky)                │
│ GrowthCo | accounting@growthco.com      │
│ Risk: Medium (42/100) | AR: $139K       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ AR OVERVIEW (3-Column Grid)             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ Total AR │ │ Overdue  │ │ Payment  │ │
│ │ $139K    │ │ $89K     │ │ Rate     │ │
│ │          │ │ (64%)    │ │ 80%      │ │
│ └──────────┘ └──────────┘ └──────────┘ │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ Avg Days │ │ # of     │ │ Risk     │ │
│ │ to Pay   │ │ Invoices │ │ Trend    │ │
│ │ 45d      │ │ 3        │ │ 📈 Rising│ │
│ └──────────┘ └──────────┘ └──────────┘ │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ RISK ASSESSMENT (Why at Risk?)          │
│ Score: 42/100 (Medium)                  │
│                                         │
│ Risk Factors:                           │
│ 🔴 Invoice #3 is 35 days overdue      │
│ 🟡 Payment velocity declining (-10d)  │
│ 🟡 Last email bounced (3 days ago)    │
│ 🟢 Overall reliability: 80%            │
│                                         │
│ Trend: ↗️ Getting worse (was 35/100)   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ COMMUNICATION HEALTH                    │
│ Email: ✅ Working                      │
│ SMS: ✅ Opted in (+1-555-9012)        │
│ Preferred: Email                       │
│ Last contact: 2 days ago (bounced)     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ CONTACT INFORMATION                     │
│ Name: [Not shown, focus on company]    │
│ Email: accounting@growthco.com [Edit]  │
│ Phone: +1-555-9012 [Edit]              │
│ Company: GrowthCo                      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ACTIVE INVOICES (Table Format)          │
│                                         │
│ Invoice  | Amount  | Due Date | Days O │
│          |         |          | verdue│
│ ─────────┼─────────┼──────────┼────────│
│ INV-001  | $32K    | Mar 15   | 25d  │
│ INV-002  | $45K    | Mar 20   | 20d  │
│ INV-003  | $62K    | Apr 01   | 8d   │
│ ─────────┼─────────┼──────────┼────────│
│          | $139K   |          |        │
│                                         │
│ [View All Invoices] [Batch Actions ▼] │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ PAYMENT TIMELINE (Last 6 Months)        │
│                                         │
│ Feb 10: Paid $50K (+45d after issue)  │
│ Jan 15: Paid $40K (+47d after issue)  │
│ Dec 20: Paid $30K (+43d after issue)  │
│                                         │
│ Insight: Reliable 45-day payer        │
│          Gets worse if overdue 30d+   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ AGENT ACTIVITY (Last 30 Days)           │
│ Emails sent: 8                         │
│ SMS sent: 2                            │
│ Emails opened: 3                       │
│ Last action: Sent dunning_1 (2d ago)  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ACTIONS (Bottom CTA Bar)                │
│ [View all invoices] [Export] [Notes]   │
└─────────────────────────────────────────┘
```

**Key Features:**
- ✅ Dashboard view (trends, patterns, health)
- ✅ Risk breakdown (why are they risky?)
- ✅ All invoices visible at once (table)
- ✅ Payment history (trend analysis)
- ✅ Communication health (can we reach them?)
- ✅ No tabs needed (everything fits on 1 page)

---

## Side-by-Side Comparison

| Feature | Invoice Detail | Customer Detail |
|---------|---|---|
| **Primary Goal** | Track THIS invoice recovery | Understand THIS customer relationship |
| **Time Horizon** | Days/weeks (focused on recovery) | Months (trends & patterns) |
| **Layout** | Linear timeline (vertical) | Dashboard overview (grid) |
| **Key Metric** | Days overdue, current stage | Total AR, risk score, trend |
| **Agent Info** | What's next? Actions? | How active? Contact health? |
| **User Action** | Send email, mark paid, pause | Understand customer, batch ops |
| **Tabs** | ❌ NONE (single scroll) | ❌ NONE (single scroll) |
| **Visual** | Timeline (storytelling) | Grid + Table (data-driven) |
| **Data Density** | Low (focus on current action) | Medium (trends + list) |

---

## Implementation Roadmap

### Phase 1: Invoice Detail Redesign (2-3 hours)
1. Create `InvoiceTimeline.tsx` component (visual timeline)
2. Create `InvoiceHeader.tsx` (sticky header)
3. Remove tabs → flatten to single page
4. Reorder sections: Header → Timeline → Details → Actions
5. Add "Next Step" prominent display
6. Remove unnecessary fields

### Phase 2: Customer Detail Redesign (3-4 hours)
1. Create `RiskAssessment.tsx` component
2. Create `CommunicationHealth.tsx` component
3. Create `InvoiceTable.tsx` (replace tabbed invoices view)
4. Create `PaymentTimeline.tsx` (chart showing payment history)
5. Remove tabs → flatten to single page
6. Add "Risk Trend" indicator

---

## Key Differences Summary

### Invoice Detail (Transformation)
| Current | Proposed |
|---------|----------|
| Multiple tabs | Single page |
| Static details | Visual timeline |
| "Details" tab | "Timeline" section |
| No clear next action | "Next Step" prominent |
| Same structure as customer | Unique invoice flow |

### Customer Detail (Transformation)
| Current | Proposed |
|---------|----------|
| Multiple tabs | Single page |
| Profile-focused | Risk/AR-focused |
| "Overview" tab | Risk dashboard |
| "Invoices" tab | Invoices table |
| No risk breakdown | Risk breakdown visible |
| No communication health | Communication health shown |

---

## Visual Style Inspiration

- **Stripe Invoices**: Clean timeline, status badges, clear CTAs
- **Linear Issues**: Minimal design, progress tracking, smart CTAs
- **Shopify Orders**: Dashboard cards + detailed timeline
- **Figma Projects**: Grid overview → drill down to detail