# 📱 SMS + 🔔 NOTIFICATION SETTINGS - COMPLETE ANALYSIS (2026-04-21)

## Part 1: SMS SETTINGS ANALYSIS

### Current Structure (What's There Now)

```
SMS SETTINGS TAB
├─ SMS Dunning (Phase 1-2) ✅
│  ├─ Enable/Disable toggle
│  ├─ Message Tone (friendly/professional/stern)
│  └─ Send SMS Timing (days overdue threshold)
│
├─ SMS Escalation Logic (Phase 3) ⏸
│  ├─ Enable escalation
│  ├─ Escalate after N emails (1-5)
│  └─ Max SMS per invoice (1-3)
│
├─ SMS Retry Configuration (Phase 3) ⏸
│  ├─ Enable retry
│  ├─ Retry after X hours
│  └─ Max retry attempts
│
├─ SMS Compliance (Phase 3) ⏸
│  ├─ TCPA Compliance (8am-9pm Eastern)
│  ├─ Weekend Blackout
│  └─ Require explicit opt-in
│
├─ SMS Opt-Outs Management (Phase 3) ⏸
│  └─ View opted-out customers
│     └─ Re-opt-in button per customer
│
└─ SMS Phone Number Configuration ⏸
   ├─ RecoverAI Number (default/shared)
   └─ Your Twilio Number (recommended)
      ├─ Account SID
      ├─ Auth Token
      └─ Phone Number
```

---

## Part 2: SMS SETTINGS ANALYSIS - WHAT'S USED vs USELESS

### ✅ PHASE 1-2 (BEING USED NOW)
| Field | Purpose | Used | Comments |
|-------|---------|------|----------|
| **SMS Enable/Disable** | Turn SMS on/off | ✅ USED | Core feature, wired in agentLoop |
| **Message Tone** | Control SMS personality | ✅ USED | Affects generated SMS messages |
| **SMS Timing** (days threshold) | When to send SMS (after N days overdue) | ✅ USED | Controls escalation timing in agent |

**Status**: Phase 1-2 is **ESSENTIAL** - all 3 fields drive core dunning pipeline

---

### ⏸ PHASE 3 (PLANNED, NOT USED YET)
| Field | Purpose | Status | When Needed |
|-------|---------|--------|------------|
| **Escalation After Emails** | SMS after N emails | ⏸ DEFERRED | Phase 2 MVP (for MVP, SMS always after 2 emails) |
| **Max SMS Per Invoice** | Limit SMS frequency | ⏸ DEFERRED | Phase 2 (hardcoded now) |
| **TCPA Compliance** | 8am-9pm window | ⏸ DEFERRED | Phase 2 (legal requirement) |
| **Weekend Blackout** | Skip weekends | ⏸ DEFERRED | Phase 2 (nice-to-have) |
| **Require Opt-In** | TCPA consent model | ⏸ DEFERRED | Phase 2 (compliance) |
| **Opt-Out Management** | STOP handling | ⏸ DEFERRED | Phase 2 (when SMS goes live) |
| **Twilio Config** | Custom SMS sender | ⏸ DEFERRED | Phase 2 (deliverability) |

**Verdict**: Phase 3 is **FUTURE** - don't show these yet for Phase 1

---

### What Should Be in Phase 1 SMS Settings

For **SINGLE PIPELINE** (Email → SMS → Voice), user should only see:

```
🔲 SMS Dunning (Main Card)
   [Enable/Disable] ← Master switch
   Message Tone: [Dropdown]
   Send after: [N] days overdue
   
[Save] button

📝 Info Box:
"SMS starts AFTER 2 email attempts. 
Message tone matches your email tone.
Customers who reply STOP are automatically opted out."
```

**Why this design?**
- **User focus**: Only controls what matters for Phase 1
- **Clear flow**: Email → SMS escalation is automatic (not user-configurable yet)
- **Reduces cognitive load**: No Phase 3 features confusing the user
- **Matches code**: Escalation logic is hardcoded in agentLoop.ts (not settings-driven yet)

