# 🔥 NOTIFICATIONS + ACTIVITY FINAL DESIGN (2026-04-21)

## CORE INSIGHT: One Recovery Journey, Not Separate Channels

**The Pipeline (in pilotQueuedEmails)**:
```
Email #1 → approved → sent → opened/bounced?
  ↓ (if bounced OR no engagement after 7d)
Email #2 → approved → sent
  ↓ (repeat 3-5 times depending on tier)
SMS #1 → approved → sent
  ↓ (if still not paying after SMS)
Voice Call → (Phase 2)
```

**Key Point**: Not "email_logs vs sms_logs vs payments" — it's ONE INVOICE'S RECOVERY JOURNEY through escalating channels.

---

## PART 1: WHAT SHOULD NOTIFICATIONS BE?

### 🎯 Principle: Bell = User Action Required (NOT History)

The bell shows **actionable alerts only**. Things that need the user to DECIDE or DO RIGHT NOW.

### 8 Event Types — When Do They Appear?

| Event | Trigger | Message | Action URL | Priority |
|-------|---------|---------|-----------|----------|
| **DAILY_ACTIONS_READY** | Agent queues ≥3 items | "✅ 3 actions ready for approval" | /activity | 🟠 Warning |
| **STRIPE_NOT_CONNECTED** | On dashboard load, no Stripe | "🔴 Stripe disconnected. Agent paused." | /settings?tab=integrations | 🔴 Critical |
| **EMAIL_NOT_CONFIGURED** | On dashboard load, no email | "📧 Email not configured. Agent paused." | /settings?tab=email | 🔴 Critical |
| **TRIAL_ENDING** | 3 days left on trial | "⏰ Trial ends in 3 days. Upgrade?" | /settings?tab=billing | 🔴 Critical |
| **TRIAL_EXPIRED** | Trial ended, account paused | "❌ Trial ended. Payment required." | /settings?tab=billing | 🔴 Critical |
| **PAYMENT_RECEIVED** | Stripe webhook detects payment | "💰 Payment received from ACME ($5K)" | /invoices | 🟠 Warning |
| **EMAIL_BOUNCED** | Hard bounce on email | "🚨 Email bounced to john@acme.com" | /invoices | 🟠 Warning |
| **AGENT_PAUSED** | Manual pause or system error | "⏸ Agent paused: [reason]" | /settings | 🔴 Critical |

### UI for Bell Icon

```
Header Bar
  ├─ [🔔 Bell Icon] (red badge if unread)
  │    ↓ click
  │    Popover (positioned right)
  │    ├─ "Notifications" header
  │    ├─ Last 7 days (max 10 notifications)
  │    │  ├─ Each notification:
  │    │  │  ├─ Icon + Priority color (red/orange/blue)
  │    │  │  ├─ Title + message (1-2 lines)
  │    │  │  ├─ Time "2 hours ago"
  │    │  │  └─ [X Dismiss]
  │    │  │
  │    │  └─ (scroll if >10)
  │    │
  │    └─ Footer
  │       ├─ [View All Activity] (link to /activity)
  │       └─ [Notification Preferences] (link to /settings?tab=notifications)
  │
  └─ Close on outside click
```

### What DOESN'T Belong in Bell (Goes in Activity Instead)

- ❌ Email sent ← historical, not actionable
- ❌ Email opened ← FYI, not actionable
- ❌ SMS sent ← historical, not actionable
- ❌ Payment detected (already paid) ← informational, not action-needed
- ❌ Agent run completed ← FYI, not actionable
- ❌ Risk score changed ← historical, use dashboard instead

---

## PART 2: WHAT SHOULD ACTIVITY TAB BE?

### 🎯 Principle: Activity = Full Audit Trail + Recovery Journey View

Activity shows the full history BUT organized by INVOICE'S RECOVERY JOURNEY, not by channel.

### Current Structure (Already Exists)

