---
name: Notification Strategy - Deep Analysis
description: When to notify, why, how other platforms do it, complete rethink
type: project
originSessionId: a92f1ac8-5a4d-4578-9f60-0287147f22b6
---
# 🔔 Notification Strategy — Deep Analysis

## The Fundamental Question

**When should we notify a user?**

Answer: **Only when they need to take action OR something important just happened.**

---

## How Others Do It

### **Slack** 📱
Notifications fire when:
```
✅ Someone mentioned you
✅ New direct message arrived
✅ Someone replied to your thread
✅ Reaction to your message
✅ New comment on workflow approval

❌ NOT shown:
❌ Message in channel you're not watching
❌ Someone is typing
❌ Background bot processing
```

**Pattern:** USER ACTION NEEDED or DIRECT MENTION

---

### **Linear** 🎯
Notifications fire when:
```
✅ Issue assigned to you
✅ Issue mentioned you (@user)
✅ Someone commented on your issue
✅ Status changed by someone else
✅ Approval requested

❌ NOT shown:
❌ Backlog status changes
❌ Other people's work
❌ Archive operations
```

**Pattern:** AFFECTS YOU or NEEDS YOUR DECISION

---

### **Gmail** 📧
Notifications fire when:
```
✅ New email arrived (inbox)
✅ New meeting invitation
✅ Important star from someone
✅ Shared folder update

❌ NOT shown:
❌ Draft created
❌ Email scheduled
❌ Background sync
```

**Pattern:** NEW ARRIVAL or SOMEONE ACTING ON YOU

---

### **GitHub** 🐙
Notifications fire when:
```
✅ PR requested your review
✅ You were mentioned in issue
✅ Your PR got a comment
✅ Your PR was merged
✅ CI/CD check failed

❌ NOT shown:
❌ Other people's PRs
❌ Closed issues
❌ Background workflows completed
```

**Pattern:** DECISION NEEDED or STATUS CHANGE AFFECTING YOU

---

### **Stripe** 💳
Notifications fire when:
```
✅ Charge failed (payment didn't go through)
✅ Refund completed
✅ Large transaction (>threshold)
✅ Dispute/chargeback filed
✅ Account alert (fraud detected)

❌ NOT shown:
❌ Regular charge succeeded
❌ Small transactions
❌ Webhook processing
```

**Pattern:** ANOMALY or PROBLEM OCCURRED

---

## **The Core Principle**

```
Notification = Action Needed + Right Now
```

**NOT:**
```
❌ Background processing completed
❌ Just FYI information
❌ Status that doesn't affect user
❌ Repeating information
```

---

## **Applied to RecoverAI**

### **What's an "Action" in RecoverAI?**

```
Manual approval needed (Shadow mode)
│
├─ ✅ Email queued for approval
├─ ✅ SMS queued for approval
├─ ✅ Voice call queued for approval
├─ ✅ Write off / manual status change needed
│
Problem occurred (agent can't proceed)
│
├─ ✅ Stripe not connected
├─ ✅ Email not configured
├─ ✅ Paid invoice still marked unpaid (needs correction)
├─ ✅ Customer phone not verified (SMS can't send)
│
Important event (user should know)
│
├─ ✅ Payment received (recovery win)
├─ ✅ Trial ending soon (action needed: upgrade)
├─ ⚠️ Risk score critically high (customer might not pay)
│
Nice to know (not urgent)
│
├─ ❌ Email bounced (can retry later)
├─ ❌ SMS failed (can retry later)
├─ ❌ Agent run completed (background info)
```

---

## **Your Specific Case: "10 Emails in Queue"**

### Current Misunderstanding

You said: "If there are 10 invoices in queue, and user has to manually approve"

**I misunderstood:** I thought you meant "pending dunning decisions"

**You actually meant:** "Emails in `pilot_queued_emails` table with `status='pending_approval'"

### The Correct Logic

