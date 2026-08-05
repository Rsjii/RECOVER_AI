# 🎯 NOTIFICATIONS + ACTIVITY: COMPLETE INTERCONNECTION MAP

## THE ONE-PAGE SUMMARY

### Current Reality (What We Have)
- ✅ Email queue works (pilotQueuedEmails)
- ✅ SMS queueing works (same pilotQueuedEmails, type='sms')
- ✅ Voice ready (Phase 2)
- ✅ Email tracking works (email_logs table)
- ✅ Notification bell exists + 8 event types ready
- ✅ Activity.tsx shows pending + sent emails
- ❌ SMS delivery tracking separate (sms_logs table NEEDED)
- ❌ Notifications not fully wired (4 gaps)
- ❌ Activity shows channels, not recovery journey
- ❌ No context showing WHY items were queued

---

## THE DESIGN: One Recovery Journey, Not Multiple Channels

### Visual: Email → SMS → Voice Pipeline (All in ONE pilotQueuedEmails Table)

```
┌─────────────────────────────────────────────────────────┐
│                  INVOICE #1 RECOVERY JOURNEY             │
└─────────────────────────────────────────────────────────┘

Day 1: Apr 10
├─ Agent queues: Email dunning_1
│  └─ pilotQueuedEmails: { type: 'email', email_type: 'dunning_1', status: 'pending_approval' }
│
└─ NOTIFICATION: None (just queued, not yet approved)


Day 1: Apr 10 (after user approves)
├─ Email sent
│  └─ email_logs: { status: 'sent', sent_at: Apr 10 10:30am }
│
└─ NOTIFICATION: None (historical, not actionable)


Day 2: Apr 11 (2am)
├─ Email opened
│  └─ email_logs: { status: 'opened', opened_at: Apr 11 2:15am }
│
└─ NOTIFICATION: None (historical)


Day 7: Apr 17
├─ Agent queues: Email dunning_2 (7-day gap, Tier 1)
│  └─ pilotQueuedEmails: { type: 'email', email_type: 'dunning_2', status: 'pending_approval' }
│
└─ NOTIFICATION: None (queued, not yet approved)
   → ACTIVITY shows: "Invoice #1 — Email dunning_2 — 7d after dunning_1"


Day 7: Apr 17 (after user approves)
├─ Email sent
│  └─ email_logs: { status: 'sent', sent_at: Apr 17 9:00am }
│
└─ NOTIFICATION: None


Day 7: Apr 17 (12pm)
├─ Email BOUNCED (Hard failure, invalid email)
│  └─ email_logs: { status: 'bounced', reason: 'Invalid address' }
│
├─ NOTIFICATION: 🚨 "Email bounced to john@acme.com"
│  └─ Bell icon shows notification
│  └─ Click → goes to /activity
│
└─ ACTIVITY: Shows "Email dunning_2 bounced — escalating to SMS"


Day 11: Apr 21 (6am)
├─ Agent detects bounce + 11 days overdue + phone opted in
│  └─ Decides: SMS time (customer avg 2.3 emails, we've sent 2)
│
├─ Agent queues: SMS
│  └─ pilotQueuedEmails: { type: 'sms', phone: '+1-555-9012', message: '...', status: 'pending_approval' }
│
├─ NOTIFICATION: ✅ "3 actions ready" (batch notification, includes this SMS)
│  └─ Bell shows "1 unread"
│
└─ ACTIVITY: Pending Approval section shows:
   ├─ Invoice #1 — SMS
   │  └─ Context: "Email bounced on Apr 17. Customer avg 2.3 emails needed. Escalating to SMS."
   └─ (Plus 2 other emails from other invoices)


Day 11: Apr 21 (user approves SMS)
├─ SMS sent to +1-555-9012
│  └─ sms_logs: { status: 'sent', sent_at: Apr 21 6:05am }
│
├─ NOTIFICATION: None (already approved, historical)
│
└─ ACTIVITY: Moves SMS from Pending → Sent & Tracked section


Day 11: Apr 21 (6:02am, 2min later)
├─ Twilio webhook: SMS delivered
│  └─ sms_logs: { status: 'delivered', delivered_at: Apr 21 6:02am }
│
├─ NOTIFICATION: None
│
└─ ACTIVITY: Shows "SMS delivered"


Day 12: Apr 22 (customer doesn't respond)
├─ Agent decides: Wait (Tier decision: wait until next gap)
│
├─ NOTIFICATION: None
│
└─ Next run will check if payment received or escalate further
```