```
Activity.tsx
├─ Section 1: PENDING APPROVAL
│  ├─ Items waiting for user to approve/reject
│  ├─ Filter: Type (Email/SMS), Email Type (dunning_1/2/3), Days Overdue
│  ├─ Multi-select: Select multiple + bulk approve/reject
│  └─ For each item:
│     ├─ Customer, Amount, Days Overdue, Type, Created Date
│     ├─ [Preview] [Edit] [Approve] [Reject] buttons
│     └─ Edit modal for subject/body (email) or message (SMS)
│
└─ Section 2: SENT & TRACKED
   ├─ All sent items (email OR SMS) with results
   ├─ Filter: Status (sent/opened/bounced/failed/delivered)
   ├─ Search: By customer email
   └─ For each item:
      ├─ Customer, Type, Status, Date Sent, Date Opened/Delivered
      ├─ Status badge (green/red/orange)
      └─ [Preview] [Resend] buttons
```

**Problem with Current Structure**: Missing context of WHICH INVOICE's JOURNEY this item belongs to.

### PROPOSED NEW STRUCTURE: Recovery Journey View

**Key Change**: Add invoice context to every item so user sees: "This is email #2 for Invoice #1, following email #1 that bounced on April 17"

```
Activity.tsx (Redesigned)
├─ [FILTERS BAR]
│  ├─ Status: All | Pending Approval | Sent | Failed | etc
│  ├─ Customer: [dropdown of customers with active items]
│  ├─ Days Overdue: All | 0-30 | 30-60 | 60+
│  └─ [Search] by customer name/email
│
├─ PENDING APPROVAL SECTION
│  ├─ Header: "2 items waiting for approval"
│  ├─ [Select All] [Approve Selected] [Reject Selected] buttons
│  │
│  └─ For each pending item (card layout):
│     ├─ Header row:
│     │  ├─ [☑] Checkbox
│     │  ├─ Invoice #1 (€5,230) | Customer: ACME | 20 days overdue
│     │  ├─ Type badge: 📧 Email dunning_2 OR 📱 SMS
│     │  └─ Created: Apr 20, 2:30 PM
│     │
│     ├─ Context row (WHY this item exists):
│     │  └─ "Email dunning_1 bounced on Apr 17. Escalating to SMS (customer avg 2.3 emails before paying)"
│     │
│     ├─ Content preview:
│     │  ├─ If email: [Subject line preview] | [Body preview - 2 lines]
│     │  └─ If SMS: [Message preview - full]
│     │
│     └─ Actions row:
│        ├─ [👁 Preview] [✏️ Edit] [✅ Approve] [❌ Reject]
│        └─ On approve: send immediately + move to Sent & Tracked
│           On reject: 7-day block created, item moves to Rejected section
│
├─ REJECTED SECTION (Collapsed by default)
│  ├─ Header: "1 item rejected (7-day block expires Apr 27)"
│  └─ For each rejected item:
│     ├─ Invoice context
│     ├─ "Rejected on Apr 20 | Blocked until Apr 27"
│     └─ [Move back to Pending] [Force Approve Now]
│
├─ SENT & TRACKED SECTION
│  ├─ Header: "Last 30 sent items"
│  │
│  └─ For each sent item (compact row layout):
│     ├─ Status icon (✅ opened | 📧 sent | ❌ bounced | 📬 delivered)
│     ├─ Invoice #1 | Customer: ACME | Type: Email dunning_1
│     ├─ Status + metadata:
│     │  ├─ If opened: "✅ Opened 2 hours ago"
│     │  ├─ If bounced: "❌ Hard bounce - no delivery"
│     │  ├─ If sent: "📧 Sent Apr 17, 10:30am"
│     │  └─ If delivered (SMS): "📬 Delivered Apr 20, 3:15pm"
│     │
│     └─ Actions:
│        ├─ [👁 Preview]
│        └─ [🔄 Resend] (if failed)
│
└─ [GLOBAL STATS at bottom]
   ├─ Pending approval: 2
   ├─ Sent (last 7d): 12
   ├─ Opened: 8 (67%)
   ├─ Bounced: 1
   └─ Last agent run: Apr 21, 6:00 AM (2 emails queued, 0 SMS)
```