```
Agent runs every 6 hours
  ↓
In SHADOW mode: generates emails but doesn't send them
  ↓
Emails go to: pilot_queued_emails table with status='pending_approval'
  ↓
These are BLOCKING: Agent can't send next batch until user approves
  ↓
✅ USER ACTION NEEDED → Send notification

If 10 emails are pending approval:
  Title: "10 emails waiting for your approval"
  Count: 10 (not from agentLoop decision count)
  Action: /invoices?filter=queued_approval
  Priority: WARNING (blocks agent)
```

---

## **The Full Notification Strategy**

### **🔴 CRITICAL (Blocks Agent)**

Notify WHEN:
```
1. Stripe not connected
   Trigger: Every check, deduplicate 1/hour
   User action: Connect Stripe
   
2. Email not configured
   Trigger: Every check, deduplicate 1/hour
   User action: Setup email
   
3. Emails queued for approval >= 3
   Trigger: After agentLoop creates pending_approval items
   User action: Approve/reject emails
   Count: SELECT COUNT(*) FROM pilot_queued_emails WHERE status='pending_approval'
```

### **🟡 IMPORTANT (User Should Know)**

Notify WHEN:
```
4. Payment received
   Trigger: Stripe webhook detects successful charge
   User action: None needed (just informational)
   Show once per payment
   
5. Trial ending in X days
   Trigger: Cron job checks trial_ends_at <= NOW() + 7 days
   User action: Upgrade to continue
   Show once per trial expiration warning
```

### **🟢 DELETE (Too Spammy)**

Remove:
```
❌ Agent run completed (every 6h, no action)
❌ Risk score changed (per invoice, too granular)
❌ Email bounced (rare, user can see in Activity)
❌ SMS failed (rare, user can see in Activity)
```

---

## **The Queue Concept**

You have queues for approval:
```
pilot_queued_emails (email approval queue)
sms_queue (SMS approval queue - if exists)
voice_call_queue (Voice approval queue - if exists)
```

**The pattern:**
```
Count all items in ALL queues with status='pending_approval'
If count >= 3:
  Notify: "N emails waiting for approval"
  Take them to: /invoices?filter=queued_approval
  Show ALL pending items (emails, SMS, voice)
```

---

## **Why NOT Notify for "Unpaid Invoices"?**

Unpaid invoices are the BASELINE status - not an action.

```
❌ WRONG: "You have 1,234 unpaid invoices"
   → Why? User already knows this
   → Notification every hour? Spam
   → No action needed
   
✅ RIGHT: "5 invoices ready for dunning approval"
   → Why? Agent wants to send, needs approval
   → NEW situation (from last 6h)
   → Action needed (approve/reject)
```

**Analogy:**
```
❌ Gmail notification: "You have email"
✅ Gmail notification: "New email from your boss"

❌ Linear notification: "You have 50 tasks"
✅ Linear notification: "Task assigned to you"

❌ RecoverAI notification: "You have unpaid invoices"
✅ RecoverAI notification: "5 invoices ready to dunning"
```

---

## **How Stripe Does This Right**

Stripe notifies when:
```
✅ Transaction declined
   Why: Problem occurred, user might need to retry/investigate
   
✅ Refund issued
   Why: Money moved, user should know
   
✅ High-risk transaction detected
   Why: Potential fraud, action may be needed
   
❌ NOT: "You processed a charge"
   Why: That's expected behavior, not news
```

---

## **Applied to Your Invoices**

### **What to Notify ON:**

```
Invoice State Change (from last check):
├─ New unpaid invoice added? ❌ (baseline)
├─ Status changed to paid? ✅ (recovery!)
├─ Status changed to arranged? ✅ (action taken)
├─ Status changed to uncollectable? ✅ (decision made)
├─ Risk score jumped from 20→80? ✅ (critical change)
└─ Dunning was paused/resumed? ⚠️ (maybe)

Queue Status:
├─ Email pending approval? ✅ (action needed)
├─ SMS pending approval? ✅ (action needed)
├─ Voice pending approval? ✅ (action needed)
└─ Agent decision queued? ❌ (just background processing)

Recovery Events:
├─ Payment received? ✅ (good news)
├─ Customer paid after dunning? ✅ (agent worked!)
└─ Large recovery completed? ✅ (milestone)
```