---

## Part 3: NOTIFICATION SETTINGS ANALYSIS

### Current Structure (What's There Now)

```
NOTIFICATION PREFERENCES
├─ System Alerts (Always On)
│  └─ Cannot disable
│
├─ Daily Actions
│  ├─ Enable/Disable
│  └─ If enabled:
│     ├─ Send email daily at: [Time]
│
├─ Agent Activity
│  ├─ Enable/Disable
│  └─ If enabled:
│     ├─ Email when agent sends dunning
│     └─ Email when payment received
│
├─ Weekly & Monthly Insights
│  ├─ Enable/Disable
│  └─ If enabled:
│     ├─ Weekly summary every [Day] at [Time]
│     └─ Monthly deep-dive report (1st Monday)
│
├─ Quiet Hours
│  ├─ Enable/Disable
│  └─ If enabled:
│     ├─ Don't email between [Time] and [Time]
│
└─ Test Notification Button (Bottom)
```

---

## Part 4: NOTIFICATION SETTINGS - WHAT'S USEFUL vs WHAT'S NOT

### Current Issues

| Feature | Used | Problem |
|---------|------|---------|
| **System Alerts** | ✅ YES | Always on (correct) |
| **Daily Actions** | ⚠️ PARTIAL | Email timing works, but feature is Phase 2 |
| **Agent Activity** | ❌ NO | Not wired (email events not implemented) |
| **Weekly/Monthly** | ❌ NO | Cron jobs exist but no digest emails implemented |
| **Quiet Hours** | ❌ NO | Not enforced in email sending |
| **Test Button** | ✅ YES | Works, good for validation |

**Verdict**: Only **System Alerts** + **Test Button** are really working. Rest are Phase 2-3 placeholders.

---

## Part 5: HOW OTHER WEBSITES DO NOTIFICATION SETTINGS

### Stripe (Webhook Management)

```
Stripe Settings > Webhooks

✓ Notifications Page shows:
  ├─ Event Types to subscribe to
  │  ├─ ☑ Payment succeeded
  │  ├─ ☑ Payment failed
  │  ├─ ☑ Customer created
  │  └─ [Toggle each]
  │
  └─ Webhook Endpoints
     ├─ URL to receive events
     ├─ API version
     └─ Events (list of subscriptions)

Design principle: 
- Event-focused (what happened?)
- Endpoint-focused (where to send?)
- Simple toggles (on/off, no complexity)
- No digest/timing logic (events fire immediately)
```

### GitHub (Notification Preferences)

```
GitHub Settings > Notifications

Two types of settings:
1. DEFAULT NOTIFICATION SETTINGS
   ├─ Watching (all events) / Not watching / Ignoring
   ├─ Automatically watching new repos
   └─ Job titles to filter by
   
2. EMAIL NOTIFICATION PREFERENCES
   ├─ ☑ Email for notifications I participate in
   ├─ ☑ Email for pushes to my repos
   ├─ ☑ Email for mentions
   └─ ☑ Email for team mentions

Design principle:
- Separate "What to notify" from "How to deliver"
- Global defaults + per-item overrides
- Email is ONE channel among many (web is default)
- No scheduling (everything immediate)
```

### Slack (Most Sophisticated)

```
Slack Settings > Notifications

Covers BOTH notification behavior AND digest timing:

1. NOTIFICATION BEHAVIOR
   ├─ When you're mentioned
   ├─ When @channel/@here is used
   ├─ All new messages
   └─ Nothing

2. NOTIFICATION DELIVERY
   ├─ Send notifications: Always / During work hours / Never
   ├─ Desktop alerts: On / Off
   ├─ Sound: On / Off
   ├─ Email digest: Never / Daily / Weekly
   └─ Quiet hours:
      ├─ From [Time] to [Time]
      └─ On [Days]

3. PER-CHANNEL OVERRIDES
   └─ Override default behavior for specific channels

Design principle:
- USER DECIDES EVERYTHING
- Granular control (when, how, what channel)
- Respects users' attention management
- Balances immediate + digest delivery
```

