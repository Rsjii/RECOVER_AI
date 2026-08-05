# 🔥 FINAL 3-FLOW INTEGRATION ANALYSIS (2026-04-21)

## STATUS: FIRST PASS MOSTLY COMPLETE — INTERCONNECTION + REFINEMENT PHASE NEEDED

**What We Have Staged**: 24 files (notifications + agentLoop + dashboard improvements)
**What's Missing**: Activity events wiring + detail page redesigns + full integration testing

---

## PART 1: AGENTLOOP/DUNNING FLOW

### ✅ CURRENT STATE (STAGED)

**File**: `backend/src/queue/agentLoop.ts` (fully rewritten, 482 lines)

**4-GATE PIPELINE IMPLEMENTED**:
1. ✅ **Gate 1** — Prevents multiple pending items per invoice (line 262-278)
   - Checks `pilotQueuedEmails.status = 'pending_approval'`
   - Skips invoice if item already queued
   
2. ✅ **Gate 2** — Unified timing (gap-based, not separate logic) (line 280-299)
   - Gets last sent item (any type) from pilotQueuedEmails
   - Calculates tierGapDays based on risk tier (7, 6, 5, 4 days)
   - Compares NOW vs lastSentTime
   
3. ⚠️ **Gate 3** — SMS intelligent timing (PARTIAL)
   - Reads `payment_insights.avg_emails_before_payment` (line 230)
   - Applies tier adjustments (slow payer: tier+1, self-payer: tier-1)
   - **MISSING**: Default fallback if payment_insights is NULL (should use SMS_MIN_EMAILS_SENT=2)
   
4. ✅ **Gate 4** — Priority queue logic (emails first, then SMS)
   - Email: checks rejection block + hard bounce detection
   - SMS: checks emailsSent >= avgEmailsNeeded threshold
   - Voice: commented out (Phase 2)

**Agent Decisions Logging**: ✅ Implemented
- `logAgentDecision()` called with metadata (tier, gap, avgEmailsNeeded, etc)
- Stored in `agent_decisions` table for learning

**What Works**:
- ✅ Decision engine runs every 6 hours (cron)
- ✅ 4-gate pipeline prevents chaos
- ✅ Risk tier calculated correctly
- ✅ Payment insights read + applied
- ✅ Dunning pauses respected
- ✅ Demo company filtered

### ❌ CURRENT GAPS (NEED FIXING)

**Critical Issues**:

1. **Payment Insights NULL Handling** — Line 230
   ```typescript
   const avgEmailsNeeded = invoice.payment_insights?.avg_emails_before_payment ?? null;
   ```
   - If NULL, tier adjustment logic doesn't run
   - **FIX**: Should use SMS_MIN_EMAILS_SENT default if null
   - **Impact**: New customers may not escalate to SMS correctly

