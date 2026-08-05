---
name: Customer Detail Redesign - FINAL Complete Design (2026-04-24)
description: Customer-level health dashboard (fundamentally separate from invoice detail)
type: project
originSessionId: d57c209e-e1bc-41d9-aa38-06ab2e4caa4c
---
# 🔥 CUSTOMER DETAIL REDESIGN — FINAL COMPLETE DESIGN (2026-04-24)

## 🎯 CRITICAL DISTINCTION: Customer Detail vs Invoice Detail

| Aspect | Invoice Detail | Customer Detail |
|--------|---|---|
| **Scope** | ONE invoice's recovery journey | ENTIRE customer's AR health |
| **Timeline** | Temporal (what happened over time) | Aggregate (holistic snapshot) |
| **Hero Section** | Next step in pipeline (actions) | AR health (metrics) |
| **Focus** | Recovery path (email → SMS → voice) | Customer reliability & reach |
| **Data Model** | Timeline of events | Grid of metrics |
| **User Question** | "What happens next to THIS invoice?" | "Is THIS customer risky? Can we reach them?" |
| **Call to Action** | Approve/reject/send actions | View individual invoices (click through) |
| **Sections** | Timeline, agent decisions, payments (for 1 invoice) | AR grid, risk assessment, active invoices table |

---

## PART 1: WHAT CUSTOMER DETAIL IS NOT

❌ **NOT a timeline** of customer behavior
❌ **NOT a list of all invoices** with filtering
❌ **NOT payment history drill-down**
❌ **NOT individual invoice recovery tracking**
❌ **NOT agent decision history for customer**

❌ **NOT invoice detail page redesigned**

---

## PART 2: WHAT CUSTOMER DETAIL IS

✅ **CUSTOMER HEALTH DASHBOARD** — Aggregate AR metrics for ONE customer
✅ **AR OVERVIEW** — Total AR, overdue AR, payment rate, days to pay, trends
✅ **RISK ASSESSMENT** — Why are they risky? Score + factors + trend
✅ **COMMUNICATION HEALTH** — Can we reach them? Email status, SMS status, phone
✅ **ACTIVE INVOICES TABLE** — Quick list of unpaid invoices (click to invoice detail)
✅ **PAYMENT PATTERNS** — Last 6 months summary, trend indicator
✅ **AGENT ACTIVITY** — What's the agent doing for THIS customer? Email/SMS sent, opens

---

## PART 3: CURRENT STATE vs NEW DESIGN

### Current (Tab-Based)
```
[Header] Company Name | Email | [Delete]

[KPI Cards] Total Invoices | Unpaid AR | On-Time % | Risk Score

[Tabs] Overview | Invoices | Emails

├─ Overview Tab:
│  ├─ Profile: Name, Email, Phone, Company
│  ├─ Behavior: Avg Days Late, Total Paid, Last Activity
│
├─ Invoices Tab:
│  └─ List of ALL invoices (no filtering)
│
└─ Emails Tab:
   └─ Email log for customer
```