### AWS (Minimal, Task-Focused)

```
AWS > SNS > Subscriptions

- Only shows delivery method (Email / SMS / Webhook / Lambda)
- Single subscription per topic
- No fancy options
- Focus: "Get alerts to the right place"

Design principle:
- Ops-focused (not feature-focused)
- Delivery > Behavior
- Simple toggles only
```

---

## Part 6: WHAT NOTIFICATION SETTINGS SHOULD BE FOR THIS APP

### Phase 1 (NOW)

**WRONG**: Current Notifications Section has Phase 2-3 features that don't exist

**RIGHT**: Notification settings should ONLY show:

```
🔔 NOTIFICATION PREFERENCES

✓ System Alerts (Always On - Cannot disable)
  └─ Stripe not connected
  └─ Email not configured
  └─ Agent paused
  └─ Trial ending

🔌 DELIVERY METHOD
  ├─ ☑ Bell Icon (always on)
  └─ Quiet Hours:
     ├─ Disable notifications between [Time] and [Time]
     └─ Only for digest emails (if any)

🧪 TEST NOTIFICATION
  └─ [Send Test] button

[Save] button
```

**Why this design for Phase 1?**
1. **System alerts are non-negotiable** - always show them
2. **Bell is primary delivery** - no email digests yet
3. **Quiet hours for future email** - prepare for Phase 2
4. **Test button validates** - user can verify system works
5. **Everything else is Phase 2** - don't clutter UI

---

### Phase 2 (Future)

When daily_actions, weekly_digest, etc. are actually working:

```
🔔 NOTIFICATION PREFERENCES

SYSTEM ALERTS (Always On)
├─ Stripe not connected ✓
├─ Email not configured ✓
├─ Agent paused ✓
└─ Trial ending ✓

TRANSACTION EVENTS
├─ ☑ Payment received
├─ ☑ Email bounced
└─ ☑ SMS failed

DAILY SUMMARIES (Optional)
├─ ☑ Daily recommended actions
│  └─ Time: [HH:MM]
│  └─ Delivery: [Bell / Email / Both]
│
├─ ☑ Agent activity log
│  └─ Time: [HH:MM]
│  └─ Delivery: [Bell / Email / Both]

WEEKLY/MONTHLY REPORTS (Optional)
├─ ☑ Weekly insights (DSO, metrics)
│  └─ Day: [Monday-Friday]
│  └─ Time: [HH:MM]
│  └─ Delivery: [Email only - digest format]
│
└─ ☑ Monthly deep-dive
   └─ Day: [1-28]
   └─ Time: [HH:MM]
   └─ Delivery: [Email only - digest format]

QUIET HOURS
├─ ☑ Enable quiet hours
└─ From [Time] to [Time]
   └─ Applies to: [All / Emails only]

DELIVERY CHANNELS
├─ ☑ Bell icon
├─ ☑ Email
└─ ☑ SMS (when SMS module is ready)

[Save] button
```

---

## Part 7: STRUCTURE DECISION FOR PHASE 1

### What to SHOW Right Now

**Keep ONLY:**
- System Alerts section (with "Always On" badge)
- Quiet Hours (for future email features)
- Test Notification button

**Remove UNTIL Phase 2:**
- Daily Actions
- Agent Activity
- Weekly & Monthly

**Rationale:**
- User isn't confused by features that don't work
- Settings page feels clean and focused
- Easy to add back when Phase 2 lands

---

## Part 8: PATTERN COMPARISON - SMS vs NOTIFICATION SETTINGS

### How They Should Differ