### Why This Structure Works Better

1. **Invoice Context**: Every item shows "this is for invoice X, days overdue Y"
2. **Recovery Journey**: "Email #1 → bounced → Escalating to SMS" tells the story
3. **User Action Required**: Pending approval section is PROMINENT, not hidden in tabs
4. **Historical Record**: Sent & Tracked is searchable, filterable, permanent
5. **No Tab Switching**: Single page, single scroll (all 3 sections visible)

---

## PART 3: EVENTS THAT SHOULD EXIST

### Backend Events → Notifications

| What Happens | Event Name | Notification? | Activity? | Code Location |
|--------------|-----------|----------------|-----------|----------------|
| Agent queues email | `email_queued` | ❌ No (batch shows as DAILY_ACTIONS_READY) | ✅ Yes | agentLoop.ts:325 |
| Email sent | `email_sent` | ❌ No | ✅ Yes | emailService.ts:sendEmail() |
| Email opened | `email_opened` | ❌ No | ✅ Yes | webhook handler |
| Email bounced | `email_bounced` | ✅ **YES** (🚨) | ✅ Yes | emailController.ts webhook |
| Email failed | `email_failed` | ❌ No | ✅ Yes | emailService.ts catch |
| Agent queues SMS | `sms_queued` | ❌ No (batch included in DAILY_ACTIONS_READY) | ✅ Yes | agentLoop.ts:410 |
| SMS sent | `sms_sent` | ❌ No | ✅ Yes | smsService.ts |
| SMS delivered | `sms_delivered` | ❌ No | ✅ Yes | Twilio webhook |
| SMS failed | `sms_failed` | ✅ **YES** (🚨) | ✅ Yes | Twilio webhook |
| Payment detected | `payment_detected` | ✅ **YES** (💰) | ✅ Yes | stripeService.ts webhook |
| Trial ending 3d | `trial_warning` | ✅ **YES** (⏰) | ❌ No | scheduler.ts |
| Trial expired | `trial_expired` | ✅ **YES** (❌) | ❌ No | scheduler.ts |
| Stripe disconnected | `system_alert` | ✅ **YES** (🔴) | ❌ No | Dashboard health check |
| Email not configured | `system_alert` | ✅ **YES** (📧) | ❌ No | Dashboard health check |

### What's Missing from Current Staged Changes

**Currently Wired** (in notificationLogger.ts):
- ✅ `logPaymentReceivedNotification()` — called from Stripe webhook
- ✅ `logEmailBouncedNotification()` — function exists but maybe not called everywhere
- ✅ `logTrialEndingNotification()` — scheduler
- ✅ `logTrialExpiredNotification()` — scheduler
- ✅ `logStripeNotConnectedNotification()` — dashboard health check
- ✅ `logEmailNotConfiguredNotification()` — dashboard health check

**MISSING Wiring**:
1. **Email bounced notification** — logEmailBouncedNotification() exists but needs to be called from agentLoop when hard bounce detected
2. **Daily actions ready** — logDailyActionsAvailableNotification() exists but not called from agentLoop when ≥3 emails queued
3. **SMS failed** — logSmsFailedNotification() doesn't exist (needs to be created + called from Twilio webhook)
4. **SMS queued** — SMS queueing happens but no activity event logged

---

## PART 4: INTERCONNECTION FLOWS

### Flow 1: Bounce → SMS Escalation → User Approval

```
Email sent (Apr 17, 10:30am)
  ↓
Resend webhook: Hard bounce
  ↓
→ Create notification: "🚨 Email bounced to john@acme.com"
  (shows in bell, click → goes to /activity)
→ Log activity event: "Email bounced (hard failure)"
→ Update email_logs.status = 'bounced'
  ↓
Next agent run (6 hours later)
  ↓
Agent detects: bounce + emailsSent=1 + avgEmailsNeeded=2.3
  ↓
→ Queue SMS to pilotQueuedEmails (type='sms')
→ Log agent decision: "SMS escalation (email bounced)"
→ Create notification: "✅ SMS ready to send (customer avg 2.3 emails needed)"
  ↓
User sees bell notification
  ↓
User opens Activity → Pending Approval section
  ↓
User sees: "Invoice #1 — SMS pending — Email dunning_1 bounced. Escalating to SMS."
  ↓
User clicks [Approve]
  ↓
→ SMS sent immediately
→ Log activity event: "SMS sent to +1-555-9012"
→ Move item to Sent & Tracked
  ↓
Twilio webhook: SMS delivered
  ↓
→ Log activity event: "SMS delivered"
→ Update sms_logs.status = 'delivered'
```