---

## **The Correct Flow**

```
Agent Run (every 6h):
  ↓
  Evaluates 100 unpaid invoices
  ↓
  Decides: "Invoice #1 → send email, Invoice #2 → send SMS, ..."
  ↓
  Creates entries in pilot_queued_emails with status='pending_approval'
  ↓
  Check count: SELECT COUNT(*) WHERE status='pending_approval'
  ↓
  If count >= 3:
    Send notification: "5 emails waiting for your approval"
    ↓
    User sees bell icon badge: [5]
    ↓
    User clicks → goes to /invoices?filter=queued_approval
    ↓
    Sees: List of 5 invoices with pending actions
    ↓
    For each: "Approve & Send" or "Skip/Edit"
    ↓
    User approves → email sent, mark as processed
    ↓
    When all approved → notification automatically clears
    ↓
    Agent continues with next batch

Meanwhile:
  Payment comes in → Notify: "Payment received from Acme Inc"
  Stripe disconnects → Notify: "Stripe not connected"
  Trial ending soon → Notify: "Trial ends in 3 days"
```

---

## **Notification Frequency**

### **Current Problem**

Agent runs every 6 hours:
```
6:00 AM → Creates 10 emails for approval → Notify
12:00 PM → Creates 5 more emails → Notify (spam if user not watching)
6:00 PM → Creates 3 more emails → Notify
11:00 PM → Creates 2 more emails → Notify
```

User gets 4 notifications/day even if not handling them.

### **Better Approach**

**Option A: Deduplicate**
```
Only notify if pending_approval count CHANGES significantly
If 10 → 12, don't notify (still high)
If 0 → 5, notify (now high)
If 5 → 0, notify (cleared)
```

**Option B: Batch Notification**
```
At 8 AM: "15 emails waiting for approval (from overnight agent runs)"
At 8 PM: "8 emails waiting for approval (from today's agent runs)"
```

**Option C: Only Notify If Blocking**
```
Notify only if count > 20 (agent is piling up approvals)
Assume user checks periodically if count < 20
```

---

## **Recommended Setup**

### **Tier 1: ALWAYS Notify (Critical Blocks)**
```
1. Stripe not connected
   Deduplicate: Once per hour
   
2. Email not configured
   Deduplicate: Once per hour
```

### **Tier 2: Notify If New (Action Needed)**
```
3. Emails pending approval >= 3
   Trigger: When count changes AND count >= 3
   Deduplicate: Don't notify again until count clears and resets
   Count logic: SELECT COUNT(*) FROM pilot_queued_emails 
               WHERE status='pending_approval'
```

### **Tier 3: Notify Once (Important Events)**
```
4. Payment received
   Deduplicate: Once per payment (unique transaction)
   
5. Trial ending in X days
   Deduplicate: Once per trial expiration date
```

### **Tier 4: Don't Notify (Spammy)**
```
❌ Agent run completed
❌ Risk score changed
❌ Email bounced
❌ SMS failed
```

---

## **FINAL: All Notifications (Consolidated)**