---

## The Bell vs Activity Rules

### 🔔 BELL (Actionable Only)

**Shows 8 types** (user MUST see + MUST do something):

1. **DAILY_ACTIONS_READY** ← ≥3 emails queued (user must approve)
2. **EMAIL_BOUNCED** ← hard bounce (user should know escalation happening)
3. **SMS_FAILED** ← SMS delivery failed (user must retry or escalate)
4. **STRIPE_NOT_CONNECTED** ← system down (critical)
5. **EMAIL_NOT_CONFIGURED** ← system down (critical)
6. **TRIAL_ENDING** ← 3 days left (user must pay)
7. **TRIAL_EXPIRED** ← payment required (critical)
8. **PAYMENT_RECEIVED** ← customer paid (good news, user should know)

**Example Bell Notification**:
```
🟠 ✅ 3 actions ready for approval
   Your agent has identified 3 dunning messages ready to send.
   Approve to send immediately.
   2 hours ago  [✕ Dismiss]
   
   [Click this] → Goes to /activity → Shows Pending Approval section
```

### 📋 ACTIVITY (Full History + Decisions)

**Shows everything** (audit trail):
- What was queued (email/SMS/voice)
- Why (context + metadata)
- What happened (sent/opened/bounced/delivered)
- User actions (approved/rejected)

**3 Sections**:

1. **PENDING APPROVAL** (2 items)
   ```
   Invoice #1 — Email dunning_2 (€5,230, 20d overdue)
   📌 Why: Email dunning_1 bounced. Gap time met. Sending dunning_2.
   
   Invoice #2 — SMS (€3,100, 8d overdue)
   📌 Why: Hard bounce + 8d overdue. Escalating to SMS.
   ```

2. **REJECTED** (1 item — user rejected, 7-day block)
   ```
   Invoice #3 — Email dunning_1
   Rejected Apr 19 | Block expires Apr 26
   [Move back to Pending] [Force Approve Now]
   ```

3. **SENT & TRACKED** (12 items from last 7 days)
   ```
   ✅ Invoice #1 — Email dunning_1 — Opened Apr 17
   ❌ Invoice #2 — Email dunning_2 — Bounced Apr 17
   📬 Invoice #1 — SMS — Delivered Apr 21
   📧 Invoice #3 — Email dunning_1 — Sent Apr 20
   ```

---

## Data Flow Diagram