| Aspect | SMS Settings | Notification Settings |
|--------|--------------|----------------------|
| **Scope** | HOW a channel behaves | WHAT to notify about + WHEN |
| **Example** | Tone, timing, escalation | System alerts, digest schedule |
| **User Focus** | "How do I tune SMS?" | "How do I get informed?" |
| **Complexity** | Medium (dunning rules) | Low (just preferences) |
| **Phase 1** | 3 simple fields | 2 sections (alerts + quiet hours) |
| **Phase 2** | Add escalation rules | Add daily/weekly digests |
| **Phase 3** | Add compliance | Add per-event toggling |

### Common Elements

| Both Should Have | Why |
|-----------------|-----|
| **Clear toggles** | Users want on/off control |
| **Test button** | Verify settings work |
| **Time pickers** | Control when notifications arrive |
| **Info boxes** | Explain what each setting does |
| **Save button** | Persist preferences |

---

## Part 9: FINAL RECOMMENDATIONS

### FOR SMS SETTINGS (Do This Now)

```
✅ KEEP:
- SMS Dunning card (enable/tone/timing)
- Info box explaining dunning flow
- Example messages showing tones
- Save button

❌ REMOVE:
- Escalation Logic section (Phase 2)
- Retry Configuration section (Phase 2)
- Compliance section (Phase 2)
- Opt-outs section (Phase 2)
- Twilio config section (Phase 2)

Reason: Phase 1 user only cares about: 
"Turn SMS on/off, pick tone, set when to start."
```

### FOR NOTIFICATION SETTINGS (Do This Now)

```
✅ KEEP:
- System Alerts (always on badge)
- Quiet Hours toggle
- Test Notification button
- Save button

❌ REMOVE:
- Daily Actions email timing
- Agent Activity checkboxes
- Weekly Digest section
- Monthly Report section

REPLACE WITH:
"🔔 System Alerts (Always On)
 Your critical alerts always show in the bell.
 Coming soon: Opt into daily summaries & digests."

Reason: Phase 1 user only gets system alerts.
Don't show digest settings until they exist.
```

---

## Part 10: SINGLE PIPELINE - HOW IT FLOWS

### Understanding "Email → SMS → Voice"

```
ONE RECOVERY JOURNEY
│
├─ Channel 1: EMAIL
│  ├─ Email #1 (Day 0)
│  ├─ Email #2 (Day 3 or 7)
│  └─ Email bounce?
│
├─ Channel 2: SMS (after emails fail)
│  ├─ SMS #1 (Day 7 or configured day)
│  ├─ SMS #2 (after X days)
│  └─ SMS bounce/STOP?
│
└─ Channel 3: VOICE (Phase 3)
   ├─ Phone call (last resort)
   └─ Human intervention

SETTINGS CONTROL EACH STEP:
- Email Settings: tone, template, timing
- SMS Settings: tone, escalation timing, retry
- Notification Settings: user gets alerted when what happens

KEY: It's ONE pipeline, not three separate things
```

---

## Summary Table

| Settings Tab | Phase 1 Status | What to Show | What to Hide |
|--------------|---|---|---|
| **Email** | ✅ Active | Sender, tone, custom SMTP | None (all Phase 1) |
| **SMS** | ⏸ Partial | Enable, tone, timing | Escalation, compliance, Twilio |
| **Notifications** | ⏸ Partial | System alerts, quiet hours, test | Daily, weekly, monthly features |
| **General** | ✅ Active | All existing settings | None |

---

## Implementation Checklist for Phase 1

- [ ] **SMS Settings**: Hide Phase 3 sections (escalation, compliance, Twilio, opt-outs)
- [ ] **SMS Settings**: Show only: Enable toggle, Tone selector, Timing slider
- [ ] **Notification Settings**: Hide Phase 2+ sections (daily actions, weekly, monthly)
- [ ] **Notification Settings**: Show only: System alerts badge, Quiet hours, Test button
- [ ] **Both**: Add clear info boxes explaining what's Phase 1 vs Phase 2
- [ ] **Both**: Add "Coming soon" callouts for deferred features

---

This approach keeps Phase 1 **clean, focused, and non-overwhelming** while leaving room for Phase 2+ to add complexity.