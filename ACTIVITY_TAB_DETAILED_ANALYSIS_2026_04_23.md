# Activity Tab: Current State vs Desired State (Detailed Analysis)
**Date**: 2026-04-23  
**Author**: Claude Analysis  
**Status**: ❌ INCOMPLETE (Phase 1 notification wiring done, Activity UI not done)

---

## Executive Summary

The **Activity tab is NOT complete**. Here's what's actually happening:

**What's Done ✅:**
- Notification infrastructure exists (database, API endpoints, bell icon)
- Email queue system (pending/rejected/sent states)
- Sent email tracking
- SHADOW/AUTO mode support for approval workflow

**What's NOT Done ❌:**
- **Context/reason rows** for queued items (WHY was this queued?)
- **Recovery journey visualization** (email→SMS→payment flow for one invoice)
- **SMS logs integration** (sms_logs table exists but not shown in Activity)
- **Notification events display** (system alerts, payment received, bounces)
- **Agent decision explanations** (why agent chose tier_1, escalated to SMS, etc.)
- **7-day rejected countdown** (when will rejected email be re-queued?)
- **Stats footer** (pending count, sent_7d, opened%, bounced%, last_agent_run)

---

## Part 1: Current Frontend (Activity.tsx) — WHAT EXISTS

### 1.1 Three Data Sources Being Fetched

```
Activity.tsx fetches:
├── GET /api/pilot-queue
│   ├── Status = 'pending' → Pending Approval section
│   └── Status = 'rejected' → Rejected Emails section
├── GET /api/pilot-queue?status=rejected → Rejected Emails
└── GET /api/email/logs → Sent & Tracked section
```

### 1.2 Section 1: Pending Approval (Lines 515-768)

**What it shows:**
- List of queued emails (pending approval)
- Filters: Channel (email/sms), Stage (dunning_1, dunning_2, etc.), Days Overdue (0-30, 30-60, 60+)
- Bulk actions: Approve All, Approve Selected, Reject Selected, Clear Selection
- Table columns:
  - Checkbox (for bulk select)
  - Customer (name + email or phone)
  - Amount (invoice amount)
  - Days Overdue
  - Type (📧 Email Tier_1 or 📱 SMS)
  - Actions (Preview, Edit, Approve, Reject)

**Data source:**
```
FROM pilot_queued_emails 
WHERE status = 'pending' AND company_id = ?
```

**Fields available in QueuedEmail interface (from pilotQueuedEmails.ts:10-33):**
```
id, company_id, invoice_id, customer_id, recipient_email, customer_name,
invoice_amount, days_overdue, email_type, status, subject, body,
created_at, sent_at, failure_count, last_error, retry_at,
user_approved_at, user_rejected_at, user_edited_at, resend_message_id, risk_score
```

**🔴 MISSING IN UI:**
- No display of: invoice due_date, dueDate stored field
- No **context row** explaining WHY queued (e.g., "Customer avg 2.3 emails before paying")
- No **escalation reason** ("bounced email on Apr 17, escalating to SMS")
- No **invoice detail card** (company name, contact, payment history)
- No **risk score explanation** (why this invoice is high-risk)

---

### 1.3 Section 2: Rejected Emails (Lines 770-961)