```
┌──────────────────┐
│   Agent Runs     │
│   (every 6h)     │
└────────┬─────────┘
         │
         ├─ Decision: Queue Email dunning_2
         │  └─ INSERT pilotQueuedEmails { type:'email', ... }
         │     ↓
         │  ✅ Log agent decision → agent_decisions table
         │     ↓
         │  [BATCH: if ≥3 queued]
         │     ↓
         │  💬 Create notification: "✅ 3 actions ready"
         │     ↓
         │     → notification_events table
         │     → Bell icon shows "1" badge
         │
         ├─ Decision: Email bounced (detected)
         │  ├─ UPDATE email_logs { status: 'bounced' }
         │  ├─ 💬 Create notification: "🚨 Email bounced"
         │  │  → notification_events table
         │  │  → Bell shows notification
         │  │
         │  └─ Decision: Queue SMS (escalation)
         │     └─ INSERT pilotQueuedEmails { type:'sms', ... }
         │        ├─ ✅ Log decision → agent_decisions
         │        ├─ 💬 Included in batch "✅ 3 actions ready"
         │        └─ [if ≥3 total]
         │           → Notification goes to bell
         │
         └─ Payment detected (Stripe webhook)
            ├─ UPDATE invoices { status: 'paid' }
            ├─ 💬 Create notification: "💰 Payment received"
            │  → notification_events table
            │  → Bell shows notification
            │
            └─ User sees bell + clicks


Activity.tsx Fetch:
┌──────────────────────────┐
│  GET /api/activity       │
└────────────┬─────────────┘
             │
             ├─ Query pilotQueuedEmails (status='pending_approval')
             │  ├─ JOIN invoices + customers
             │  ├─ Add context (why queued)
             │  └─ Return: pending_approval[]
             │
             ├─ Query pilotQueuedEmails (status='sent')
             │  ├─ For type='email': JOIN email_logs
             │  ├─ For type='sms': JOIN sms_logs  ← NEEDS SMS_LOGS TABLE
             │  └─ Return: sent_tracked[]
             │
             └─ Query: Last agent run stats
                └─ Return: stats { emails_queued, sms_queued, ... }
```

---

## What Needs to Be Done (Priority)

### 🔴 CRITICAL (Do First — 5-7 hours)

1. **Wire 4 missing notifications** (2-3 hours)
   ```
   ✅ Email bounce:
      agentLoop.ts detects bounce → call logEmailBouncedNotification()
   
   ✅ Daily actions:
      agentLoop.ts: if emailsQueued >= 3 → call logDailyActionsAvailableNotification()
   
   ✅ SMS failed:
      Create logSmsFailedNotification() function
      Call from smsService.ts or Twilio webhook
   
   ✅ Unreachable:
      agentLoop.ts: if SMS not possible after bounce → call logUnreachableNotification()
   ```

2. **Create SMS logs table** (1-2 hours)
   ```sql
   CREATE TABLE sms_logs (
     id UUID PRIMARY KEY,
     invoice_id UUID REFERENCES invoices(id),
     company_id UUID REFERENCES companies(id),
     phone VARCHAR,
     message_full TEXT,
     status VARCHAR,      -- queued | sent | delivered | failed
     sent_at TIMESTAMPTZ,
     delivered_at TIMESTAMPTZ,
     failed_reason VARCHAR,
     created_at TIMESTAMPTZ
   );
   ```

3. **Enhance Activity API** (1-2 hours)
   ```
   GET /api/activity
   
   Return:
   {
     pending_approval: [{ id, type, email_type|message, context: {why, reason, metadata} }],
     rejected: [...],
     sent_tracked: [...],
     stats: { pending_count, sent_count, bounced_count, last_run }
   }
   ```

4. **Update Activity.tsx UI** (2-3 hours)
   ```
   Add context + reason to each item
   Show invoice metadata (amount, days overdue)
   Show "why" (previous step + escalation reason)
   Remove tabs, make single page
   ```

### 🟡 NEXT (After Critical — 3-4 hours)

5. **Hook SMS queueing to logs** (1 hour)
   - When SMS queued in agentLoop → INSERT sms_logs (status='queued')
   - When SMS sent → UPDATE sms_logs (status='sent', sent_at)
   - When Twilio webhook → UPDATE sms_logs (status='delivered' or 'failed')

6. **Test end-to-end** (2-3 hours)
   - Queue email → see pending + activity
   - Approve email → sent + email_logs created
   - Bounce email → notification + email_logs updated
   - Queue SMS → pending + activity, included in batch notification
   - Approve SMS → sent + sms_logs created
   - SMS delivered → sms_logs updated

---

## Why This Design Works

### ✅ User Perspective
- ONE view per invoice (recovery journey visible)
- Clear "why" for every decision (context shown)
- No switching channels (email vs SMS is just escalation path)
- Bell shows "do this now", Activity shows "here's what happened"