2. **Hard Bounce Escalation NOT Wired to Notifications**
   - Code detects hard bounce (line checks email_logs status)
   - **MISSING**: When hard bounce detected → should create `EMAIL_BOUNCED` notification
   - **Current**: Only logs to agent_decisions (user doesn't see it)
   - **Fix needed**: Call `logEmailBouncedNotification()` when hard bounce path triggered

3. **Unreachable Path Incomplete**
   - When SMS unavailable + email bounced → marks customer "unreachable"
   - **MISSING**: No notification created when marked unreachable
   - **Fix needed**: Call `logUnreachableNotification()` at that point

4. **Daily Actions Notification Not Wired**
   - Should trigger when ≥3 emails queued
   - **Current**: `logDailyActionsAvailableNotification()` function exists (notificationLogger.ts:161)
   - **MISSING**: Call it in agentLoop when emailsQueued >= 3
   - **Impact**: Bell icon shows no alert for approved actions

5. **Agent Decisions Not Shown to User (Activity Tab)**
   - Agent logs decisions → agent_decisions table
   - **MISSING**: Activity tab doesn't query/display agent decisions
   - **Current**: Activity.tsx only shows email logs
   - **Fix needed**: Add "Agent Decisions" tab or section with last 5 runs

### 🔄 WHAT IT SHOULD BE

The complete flow after fixes:

```
Every 6 hours:
  ↓
Get unpaid invoices
  ├─ Filter: not demo, not paused
  ├─ Filter: email on file
  └─ Filter: due_date < NOW + 7d
  ↓
For each invoice:
  ├─ GATE 1: Pending item? → Skip
  │
  ├─ GATE 2: Time for next item?
  │  ├─ Get last sent timestamp
  │  ├─ Calculate tier (risk_score + dunning_tone + payment_insights)
  │  ├─ Apply gap (7/6/5/4 days based on tier)
  │  └─ Is NOW >= nextEligible? → Continue
  │
  ├─ GATE 3: What to queue (Email → SMS → Voice)?
  │  ├─ Email: ✅ Tier 1 → dunning_1
  │  ├─ Email: ✅ Tier 2 → dunning_2
  │  ├─ Email: ✅ Tier 3 → dunning_3
  │  ├─ Email: ✅ Tier 4 → dunning_4 (+ add tier 5 if 60+ days)
  │  ├─ SMS: NEEDS FIX ✅ Check emailsSent >= Math.ceil(avgEmailsNeeded ?? 2)
  │  └─ SMS: ✅ Create notification + notification event
  │
  ├─ HIGH-RISK ALERT: if risk_score >= 75 + daysOverdue >= 30
  │  └─ Send Slack notification (already implemented)
  │
  ├─ LOG TO AGENT DECISIONS:
  │  ├─ What was queued (email/SMS/voice)
  │  ├─ Why (tier, gap, avgEmailsNeeded)
  │  ├─ Metadata for transparency
  │  └─ Timestamp for audit
  │
  └─ NOTIFICATIONS:
     ├─ Email bounced? → EMAIL_BOUNCED notification ⚠️ MISSING
     ├─ Marked unreachable? → UNREACHABLE notification ⚠️ MISSING
     └─ ≥3 emails queued? → DAILY_ACTIONS_READY notification ⚠️ MISSING
```

---

## PART 2: NOTIFICATION FLOW (Bell + Activity)

### ✅ CURRENT STATE (STAGED)

**Backend**:
- ✅ `notification_events` table (schema.sql) — 8 event types supported
- ✅ `notificationEvents.ts` (DB CRUD) — 7 functions
- ✅ `notificationsController.ts` (API) — 7 endpoints
  - GET /api/notifications/unread
  - GET /api/notifications
  - GET /api/notifications/unread-count
  - POST /api/notifications/:id/read
  - POST /api/notifications/:id/dismiss
  - GET /api/notifications/by-type/:type
  - POST /api/notifications/mark-all-as-read
- ✅ `notificationLogger.ts` (event helpers) — 9 notification functions
- ✅ Wired in: stripeService.ts, emailController.ts, scheduler.ts

**Frontend**:
- ✅ `NotificationCenter.tsx` (bell icon component)
  - Shows unread count
  - Popover with last 7 days
  - Click event → navigate + mark as read
  - Dismiss button (soft delete)
- ✅ `NotificationsSection.tsx` (settings panel)
  - Preferences UI (toggles + time pickers)
  - Save/load with API
- ✅ Bell always visible in Header.tsx

**8 Notification Event Types Supported**:
1. ✅ `STRIPE_NOT_CONNECTED` (critical) — system health check
2. ✅ `EMAIL_NOT_CONFIGURED` (critical) — system health check
3. ✅ `TRIAL_ENDING` (critical) — scheduler job
4. ✅ `TRIAL_EXPIRED` (critical) — scheduler job
5. ✅ `AGENT_PAUSED` (critical) — manual override
6. ✅ `PAYMENT_RECEIVED` (warning) — Stripe webhook
7. ✅ `EMAIL_BOUNCED` (warning) — Resend webhook
8. ✅ `DAILY_ACTIONS_READY` (warning) — agent loop (NOT WIRED YET)

### ❌ CURRENT GAPS (NEED FIXING)

**Critical Issues**:

1. **Activity Tab Not Connected to Notifications** ⚠️
   - `Activity.tsx` only shows `emailLogs` (Pending Approval + Sent & Tracked)
   - **MISSING**: SMS activity, Payments, Agent Decisions
   - **Current**: Tabs defined but commented out (lines 16-18)
   - **Impact**: User can't see SMS history or payment tracking in Activity
   - **Fix needed**: Uncomment tabs + wire API endpoints for SMS logs, payments, agent decisions

2. **No Activity Events Table** ❌
   - Different from `notification_events` (which are alerts in bell)
   - **Needed**: Permanent audit trail of what agent did
   - **Missing schema**: `activity_events` table
   - **Needed columns**: id, company_id, event_type, actor, metadata, created_at (no read_at)
   - **Impact**: No historical record of SMS sent, payments detected, risk changes, etc

3. **SMS Logs Not Wired** ❌
   - SMS can be queued in agentLoop.ts
   - **MISSING**: No `sms_logs` table to store results
   - **Current**: sms_count field exists on invoices (stores count only)
   - **Fix needed**: Create sms_logs table + wire twilio callback
   - **Columns needed**: id, invoice_id, customer_id, company_id, phone, message, status, created_at, delivered_at

4. **Payment Insights Not Always Populated** ⚠️
   - Calculated on CSV import + Stripe sync
   - **MISSING**: Default for new customers (may be NULL)
   - **Fix needed**: Always default to SMS_MIN_EMAILS_SENT if null
   - **Current**: agentLoop.ts:230 reads but doesn't handle null gracefully

5. **Notification Preferences Not Enforced** ⚠️
   - UI exists for preferences (NotificationsSection.tsx)
   - **MISSING**: System doesn't CHECK preferences before sending
   - **Current**: All notifications sent regardless of preference
   - **Note**: Phase 3 feature (email digests need this)
   - **Phase 1 approach**: Send all notifications now, preference checks come later

6. **Event Metadata Not Always Populated** ⚠️
   - Notification events created with metadata field
   - **MISSING**: Metadata not always populated (should include customer_id, amount, etc)
   - **Impact**: Can't filter notifications by customer or amount
   - **Fix needed**: Always populate metadata in notificationLogger functions

### 🔄 WHAT IT SHOULD BE

**Activity Tab Structure** (after fixes):

```
Activity.tsx (single page, no tabs initially)
  ├─ Section 1: PENDING APPROVAL (pilotQueuedEmails)
  │  ├─ Status: pending_approval
  │  ├─ Columns: Customer, Type, Email Type/SMS/Voice, Amount, Due Date, Created
  │  ├─ Filters: Type (Email/SMS/Voice), Days Overdue
  │  ├─ Multi-select: select multiple + bulk approve/reject
  │  ├─ Preview: click → preview modal
  │  ├─ Edit: click → edit subject/body
  │  └─ Actions: Approve, Reject, Preview, Edit
  │
  ├─ Section 2: REJECTED (7-day block)
  │  ├─ Status: rejected
  │  ├─ Reason: why rejected
  │  ├─ Blocked until: 2026-04-28 (7 days after rejection)
  │  ├─ Actions: Move back to pending, Force approve now
  │  └─ Once blocked expires: auto-move back to pending
  │
  ├─ Section 3: SENT & TRACKED (email_logs) ✅ DONE
  │  ├─ Status: sent, delivered, opened, clicked, bounced, failed
  │  ├─ Filters: by status, customer email
  │  ├─ Search: by customer name or email
  │  ├─ Click row → preview email content
  │  └─ Columns: Customer, Status, Date Sent, Date Opened, Bounced Details
  │
  ├─ Section 4: SMS ACTIVITY (sms_logs) ❌ NEEDS SMS_LOGS TABLE
  │  ├─ Status: queued, sent, delivered, failed
  │  ├─ Columns: Customer, Phone, Message preview, Status, Date Sent
  │  ├─ Click → preview SMS
  │  └─ Filters: by status, customer
  │
  ├─ Section 5: PAYMENTS (activity_events filtered to payment_detected) ❌ NEEDS ACTIVITY_EVENTS TABLE
  │  ├─ Columns: Date, Customer, Amount, Invoice #
  │  ├─ Click → navigate to Invoice detail
  │  └─ Sorted by date DESC
  │
  ├─ Section 6: AGENT DECISIONS (agent_decisions) ⚠️ NEEDS WIRING
  │  ├─ Timestamp, What was decided (email #X queued, SMS queued, etc)
  │  ├─ Why (tier, gap, avgEmailsNeeded reason)
  │  ├─ Metadata displayed inline
  │  └─ Last 10 decisions grouped by run
  │
  └─ GLOBAL FILTERS (across all sections)
     ├─ By type (emails, SMS, payments, decisions)
     ├─ By customer (dropdown)
     ├─ By date range (from/to)
     └─ Search (full text)
```

**Notification Bell** (already implemented, just needs wiring):

```
Bell icon (always visible in Header)
  ├─ Badge: unread count (0 = no badge)
  ├─ Click → popover
  │  ├─ Shows last 7 days notifications
  │  ├─ Color-coded: 🔴 critical, 🟠 warning, 🔵 info
  │  ├─ Each notification:
  │  │  ├─ Icon + title
  │  │  ├─ Message
  │  │  ├─ Dismiss button (X)
  │  │  └─ Click → navigate to action_url + mark read
  │  │
  │  └─ Footer: "View All Activity" (link to /activity)
  │     "Notification Preferences" (link to /settings?tab=notifications)
  │
  └─ 8 Event Types:
     ├─ 🔴 STRIPE_NOT_CONNECTED (critical)
     ├─ 📧 EMAIL_NOT_CONFIGURED (critical)
     ├─ ⏰ TRIAL_ENDING (critical)
     ├─ ❌ TRIAL_EXPIRED (critical)
     ├─ ⏸ AGENT_PAUSED (critical)
     ├─ 💰 PAYMENT_RECEIVED (warning)
     ├─ 🚨 EMAIL_BOUNCED (warning)
     └─ ✅ DAILY_ACTIONS_READY (warning)
```

**Event Routing Rules**:

| Event | Bell | Activity | Type | Wire Point |
|-------|------|----------|------|-----------|
| Email sent | ❌ | ✅ email_logs | Historical | emailService.ts |
| Email opened | ❌ | ✅ email_logs | FYI | webhook |
| Email bounced | ✅ | ✅ email_logs | ACTION | emailController.ts |
| SMS queued | ⚠️ | ✅ sms_logs | Historical | agentLoop.ts |
| SMS sent | ❌ | ✅ sms_logs | FYI | smsService.ts |
| SMS failed | ✅ | ✅ sms_logs | ACTION | twilio webhook |
| Payment detected | ✅ | ✅ activity_events | GOOD NEWS | stripeService.ts |
| Agent run completed | ❌ | ✅ agent_decisions | FYI | agentLoop.ts |
| Daily actions ready | ✅ | ❌ | ACTION NEEDED | agentLoop.ts |
| Stripe disconnected | ✅ | ❌ | CRITICAL | dashboard health check |
| Email not configured | ✅ | ❌ | CRITICAL | dashboard health check |
| Trial ending (3d) | ✅ | ❌ | CRITICAL | scheduler |
| Trial expired | ✅ | ❌ | CRITICAL | scheduler |

---

## PART 3: CUSTOMER + INVOICE DETAIL PAGES

### ❌ CURRENT STATE (NOT STAGED YET)

**Current Implementation**:
- Invoice detail: Still tab-based (Details | Payments | Emails | Dunning)
- Customer detail: Still tab-based (Overview | Invoices | Emails)
- No timeline visualization
- No agent decision transparency
- No SMS logs shown
- No payment tracking insights

**What exists**:
- ✅ `InvoiceDetail.tsx` (exists, but tab-based)
- ✅ `CustomerDetail.tsx` (exists, but tab-based)
- ❌ No timeline component
- ❌ No risk breakdown component
- ❌ No agent decisions display

### 🔄 WHAT IT SHOULD BE

**Invoice Detail (Single-Page Dashboard)**:

```
InvoiceDetail.tsx (no tabs, single scroll page)
  ├─ [STICKY HEADER] — Always visible
  │  ├─ Amount | Status | Days Overdue | Risk Score (color-coded)
  │  ├─ Quick actions: [Send Email] [Send SMS] [Pause] [Mark Paid]
  │  └─ Invoice ID + Customer name
  │
  ├─ [TIMELINE SECTION] — Visual recovery journey
  │  ├─ Vertical timeline, left-aligned
  │  ├─ Events:
  │  │  ├─ Email #1 sent (2026-04-10, 10:30am) ✅
  │  │  ├─ Email #1 opened (2026-04-10, 2:15pm) ✅
  │  │  ├─ Email #2 sent (2026-04-17, 9:00am) ✅
  │  │  ├─ Email #2 bounced (2026-04-17, 10:30am) ❌
  │  │  ├─ SMS queued (2026-04-20, 6:00am) ⏳
  │  │  └─ NEXT → SMS eligible (2026-04-23) 🔜
  │  │
  │  └─ Colors: Green (success), Orange (pending), Red (failed/bounced)
  │
  ├─ [NEXT STEP SECTION] — What happens next
  │  ├─ Current status: "Waiting for SMS approval"
  │  ├─ Last action: "Email #2 bounced (hard failure) on 2026-04-17"
  │  ├─ Next action: "SMS will be sent 2026-04-23 (in 2 days)"
  │  ├─ Reason: "Customer hard bounced, escalating to SMS"
  │  └─ Metadata: "avg_emails_before_payment: 2.3, tier: 2, gap: 6 days"
  │
  ├─ [INVOICE DETAILS GRID] — Key info
  │  ├─ 2x3 grid: Due Date, Customer, Dunning Stage, Tier, Risk Score
  │  └─ Click any → navigate to detail
  │
  ├─ [AGENT ACTIONS SECTION] — Last 3 decisions
  │  ├─ 2026-04-20 06:00 → SMS queued (avg: 2.3)
  │  ├─ 2026-04-17 10:30 → Email bounced (hard), escalating
  │  └─ 2026-04-10 10:30 → Email #1 sent (Tier 2, 6-day gap)
  │
  ├─ [COMMUNICATION LOG] — Collapsed by default
  │  ├─ Email log (status, dates, preview)
  │  ├─ SMS log (status, dates, preview)
  │  └─ Payment log (date, amount, invoice)
  │
  ├─ [PAYMENT TRACKING]
  │  ├─ Last payment: 2026-03-15, €5,000
  │  ├─ Historical days to pay: 18 days
  │  └─ Reliability: 90%
  │
  └─ [CUSTOMER CONTEXT CARD] — Mini snapshot
     ├─ Click → Customer detail page
     └─ Shows: Company, Total AR, Risk, Payment velocity
```

**Customer Detail (Single-Page Dashboard)**:

```
CustomerDetail.tsx (no tabs, single scroll page)
  ├─ [STICKY HEADER]
  │  ├─ Company name | Total AR | Risk score (big, color-coded)
  │  └─ Quick actions: [Export] [Notes] [Pause] [Delete]
  │
  ├─ [AR OVERVIEW GRID] — 6 cards
  │  ├─ Card 1: Total AR (€45,230)
  │  ├─ Card 2: Overdue AR (€12,500, >30d)
  │  ├─ Card 3: Payment rate (85% on time)
  │  ├─ Card 4: Days to pay (18 days avg)
  │  ├─ Card 5: Invoice count (12 total)
  │  └─ Card 6: Risk trend (↗️ up 7 points)
  │
  ├─ [RISK ASSESSMENT] — Why are they risky?
  │  ├─ Risk score: 52/100 (MEDIUM) — badge
  │  ├─ Risk factors:
  │  │  ├─ 🔴 Invoice #5 overdue 35 days (high severity)
  │  │  ├─ 🟡 Payment velocity declining (-10 days)
  │  │  ├─ 🟡 Email delivery issues (2 hard bounces)
  │  │  └─ 🟢 Overall reliability: 85%
  │  └─ Trend: Was 45 (30d ago) → Now 52 (↗️ up 7)
  │
  ├─ [COMMUNICATION HEALTH] — Can we reach them?
  │  ├─ Email: ✅ Working (no bounces)
  │  ├─ SMS: ✅ Opted in (phone: +1-555-9012)
  │  └─ Recommendation: "Responsive, try SMS for faster response"
  │
  ├─ [CONTACT INFORMATION]
  │  ├─ Company, Contact person, Email, Phone
  │  └─ [Edit] buttons on each field
  │
  ├─ [ACTIVE INVOICES TABLE] — Current unpaid
  │  ├─ Columns: Invoice # | Amount | Due | Days Overdue | Status
  │  ├─ Sorted: by days_overdue DESC
  │  ├─ Click row → Invoice detail page
  │  └─ [View all invoices] link
  │
  ├─ [PAYMENT TIMELINE] — Last 6 months
  │  ├─ Visual: monthly bars or summary
  │  │  ├─ March: 2 payments, avg 14d late
  │  │  ├─ Feb: 3 payments, avg 8d late
  │  │  └─ Jan: 2 payments, avg 3d late
  │  └─ Trend: "Getting slower (3d → 8d → 14d)"
  │
  ├─ [AGENT ACTIVITY SUMMARY] — Last 30 days
  │  ├─ Emails sent: 5 (60% open rate)
  │  ├─ SMS sent: 1
  │  ├─ Payments detected: 3
  │  ├─ Last action: Email #2 sent 2026-04-17
  │  └─ [View full activity →] link to Activity tab filtered by customer
  │
  └─ [PAYMENT HISTORY TABLE] — All past payments
     ├─ Columns: Date | Invoice # | Amount | Days After Due
     ├─ Sortable, filterable
     └─ [Export CSV]
```

---

## PART 4: CRITICAL MISSING PIECES (PRIORITY ORDER)

### Phase 1: Foundation (This Week - 15-20 hours)

#### 1.1 **SMS Logs Table + Wiring** (3-4 hours)
**What**: Create `sms_logs` table to track SMS history
**Files**:
- backend/schema.sql — add sms_logs table
- backend/src/db/smsLogs.ts — NEW (CRUD functions)
- backend/src/services/smsService.ts — wire SMS sending to log
- backend/src/services/twilioService.ts — wire webhook callbacks

**Schema**:
```sql
CREATE TABLE sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  phone VARCHAR NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR DEFAULT 'queued',  -- queued | sent | delivered | failed
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_reason TEXT,
  twilio_message_id VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 1.2 **Activity Events Table + Wiring** (5-7 hours)
**What**: Create permanent audit trail of agent actions
**Files**:
- backend/schema.sql — add activity_events table
- backend/src/db/activityEvents.ts — NEW (CRUD)
- backend/src/utils/activityLogger.ts — NEW (event helpers)
- Modify: agentLoop.ts, smsService.ts, stripeService.ts, emailService.ts

**Schema**:
```sql
CREATE TABLE activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  event_type VARCHAR NOT NULL,  -- email_sent | sms_sent | payment_detected | agent_run | etc
  actor VARCHAR,  -- 'system' | 'agent' | 'user'
  title VARCHAR NOT NULL,
  message TEXT,
  metadata JSONB,  -- customer_id, invoice_id, amount, reason, etc
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Wire at 12+ points**:
- emailService.ts: email_sent
- smsService.ts: sms_sent
- stripeService.ts: payment_detected
- agentLoop.ts: agent_run_completed
- Etc.

#### 1.3 **Fix Payment Insights Null Handling** (30 min)
**File**: backend/src/queue/agentLoop.ts (line 230)
```typescript
// Current:
const avgEmailsNeeded = invoice.payment_insights?.avg_emails_before_payment ?? null;

// Should be:
const avgEmailsNeeded = invoice.payment_insights?.avg_emails_before_payment ?? SMS_MIN_EMAILS_SENT;
```

#### 1.4 **Wire Notifications in AgentLoop** (2-3 hours)
**File**: backend/src/queue/agentLoop.ts

**Add calls**:
```typescript
// When email bounced (hard):
await logEmailBouncedNotification(companyId, customerName, email);

// When marked unreachable:
await logUnreachableNotification(companyId, customerName);

// When ≥3 emails queued:
if (emailsQueued >= 3) {
  await logDailyActionsAvailableNotification(companyId, emailsQueued);
}
```

#### 1.5 **Wire Notifications in Webhooks** (1-2 hours)
**Files**: stripeService.ts, emailController.ts, smsService.ts

**Already done**: ✅ Stripe webhook calls logPaymentReceivedNotification
**Already done**: ✅ Email bounced wired (mostly)
**Missing**: SMS delivery webhook

### Phase 2: Activity Tab Rebuild (Week 2 - 8-10 hours)

#### 2.1 **Uncomment + Wire SMS/Payments/Agent Decisions Tabs** (3-4 hours)
**File**: frontend/src/pages/Activity.tsx

**What**:
- Uncomment SMS, Payments, Events tabs (lines 16-18)
- Create API endpoints for sms_logs, payment history, agent_decisions
- Wire up fetch logic for each tab

#### 2.2 **Create Backend Endpoints for Activity** (2-3 hours)
**Files**: backend/src/controllers/activityController.ts (NEW)

```typescript
GET /api/activity/emails (already exists)
GET /api/activity/sms (new)
GET /api/activity/payments (new)
GET /api/activity/decisions (new)
```

#### 2.3 **Frontend Activity Components** (3-4 hours)
- SMSActivitySection.tsx (new)
- PaymentActivitySection.tsx (new)
- AgentDecisionsSection.tsx (new)
- Global filters/search UI

### Phase 3: Invoice Detail Redesign (Week 3 - 6-8 hours)

#### 3.1 **Create Timeline Component** (2-3 hours)
**File**: frontend/src/components/invoice/InvoiceTimeline.tsx
- Vertical timeline visualization
- Events: email sent, opened, bounced, SMS queued, payment received
- Merge email_logs + sms_logs + payment_logs into unified timeline

#### 3.2 **Create Detail Components** (2-3 hours)
- InvoiceHeader.tsx (sticky)
- NextStepSection.tsx (shows what's next + why)
- AgentDecisionsDisplay.tsx (last 3 decisions)
- CommunicationLog.tsx (email + SMS merged)

#### 3.3 **Rewrite InvoiceDetail.tsx** (1-2 hours)
- Remove tab structure
- Single-page layout with sections
- Wire everything together

#### 3.4 **Enhance Backend Endpoint** (1-2 hours)
**File**: backend/src/controllers/invoiceController.ts
- GET /api/invoices/:id/detail should return:
  ```typescript
  {
    invoice: Invoice,
    emailLogs: EmailLog[],
    smsLogs: SMSLog[],  // NEW
    paymentLogs: PaymentLog[],  // NEW
    timeline: TimelineEvent[],  // NEW (merged)
    agentDecisions: AgentDecision[],  // NEW (last 3)
    nextStep: {
      action: string,
      eligibleAt: Date,
      reason: string,
      metadata: any,
    }
  }
  ```

### Phase 4: Customer Detail Redesign (Week 4 - 8-10 hours)

#### 4.1 **Create Component Library** (3-4 hours)
- AROverviewGrid.tsx (6 cards)
- RiskAssessmentSection.tsx (score + factors + trend)
- CommunicationHealthCard.tsx
- PaymentTimelineSection.tsx
- AgentActivitySummary.tsx

#### 4.2 **Rewrite CustomerDetail.tsx** (2-3 hours)
- Remove tabs
- Single-page layout
- Wire all sections

#### 4.3 **Enhance Backend Endpoint** (2-3 hours)
**File**: backend/src/controllers/customerController.ts
- GET /api/customers/:id should return:
  ```typescript
  {
    customer: Customer,
    stats: {},
    paymentInsights: {},  // NEW
    riskFactors: RiskFactor[],  // NEW
    riskTrend: {},  // NEW
    communicationHealth: {},  // NEW
    paymentHistory: [],  // NEW (6 months)
    agentActivity: {},  // NEW
    activeInvoices: Invoice[]
  }
  ```

---

## PART 5: EXECUTION PLAN (WEEK-BY-WEEK)

### Week 1 (This Week): Foundation Wiring
**Goal**: SMS logs + activity events + notification wiring complete

**Mon-Wed** (8-10 hours):
1. ✅ Create sms_logs table + DB functions
2. ✅ Create activity_events table + DB functions
3. ✅ Fix payment_insights null handling
4. ✅ Wire SMS callbacks
5. ✅ Wire notifications in agentLoop (bounce, unreachable, daily actions)

**Thu-Fri** (4-5 hours):
6. ✅ Test end-to-end: agent runs → notifications created → Activity tab ready for next phase
7. ✅ Deploy to staging

**Deliverable**: SMS logs + activity events complete, notifications wired, Activity tab ready to show new data

---

### Week 2: Activity Tab Rebuild
**Goal**: Activity tab shows SMS, payments, agent decisions with filters

**Mon-Wed** (6-8 hours):
1. ✅ Uncomment SMS/Payments/Decisions tabs
2. ✅ Create backend activity endpoints
3. ✅ Wire frontend fetch logic
4. ✅ Create component sections for each tab

**Thu-Fri** (2-3 hours):
5. ✅ Global filters + search
6. ✅ Test & polish UI

**Deliverable**: Activity tab fully functional with all 4 sections (Pending, SMS, Payments, Decisions)

---

### Week 3: Invoice Detail Redesign
**Goal**: Timeline + next step + agent decisions transparent

**Mon-Wed** (4-5 hours):
1. ✅ Create timeline component
2. ✅ Create detail sections (header, next step, decisions)
3. ✅ Enhance backend endpoint

**Thu-Fri** (2-3 hours):
4. ✅ Rewrite InvoiceDetail.tsx
5. ✅ Test & polish

**Deliverable**: Invoice detail shows timeline, next action, and agent reasoning

---

### Week 4: Customer Detail Redesign
**Goal**: AR health, risk breakdown, payment patterns visible

**Mon-Wed** (4-5 hours):
1. ✅ Create component library (6 components)
2. ✅ Enhance backend endpoint
3. ✅ Rewrite CustomerDetail.tsx

**Thu-Fri** (2-3 hours):
4. ✅ Payment timeline + agent activity
5. ✅ Test & polish

**Deliverable**: Customer detail shows full financial health + agent activity

---

## PART 6: CURRENT STAGED CHANGES CHECKLIST

### ✅ ALREADY STAGED (24 files)

**Backend** (13 files):
- ✅ schema.sql — notification_events table
- ✅ app.ts — routes registered
- ✅ dashboardController.ts — system health check
- ✅ emailController.ts — bounce webhook (partial)
- ✅ notificationPreferencesController.ts — NEW
- ✅ notificationsController.ts — NEW (7 endpoints)
- ✅ agentDecisions.ts — logging
- ✅ dashboard.ts — metrics
- ✅ notificationEvents.ts — NEW (CRUD)
- ✅ notificationPreferences.ts — NEW (CRUD)
- ✅ scheduler.ts — trial checks
- ✅ agentLoop.ts — decision engine (mostly complete)
- ✅ csvImportJob.ts
- ✅ stripeService.ts — payment webhook
- ✅ notificationLogger.ts — NEW (9 helpers)
- ✅ routes/notifications.ts — NEW (API routes)
- ✅ routes/settings.ts — prefs endpoints

**Frontend** (11 files):
- ✅ NotificationCenter.tsx — bell icon
- ✅ NotificationsSection.tsx — settings
- ✅ SettingsLayout.tsx — tabs
- ✅ Settings.tsx — page
- ✅ Header.tsx — bell in header
- ✅ useRecommendedActions.ts — hook
- ✅ dashboardController.ts — health metrics

### ❌ NOT STAGED YET (But needed)

**Backend**:
- ❌ sms_logs table (schema.sql)
- ❌ activity_events table (schema.sql)
- ❌ smsLogs.ts (DB functions)
- ❌ activityEvents.ts (DB functions)
- ❌ activityLogger.ts (event helpers)
- ❌ activityController.ts (endpoints)
- ❌ notification wiring in agentLoop.ts (fixes + calls)

**Frontend**:
- ❌ SMS/Payments/Decisions sections in Activity.tsx
- ❌ Timeline component for Invoice detail
- ❌ Invoice detail redesign
- ❌ Customer detail redesign
- ❌ Risk assessment components
- ❌ Payment timeline component

---

## PART 7: WHAT TO DO RIGHT NOW (NEXT STEPS)

### Immediate Actions (Today/Tomorrow)

**1. Review & Approve This Analysis**
- Does the 3-flow breakdown match your understanding?
- Any critical pieces I missed?
- Any priorities different from what I suggested?

**2. Decide on Phase 1 Scope**
- Just SMS logs + activity events + notification wiring? (15-20 hours)
- Or include Activity tab rebuild too? (+8-10 hours)

**3. Get First Block of Work Ready**
- I'll create detailed task breakdown for Week 1 (SMS logs + activity events)
- Ready to start immediately after approval

### Expected Outcome

After all 4 weeks:
- 🎯 **User sees complete recovery journey** (timeline on invoice detail)
- 🎯 **User understands WHY agent made decisions** (metadata in next step)
- 🎯 **User has full Activity history** (emails + SMS + payments + agent runs)
- 🎯 **User can see customer risk breakdown** (why are they risky)
- 🎯 **All 3 flows interconnected** (notifications → activity → detail pages → customer page)
- 🎯 **Production ready** (builds clean, tests pass, no missing wiring)

---

## SUMMARY TABLE

| System | Current | Should Be | Hours | Priority | Week |
|--------|---------|-----------|-------|----------|------|
| AgentLoop | ✅ 4-gate pipeline | ✅ + fix nulls + wire notifications | 2 | 🔴 P0 | 1 |
| SMS Logs | ❌ Missing | ✅ Table + wiring | 4 | 🔴 P0 | 1 |
| Activity Events | ❌ Missing | ✅ Table + wiring | 5 | 🔴 P0 | 1 |
| Notification Wiring | ⚠️ Partial | ✅ Complete | 3 | 🔴 P0 | 1 |
| Activity Tab | ⚠️ Emails only | ✅ SMS + Payments + Decisions | 8 | 🟡 P1 | 2 |
| Invoice Detail | ⚠️ Tabs | ✅ Timeline + next step | 6 | 🟡 P1 | 3 |
| Customer Detail | ⚠️ Tabs | ✅ Risk + AR health | 8 | 🟡 P1 | 4 |
| **TOTAL** | | | **36-40** | | 4 weeks |