| Priority | Notification | Trigger | Count | Action URL | Default | Type |
|---|---|---|---|---|---|---|
| 🔴 **P0** | Stripe not connected | Missing stripe_account_id | N/A | /settings?tab=integrations | ON | In-app |
| 🔴 **P0** | Email not configured | Missing email setup (smtp_verified=false) | N/A | /settings?tab=email | ON | In-app |
| 🔴 **P0** | **Twilio not configured** | sms_enabled=true AND missing twilio_account_sid | N/A | /settings?tab=integrations | ON | In-app |
| 🟡 **P1** | Emails pending approval | SELECT COUNT(*) FROM pilot_queued_emails WHERE status='pending_approval' | >= 3 | /invoices?filter=queued_approval | ON | In-app |
| 🟡 **P1** | Payment received | Stripe webhook (charge.succeeded) | Per transaction | /dashboard | ON | In-app |
| 🟡 **P1** | Trial ending soon | trial_ends_at <= NOW() + 7 days | N/A | /settings?tab=billing | ON | In-app |
| 🟢 **P2** | **Email hard bounced** | Resend webhook (bounce_type='permanent') | Per customer | /customers/:customerId | OFF | In-app |
| 🟢 **P2** | **SMS hard failed** | Twilio webhook (error_type='hard_failure') | Per customer | /customers/:customerId | OFF | In-app |
| 🟢 **P2** | **Weekly summary** | Cron job (Monday 9 AM) | N/A | Email body | ON | EMAIL |
| 🟢 **P2** | **Daily recap** | Cron job (Every morning 8 AM) | N/A | Email body | OFF | EMAIL |
| 🟢 **P2** | **Monthly report** | Cron job (1st Monday 9 AM) | N/A | Email + PDF | OFF | EMAIL |

---

## **How to Fix**

### **Step 1: Rename the notification**
```typescript
// Change from:
logDailyActionsAvailableNotification(companyId, count)

// To:
logEmailsPendingApprovalNotification(companyId, count)
```

### **Step 2: Count correctly**
```typescript
// Don't count emailsQueued
// Instead count pending approvals:

const pendingApprovals = await pool.query(`
  SELECT COUNT(*) as count 
  FROM pilot_queued_emails 
  WHERE company_id = $1 
    AND status = 'pending_approval'
`,  [companyId]);

if (pendingApprovals.rows[0].count >= 3) {
  await logEmailsPendingApprovalNotification(
    companyId, 
    pendingApprovals.rows[0].count
  );
}
```

### **Step 3: Fix URL & messaging**
```typescript
action_url: '/invoices?filter=queued_approval',
title: `${count} emails waiting for your approval`,
message: 'Review and approve the pending dunning emails',
priority: 'warning'  // Important, blocks agent
```

### **Step 4: Add deduplication**
```typescript
const exists = await hasRecentUnreadSystemAlert(
  companyId, 
  'emails_pending_approval'
);
if (!exists || count > lastNotifiedCount + 5) {
  // Only notify if NEW high count
  await logEmailsPendingApprovalNotification(companyId, count);
}
```

---

## **The Philosophy**

```
Notifications = Communication from agent to human
Purpose = "I need you to make a decision"

NOT = "FYI, something happened in the background"

That's what Activity logs and dashboards are for.
```

Better messaging:
```
❌ "Agent run completed"
✅ "5 emails waiting for approval"

❌ "Risk score changed"
✅ "Customer high-risk, payment unlikely"

❌ "Email bounced"
✅ "Email to acme@example.com failed, retry?"
```

---

## **IMPLEMENTATION PLAN (Complete)**

### **Phase 1: P0 - Critical Blocks (15 mins)**

#### **1. Add Twilio Health Check**
**File:** `backend/src/services/systemHealthService.ts`

```typescript
// Add to checkAndNotifySystemHealth()
const smsTwilioEnabled = company.sms_enabled;
if (smsTwilioEnabled && !company.twilio_account_sid) {
  logInfo('systemHealthService', method, 'Twilio not configured, logging notification', { companyId });
  try {
    await logTwilioNotConfiguredNotification(companyId);
  } catch (err) {
    logError('systemHealthService', method, 'Failed to log Twilio alert (non-blocking)', err);
  }
}
```

#### **2. Add Twilio Notification Function**
**File:** `backend/src/utils/notificationLogger.ts`