### Flow 2: Multiple Emails Queued → Daily Actions Notification

```
Agent run (every 6 hours)
  ↓
Invoice #1: Queues dunning_1 (time eligible)
Invoice #2: Queues dunning_1 (time eligible)
Invoice #3: Queues dunning_2 (escalation path)
  ↓
emailsQueued = 3 (>= threshold)
  ↓
→ Create notification: "✅ 3 actions ready for approval"
  (🟠 Warning priority, shows in bell)
→ Log activity event: "Agent run completed (3 emails queued)"
  ↓
User sees bell badge with "1" unread
  ↓
User clicks bell → sees notification
  ↓
User clicks "View All Activity"
  ↓
Activity.tsx: Pending Approval section expanded
  ├─ Invoice #1: Email dunning_1
  ├─ Invoice #2: Email dunning_1
  └─ Invoice #3: Email dunning_2
  ↓
User reviews → [Select All] [Approve] → All sent
```

### Flow 3: Payment Received

```
Customer pays
  ↓
Stripe webhook fires
  ↓
→ Update invoice.status = 'paid'
→ Create notification: "💰 Payment received from ACME ($5,000)"
  (🟠 Warning priority, shows in bell)
→ Log activity event: "Payment detected ($5,000)"
  (but ONLY in activity, not in Pending Approval)
  ↓
User sees bell notification
  ↓
User clicks → navigates to /invoices (can see paid status)
```

---

## PART 5: DATA FLOW & API CHANGES

### What Gets Queued in pilotQueuedEmails

```typescript
{
  id: UUID,
  company_id: UUID,
  invoice_id: UUID,
  customer_id: UUID,
  type: 'email' | 'sms',           // ← This is the key field
  
  // For EMAIL type:
  email_type: 'dunning_1' | 'dunning_2' | ... | 'payment_plan_offer',
  recipient_email: string,
  subject: string,
  body: string,
  
  // For SMS type:
  phone: string,
  message_preview: string,
  message_full: string,
  
  // Shared fields:
  status: 'pending_approval' | 'sent' | 'rejected' | 'failed',
  created_at: timestamp,
  approved_at: timestamp | null,
  sent_at: timestamp | null,
  rejected_at: timestamp | null,
  rejection_reason: string | null,
  rejection_block_until: timestamp | null,  // 7-day block if rejected
}
```

### Activity Tab API Endpoint

```typescript
GET /api/activity
Returns:
{
  pending_approval: [
    {
      id, invoice_id, customer_id, type, email_type | phone,
      subject | message, created_at,
      invoice: { id, amount, due_date, days_overdue },
      customer: { name, email },
      context: {
        previous_step: 'Email dunning_1 bounced on Apr 17',
        reason: 'Email bounced (hard), escalating to SMS',
        avg_emails_needed: 2.3
      }
    }
  ],
  rejected: [
    {
      id, invoice_id, rejected_at, rejection_block_until,
      context: { reason, moved_back_eligible_at }
    }
  ],
  sent_tracked: [
    {
      id, type, status, sent_at, delivered_at, opened_at,
      invoice, customer, content_preview,
      result: 'opened' | 'delivered' | 'bounced' | 'failed'
    }
  ],
  stats: {
    pending_count: number,
    rejected_count: number,
    sent_last_7d: number,
    opened_count: number,
    bounced_count: number,
    last_agent_run: { timestamp, emails_queued, sms_queued }
  }
}
```

---

## PART 6: UI MOCK-UPS

### Bell Icon + Popover

