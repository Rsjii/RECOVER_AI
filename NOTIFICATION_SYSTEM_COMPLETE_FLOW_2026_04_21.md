# 🔔 NOTIFICATION SYSTEM - COMPLETE FLOW GUIDE (2026-04-21)

## Part 1: Overview - Two Types of Notifications

### TYPE A: SYSTEM ALERTS (Persistent Issues)
**Examples**: Stripe not connected, Email not configured, Trial ending, Agent paused

**Characteristics**:
- Represent ONGOING PROBLEMS that need to be FIXED
- Should keep reminding user until problem is resolved
- If user dismisses but problem still exists → Should reappear
- Deduplication: Prevent spam in same session
- Regeneration: Create fresh notification if problem persists

### TYPE B: EVENT NOTIFICATIONS (Past Events)
**Examples**: Payment received, Email bounced, SMS failed, Daily actions ready

**Characteristics**:
- Represent THINGS THAT ALREADY HAPPENED
- Should inform user once, not keep nagging
- If user dismisses → Never reappear (event is done)
- Deduplication: Not needed (events don't repeat)
- Regeneration: Never (event already occurred)

---

## Part 2: The Exact Flow - Step by Step

### SCENARIO 1: User Dismisses System Alert (Stripe not connected)

```
TIMELINE OF EVENTS:

📅 Day 1, 10:00 AM
─────────────────
1. User logs in → Dashboard loads
2. dashboardController.ts calls checkAndNotifySystemHealth()
3. Stripe not connected detected
4. logStripeNotConnectedNotification() called
5. hasRecentUnreadSystemAlert() checks:
   - Company has recent UNREAD stripe_disconnected? 
   - In last 5 minutes? 
   - Result: NO (first time)
6. createNotificationEvent() creates notification
7. Bell shows: 🔴 "Stripe not connected"
8. User sees bell badge with count


📅 Day 1, 10:15 AM  
─────────────────
1. User clicks X on notification in bell
2. handleDismiss() → API call to mark notification as read
3. Backend: UPDATE notification_events SET read_at = NOW()
4. Bell badge count decreases
5. Notification disappears from bell


📅 Day 1, 10:20 AM
─────────────────
1. User clicks Activity tab
2. NO health check here (not dashboard)
3. Dismissed notification stays gone
4. User has peace, problem still unsolved


📅 Day 1, 2:00 PM
─────────────────
1. User visits Dashboard again
2. dashboardController calls checkAndNotifySystemHealth()
3. Stripe STILL not connected
4. logStripeNotConnectedNotification() called AGAIN
5. hasRecentUnreadSystemAlert() checks:
   - Company has recent UNREAD stripe_disconnected?
   - In last 5 minutes?
   - Result: NO (dismissed notification is READ, not UNREAD)
6. createNotificationEvent() creates FRESH notification ✅
7. Bell shows: 🔴 "Stripe not connected" AGAIN
8. User realizes problem still there


📅 Day 2, 9:00 AM (Next Day)
─────────────────
1. User logs in → Dashboard loads
2. Same cycle repeats: Fresh notification created
3. Notification persists until Stripe is connected


📅 Day 2, 11:00 AM (Stripe Connected!)
─────────────────
1. User connects Stripe in integrations
2. Company.stripe_account_id is updated
3. Next dashboard load:
   - checkAndNotifySystemHealth() runs
   - !company.stripe_account_id is FALSE
   - Notification NOT created ✅
   - Problem solved, no more alerts
```

---

### SCENARIO 2: User Dismisses Event Notification (Payment received)

```
TIMELINE OF EVENTS:

📅 Day 1, 10:00 AM
─────────────────
1. Stripe webhook fires: Payment received
2. Backend processes payment
3. logPaymentReceivedNotification() called
4. createNotificationEvent() creates notification
5. Bell shows: 💰 "Payment received $100"
6. User sees alert


📅 Day 1, 10:15 AM  
─────────────────
1. User clicks X on notification
2. handleDismiss() → SET read_at = NOW()
3. Notification disappears from bell


📅 Day 1, 2:00 PM
─────────────────
1. User visits Dashboard
2. checkAndNotifySystemHealth() runs
3. Checks Stripe/Email status (NOT about payments)
4. Payment notification NOT recreated ✅
5. Notification stays dismissed FOREVER


📅 Day 2, 9:00 AM (Next Day)
─────────────────
1. User logs in
2. Payment notification still dismissed
3. No recreation because event already happened
4. Result: Clean bell, not spammed
```

---

## Part 3: Deduplication Logic - How It Prevents Spam

### What is Deduplication?

**Problem it solves:**
```
Without deduplication:
- Dashboard loads
- Health check runs → Creates notification
- User clicks something → Dashboard reloads
- Health check runs again → Creates ANOTHER notification (same msg)
- User sees 4+ duplicate "Stripe not connected" messages ❌
```

**Solution: Deduplication**
```
With deduplication:
- Dashboard loads
- Health check runs → Creates notification
- User clicks something → Dashboard reloads
- Health check runs again → Checks if recent UNREAD notification exists
- Finds recent unread "stripe_disconnected" → SKIP creating duplicate ✅
- User sees only 1 message
```

### How It Works

**Function**: `hasRecentUnreadSystemAlert(companyId, eventType)`

```typescript
Location: backend/src/db/notificationEvents.ts (Lines 191-210)

Logic:
SELECT COUNT(*) FROM notification_events
WHERE company_id = $1                    // Same company
  AND event_type = 'system_alert'        // Only system alerts
  AND read_at IS NULL                    // Only UNREAD ones
  AND created_at >= NOW() - 5 MINUTES    // Only recent (last 5 min)
  AND metadata.event_type = $2           // Exact alert type (stripe_disconnected)

Result:
- If COUNT > 0 → Alert already exists → Skip creating new one
- If COUNT = 0 → No recent unread alert → Create new one
```

### Timeline of Deduplication in Action

```
10:00 AM: Dashboard loads → Health check → Creates "Stripe not connected"
         hasRecentUnreadSystemAlert() = FALSE → Creates notification ✅

10:00:30 AM: User navigates within dashboard → Reload triggers health check again
         hasRecentUnreadSystemAlert() = TRUE (found unread 30s old) → SKIPS ✅

10:01 AM: Another reload
         hasRecentUnreadSystemAlert() = TRUE (found unread 1 min old) → SKIPS ✅

10:05 AM: User clicks X (dismisses notification) → read_at = 10:05
         Notification is now READ

10:05:30 AM: Page reloads, health check runs again
         hasRecentUnreadSystemAlert() = FALSE (notification is READ, not UNREAD)
         Stripe still not connected → Creates FRESH notification ✅
         User sees message again!

10:10 AM: Another reload
         hasRecentUnreadSystemAlert() = TRUE (new notification is unread) → SKIPS ✅
```

---

## Part 4: Regeneration Logic - How Notifications Recreate

### Key Insight

**Deduplication checks UNREAD notifications only:**
```typescript
AND read_at IS NULL  // Only unread ones count for deduplication
```

**This means:**
- If notification is UNREAD → Deduplication prevents duplicate
- If notification is READ (dismissed) → Deduplication doesn't apply → NEW one created

### Regeneration Conditions

**System alerts regenerate when:**
1. User dismisses (read_at = now)
2. Problem still exists (Stripe not connected)
3. Next health check runs (Dashboard access)

**System alerts DO NOT regenerate when:**
1. Problem is fixed (Stripe connected) → Health check skips creating it
2. 5 minutes haven't passed → Deduplication prevents it

**Event notifications DO NOT regenerate when:**
1. Event already happened (payment processed) → No trigger to recreate
2. User dismisses → Stays dismissed (no health check for events)

### Regeneration Example

```
Initial state:
- Stripe not connected ✅
- Notification created
- read_at = NULL

User dismisses:
- read_at = NOW()
- Notification marked as READ

Next health check (Dashboard load):
- Checks: Is Stripe connected? NO
- Checks: Any UNREAD stripe_disconnected in last 5 min? NO
- Action: Create fresh notification ✅
- New notification has:
  - Different ID (new row)
  - Same title, message, icon
  - read_at = NULL (new notification is unread)

Result:
- User sees notification again
- Can dismiss again if wants
- Cycle repeats until Stripe is connected
```

---

## Part 5: Code Implementation - Where Everything Happens

### 1. Health Check Trigger

**File**: `backend/src/controllers/dashboardController.ts` (Line 27)

```typescript
// Every time user accesses dashboard:
checkAndNotifySystemHealth(companyId).catch((err) => {
  logError(LOG_MODULE, handler, 'System health check failed (non-blocking)', err);
});
```

**When it runs:**
- User loads dashboard
- User navigates to another page and back to dashboard
- Every dashboard refresh/reload

### 2. Health Check Logic

**File**: `backend/src/services/systemHealthService.ts` (Lines 13-55)

```typescript
export async function checkAndNotifySystemHealth(companyId: string): Promise<void> {
  // Check 1: Stripe Connected?
  if (!company.stripe_account_id) {
    await logStripeNotConnectedNotification(companyId);
  }

  // Check 2: Email Configured?
  const emailConfigured = company.smtp_host || company.mail_from_email;
  if (!emailConfigured) {
    await logEmailNotConfiguredNotification(companyId);
  }
}
```

### 3. Deduplication Before Creating Notification

**File**: `backend/src/utils/notificationLogger.ts` (Lines 191-217)

```typescript
export async function logStripeNotConnectedNotification(companyId: string) {
  // Step 1: Check if recent unread alert already exists
  const exists = await hasRecentUnreadSystemAlert(companyId, 'stripe_disconnected');
  if (exists) {
    return; // SKIP - recent notification already there
  }

  // Step 2: Create new notification
  await createNotificationEvent(
    companyId,
    'system_alert',
    '🔴 Stripe not connected',
    {
      message: '...',
      icon: '🔴',
      priority: 'critical',
      action_url: '/settings?tab=integrations',
      action_label: 'Connect Stripe',
      metadata: {
        event_type: 'stripe_disconnected',
      },
    }
  );
}
```

### 4. Deduplication Check

**File**: `backend/src/db/notificationEvents.ts` (Lines 191-210)

```typescript
export async function hasRecentUnreadSystemAlert(
  companyId: string,
  eventTypeInMetadata: string
): Promise<boolean> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM notification_events
     WHERE company_id = $1
     AND event_type = 'system_alert'
     AND read_at IS NULL                        // ← KEY: Only unread ones
     AND created_at >= NOW() - INTERVAL '5 minutes'
     AND metadata->>'event_type' = $2`,
    [companyId, eventTypeInMetadata]
  );

  return parseInt(result.rows[0]?.count) > 0;
}
```

### 5. Dismissal (Bell UI)

**File**: `frontend/src/components/layout/NotificationCenter.tsx` (Lines 82-90)

```typescript
const handleDismiss = async (notificationId: string) => {
  try {
    // API call to mark as read
    await api.post(`/api/notifications/${notificationId}/dismiss`);
    
    // Update local state (remove from list)
    setNotifications(notifications.filter(n => n.id !== notificationId));
    setUnreadCount(Math.max(0, unreadCount - 1));
  } catch (err) {
    console.error('Failed to dismiss notification:', err);
  }
};
```

**Backend handler**: `backend/src/controllers/notificationsController.ts` (Lines 135-161)

```typescript
export async function dismissHandler(req: Request, res: Response) {
  const notificationId = req.params.id;
  const companyId = req.companyId;

  // Update: Set read_at = NOW()
  const notification = await dismissNotification(notificationId, companyId);
  
  res.json({ data: { success: true } });
}
```

---

## Part 6: Notification Types Summary

| Aspect | System Alerts | Events |
|--------|---------------|--------|
| **Examples** | Stripe not connected, Email not configured | Payment received, Email bounced |
| **Represents** | Ongoing problems | Past events |
| **Deduplication** | Yes (prevent spam) | No (no trigger) |
| **Regeneration** | Yes (if problem persists) | No (event done) |
| **Dismiss behavior** | Can dismiss, reappears if problem continues | Dismiss = gone forever |
| **When created** | Health check on dashboard load | When event happens (webhook, cron) |
| **When recreated** | Next dashboard load if problem exists | Never |
| **User expectation** | "Remind me until it's fixed" | "Tell me what happened" |

---

## Part 7: Complete User Journey

### User Action Sequence

```
MONDAY 10:00 AM
├─ User logs in → Dashboard loads
├─ Health check: Stripe not connected ✓, Email not configured ✓
├─ Bell shows: 🔴 Stripe (2 notifications)
├─ 📧 Email not configured
└─ User sees 2 system alerts