```typescript
export async function logTwilioNotConfiguredNotification(companyId: string): Promise<void> {
  try {
    const exists = await hasRecentUnreadSystemAlert(companyId, 'twilio_not_configured');
    if (exists) {
      return;
    }

    await createNotificationEvent(
      companyId,
      'system_alert',
      '📱 Twilio not configured',
      {
        message: 'SMS escalation is enabled but Twilio is not connected. Agent cannot send SMS. Connect Twilio to enable SMS recovery.',
        icon: '📱',
        priority: 'critical',
        action_url: '/settings?tab=integrations',
        action_label: 'Connect Twilio',
        metadata: {
          event_type: 'twilio_not_configured',
        },
      }
    );
  } catch (err) {
    console.error('Error logging Twilio notification:', err);
  }
}
```

#### **3. Fix "Emails Pending Approval" Notification**
**File:** `backend/src/queue/agentLoop.ts`

```typescript
// CHANGE THIS (line 600-607):
if (emailsQueued >= 3 && invoices.length > 0) {
  try {
    const companyId = invoices[0].company_id;
    await logDailyActionsAvailableNotification(companyId, emailsQueued);
  } catch (notifyErr: unknown) {
    logWarn(LOG_MODULE, method, 'Failed to log daily actions notification (non-blocking)', { error: String(notifyErr) });
  }
}

// TO THIS:
// Count pending approvals (not queued emails)
const pendingApprovalsResult = await pool.query(`
  SELECT COUNT(*) as count 
  FROM pilot_queued_emails 
  WHERE company_id = $1 
    AND status = 'pending_approval'
`, [invoices[0].company_id]);

const pendingCount = parseInt(pendingApprovalsResult.rows[0]?.count || '0');

if (pendingCount >= 3 && invoices.length > 0) {
  try {
    const companyId = invoices[0].company_id;
    await logEmailsPendingApprovalNotification(companyId, pendingCount);
  } catch (notifyErr: unknown) {
    logWarn(LOG_MODULE, method, 'Failed to log pending approval notification (non-blocking)', { error: String(notifyErr) });
  }
}
```

#### **4. Rename & Update Notification Function**
**File:** `backend/src/utils/notificationLogger.ts`

```typescript
// RENAME FROM:
export async function logDailyActionsAvailableNotification(
  companyId: string,
  actionCount: number
): Promise<void> {

// TO:
export async function logEmailsPendingApprovalNotification(
  companyId: string,
  pendingCount: number
): Promise<void> {
  try {
    await createNotificationEvent(
      companyId,
      'emails_pending',
      `✉️ ${pendingCount} emails waiting for your approval`,
      {
        message: `Review and approve ${pendingCount} pending dunning emails. These are blocking the agent until approved.`,
        icon: '✉️',
        priority: 'warning',
        action_url: '/invoices?filter=queued_approval',
        action_label: 'Review Emails',
        metadata: {
          event_type: 'emails_pending_approval',
          pending_count: pendingCount,
        },
      }
    );
  } catch (err) {
    console.error('Error logging emails pending notification:', err);
  }
}
```

#### **5. Update notificationLogger.ts Exports**
```typescript
// Export both names for backward compatibility
export { logEmailsPendingApprovalNotification as logDailyActionsAvailableNotification };
```

---

### **Phase 2: P1 - Important Features (30 mins)**

#### **6. Add Hard Bounce Detection**
**File:** `backend/src/routes/webhooks.ts` (Resend webhook handler)

```typescript
// In Resend webhook handler
if (event.type === 'email.bounced' && event.data.bounce_type === 'permanent') {
  try {
    await logEmailHardBouncedNotification(
      companyId,
      customerName,
      event.data.to,
      event.data.bounce_reason
    );
  } catch (err) {
    // Non-blocking
  }
}
```

#### **7. Add Email Hard Bounce Notification**
**File:** `backend/src/utils/notificationLogger.ts`