**What it shows:**
- List of rejected emails (user rejected them, won't re-queue automatically)
- Bulk actions: Approve Selected, Move to Pending, Clear Selection
- Same table structure as Pending (Checkbox, Customer, Amount, Days Overdue, Type, Actions)

**Data source:**
```
FROM pilot_queued_emails
WHERE status = 'rejected' AND company_id = ?
```

**🔴 MISSING IN UI:**
- No **7-day countdown** or "Re-queue date: Apr 30" display
- No **reason for rejection** (user didn't enter a reason, just clicked reject)
- No **"blocked until X date" notice** (if hardcoded 7-day block exists)

---

### 1.4 Section 3: Sent & Tracked (Lines 963-1072)

**What it shows:**
- List of sent emails (tracked by Resend)
- Filters: Status (all, sent, opened, clicked, bounced, failed), Customer Email search
- Table structure: Icon + Subject + Recipient + Email Type + Sent Date + Opened Date + Status badge
- Grouped by date (Today, Yesterday, Apr 22, etc.)
- Actions per email: Preview, Resend (if draft/failed)

**Data source:**
```
FROM email_logs
WHERE company_id = ? AND status != 'skipped'
ORDER BY sent_at DESC
```

**Fields tracked:**
- Subject, recipient_email, email_type, status (sent/opened/clicked/bounced/failed)
- Sent_at, opened_at, resend_message_id

**🔴 MISSING IN UI:**
- No **bounce reason** (soft bounce vs hard bounce)
- No **notification event** tied to this email (e.g., "Email bounced at 2:30pm, escalating to SMS")
- No **next action** (when will SMS be sent? why not already sent?)
- No **invoice link** to see full recovery context
- No **SMS follow-up** shown next to bounced email

---

## Part 2: Backend Notification System — WHAT EXISTS BUT ISN'T USED

### 2.1 Notification Events Table (Does Exist in Schema)

```sql
CREATE TABLE notification_events (
  id UUID,
  company_id UUID,
  event_type VARCHAR,  -- 'system_alert', 'payment_received', 'email_bounced', 'sms_failed', 'daily_actions_ready'
  title VARCHAR,
  message TEXT,
  icon VARCHAR,
  priority VARCHAR,    -- 'critical', 'warning', 'info'
  read_at TIMESTAMP,   -- NULL = unread
  action_url VARCHAR,
  action_label VARCHAR,
  metadata JSONB,      -- stores extra context
  created_at TIMESTAMP
);
```

**Managed by:** `notificationEvents.ts` (67 functions for CRUD + queries)

**API Endpoints Created (notificationsController.ts):**
- `GET /api/notifications/unread` ← Get unread notification events
- `GET /api/notifications` ← Get all notifications (last 30 days)
- `GET /api/notifications/unread-count` ← Count unread
- `GET /api/notifications/by-type/:eventType` ← Filter by event type
- `POST /api/notifications/:id/read` ← Mark as read
- `POST /api/notifications/mark-all-read` ← Mark all as read
- `POST /api/notifications/test` ← Send test notification

**🔴 CURRENT STATE:** These endpoints **EXIST but are NOT CALLED by Activity.tsx**
- Used only by: NotificationCenter (bell icon) on Header
- Unused by: Activity.tsx (should be showing notifications)

---

### 2.2 SMS Logs Table (Exists but Not Displayed in Activity)

```sql
CREATE TABLE sms_logs (
  id UUID,
  company_id UUID,
  customer_id UUID,
  phone_number VARCHAR,
  message_full TEXT,
  message_preview VARCHAR(160),
  sms_type VARCHAR,     -- 'dunning', 'follow_up', 'payment_reminder'
  status VARCHAR,       -- 'pending', 'sent', 'delivered', 'failed', 'bounced'
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  failure_reason TEXT,
  twilio_sid VARCHAR,
  created_at TIMESTAMP
);
```

**Current state:**
- ✅ Table exists in schema
- ✅ Data gets inserted when SMS is sent (twilioController.ts)
- ❌ **No API endpoint to fetch SMS logs** (Activity.tsx can't display them)
- ❌ **Activity.tsx has commented-out SMS tab** (line 16: `// { id: 'sms', label: 'SMS' }`)

---

## Part 3: The Disconnect — Why Activity Tab Feels Incomplete

### 3.1 Three Independent Data Sources Not Unified

```
┌─────────────────────────────────────────────────────────────────┐
│                    ACTIVITY.TSX (Frontend)                       │
└─────────────────────────────────────────────────────────────────┘

Fetches from 3 separate sources:

1. pilotQueuedEmails table (via /api/pilot-queue)
   ├── Pending Approval section
   └── Rejected section

2. email_logs table (via /api/email/logs)  
   └── Sent & Tracked section

3. ❌ MISSING: notification_events table (API exists but not called)
   ├── system_alert events (Stripe down, email service down, trial ending)
   ├── event_type: payment_received
   ├── event_type: email_bounced
   └── event_type: sms_failed

4. ❌ MISSING: sms_logs table (no API endpoint)
   ├── SMS sent/delivered/failed
   └── Completion of recovery journey

5. ❌ MISSING: agent_decisions table (doesn't exist yet)
   ├── Why agent chose dunning_1 vs dunning_2
   ├── Why escalated to SMS (2+ emails, 7+ days, opt-in)
   └── What would next action be
```

### 3.2 Example: Single Invoice Recovery Journey (Currently Scattered)

**Customer**: TechWave Co (€9,100 invoice, 32 days overdue)

**What SHOULD appear as ONE cohesive journey in Activity:**
```
┌─ Apr 15 (Day 1) ─────────────────────────────────────────────┐
│ 🤖 Agent Decision: "Risk tier 2 → Send dunning_1 email"       │
│    Why: 15 days overdue, payment insights = avg 5.2 days     │
│ 📧 Email Queued: dunning_1 to accounts@techwave.io           │
│ ✓ User approved (SHADOW mode)                                 │
│ 📬 Email Sent at 3:45pm                                       │
│ 📖 Email Opened at 4:12pm                                     │
└────────────────────────────────────────────────────────────────┘

┌─ Apr 19 (Day 5) ──────────────────────────────────────────────┐
│ 🤖 Agent Decision: "No payment yet. Risk score ↑. Tier 2"     │
│    Next: Send dunning_2 OR escalate to SMS?                  │
│ 📧 Email Queued: dunning_2 to accounts@techwave.io           │
│ ✓ User approved                                               │
│ 📬 Email Sent at 9:00am                                       │
│ ❌ Email Bounced (hard bounce: invalid address)               │
│ 🚨 Notification Event: EMAIL_BOUNCED                          │
└────────────────────────────────────────────────────────────────┘

┌─ Apr 21 (Day 7) ──────────────────────────────────────────────┐
│ 🤖 Agent Decision: "Email bounced + 7 days overdue + SMS opt" │
│    Why: 2 attempts, email failed, customer opt-in verified    │
│ 📱 SMS Queued: "Hi TechWave, invoice €9,100 due..."          │
│ ✓ User approved (SHADOW mode)                                │
│ 📤 SMS Sent at 10:30am via Twilio                            │
│ ✅ SMS Delivered at 10:31am                                   │
│ 🚨 Notification Event: SMS_SENT                               │
└────────────────────────────────────────────────────────────────┘

┌─ Apr 23 (Day 9) ──────────────────────────────────────────────┐
│ 💰 Payment Received: €9,100                                    │
│ 🚨 Notification Event: PAYMENT_RECEIVED                        │
│ 📊 Agent Learning: "Customer took 9 days, SMS was trigger"    │
│    Update payment_insights: avg_emails_before_payment = 2     │
└────────────────────────────────────────────────────────────────┘
```

**Currently in Activity.tsx, this appears as:**
- Pending Approval: SMS message (no context why escalated)
- Sent & Tracked: dunning_1 (opened), dunning_2 (bounced) — no SMS shown
- Rejected: (nothing)
- Missing: SMS tracking, notification events, agent decisions

---

## Part 4: What Needs to Be Done — Implementation Roadmap

### 4.1 Database Layer Additions

**Already exist, need to be fetched:**
- ✅ notification_events table (has API, not called by Activity)
- ✅ sms_logs table (no API endpoint for Activity)
- ✅ pilotQueuedEmails table (already called, needs context fields)

**May need to add:**
- ❓ agent_decisions table (optional, for explaining WHY decisions were made)
- ❓ escalation_reasons field in pilotQueuedEmails (optional, for context)

### 4.2 Backend API Enhancements

**Need to add:**

1. **GET /api/activity/combined** (NEW) — Unified activity endpoint
   - Combines: pilotQueuedEmails + email_logs + sms_logs + notification_events
   - Returns: Single cohesive timeline for an invoice or company
   - Response includes: context, metadata, escalation_reason, previous_step

2. **GET /api/activity/sms-logs** (NEW) — Fetch SMS logs for Activity
   - Returns: All SMS sent/delivered/failed
   - Filters: customer_id, status, date_range

3. **Enhance GET /api/pilot-queue** (MODIFY) — Add context fields
   - Return: escalation_reason, previous_step, metadata
   - Example: `{ escalation_reason: "email_bounced", previous_step: "dunning_1", bounced_on: "2026-04-19T09:00Z" }`

### 4.3 Frontend UI Enhancements

#### 4.3.1 Context/Reason Row (HIGH PRIORITY)

**Add below each pending/rejected item in table:**
```
┌─ Customer Name ────────────────────────────────────┐
│ Amount: €9,100 | Days Overdue: 32d | 📧 dunning_2 │
├──────────────────────────────────────────────────┤
│ Context: Email bounced on Apr 19 (hard bounce)    │ ← NEW
│ Why escalated to SMS: 2 emails sent, 7d overdue   │ ← NEW
│ Customer insight: Avg 5.2 days to pay             │ ← NEW
└──────────────────────────────────────────────────┘
```

**Data to fetch:**
```typescript
interface QueuedEmailWithContext extends QueuedEmail {
  escalation_reason?: string;        // "email_bounced", "time_threshold", "manual"
  previous_step?: string;             // "dunning_1"
  bounce_info?: {
    bounced_on?: string;
    reason?: string;                  // "hard_bounce", "soft_bounce"
  };
  customer_insights?: {
    avg_emails_before_payment?: number;
    avg_days_to_pay?: number;
    payment_reliability?: number;
  };
  next_action?: string;              // "Send SMS", "Wait 3 days"
}
```

#### 4.3.2 Invoice Context Card (MEDIUM PRIORITY)

**Show invoice detail in expandable section:**
```
┌─ Invoice Detail ────────────────────────────────┐
│ Invoice #: INV-2026-001234                       │
│ Due Date: Mar 22, 2026 (32 days overdue)        │
│ Company: TechWave Co | Contact: john@techwave   │
│ Amount: €9,100 | Status: Unpaid                 │
│ Previous Recovery Journey:                       │
│  ├─ Apr 15: Email tier_1 sent → Opened         │
│  ├─ Apr 19: Email tier_2 sent → Hard bounced   │
│  └─ Apr 21: SMS tier_2 sent → Delivered        │
└─────────────────────────────────────────────────┘
```

#### 4.3.3 7-Day Rejected Countdown (MEDIUM PRIORITY)

**Modify Rejected section to show:**
```
⚠️ Rejected Emails (will re-queue in 7 days)

┌─ Customer ─────────────────────────────────┐
│ TechWave Co - €9,100                        │
│ Status: Rejected on Apr 23 (1 day ago)     │
│ Will auto-re-queue: Apr 30                 │
│ [✓ Approve Now] [↩️ Move to Pending]       │
└─────────────────────────────────────────────┘
```

#### 4.3.4 SMS Logs Integration (MEDIUM PRIORITY)

**Add SMS section to Sent & Tracked:**
```
✅ Sent & Tracked

📧 Emails (12 sent, 8 opened, 2 bounced)

📱 SMS (3 sent, 3 delivered, 0 failed)
├─ Apr 21: TechWave Co - Delivered
├─ Apr 22: DevShop Inc - Delivered  
└─ Apr 23: WebStudio - Pending
```

#### 4.3.5 Notification Events Display (LOW PRIORITY for now)

**Optional: Show system alerts + events in separate timeline:**
```
🚨 System Alerts & Events

Apr 23, 2:15pm - Payment Received (TechWave Co, €9,100)
Apr 22, 4:30pm - Email Bounce (dunning_2 to accounts@techwave.io)
Apr 21, 10:30am - SMS Sent (TechWave Co)
Apr 15, 3:45pm - Email Sent (TechWave Co, dunning_1)
```

#### 4.3.6 Stats Footer (LOW PRIORITY)

**Add bottom section showing:**
```
Pending: 5 | Sent (7d): 23 | Opened: 16 (69%) | Bounced: 2 | Last Agent Run: 2h ago
```

---

## Part 5: Data Flow Diagram (Current → Desired)

### Current (Broken)

```
Activity.tsx
├── fetchEmails() → /api/email/logs → email_logs table
├── fetchQueuedEmails() → /api/pilot-queue → pilot_queued_emails
└── (NO CALLS TO notification endpoints)

NotificationCenter.tsx (Bell Icon)
├── Calls → /api/notifications/unread → notification_events table
└── Shows badge count only, no integration with Activity
```

### Desired (Unified)

```
Activity.tsx
├── fetchActivityTimeline() → /api/activity/combined
│   ├── Queries: pilot_queued_emails (context enriched)
│   ├── Queries: email_logs (with bounce metadata)
│   ├── Queries: sms_logs (sent/delivered/failed)
│   ├── Queries: notification_events (for alerts)
│   └── Returns: Single unified timeline
│
├── Sections now show:
│   ├── 📬 Pending Approval (with context rows)
│   ├── ⚠️ Rejected (with 7-day countdown)
│   ├── ✅ Sent & Tracked (emails + SMS unified)
│   ├── 🚨 Notifications (system alerts, events)
│   └── 📊 Stats (footer metrics)
└── Each item shows: recovery journey context, next action, why

NotificationCenter.tsx (Bell Icon)
└── Still fetches /api/notifications/unread (separate concern)
```

---

## Part 6: Why This Matters (Business Context)

**The Activity tab is the transparency layer.**

Service agencies hire RecoverAI to recover AR autonomously. But they need to **trust** the agent. Trust = understanding WHY the agent made decisions.

**Without context rows, Activity tab shows:**
- ❌ "SMS queued" (so what? why not email?)
- ❌ "Email bounced" (and then what? why no SMS yet?)
- ❌ "Payment received" (did the SMS cause it? or something else?)

**With context rows, Activity tab shows:**
- ✅ "Email bounced Apr 19 (hard bounce) → Escalating to SMS (2 attempts, 7d overdue, opt-in verified)"
- ✅ "Payment received €9,100 (customer took 9 days, SMS was trigger)"
- ✅ "Next action: Monitor for reply or escalate to voice call"

**Result:** User sees the agent is intelligent, making informed decisions, not just a dumb automaton. Confidence grows → retention increases.

---

## Part 7: Implementation Priority & Effort

| Feature | Priority | Effort | Impact | Can Do Now? |
|---------|----------|--------|--------|------------|
| Context/Reason Rows | 🔴 HIGH | 6-8h | Medium | ✅ Yes |
| Invoice Context Card | 🟠 MEDIUM | 4-6h | Low | ✅ Yes |
| SMS Logs API + Display | 🟠 MEDIUM | 4-6h | Medium | ✅ Yes |
| 7-Day Countdown | 🟠 MEDIUM | 2-3h | Low | ✅ Yes |
| Notification Events Display | 🟡 LOW | 3-4h | Low | ⏳ Later |
| Agent Decisions Table | 🟡 LOW | 8-10h | High | ⏳ Later (Phase 2) |
| Stats Footer | 🟡 LOW | 2-3h | Low | ✅ Yes |

**Quick Wins (2-3h):**
- 7-day countdown display
- Stats footer
- Bulk rename tabs (remove SMS tab placeholder)

**Core Work (12-16h):**
- Context/reason rows + escalation metadata (6-8h)
- SMS logs API endpoint + integration (4-6h)
- Invoice context card (4-6h optional)

**Total to "Acceptable": 14-19h**

---

## Part 8: Why Current Claims of "Complete" Are Wrong

**PHASE_1_2_IMPLEMENTATION_PLAN.md claims:**
> "Phase 1 & 2: 100% COMPLETE"
> "Email bounce notification ✅"
> "SMS failed notification ✅"

**What this actually means:**
- ✅ notification_events table exists
- ✅ API endpoints created
- ✅ Bell icon shows notifications
- ❌ **Activity tab doesn't integrate with notifications**
- ❌ **No context/reason display for queued items**
- ❌ **No unified recovery journey view**
- ❌ **SMS logs not displayed**

**Analogy:** Saying "Notification system complete" because the table exists is like saying "Car is complete" because the engine exists. The engine (notification infrastructure) exists, but the dashboard (Activity tab that shows it) doesn't.

---

## Part 9: What Exists vs What's Needed (Truth Table)

| Component | Table Exists | API Endpoint Exists | Called by Activity.tsx | Displayed in Activity |
|-----------|-------------|-------------------|----------------------|----------------------|
| Email Queue (pending) | ✅ pilot_queued_emails | ✅ GET /api/pilot-queue | ✅ Yes | ✅ Pending Approval |
| Email Queue (rejected) | ✅ pilot_queued_emails | ✅ GET /api/pilot-queue?status=rejected | ✅ Yes | ✅ Rejected Emails |
| Sent Emails | ✅ email_logs | ✅ GET /api/email/logs | ✅ Yes | ✅ Sent & Tracked |
| **Notification Events** | ✅ notification_events | ✅ GET /api/notifications/* | ❌ **NO** | ❌ **NO** |
| **SMS Logs** | ✅ sms_logs | ❌ **NO** | ❌ **NO** | ❌ **NO** |
| **Context/Metadata** | ⚠️ Partial (risk_score exists) | ❌ **NO** | ❌ **NO** | ❌ **NO** |

---

## Part 10: REVISED — Activity Tab Scope (Simplified)

**Key Insight:** Detailed context should live on Invoice Detail + Customer Detail pages, NOT in Activity tab.

**Activity Tab = Quick Log + Stats**
- Pending Approval: What's waiting for user approval (scannable list)
- Rejected: What was rejected + 7-day countdown
- Sent & Tracked: What was sent (emails + SMS combined)
- Stats: Quick metrics

**Details = Click through to dedicated pages**
- Click on invoice → Invoice Detail page (shows full recovery journey, context, agent decisions)
- Click on customer → Customer Detail page (shows all invoices, payment history, insights)

---

### 10.1 What Activity Tab SHOULD Show (Minimal, Scannable)

**Pending Approval Section:**
```
┌─ Customer ────── Amount ─── Type ───── Actions ──────────┐
│ TechWave Co    €9,100      📧 Email   [Preview] [Approve]│
│ DevShop Inc    €5,200      📱 SMS     [Preview] [Approve]│
│ WebStudio      €3,400      📧 Email   [Preview] [Approve]│
└──────────────────────────────────────────────────────────┘

👉 Click on row → goes to Invoice Detail (see why it was queued, context, history)
```

**Rejected Section:**
```
┌─ Customer ────── Amount ─── Re-queue Date ─ Actions ──────┐
│ TechWave Co    €9,100      Apr 30          [Approve] [Move]│
└──────────────────────────────────────────────────────────┘

👉 Click on row → goes to Invoice Detail (see why rejected, decide what to do)
```

**Sent & Tracked Section (Unified Timeline - Email + SMS):**
```
✅ Sent & Tracked

Apr 23, 3:45pm - TechWave Co - 📧 Email tier_1 - Opened ✅
Apr 22, 9:00am - DevShop Inc - 📧 Email tier_2 - Bounced ❌
Apr 21, 4:30pm - TechWave Co - 📱 SMS - Delivered ✅
Apr 21, 10:30am - WebStudio - 📧 Email tier_1 - Sent 📧
Apr 20, 2:15pm - DevShop Inc - 📱 SMS - Delivered ✅

👉 Click on row → goes to Invoice Detail (see full recovery journey, bounce reason, etc)
```

**Stats Footer with Time Range Filter:**
```
Time Range: [Last 24h] [Last 7 days] [All Time]

📬 Pending: 5 | 📊 Sent: 23, Opened: 16 (70%), Bounced: 2 | ⚙️ Last Run: 2h ago

(Stats update based on selected time range)
```

---

### 10.2 What Activity Tab should NOT Show
- ❌ Context/reason rows (belongs on Invoice Detail page)
- ❌ Invoice detail cards (belongs on Invoice Detail page)
- ❌ Recovery journey timeline (belongs on Invoice Detail page)
- ❌ Agent decision explanations (belongs on Invoice Detail page)
- ❌ Payment history/insights (belongs on Customer Detail page)

---

### 10.3 Actual Work Needed (FINAL)

**4 Implementation Items (4 hours total):**

---

## Item 1: 7-Day Countdown in Rejected Section (1h)

**What to do:**
- Calculate: `rejected_at + 7 days` → `re_queue_date`
- Display in Rejected table: "Will re-queue: Apr 30"
- Backend: Already have `rejected_at` timestamp in pilotQueuedEmails table

**Frontend change (Activity.tsx - Rejected section, line 916):**
```typescript
<td className="px-4 py-3">
  <p className="text-gray-700 dark:text-gray-300 text-sm">
    {email.days_overdue}d | Will re-queue: {formatDate(addDays(new Date(email.user_rejected_at), 7))}
  </p>
</td>
```

**Result:**
```
TechWave Co | €9,100 | 32d | Will re-queue: Apr 30 | [Approve] [Move to Pending]
```

---

## Item 2: SMS + Email Unified Timeline (1h)

**What to do:**
1. Create `GET /api/activity/sms-logs` backend endpoint
   - Returns: All SMS logs for company, filtered by date range
   - Fields: id, customer_id, customer_name, phone_number, message_preview, status, sent_at, delivered_at

2. Frontend merge (Activity.tsx - Sent & Tracked section, line 1005)
   - Fetch email_logs + sms_logs separately
   - Merge in chronological order (by sent_at)
   - Add type badges: 📧 Email, 📱 SMS
   - Group by date as usual

**Data structure:**
```typescript
interface ActivityLog {
  id: string;
  type: 'email' | 'sms';
  customer_name: string;
  timestamp: string;  // sent_at
  status: string;     // opened, bounced, delivered, failed, etc
  preview: string;    // subject (email) or message_preview (SMS)
  icon: string;       // 📧 or 📱
}
```

**Result:**
```
Apr 23, 3:45pm - TechWave Co - 📧 Email tier_1 - Opened ✅
Apr 21, 4:30pm - TechWave Co - 📱 SMS - Delivered ✅
Apr 20, 2:15pm - DevShop Inc - 📱 SMS - Delivered ✅
```

---

## Item 3: Stats Footer with Time Range Filter (0.5h)

**What to do:**
1. Add filter buttons above stats
2. Update stats based on selected range
3. Display metrics dynamically

**UI:**
```
Time Range: [Last 24h] [Last 7 days] [All Time]

📬 Pending: 5 | 📊 Sent: 23, Opened: 16 (70%), Bounced: 2 | ⚙️ Last Run: 2h ago
```

**Logic:**
```typescript
const getStatsForRange = (range: '1d' | '7d' | 'all') => {
  const cutoff = range === '1d' ? NOW() - 1d 
               : range === '7d' ? NOW() - 7d 
               : null;
  
  return {
    pending: count(pilotQueuedEmails where status='pending'),
    sent: count(email_logs + sms_logs where sent_at >= cutoff),
    opened: count(email_logs where status='opened' and sent_at >= cutoff),
    bounced: count(email_logs where status IN ('bounced', 'failed') and sent_at >= cutoff),
    lastRun: getLastAgentRunTime()
  };
};
```

**Result:** User sees real-time effectiveness metrics for their chosen time period

---

## Item 4: Click Popup Modal with 3 States (1.5h)

**Architecture:** Single modal component with conditional rendering based on item state

### State 1: PENDING Approval
**Data source:** `pilotQueuedEmails` (status='pending')

**Modal content:**
```
┌─ Invoice INV-001 | TechWave Co ────────────────────┐
│ €9,100 | 32 days overdue | 📧 Email dunning_2     │
├────────────────────────────────────────────────────┤
│ Status: ⏳ Pending Your Approval                    │
│ Queued: Apr 22, 2026                                │
│                                                     │
│ Preview:                                            │
│ Subject: "Invoice €9,100 Due - Action Required"    │
│                                                     │
│ Body:                                               │
│ "Hi TechWave, your invoice €9,100 was due on..."   │
│ [200 chars truncated]                              │
├────────────────────────────────────────────────────┤
│ [👁️ Preview Full] [✏️ Edit] [✓ Approve] [✕ Reject]│
│ [→ View Full Invoice Details]                      │
└────────────────────────────────────────────────────┘
```

**Actions available:**
- Preview Full: Show complete subject + body
- Edit: Open edit modal to change subject/body (already exists)
- Approve: Send immediately
- Reject: Block for 7 days
- View Full Invoice Details: Navigate to Invoice Detail page

---

### State 2: REJECTED
**Data source:** `pilotQueuedEmails` (status='rejected')

**Modal content:**
```
┌─ Invoice INV-001 | TechWave Co ────────────────────┐
│ €9,100 | 32 days overdue | 📧 Email dunning_2     │
├────────────────────────────────────────────────────┤
│ Status: ⚠️ Rejected (Blocked for 7 days)           │
│ Rejected on: Apr 23, 2026                           │
│ Will auto re-queue: Apr 30, 2026                   │
│                                                     │
│ Type: Email                                         │
│ Recipient: accounts@techwave.io                    │
│                                                     │
│ Message Preview:                                    │
│ "Invoice €9,100 Due - Action Required..."          │
├────────────────────────────────────────────────────┤
│ [✓ Approve Now] [↩️ Move to Pending]               │
│ [→ View Full Invoice Details]                      │
└────────────────────────────────────────────────────┘
```

**Actions available:**
- Approve Now: Override 7-day block, send immediately
- Move to Pending: Unblock early, move back to pending queue
- View Full Invoice Details: Navigate to Invoice Detail page

---

### State 3: SENT & TRACKED
**Data source:** `email_logs` OR `sms_logs`

**Modal content (Email):**
```
┌─ Invoice INV-001 | TechWave Co ────────────────────┐
│ €9,100 | 32 days overdue | 📧 Email dunning_1     │
├────────────────────────────────────────────────────┤
│ Status: ✅ Opened                                   │
│ Sent: Apr 23, 3:45pm                                │
│ Opened: Apr 23, 4:12pm (27 mins later)             │
│                                                     │
│ To: accounts@techwave.io                           │
│ Subject: "Invoice €9,100 Due - Action Required"    │
│                                                     │
│ Message Preview:                                    │
│ "Hi TechWave, your invoice €9,100..."              │
├────────────────────────────────────────────────────┤
│ [👁️ Preview Full] [→ View Full Invoice Details]   │
└────────────────────────────────────────────────────┘
```

**Modal content (SMS):**
```
┌─ Invoice INV-001 | TechWave Co ────────────────────┐
│ €9,100 | 32 days overdue | 📱 SMS                  │
├────────────────────────────────────────────────────┤
│ Status: ✅ Delivered                                │
│ Sent: Apr 21, 10:30am                               │
│ Delivered: Apr 21, 10:31am                         │
│                                                     │
│ To: +1 (***) ***-4567                              │
│                                                     │
│ Message:                                            │
│ "Hi TechWave, invoice €9,100 due Mar 22. Please..." │
├────────────────────────────────────────────────────┤
│ [🔄 Resend] (if failed) | [→ View Full Invoice]   │
└────────────────────────────────────────────────────┘
```

**Modal content (Email - Failed/Bounced):**
```
┌─ Invoice INV-001 | TechWave Co ────────────────────┐
│ €9,100 | 32 days overdue | 📧 Email dunning_2     │
├────────────────────────────────────────────────────┤
│ Status: ❌ Bounced (Hard Bounce)                    │
│ Sent: Apr 22, 9:00am                                │
│ Bounced: Apr 22, 9:15am                            │
│ Reason: Invalid recipient address                  │
│                                                     │
│ To: accounts@techwave.io                           │
│ Subject: "Invoice €9,100 Due - Action Required"    │
├────────────────────────────────────────────────────┤
│ [🔄 Resend] [→ View Full Invoice Details]         │
└────────────────────────────────────────────────────┘
```

**Actions available:**
- Preview Full: Show complete message
- Resend: Only shown if status='failed' or 'bounced' → resend immediately
- View Full Invoice Details: Navigate to Invoice Detail page

---

## Implementation (Frontend - Activity.tsx):

```typescript
// 1. Add modal state
const [activityModal, setActivityModal] = useState<{
  isOpen: boolean;
  state?: 'pending' | 'rejected' | 'sent';
  item?: QueuedEmail | EmailLog | SmsLog;
}>(
  { isOpen: false }
);

// 2. Handle row click
const handleRowClick = (item: QueuedEmail | EmailLog | SmsLog, state: 'pending' | 'rejected' | 'sent') => {
  setActivityModal({ isOpen: true, state, item });
};

// 3. Render modal
<ActivityModal
  isOpen={activityModal.isOpen}
  state={activityModal.state}
  item={activityModal.item}
  onClose={() => setActivityModal({ isOpen: false })}
  onApprove={handleApproveQueuedEmail}
  onReject={handleRejectQueuedEmail}
  onEdit={(item) => setShowEditModal(true)}
  onResend={(item) => resendEmail(item)}
/>

// 4. In Activity sections, update table row to be clickable
<tr onClick={() => handleRowClick(email, 'pending')} className="cursor-pointer hover:bg-blue-50">
  ...
</tr>
```

---

**Total Effort: 4 hours**
- Item 1 (7-day countdown): 1h
- Item 2 (SMS unified): 1h
- Item 3 (Stats filter): 0.5h
- Item 4 (Click modal): 1.5h

---

## Conclusion: Revised

### ✅ What IS Complete:
1. Email queue system (SHADOW/AUTO modes)
2. Sent email tracking
3. Notification infrastructure (table + API)
4. Bell icon showing unread count
5. SMS capability (sending works)

### ❌ What's Minimally Needed:
1. **7-day countdown in Rejected section** (1h)
2. **SMS logs API + display in Sent & Tracked** (1h)
3. **Stats footer with metrics** (0.5h)

### ✅ What's Already Handled:
- Context/details → Invoice Detail page (click through)
- Recovery journey → Invoice Detail page (click through)
- Agent decisions → Invoice Detail page (click through)
- Customer insights → Customer Detail page (click through)

### 🎯 Bottom Line:
**Activity tab is NOT broken. It's just missing: (1) SMS display, (2) 7-day countdown, (3) stats footer. Add these 3 quick wins = Done.**

**~2.5h of work, not 14-19h.**

---

## Next Steps (IMPLEMENTATION PLAN)

**This Week (4 hours total):**

### Item 1: 7-Day Countdown (1h)
- **File:** `frontend/src/pages/Activity.tsx` (Rejected section, ~line 916)
- **Change:** Add countdown calculation
- **Result:** Users see "Will re-queue: Apr 30" in Rejected table

### Item 2: SMS + Email Unified Timeline (1h)
- **Backend:** Create `GET /api/activity/sms-logs` endpoint
  - File: `backend/src/routes/activity.ts` (new or extend existing)
  - Query: `SELECT * FROM sms_logs WHERE company_id = ? AND sent_at >= ?`
  
- **Frontend:** Merge timeline in Activity.tsx
  - File: `frontend/src/pages/Activity.tsx` (Sent & Tracked section, ~line 1005)
  - Logic: Combine email_logs + sms_logs, sort by sent_at DESC, group by date
  - Visual: Add 📧 📱 badges to distinguish type
  
- **Result:** One chronological timeline showing emails and SMS together

### Item 3: Stats Footer with Time Filter (0.5h)
- **File:** `frontend/src/pages/Activity.tsx` (top of Activity component)
- **Add:** Time range buttons: [Last 24h] [Last 7 days] [All Time]
- **Logic:** Recalculate stats (pending, sent, opened%, bounced%) based on selected range
- **Result:** Users see metrics for their chosen time period (24h, 7d, or all-time)

### Item 4: Click Popup Modal (1.5h)
- **New Component:** `frontend/src/components/activity/ActivityModal.tsx`
  - Handle 3 states: 'pending' | 'rejected' | 'sent'
  - Show different content + actions for each state
  - Include link to "View Full Invoice Details"

- **Update Activity.tsx:**
  - Add modal state management
  - Make table rows clickable
  - Pass clicked item to modal with state type
  - Handle modal actions (Approve, Reject, Edit, Resend, etc)

- **Result:** 
  - Clicking row opens popup with item details
  - User can take action (Approve/Reject/Resend) without leaving Activity
  - "View Full Invoice Details" link navigates to Invoice Detail page

---

## Complete Activity Tab After Implementation

```
┌─ Activity ──────────────────────────────────────────────────┐
│ Agent Activity ✨ Auto Mode                                  │
│                                                              │
│ 📬 Pending Approval                                  5 items │
│ ├─ TechWave Co | €9,100 | 32d | Email dunning_2  [PENDING] │
│ │  └─ Click → Opens popup [Approve/Reject/Edit]            │
│ └─ DevShop Inc | €5,200 | 15d | SMS              [PENDING] │
│    └─ Click → Opens popup [Approve/Resend]                 │
│                                                              │
│ ⚠️ Rejected Emails                                  1 item   │
│ └─ WebStudio | €3,400 | 8d | Email dunning_1     [REJECTED]│
│    └─ Will re-queue: Apr 30 | Click → Opens popup           │
│                                                              │
│ ✅ Sent & Tracked                                            │
│ Time Range: [Last 24h] [Last 7 days] [All Time]            │
│                                                              │
│ Apr 23, 3:45pm - TechWave Co - 📧 Email - Opened ✅        │
│ Apr 22, 9:00am - DevShop Inc - 📧 Email - Bounced ❌       │
│ Apr 21, 4:30pm - TechWave Co - 📱 SMS - Delivered ✅       │
│ Apr 21, 10:30am - WebStudio - 📧 Email - Sent 📧           │
│                                                              │
│ Footer:                                                      │
│ 📬 Pending: 5 | 📊 Sent (7d): 23, Opened: 16 (70%), ❌ 2   │
│ ⚙️ Last Run: 2h ago                                          │
└──────────────────────────────────────────────────────────────┘
```

---

## Summary

**Changes Made:**
1. ✅ **7-day countdown** in Rejected section
2. ✅ **SMS + Email unified timeline** in Sent & Tracked
3. ✅ **Stats footer with time range filter**
4. ✅ **Click popup modal** with 3 states (pending/rejected/sent)

**User Experience:**
- Quick log view of all activity (what's done, what's pending)
- Click on any item → see quick context in popup
- Take action (approve/reject/resend) without leaving Activity
- "View Full Invoice Details" → go to Invoice Detail page for complete context

**Effort: 4 hours**

**Ready to start implementation?** 🚀