```
┌─────────────────────────────────┐
│ Header                      [🔔₁] ← badge shows "1" (unread count)
└─────────────────────────────────┘

┌─────────────────────────────────────┐
│ NOTIFICATIONS        [↻ Refresh]    │
├─────────────────────────────────────┤
│                                     │
│ 🟠 ✅ 3 actions ready for approval │
│    Your agent has identified 3     │
│    dunning messages ready to send. │
│    Approve to send immediately.    │
│    ~ 2 hours ago      [✕ Dismiss]  │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│ 💰 Payment received from ACME      │
│    €5,000 payment received and     │
│    matched to Invoice #3.          │
│    ~ 6 hours ago      [✕ Dismiss]  │
│                                     │
│ ─────────────────────────────────── │
│                                     │
│ 🚨 Email bounced to john@acme.com │
│    Email dunning_1 failed to       │
│    deliver. Escalating to SMS.     │
│    ~ 1 day ago        [✕ Dismiss]  │
│                                     │
├─────────────────────────────────────┤
│ [View All Activity] [Preferences]  │
└─────────────────────────────────────┘
```

### Activity Tab - Pending Approval Section

```
PENDING APPROVAL — 2 items waiting
═════════════════════════════════════════════════════════════

[☑ Select All]  [Approve Selected]  [Reject Selected]

┌─────────────────────────────────────────────────────────────┐
│ ☐ Invoice #1 (€5,230) | ACME Corp | 20 days overdue         │
│   📧 Email dunning_2 • Created Apr 20, 2:30 PM             │
│                                                              │
│   📌 Context: Email dunning_1 sent Apr 17. After 3 days     │
│              no engagement. Sending dunning_2.              │
│                                                              │
│   Subject: Invoice €5,230 now 20 days overdue               │
│   Body: Dear John, we haven't received payment for...       │
│          [Show 2-3 lines preview]                           │
│                                                              │
│   [👁 Preview] [✏️ Edit] [✅ Approve] [❌ Reject]          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ☐ Invoice #2 (€3,100) | TechWave Inc | 8 days overdue      │
│   📱 SMS • Created Apr 20, 6:00 AM                          │
│                                                              │
│   📌 Context: Email dunning_1 bounced hard on Apr 17.       │
│              Customer avg 2.3 emails before payment.        │
│              Escalating to SMS.                             │
│                                                              │
│   Message: Hi John, your invoice €3,100 is overdue.         │
│            Please arrange payment. Reply PAID when done.    │
│                                                              │
│   [👁 Preview] [✏️ Edit] [✅ Approve] [❌ Reject]          │
└─────────────────────────────────────────────────────────────┘
```

### Activity Tab - Sent & Tracked Section

```
SENT & TRACKED — 12 items (last 7 days)
════════════════════════════════════════════════════════════════

Filter: [All Status ▼] [All Customers ▼] [Search customer...]

┌────────────────────────────────────────────────────────────┐
│ ✅ Invoice #1 | ACME | Email dunning_1                     │
│    Status: Opened (2 hours ago)                            │
│    Sent: Apr 17 10:30am | Opened: Apr 17 2:15pm           │
│    Open rate: 1/1 (100%)                                   │
│    [👁 Preview]                                            │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ ❌ Invoice #2 | TechWave | Email dunning_1                 │
│    Status: Bounced (hard failure)                          │
│    Sent: Apr 10 9:00am | Bounced: Apr 10 9:15am           │
│    Reason: Invalid email address                           │
│    Action: Escalated to SMS (queued Apr 20)               │
│    [👁 Preview]                                            │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ 📧 Invoice #3 | BuildCo | Email dunning_2                  │
│    Status: Sent                                            │
│    Sent: Apr 19 3:45pm | Opened: Not yet                   │
│    [👁 Preview]                                            │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ 📬 Invoice #1 | ACME | SMS                                 │
│    Status: Delivered                                       │
│    Sent: Apr 20 6:00am | Delivered: Apr 20 6:02am         │
│    [👁 Preview]                                            │
└────────────────────────────────────────────────────────────┘
```