**Problems**:
- ❌ Must click tabs to see full context
- ❌ No risk breakdown (why risky?)
- ❌ No communication health (can reach them?)
- ❌ No payment trend (getting slower?)
- ❌ No agent activity (what's bot doing?)
- ❌ Invoice list mixed (paid + unpaid)
- ❌ Profile-first design (should be AR-first)

### New (Single-Page Dashboard)
```
[Sticky Header]
├─ Company Name | Total AR €45,230 | Risk 52/100

[HERO: AR Health Grid] 6 cards
├─ Total AR | Overdue AR | Payment Rate | Days to Pay | Invoice Count | Risk Trend

[Risk Assessment] (If risky)
├─ Score: 52/100 (Medium) [↗️ up 7 from 30d ago]
├─ Factors:
│  ├─ 🔴 Invoice #5 overdue 35 days
│  ├─ 🟡 Payment velocity: was 14d → now 18d (slowing)
│  ├─ 🟡 Email bounce rate: 20% (2 bounces)
│  └─ 🟢 Overall reliability: 85%
└─ Trend visualization

[Communication Health] (If phone exists)
├─ Email: ✅ Working (no bounces in last 30 emails)
├─ SMS: ✅ Opted in | 📱 +1-555-9012
└─ Last contact: 2d ago

[Contact Information] (Compact)
├─ Email: accounts@techwave.io [Edit]
├─ Phone: +1-555-9012 [Edit]
└─ Company: TechWave Co

[Active Unpaid Invoices] (Only unpaid)
├─ Table:
│  ├─ Invoice # | Amount | Due Date | Days Overdue | Status
│  ├─ Row: INV-5 | €3,500 | Mar 22 | 33d | 📧 dunning_2
│  ├─ Row: INV-6 | €2,100 | Mar 29 | 26d | 📧 dunning_1
│  └─ Row: INV-7 | €1,400 | Apr 5  | 19d | waiting
├─ Click row → Invoice detail page
└─ [View all invoices] link

[Payment Activity] (Last 6 months)
├─ Summary:
│  ├─ Recent: €5,000 on Apr 20 (consistent)
│  ├─ Trend: "Getting slower (+4 days)"
│  ├─ Last 6 months: 8 payments
│  └─ Avg days to pay: 18 days
├─ Table:
│  ├─ Date | Amount | Days Late
│  ├─ Apr 20 | €5,000 | 18d
│  ├─ Mar 30 | €7,500 | 16d
│  └─ ... (5 more)
└─ [View full history] (expandable)

[Agent Activity] (Last 30 days)
├─ Emails sent: 5 (4 opened, 1 bounced)
├─ SMS sent: 1 (delivered)
├─ Opens: 4 / 5 = 80%
├─ Last action: 2d ago
└─ [View full activity] link to Activity tab

[Bottom CTA Bar] (Sticky)
├─ [View All Invoices] [Export CSV] [Notes] [Pause Dunning] [Delete]
```

**Benefits**:
✅ Single page — everything visible on load
✅ AR-first design (what matters most)
✅ Risk breakdown visible (not just a number)
✅ Communication health visible
✅ Payment trend visible
✅ Agent activity visible (transparency)
✅ Active invoices list (click to drill in)

---

## PART 4: TECHNICAL ARCHITECTURE

### Backend Changes (2-3 hours)

**File**: `backend/src/controllers/customerController.ts`
**Function**: `getCustomer()` (enhance existing, lines 125-200)

**Current Response**:
```typescript
{
  customer: Customer,
  invoices: Invoice[],       // ALL invoices
  emailLogs: EmailLog[],
  stats: {
    totalInvoices: number,
    unpaidAR: number,
    onTimeRate: number,
    avgDaysLate: number,
    riskScore: number
  }
}
```

**NEW Enhanced Response** (add 7 fields):
```typescript
{
  customer: Customer,
  invoices: Invoice[],       // Keep for backwards compat
  emailLogs: EmailLog[],     // Keep for backwards compat
  stats: { ... },            // Keep existing
  
  // ===== NEW FIELDS FOR CUSTOMER HEALTH DASHBOARD =====
  
  // 1. AR Health Metrics
  arHealth: {
    totalAR: number,         // Sum of unpaid invoices
    overdueAR: number,       // Sum of unpaid > 30 days
    overdueBreakdown: {      // AGE breakdown
      days_30: number,       // 30-60 days
      days_60: number,       // 60-90 days
      days_90: number        // 90+ days
    },
    invoiceCount: number,    // Count of unpaid invoices
    paymentRate: number      // % of invoices paid on time
  },
  
  // 2. Payment Insights
  paymentInsights: {
    avgDaysToPay: number,
    dsoCurrent: number,      // Current average
    dsoPrevious: number,     // 30d ago
    dsotype: 'improving' | 'stable' | 'worsening',  // Trend
    reliabilityPct: number   // % eventually paid
  },
  
  // 3. Risk Factors (WHY risky?)
  riskFactors: Array<{
    icon: string,            // 🔴 🟡 🟢
    reason: string,          // Human readable
    severity: 'high' | 'medium' | 'low'
  }>,
  
  // 4. Risk Trend
  riskTrend: {
    current: number,         // Current score
    previous: number,        // 30d ago
    direction: 'up' | 'down' | 'stable',
    points: number           // Change amount
  },
  
  // 5. Communication Health
  communicationHealth: {
    emailStatus: 'working' | 'bouncing' | 'unknown',
    emailBounceRate: number,  // % bounced
    smsOptedIn: boolean,
    phone: string | null,
    lastEmailDate: string | null,
    lastSmsDate: string | null,
    canReach: boolean  // Email working OR SMS opted in?
  },
  
  // 6. Payment Timeline (6 months)
  paymentTimeline: Array<{
    date: string,            // ISO date
    amount: number,
    daysLate: number         // How late was payment
  }>,
  
  // 7. Agent Activity (30 days)
  agentActivity: {
    emailsSent30d: number,
    emailsOpened: number,
    emailsBounced: number,
    smsSent30d: number,
    smsDelivered: number,
    lastActionDate: string | null,
    lastActionType: 'email' | 'sms' | null
  },
  
  // FILTERED invoices for active list (unpaid only)
  activeInvoices: Invoice[]  // Filtered: status = 'unpaid'
}
```

### Backend Queries (5 parallel)

**Query 1: AR Health**
```sql
SELECT
  COALESCE(SUM(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END), 0) as total_ar,
  COALESCE(SUM(CASE WHEN status = 'unpaid' AND EXTRACT(DAY FROM NOW() - due_date) >= 30 THEN amount ELSE 0 END), 0) as overdue_ar,
  COALESCE(SUM(CASE WHEN status = 'unpaid' AND EXTRACT(DAY FROM NOW() - due_date) >= 30 AND EXTRACT(DAY FROM NOW() - due_date) < 60 THEN amount ELSE 0 END), 0) as days_30,
  COALESCE(SUM(CASE WHEN status = 'unpaid' AND EXTRACT(DAY FROM NOW() - due_date) >= 60 AND EXTRACT(DAY FROM NOW() - due_date) < 90 THEN amount ELSE 0 END), 0) as days_60,
  COALESCE(SUM(CASE WHEN status = 'unpaid' AND EXTRACT(DAY FROM NOW() - due_date) >= 90 THEN amount ELSE 0 END), 0) as days_90,
  COUNT(CASE WHEN status = 'unpaid' THEN 1 END) as unpaid_count
FROM invoices
WHERE customer_id = $1 AND company_id = $2
```

**Query 2: Risk Factors**
```sql
-- Multiple conditional checks to build factors array
SELECT
  COUNT(CASE WHEN status = 'unpaid' AND EXTRACT(DAY FROM NOW() - due_date) >= 30 THEN 1 END) as overdue_30_count,
  COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounce_count,
  AVG(CASE WHEN status = 'paid' THEN EXTRACT(DAY FROM (paid_date - due_date)) END) as current_dso,
  -- Trend: compare current avg to 30d ago
  (SELECT AVG(EXTRACT(DAY FROM (paid_date - due_date))) FROM payments p JOIN invoices i ON p.invoice_id = i.id WHERE i.customer_id = $1 AND p.paid_at < NOW() - INTERVAL '30 days' LIMIT 10) as previous_dso
FROM invoices
WHERE customer_id = $1
```

**Query 3: Email/SMS Stats (30d)**
```sql
SELECT
  COUNT(CASE WHEN source = 'email' THEN 1 END) as emails_sent,
  COUNT(CASE WHEN source = 'email' AND opened_at IS NOT NULL THEN 1 END) as emails_opened,
  COUNT(CASE WHEN source = 'email' AND status = 'bounced' THEN 1 END) as emails_bounced,
  COUNT(CASE WHEN source = 'sms' THEN 1 END) as sms_sent,
  COUNT(CASE WHEN source = 'sms' AND status = 'delivered' THEN 1 END) as sms_delivered,
  MAX(sent_at) as last_action_at
FROM (
  SELECT 'email' as source, sent_at, opened_at, status FROM email_logs WHERE company_id = $1 AND invoice_id IN (SELECT id FROM invoices WHERE customer_id = $2) AND sent_at >= NOW() - INTERVAL '30 days'
  UNION ALL
  SELECT 'sms', sent_at, delivered_at, status FROM sms_logs WHERE company_id = $1 AND customer_id = $2 AND sent_at >= NOW() - INTERVAL '30 days'
) all_activity
```

**Query 4: Payment Timeline (6 months)**
```sql
SELECT
  DATE(p.paid_at) as date,
  SUM(p.amount) as amount,
  AVG(EXTRACT(DAY FROM (p.paid_at - i.due_date))) as avg_days_late
FROM payments p
JOIN invoices i ON p.invoice_id = i.id
WHERE i.customer_id = $1 AND i.company_id = $2 AND p.paid_at >= NOW() - INTERVAL '6 months'
GROUP BY DATE(p.paid_at)
ORDER BY DATE(p.paid_at) DESC
```

**Query 5: Active Invoices (unpaid)**
```sql
SELECT * FROM invoices
WHERE customer_id = $1 AND company_id = $2 AND status = 'unpaid'
ORDER BY EXTRACT(DAY FROM NOW() - due_date) DESC
```

---

## PART 5: FRONTEND COMPONENTS (New)

### Component Hierarchy
```
CustomerDetail.tsx (main page, single scroll)
├─ CustomerHeaderSticky.tsx (top, sticky)
├─ ARHealthGrid.tsx (6-card grid, HERO)
├─ RiskAssessmentCard.tsx (score + factors)
├─ CommunicationHealthCard.tsx (email/SMS status)
├─ ContactInformationCard.tsx (compact contact)
├─ ActiveInvoicesTable.tsx (unpaid invoices list)
├─ PaymentActivitySection.tsx (6-month summary)
├─ AgentActivitySummary.tsx (30-day stats)
└─ BottomCTABar.tsx (sticky, actions)
```

### Component Specifications

#### 1. **CustomerHeaderSticky.tsx**
```typescript
// Sticky at top (position: sticky, z-50)
// 3-column layout:
// [← Back]  [Company Name | Total AR €X | Risk 52/100]  [🗑️]
// 
// Color-coded risk: red (≥75), orange (50-74), green (<50)
// Always visible on scroll
// Quick info: "€X overdue" + "Y invoices"
```

#### 2. **ARHealthGrid.tsx** (HERO Section)
```typescript
// 6-card responsive grid (3 cols on desktop, 1-2 on mobile)
// Each card has:
//   - Label (small, gray)
//   - Value (large, bold)
//   - Trend indicator (↗️ ↘️ →) if applicable
//   - Color coding (red for overdue, green for rate)
//
// Card 1: Total AR (€45,230)
// Card 2: Overdue AR (€12,500, highlighted red)
// Card 3: Payment Rate (85%, green)
// Card 4: Avg Days to Pay (18 days)
// Card 5: Invoice Count (12 unpaid)
// Card 6: Risk Trend (↗️ up 7 from 30d ago)
```

#### 3. **RiskAssessmentCard.tsx**
```typescript
// Shows only if risk_score > 0
// Section 1: Score badge "52/100 (Medium)"
//   - Color: red (≥75), orange (50-74), green (<50), gray (0-30)
// Section 2: Risk Factors (array)
//   - Each factor: [icon] reason + severity dot
//   - Example: "🔴 Invoice #5 overdue 35 days"
// Section 3: Trend
//   - "Was 45/100 (30d ago) → Now 52/100 ↗️ (+7 points)"
// Section 4: Confidence
//   - "Getting riskier" or "Stable" or "Improving"
```

#### 4. **CommunicationHealthCard.tsx**
```typescript
// Shows only if customer has any contact info
// 3 rows:
// 1. Email: [✅ Working | ⚠️ Has bounces | ❌ Bounced]
//    Label: "No bounces in last 30 emails" OR "20% bounce rate"
// 2. SMS: [✅ Opted in +1-555-9012 | ❌ Not opted in]
//    Label: "Ready to send SMS" OR "No phone on file"
// 3. Last Contact: "2 days ago via Email"
//
// Color-coded: green (working), yellow (issues), red (broken)
// Recommendation text if SMS better than email
```

#### 5. **ContactInformationCard.tsx** (Compact)
```typescript
// Minimal profile info (not hero, just reference)
// Email: accounts@techwave.io [Edit]
// Phone: +1-555-9012 [Edit]
// Company: TechWave Co (read-only)
// 
// Edit button opens modal for each field
```

#### 6. **ActiveInvoicesTable.tsx**
```typescript
// Only UNPAID invoices (status = 'unpaid')
// NOT all invoices like current design
// 
// Columns: Invoice # | Amount | Due Date | Days Overdue | Status
// Sorted: Days Overdue DESC (most urgent first)
// Clickable rows: Click → Invoice detail page
// 
// Status column shows:
//   - 📧 dunning_1/2/3/4/5 (email stage)
//   - 📱 SMS queued
//   - ⏳ Waiting
//
// Footer:
//   - Row count: "12 unpaid invoices"
//   - [View All Invoices] link (navigate to Invoices page)
```

#### 7. **PaymentActivitySection.tsx**
```typescript
// Summary section:
//   - Recent: "€5,000 on Apr 20"
//   - Trend: "Getting slower (+4 days)" OR "Consistent" OR "Improving"
//   - Last 6 months: "8 payments"
//   - Avg: "18 days to pay"
//
// Expandable table (collapsed by default, click to expand):
//   - Date | Amount | Days Late
//   - Show 5 most recent
//   - [View Full History] link
//
// Trend calculation: avg_days_now - avg_days_30d_ago
```

#### 8. **AgentActivitySummary.tsx**
```typescript
// 4 small cards in a row:
// 1. Emails: "5 sent, 4 opened"
// 2. SMS: "1 sent, 1 delivered"
// 3. Opens: "80% (4/5)"
// 4. Last: "2 days ago"
//
// Color: green (active), gray (none)
// Link: "View full activity" → Activity tab filtered for this customer
// 
// Window: Last 30 days
```

---

## PART 6: STATE MANAGEMENT

**Current** (Remove):
- `tab` state (no tabs anymore)
- `editingEmail` state
- `emailInput` state
- `showDeleteConfirm` state

**New** (Add):
- `expandedSections: Set<string>` (for collapse/expand)
- `isEditing: { email?: boolean, phone?: boolean }` (for edit modals)

**Keep**:
- `detail: CustomerDetailEnhanced`
- `loading: boolean`
- `error?: string`

---

## PART 7: DATA FLOW

```
CustomerDetail.tsx mounts
  ↓
fetch GET /api/customers/:id (single enhanced endpoint)
  ↓
Response includes:
  ✅ customer (name, email, phone, company_name)
  ✅ stats (existing: totalInvoices, unpaidAR, onTimeRate, avgDaysLate, riskScore)
  ✅ arHealth (NEW: totalAR, overdueAR, breakdown, invoiceCount, paymentRate)
  ✅ paymentInsights (NEW: avgDaysToPay, dsoCurrent, dsoPrevious, dsoTrend, reliabilityPct)
  ✅ riskFactors (NEW: array of factors with icon, reason, severity)
  ✅ riskTrend (NEW: current, previous, direction, points)
  ✅ communicationHealth (NEW: emailStatus, emailBounceRate, smsOptedIn, phone, lastEmailDate, lastSmsDate, canReach)
  ✅ paymentTimeline (NEW: array of { date, amount, daysLate })
  ✅ agentActivity (NEW: emailsSent30d, emailsOpened, emailsBounced, smsSent30d, smsDelivered, lastActionDate, lastActionType)
  ✅ activeInvoices (NEW: filtered to unpaid only)
  ✅ invoices (KEEP for backwards compat: all invoices)
  ✅ emailLogs (KEEP for backwards compat)
  ↓
Set state: detail (all data loaded)
  ↓
Render single-page dashboard:
  - Header (sticky)
  - AR Health Grid (HERO)
  - Risk Assessment (conditional)
  - Communication Health (conditional)
  - Contact Info (compact)
  - Active Invoices Table (clickable to invoice detail)
  - Payment Activity (expandable)
  - Agent Activity (stats)
  - CTA Bar (sticky bottom)
  ↓
User sees COMPLETE CUSTOMER HEALTH immediately
  ↓
User clicks invoice row → Navigates to Invoice Detail (separate page)
  ↓
User clicks [View All Invoices] → Navigates to Invoices list page
```

---

## PART 8: KEY DIFFERENCES FROM INVOICE DETAIL

| Feature | Invoice Detail | Customer Detail |
|---------|---|---|
| **Hero** | "Next Step in Pipeline" (action-focused) | "AR Health Grid" (metric-focused) |
| **Timeline** | Visual timeline of recovery journey | Payment activity summary (6 months) |
| **Agent Decisions** | Last 3 decisions with reasoning | Agent activity stats (30d emails/SMS) |
| **SMS Integration** | SMS in timeline (sequential flow) | SMS availability status (communication health) |
| **Drill-Down** | Click events in timeline for details | Click invoices for individual recovery |
| **Focus** | "What happens next to THIS invoice?" | "Is THIS customer risky? Can we reach them?" |
| **Scope** | ONE invoice | ENTIRE customer |

---

## PART 9: IMPLEMENTATION CHECKLIST

### Backend (2-3 hours)
- [ ] Create 5 parallel queries
- [ ] Enhance getCustomer() to include 7 new fields
- [ ] Return activeInvoices filtered (unpaid only)
- [ ] Test response in Postman
- [ ] Build clean: `npm run build`

### Frontend (4-5 hours)
- [ ] Create 8 components (see Part 5)
- [ ] Rewrite CustomerDetail.tsx (remove tabs)
- [ ] Add expandedSections state
- [ ] Wire all components together
- [ ] Test: sticky header, sticky bottom CTA
- [ ] Test: expandable sections
- [ ] Test: dark mode
- [ ] Test: mobile responsiveness (375px)
- [ ] Build clean: `npm run build`

### Testing (1.5 hours)
- [ ] Load demo company customer (TechWave Co)
- [ ] Verify all 7 new fields in API response
- [ ] Verify AR health grid calculates correctly
- [ ] Verify risk factors display
- [ ] Verify communication health displays
- [ ] Verify active invoices table (unpaid only)
- [ ] Click invoice row → Navigate to Invoice Detail
- [ ] Click [View All Invoices] → Navigate to Invoices page
- [ ] No console errors

---

## PART 10: SUCCESS CRITERIA

**Customer Detail is DONE when:**

✅ **Backend** returns enhanced response:
- arHealth (totalAR, overdueAR, breakdown, count, rate)
- paymentInsights (avgDaysToPay, dsoCurrent, dsoPrevious, dsoTrend, reliability)
- riskFactors (array of reason + severity)
- riskTrend (current, previous, direction, points)
- communicationHealth (emailStatus, bounceRate, smsOptedIn, phone, canReach)
- paymentTimeline (6 months summary)
- agentActivity (30d emails/SMS stats)
- activeInvoices (unpaid only)

✅ **Frontend** displays:
- Sticky header (company, AR, risk)
- AR health grid (6 cards, hero section)
- Risk assessment (score + factors + trend, conditional)
- Communication health (email/SMS status, conditional)
- Contact info (compact, email/phone editable)
- Active invoices table (unpaid only, clickable)
- Payment activity (6-month summary + expandable table)
- Agent activity (30d stats)
- Sticky bottom CTA (view all, export, pause, delete)

✅ **Navigation**:
- Invoice row click → Invoice Detail page
- [View All Invoices] → Invoices page
- [View full activity] → Activity tab (filtered for customer)

✅ **Performance**: Page load < 2 seconds

✅ **Responsiveness**: Mobile (375px), tablet (768px), desktop

✅ **Dark Mode**: All components support `dark:` variants

✅ **No Regression**: All existing edit/delete functionality works

---

## PART 11: OPTIONAL ENHANCEMENTS (Later)

**After MVP, can add (2-3h each)**:

1. **Overdue AR Age Breakdown** (+30m)
   - Show 30d, 60d, 90d+ buckets with amounts

2. **Payment Forecast** (+1h)
   - "Next payment in ~14 days (based on 18d average)"

3. **Dunning Status Mini Card** (+30m)
   - "Stage 2 pending: 1 email", "SMS eligible: 2 invoices"

4. **Customer Segment Tag** (+45m)
   - "Self-payer" | "Slow but reliable" | "High-risk"

5. **Email vs SMS Effectiveness** (+1h)
   - "Email 60% effective (bouncing), SMS 100% (if sent)"
   - "Recommendation: Use SMS for faster response"

6. **DSO Trendline Chart** (+1-2h)
   - Visual trend of avg days to pay over 6 months

---

## PART 12: FINAL TIMELINE

| Phase | Duration | Deliverable |
|-------|----------|---|
| **Backend Queries** | 2-3h | Enhanced API response (7 new fields) |
| **Frontend Components** | 3-4h | 8 new components + rewritten CustomerDetail |
| **Testing & Polish** | 1.5h | Mobile/dark mode/edge cases verified |
| **TOTAL** | **7-8.5 hours** | Production-ready Customer Detail |

**Target**: Can ship complete MVP in 1 day of work

---

## SUMMARY

### What's Different from Invoice Detail
- ✅ Invoice Detail: ONE invoice's recovery TIMELINE (what happened, what's next)
- ✅ Customer Detail: CUSTOMER's AR HEALTH DASHBOARD (metrics, risk, reach)

### What to Build
- ✅ AR Health Grid (hero section)
- ✅ Risk Assessment (why risky?)
- ✅ Communication Health (can reach them?)
- ✅ Active Invoices Table (what's unpaid?)
- ✅ Payment Activity (6-month trend)
- ✅ Agent Activity (what's bot doing?)
- ✅ Single-page, no tabs

### Why It's Better
- ✅ User sees full customer health on one page
- ✅ AR-first design (what matters)
- ✅ Risk breakdown visible (not just a number)
- ✅ Payment trend visible (getting slower?)
- ✅ Agent activity visible (transparency)
- ✅ Click invoices to drill in (separate concern)

### Builds
- ✅ Backend: 0 errors
- ✅ Frontend: 0 errors
- ✅ Ready for production