### ✅ Agent Transparency
- "Why did agent queue SMS?" ← Shown in activity context
- "Did SMS deliver?" ← Shown in sent & tracked
- "What bounced?" ← Shown with red badge
- "How many approvals pending?" ← Stats at bottom

### ✅ System Correctness
- One recovery journey per invoice
- All escalations tracked in one table (pilotQueuedEmails)
- No duplicate data (SMS not in separate table, type field handles it)
- Full audit trail in activity events

### ✅ Competitive Advantage
- Most AR tools show dashboard only
- RecoverAI shows DECISIONS + REASONING + FULL AUDIT TRAIL
- User UNDERSTANDS why agent chose SMS over voice
- User TRUSTS agent because they can see the logic

---

## Implementation Order (Week 1)

**Day 1-2: Wire notifications** (4 hours)
- Add calls to logEmailBouncedNotification, logDailyActionsAvailableNotification, logSmsFailedNotification
- Test: queue email → see notification

**Day 2-3: SMS logs table + wiring** (3 hours)
- Create sms_logs schema
- Hook smsService.ts to INSERT/UPDATE sms_logs
- Hook Twilio webhook to UPDATE sms_logs on delivery

**Day 4: Enhance Activity API** (2 hours)
- Modify GET /api/activity response structure
- Add context + metadata to each item
- Add stats calculation

**Day 5: Update Activity.tsx** (3 hours)
- Add invoice context display
- Add reason/why field
- Single page layout (no tabs)
- Test filters + search

**Day 5 (evening): End-to-End Test** (2 hours)
- Queue email → see pending + notification
- Bounce email → see notification + escalation
- Queue SMS → see in pending + batch notification
- Approve SMS → see in sent + delivery status

---

## ONE MORE THING: Why NOT Separate SMS Tab?

**Wrong Design** (what old MD suggested):
```
Activity → Emails tab | SMS tab | Payments tab | Events tab
```

**Problem**: User thinks "I want to know about Invoice #1" but must click 3+ tabs to understand it.

**Right Design** (what we're doing):
```
Activity
├─ Pending Approval (3 items waiting)
│  ├─ Invoice #1: Email dunning_2
│  ├─ Invoice #2: SMS (hard bounce escalation)
│  └─ Invoice #3: Email dunning_1
│
└─ Sent & Tracked (12 items)
   ├─ Invoice #1: Email opened
   ├─ Invoice #1: Email bounced
   ├─ Invoice #1: SMS delivered
   └─ etc
```

**Benefit**: User sees FULL JOURNEY for each invoice in context, not scattered across tabs.

---

## Diagram: Bell → Activity Flow

```
User sees bell notification "✅ 3 actions"
     ↓
[Click bell]
     ↓
Notification popover shows:
"3 actions ready for approval"
Action URL: "/activity"
     ↓
[Click "View All Activity"]
     ↓
Activity.tsx opens
     ↓
Pending Approval section expanded
     ↓
Shows 3 items:
├─ Invoice #1: Email dunning_2 (Tier 2 gap)
├─ Invoice #2: SMS (bounce escalation)
└─ Invoice #3: Email dunning_1 (new invoice)
     ↓
User selects all 3, clicks [Approve]
     ↓
All 3 sent immediately
     ↓
Move to Sent & Tracked section
```

---

## Summary Table

| Aspect | Current | Proposed | Status |
|--------|---------|----------|--------|
| **Bell Icon** | 8 events ready | 4 still missing wiring | 50% ✅ |
| **Notifications** | Function exist | Need 4 more wire points | 30% ✅ |
| **Activity UI** | Email only | One journey view | 0% ❌ |
| **SMS Tracking** | Queue only | Need logs table | 0% ❌ |
| **Context** | None | Per-item reason shown | 0% ❌ |
| **Pipeline View** | N/A | Email → SMS visible | 0% ❌ |

**Total Work**: 7-10 hours this week