MONDAY 10:15 AM
├─ User clicks X on Stripe notification → read_at = 10:15
├─ Bell still shows: 📧 Email (Stripe is dismissed)
└─ User has peace for a bit

MONDAY 2:00 PM
├─ User clicks on Activity → NO health check (Activity page)
├─ Dismissed Stripe notification stays gone
└─ Email notification still visible

MONDAY 3:00 PM
├─ User goes back to Dashboard → Health check runs
├─ Stripe: Still not connected (problem persists)
├─ hasRecentUnreadSystemAlert() checks:
│  - Any UNREAD stripe alerts in last 5 min? NO (dismissed at 10:15)
│  - Create fresh notification? YES ✓
├─ Bell shows: 🔴 Stripe + 📧 Email (both appear again)
└─ User realizes "Still need to fix these"

TUESDAY 9:00 AM
├─ User logs in → Dashboard loads → Health check
├─ Stripe: STILL not connected
├─ Email: STILL not configured
├─ Bell shows: Both alerts again (fresh notifications)
└─ Persistent reminder!

TUESDAY 11:00 AM
├─ User connects Stripe account
├─ Navigates to Dashboard
├─ Health check runs:
│  - Stripe: NOW connected ✓
│  - Email: Still not configured
│  - NO Stripe notification created ✅
├─ Bell shows: Only 📧 Email alert
└─ Stripe issue resolved, alert gone!