---

## PART 7: NOTIFICATION WIRING CHECKLIST

### What Needs to Be Added/Fixed

**1. Email Bounce Notification** (Already has function, needs wiring)
```typescript
// In emailController.ts webhook handler (when hard bounce detected)
await logEmailBouncedNotification(
  companyId,
  customerName,
  recipientEmail,
  'Hard bounce - undeliverable'
);
```

**2. Daily Actions Notification** (Already has function, needs wiring)
```typescript
// In agentLoop.ts, after queueing emails
if (emailsQueued >= 3) {
  await logDailyActionsAvailableNotification(companyId, emailsQueued);
}
```

**3. SMS Failed Notification** (Function doesn't exist, needs creation)
```typescript
// In notificationLogger.ts - NEW
export async function logSmsFailedNotification(
  companyId: string,
  customerName: string,
  phone: string,
  reason?: string
): Promise<void> {
  await createNotificationEvent(companyId, 'sms_failed', ...) 
}

// Called from: Twilio webhook handler or smsService catch block
```

**4. Unreachable Customer** (If no SMS available after bounce)
```typescript
// In agentLoop.ts, when SMS conditions not met
if (!invoice.customer_phone_opt_in || !invoice.customer_phone) {
  await logUnreachableNotification(
    companyId,
    customerName,
    'Email bounced and SMS not available'
  );
}
```

---

## PART 8: ACTIVITY TAB API ENDPOINTS

### Modify Existing Endpoint

**GET /api/activity** (CHANGE from current)

**Current**: Returns separate emailLogs, queueStats, pilot queue

**New**: Returns structured object with:
- `pending_approval` — pilotQueuedEmails with status='pending_approval' (email OR sms)
- `rejected` — pilotQueuedEmails with status='rejected'
- `sent_tracked` — pilotQueuedEmails with status='sent' + email_logs/sms_logs combined
- `stats` — counts + last agent run info

**Sample Response**:
```json
{
  "pending_approval": [
    {
      "id": "uuid",
      "invoice_id": "inv-1",
      "customer_id": "cust-1",
      "type": "email",
      "email_type": "dunning_2",
      "recipient_email": "john@acme.com",
      "subject": "Invoice overdue",
      "body": "...",
      "created_at": "2026-04-20T14:30:00Z",
      "invoice": {
        "id": "inv-1",
        "amount": 5230,
        "due_date": "2026-04-01",
        "days_overdue": 20
      },
      "customer": {
        "name": "ACME Corp",
        "email": "info@acme.com"
      },
      "context": {
        "previous_step": "Email dunning_1 sent Apr 17",
        "reason": "3-day gap met (Tier 2 = 6d gap). Sending dunning_2.",
        "metadata": {
          "tier": 2,
          "gap_days": 6,
          "avg_emails_needed": 2.3
        }
      }
    },
    {
      "id": "uuid",
      "invoice_id": "inv-2",
      "customer_id": "cust-2",
      "type": "sms",
      "phone": "+1-555-9012",
      "message_full": "Invoice €3,100 is overdue...",
      "created_at": "2026-04-20T06:00:00Z",
      "context": {
        "previous_step": "Email dunning_1 bounced hard on Apr 17",
        "reason": "Hard bounce + 8 days overdue. Customer avg 2.3 emails. SMS eligible.",
        "metadata": {
          "bounce_reason": "Invalid address",
          "avg_emails_needed": 2.3,
          "escalation_path": "email -> sms"
        }
      }
    }
  ],
  "rejected": [
    {
      "id": "uuid",
      "invoice_id": "inv-3",
      "rejected_at": "2026-04-19T10:00:00Z",
      "rejection_block_until": "2026-04-26T10:00:00Z",
      "reason": "User rejected dunning_1"
    }
  ],
  "sent_tracked": [
    {
      "id": "uuid",
      "invoice_id": "inv-1",
      "type": "email",
      "status": "opened",
      "recipient": "john@acme.com",
      "subject": "Invoice overdue",
      "sent_at": "2026-04-17T10:30:00Z",
      "opened_at": "2026-04-17T14:15:00Z",
      "invoice": { "id", "amount", "due_date" },
      "customer": { "name" }
    },
    {
      "id": "uuid",
      "invoice_id": "inv-2",
      "type": "sms",
      "status": "delivered",
      "phone": "+1-555-9012",
      "sent_at": "2026-04-20T06:00:00Z",
      "delivered_at": "2026-04-20T06:02:00Z",
      "message_preview": "Invoice €3,100 is overdue..."
    }
  ],
  "stats": {
    "pending_count": 2,
    "rejected_count": 1,
    "sent_last_7d": 12,
    "opened_count": 8,
    "bounced_count": 1,
    "last_agent_run": {
      "timestamp": "2026-04-21T06:00:00Z",
      "emails_queued": 2,
      "sms_queued": 1,
      "reason": "2 invoices time-eligible for escalation"
    }
  }
}
```

---

## PART 9: IMPLEMENTATION PRIORITY

### Week 1: Foundation (7-10 hours)

1. **Wire missing notifications** (2 hours)
   - Email bounce notification (call from emailController.ts)
   - Daily actions notification (call from agentLoop.ts)
   - Create SMS failed notification function + wire

2. **Enhance Activity API endpoint** (2 hours)
   - Modify `/api/activity` to return structured response
   - Include context (previous_step, reason, metadata)
   - Aggregate pending + rejected + sent

3. **Update Activity.tsx UI** (3-4 hours)
   - Add invoice context to each pending item
   - Show reason/context why it's queued
   - Add metadata display
   - Remove tab switching (single page)
   - Reorganize Pending/Rejected/Sent into 3 sections

4. **Test end-to-end** (1-2 hours)
   - Queue email → see in pending approval + notification
   - Approve email → see in sent & tracked
   - Bounce email → see notification + SMS in pending
   - Approve SMS → see in sent & tracked

---

## PART 10: KEY DESIGN DECISIONS

### Why NOT Separate SMS Tab?

❌ Wrong approach: "Emails" | "SMS" | "Payments" tabs

✅ Right approach: Each item shows its RECOVERY JOURNEY context

**Reason**: User doesn't think in channels. They think in invoices:
- "What's happening with invoice #1?" → answer: "Email sent, bounced, SMS queued"
- NOT: "Show me all SMS" (user doesn't need to switch channels to understand)

### Why pilotQueuedEmails (Not Separate SMS Table)?

The `type` field in pilotQueuedEmails handles both email AND sms. No need for `sms_logs` table because:
- SMS is part of the same pipeline as email
- User approves/rejects both in same workflow
- Same schema (id, type, status, created_at, approved_at, sent_at)

**BUT**: When SMS is SENT, we track it separately:
- `email_logs` for email delivery tracking (opened, clicked, bounced)
- `sms_logs` for SMS delivery tracking (sent, delivered, failed) ← NEEDED for Activity to show delivery status

### Why Activity > Dashboard

Dashboard shows KPIs and health. Activity shows AUDIT TRAIL and DECISIONS.

Different purposes:
- **Dashboard**: "What's the state right now?" (total AR, recovery rate, risk)
- **Activity**: "What happened and why?" (full journey, user decisions, escalations)

---

## SUMMARY

### Notifications (Bell)
- ✅ 8 actionable event types
- ✅ Unread count badge
- ✅ Click → navigate + mark read
- ❌ Missing: Wire email bounce, daily actions, SMS failed, unreachable

### Activity Tab
- ✅ Pending Approval section (with invoice context + reason)
- ✅ Sent & Tracked section (with status + results)
- ✅ Rejected section (with block expiry)
- ✅ Single page (no tabs)
- ✅ Filters: status, customer, days overdue
- ✅ Search
- ❌ Missing: Context/reason for each item, SMS logs table for delivery tracking

### Pipeline Visualization
- ✅ Shows email → bounced → SMS escalation as ONE journey
- ✅ "Why was SMS queued?" answered in context field
- ✅ User understands agent decisions without clicking multiple tabs