```typescript
export async function logEmailHardBouncedNotification(
  companyId: string,
  customerName: string,
  email: string,
  reason?: string
): Promise<void> {
  try {
    await createNotificationEvent(
      companyId,
      'email_hard_bounce',
      `📧 Email bounced: ${email}`,
      {
        message: `Email to ${customerName} at ${email} failed permanently. ${reason || 'Invalid email address'}. Need to get valid contact info.`,
        icon: '📧',
        priority: 'warning',
        action_url: `/customers?search=${encodeURIComponent(customerName)}`,
        action_label: 'Update Contact',
        metadata: {
          event_type: 'email_hard_bounce',
          customer_name: customerName,
          email,
          reason,
        },
      }
    );
  } catch (err) {
    console.error('Error logging email hard bounce notification:', err);
  }
}
```

#### **8. Add SMS Hard Failure Detection**
**File:** `backend/src/queue/smsQueue.ts` (SMS error handler)

```typescript
// When Twilio returns hard failure
if (twilioError.errorType === 'hard_failure') {
  try {
    await logSmsHardFailedNotification(
      companyId,
      customerName,
      phone,
      twilioError.message
    );
  } catch (err) {
    // Non-blocking
  }
}
```

#### **9. Add SMS Hard Failure Notification**
**File:** `backend/src/utils/notificationLogger.ts`

```typescript
export async function logSmsHardFailedNotification(
  companyId: string,
  customerName: string,
  phone: string,
  reason?: string
): Promise<void> {
  try {
    await createNotificationEvent(
      companyId,
      'sms_hard_failure',
      `📱 SMS failed: ${phone}`,
      {
        message: `SMS to ${customerName} at ${phone} failed permanently. ${reason || 'Invalid phone number'}. Need to get valid contact info.`,
        icon: '📱',
        priority: 'warning',
        action_url: `/customers?search=${encodeURIComponent(customerName)}`,
        action_label: 'Update Contact',
        metadata: {
          event_type: 'sms_hard_failure',
          customer_name: customerName,
          phone,
          reason,
        },
      }
    );
  } catch (err) {
    console.error('Error logging SMS hard failure notification:', err);
  }
}
```

---

### **Phase 3: P2 - Email Digests (60 mins - Phase 1.5)**

#### **10. Create Weekly Summary Email Template**
**File:** `backend/src/services/emailDigestService.ts` (NEW)

```typescript
export async function sendWeeklySummaryEmail(companyId: string): Promise<void> {
  // Fetch metrics
  const metrics = await getWeeklyMetrics(companyId);
  
  const html = `
    <h2>RecoverAI Weekly Summary</h2>
    <p>📊 <strong>Recovery Metrics</strong></p>
    <ul>
      <li>Total AR: €${metrics.totalAR}</li>
      <li>Recovered this week: €${metrics.recoveredThisWeek}</li>
      <li>Payment rate: ${metrics.paymentRate}%</li>
      <li>Avg days to pay: ${metrics.avgDaysToPay}d</li>
    </ul>
    <!-- More content -->
  `;
  
  // Send email
  await emailService.send({
    to: company.email,
    subject: `RecoverAI Weekly Summary — Week of ${startDate}`,
    html,
  });
}
```

---

### **Complete Checklist**

**P0 (Do Now - 15 mins):**
- [ ] Add Twilio health check to systemHealthService
- [ ] Add logTwilioNotConfiguredNotification function
- [ ] Fix "Emails Pending Approval" trigger (count from DB, not emailsQueued)
- [ ] Rename logDailyActionsAvailableNotification
- [ ] Update action_url to /invoices?filter=queued_approval
- [ ] Test: Build & verify 0 errors

**P1 (After MVP - 30 mins):**
- [ ] Add hard bounce detection for emails
- [ ] Add logEmailHardBouncedNotification function
- [ ] Add hard failure detection for SMS
- [ ] Add logSmsHardFailedNotification function
- [ ] Add user preference toggles for bounces/failures
- [ ] Test: Trigger bounces, verify notifications appear

**P2 (Phase 1.5 - 60 mins):**
- [ ] Create emailDigestService.ts
- [ ] Add weekly summary email template
- [ ] Add weekly cron job (Monday 9 AM)
- [ ] Add user preferences for weekly/daily/monthly
- [ ] Test: Verify emails send on schedule

---

This is the correct mental model for your notifications.