TUESDAY 3:00 PM
├─ User sets up custom SMTP for Email
├─ Dashboard load → Health check
├─ Stripe: Connected ✓
├─ Email: NOW configured ✓
├─ NO notifications created ✅
├─ Bell shows: No system alerts
└─ All clear!
```

---

## Part 8: Key Takeaways

### The Three Core Principles

1. **System Alerts are Persistent**
   - Recreate if problem persists
   - Dismiss button is a "Snooze", not a "Delete"
   - Problem must be FIXED, not just dismissed

2. **Events are One-Time**
   - Never recreate
   - Dismiss = gone forever
   - Problem already happened

3. **Deduplication Prevents Spam**
   - Only 5-minute check window
   - Only counts UNREAD notifications
   - Allows recreation after dismissal

### When Regeneration Happens

```
System Alert regeneration = On next Dashboard access, if:
  ✓ Problem still exists (Stripe not connected)
  ✓ AND previous notification is read/dismissed
  ✓ AND last 5 minutes haven't passed since creation

Event regeneration = Never (no problem to solve)
```

### Why This Is Better

| Old Way | New Way |
|---------|---------|
| 4+ duplicate messages ❌ | 1 clean message ✅ |
| User can't dismiss ❌ | User can dismiss to snooze ✅ |
| No problem tracking | Problem persists until fixed ✅ |
| Spam feels annoying ❌ | Reminders feel helpful ✅ |

---

## Summary

**Notification lifecycle for System Alerts:**

```
Created → User dismisses → Problem persists → 
→ Next dashboard load → Recreated → Cycle repeats →
→ Problem fixed → No longer created → Alert gone
```

**Notification lifecycle for Events:**

```
Event happens → Created → User dismisses →
→ Stays dismissed (event doesn't unhappen) →
→ User sees clean bell
```

This matches how **Stripe, GitHub, AWS, Slack** all handle notifications.