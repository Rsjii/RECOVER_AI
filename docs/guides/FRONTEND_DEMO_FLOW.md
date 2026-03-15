# 🎬 RecoverAI Frontend - Demo Data Flow for Clients

**Date:** March 7, 2026
**Status:** ✅ Complete & Production Ready

---

## 📱 FULL DEMO JOURNEY (Step-by-Step for Clients)

### STEP 1: Landing Page
```
URL: http://localhost:5173
```

**What client sees:**
- Beautiful hero section: "Stop chasing invoices. Let AI recover them."
- Two buttons:
  - **"Start 14-day free trial"** (for sign up)
  - **"Try live demo"** ← Client clicks this
- Stats section showing: 68% recovery rate, <1 day to first recovery
- How it works section (3-column feature breakdown)

**Client action:** Clicks "Try live demo" button

---

### STEP 2: Backend Auto-Creates Demo Data (< 1 second)
```
Endpoint: POST /api/demo/login
```

**What happens behind scenes:**
1. Frontend calls `/api/demo/login` endpoint
2. Backend creates:
   - 1 Demo company: "Acme SaaS (Demo)"
   - 1 Demo user: `demo@recoverai.com` / `Demo1234!`
   - 8 Realistic customers with payment histories
   - 24 Invoices across 4 statuses
   - Complete email logs with engagement
   - Payment records

3. Frontend:
   - Sets auth cookie
   - Refreshes auth context
   - Navigates to `/dashboard`

**Client sees:** Brief loading spinner with "Loading demo..."

---

### STEP 3: Dashboard Landing (THE MAIN ATTRACTION)
```
URL: http://localhost:5173/dashboard
Status: Authenticated ✅
Data: All demo data loaded
```

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  RecoverAI Dashboard                     [Acme SaaS]     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  📊 KEY METRICS (4 Cards at top)                        │
│  ├─ Owed: $485,500                                      │
│  ├─ Recovered: $245,000                                 │
│  ├─ Recovery Rate: 50%                                  │
│  └─ Overdue Count: 8 invoices                           │
│                                                           │
│  📈 CHARTS (Middle section)                            │
│  ├─ Recovery Timeline (line chart over time)            │
│  ├─ Pipeline Breakdown (pie chart: Paid/Arranged/etc)   │
│  └─ Risk Distribution                                   │
│                                                           │
│  👥 TOP RISKY CUSTOMERS (Table at bottom)              │
│  ├─ Nina Patel (DevTools) - 30% on-time, HIGH RISK    │
│  ├─ David Park (SaaS) - 40% on-time, HIGH RISK        │
│  ├─ Jason Torres (Cloud) - 55% on-time, MEDIUM RISK   │
│  └─ [+ 5 more...]                                       │
│                                                           │
│  🎯 ACTION BUTTONS                                      │
│  ├─ Trigger Agent (run collection loop)                │
│  └─ Export Report                                       │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 INTERACTIVE EXPLORATION (Client Demo Script)

### Interaction 1: View Customer Risk Scoring
**Client says:** "Tell me about customer risk..."

**Demo steps:**
1. Click on "Nina Patel" in Top Risky Customers table
2. Navigate to: `/customers/[customer-id]`
3. Shows full customer detail page:

```
┌────────────────────────────────────────┐
│ Nina Patel - DevTools                  │
├────────────────────────────────────────┤
│                                        │
│ Risk Score: 75/100 (HIGH RISK)        │
│ On-Time Rate: 30% (Critical)          │
│ Total Outstanding: $18,000            │
│ Days Overdue (avg): 55 days           │
│                                        │
│ Payment History:                       │
│ ├─ 6/20 invoices paid on time        │
│ ├─ 14/20 invoices late               │
│ ├─ Average days late: 32 days         │
│                                        │
│ Recent Invoices:                       │
│ ├─ INV-008: $12,500 - 65 days UNPAID │
│ ├─ INV-007: $5,500 - 45 days UNPAID  │
│ └─ INV-006: $8,000 - PAID (was late) │
│                                        │
│ Recommended Actions:                   │
│ ├─ ⚠️ Send urgent dunning email      │
│ ├─ 🔴 Escalate after dunning_3      │
│ └─ 💬 Offer payment plan             │
│                                        │
└────────────────────────────────────────┘
```

**Client insight:** "Oh, I see exactly which customers are problematic and why."

---

### Interaction 2: View Invoice & Email Preview
**Client says:** "How does the email automation work?"

**Demo steps:**
1. Go to: `/invoices`
2. Click on unpaid invoice: "INV-008" ($12,500 from Nina Patel, 65 days overdue)
3. Click "Preview Next Email" button
4. Modal opens showing:

```
┌─────────────────────────────────────────────────────────┐
│ Email Preview - INV-008                                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Stage: Dunning 2 (Firm Reminder)                       │
│ Sent: March 5, 2026                                     │
│ Opens: 1 (opened at 2:34 PM)                           │
│ Clicks: 0                                               │
│                                                          │
│ ─────────────────────────────────────────────────────   │
│                                                          │
│ From: accounting@recoverai.com                         │
│ To: nina@devfirst.io                                   │
│                                                          │
│ Subject:                                               │
│ "Invoice #INV-008: Payment Required - $12,500"       │
│                                                          │
│ Body (AI-Generated):                                   │
│ ───────────────────────────────────────────────────    │
│                                                          │
│ Hi Nina,                                               │
│                                                          │
│ We noticed that invoice INV-008 for $12,500 is now   │
│ 65 days overdue. While we appreciate your business,   │
│ we need to resolve this payment urgently.             │
│                                                          │
│ Invoice Details:                                       │
│ • Amount: $12,500                                      │
│ • Due Date: Dec 12, 2025                              │
│ • Days Overdue: 65                                     │
│                                                          │
│ We understand cash flow can be challenging. We're     │
│ happy to discuss a payment plan that works for you.   │
│                                                          │
│ [Pay Now] [View Invoice] [Request Payment Plan]       │
│                                                          │
│ Best regards,                                          │
│ RecoverAI Team                                         │
│                                                          │
│ ─────────────────────────────────────────────────────   │
│                                                          │
│ [Preview 1] [Preview 2] [Preview 3] [Preview 4]       │
│ [Preview 5] [ Send Now ]                              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Client sees all 5 email stages:**
- **Dunning 1:** Friendly reminder (Day +7)
- **Dunning 2:** Firm reminder (Day +14)
- **Dunning 3:** Escalation (Day +30)
- **Dunning 4:** Urgent action (Day +45)
- **Dunning 5:** Final notice (Day +60)

**Client insight:** "These are real AI-written emails, not templates! And I can see exactly who opened them."

---

### Interaction 3: View Payment Plans
**Client says:** "Can we offer payment plans?"

**Demo steps:**
1. From invoice detail, click "Create Payment Plan"
2. Modal shows:

```
┌─────────────────────────────────────────────────────────┐
│ Create Payment Plan - INV-008                           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Invoice: INV-008                                        │
│ Amount: $12,500                                         │
│ Customer: Nina Patel (High Risk)                        │
│                                                          │
│ AI Recommendation:                                      │
│ "Given Nina's payment history (30% on-time),          │
│  recommend 6 installments over 6 months to             │
│  reduce default risk."                                 │
│                                                          │
│ Payment Plan Options:                                   │
│ ├─ 3 installments: $4,167 each (recommended: Medium)  │
│ ├─ 4 installments: $3,125 each (recommended: High)    │
│ ├─ 6 installments: $2,083 each (recommended: Very High)│
│ └─ Custom: [input] installments                       │
│                                                          │
│ Payment Schedule (if 4 installments):                  │
│ ├─ Installment 1: $3,125 - Due April 7, 2026         │
│ ├─ Installment 2: $3,125 - Due May 7, 2026           │
│ ├─ Installment 3: $3,125 - Due June 7, 2026          │
│ └─ Installment 4: $3,125 - Due July 7, 2026          │
│                                                          │
│ [ Create Payment Plan ] [ Cancel ]                     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Demo shows existing payment plan:**
- 4 Arranged invoices already have payment plans
- Shows first payment already collected
- Timeline shows next installments due

**Client insight:** "AI is adjusting payment terms based on risk. Higher risk = longer terms = better recovery."

---

### Interaction 4: View Invoice List & Statuses
**Client says:** "Show me all invoices..."

**Demo steps:**
1. Go to: `/invoices`
2. Shows list with filtering:

```
┌─────────────────────────────────────────────────────────┐
│ Invoices (24 total)                    [Filter ▼]       │
├─────────────────────────────────────────────────────────┤
│ Status: [All ▼] [Paid ▼] [Arranged ▼] [Unpaid ▼]       │
│ Sort: [Due Date ▼] [Amount ▼]                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ PAID (8 invoices - $45,200) ✅                         │
│ ├─ INV-001 | Sarah Chen      | $5,200  | Mar 1 | PAID │
│ ├─ INV-002 | Ryan Lee        | $8,900  | Feb 28| PAID │
│ ├─ INV-003 | Priya Mehta     | $4,600  | Mar 2 | PAID │
│ └─ [5 more...]                                         │
│                                                          │
│ ARRANGED (4 invoices - payment plans active) 📊        │
│ ├─ INV-012 | Nina Patel      | $22,000 | 3 installments
│ ├─ INV-013 | David Park      | $18,500 | 3 installments
│ └─ [2 more...]                                         │
│                                                          │
│ UNPAID (8 invoices - $120,300) ⚠️                      │
│ ├─ INV-008 | Nina Patel      | $12,500 | 65 days late │
│ ├─ INV-009 | David Park      | $18,000 | 42 days late │
│ └─ [6 more...]                                         │
│                                                          │
│ FRESH (4 invoices - just created) 🆕                   │
│ ├─ INV-020 | Sarah Chen      | $6,100  | Due Mar 10   │
│ └─ [3 more...]                                         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Demo data breakdown:**
- **Total Owed:** $485,500
- **Recovered:** $245,000 (via payments + plans)
- **Recovery Rate:** 50%
- **At Risk:** 8 unpaid + 4 on payment plans

**Client insight:** "I can see exactly what's happening with every invoice at a glance."

---

### Interaction 5: View Email Engagement
**Client says:** "What about email performance?"

**Demo steps:**
1. Go to: `/reports` or click "Email Performance"
2. Shows email campaign metrics:

```
┌─────────────────────────────────────────────────────────┐
│ Email Campaign Performance                              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Campaign Summary:                                       │
│ ├─ Total Emails Sent: 24                               │
│ ├─ Delivered: 24 (100%)                                │
│ ├─ Opened: 16 (67%)                                    │
│ ├─ Clicked: 11 (46%)                                   │
│ └─ Bounced: 0 (0%)                                     │
│                                                          │
│ By Stage:                                              │
│ ├─ Dunning 1 (Friendly): 8 sent, 6 opened (75%)      │
│ ├─ Dunning 2 (Firm): 8 sent, 5 opened (63%)          │
│ ├─ Dunning 3 (Urgent): 4 sent, 3 opened (75%)        │
│ ├─ Dunning 4 (Escalation): 2 sent, 2 opened (100%)   │
│ └─ Dunning 5 (Final): 2 sent, 0 opened (0%)          │
│                                                          │
│ Timeline:                                              │
│ ├─ Day +7: Dunning 1 sent (high open rate)           │
│ ├─ Day +14: Dunning 2 sent (medium open rate)        │
│ ├─ Day +30: Dunning 3 sent (continued engagement)    │
│ ├─ Day +45: Dunning 4 sent (more engaged)            │
│ └─ Day +60: Dunning 5 sent (lower engagement)        │
│                                                          │
│ [ Export Report ] [ Refresh ]                          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Demo email logs show:**
- Who opened emails (timestamps)
- Who clicked buttons
- Which stage caused conversions
- Drop-off patterns

**Client insight:** "We can see what's working and adjust strategy based on real engagement data."

---

## 🖥️ RESPONSIVE DESIGN (Mobile Demo)

**Client asks:** "Does this work on iPad/mobile?"

**Demo shows:**
- Open on phone/tablet
- Dashboard cards stack vertically
- Charts are responsive
- Buttons are touch-friendly
- Navigation collapses to hamburger menu
- All data visible and usable

**Client insight:** "My sales reps can check collections on their phones!"

---

## 🌙 DARK MODE (Optional Demo)

**Client asks:** "Do you have dark mode?"

**Demo steps:**
1. Toggle button in header
2. Entire UI switches to dark theme
3. All colors remain readable
4. Charts work in dark mode

**Client insight:** "Professional look, works for late-night work."

---

## 🔌 SETTINGS PAGE (Optional Deep Dive)

**URL:** `/settings`

**Shows:**
```
┌─────────────────────────────────────────────────────────┐
│ Settings - Acme SaaS (Demo)                             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ 📊 Dunning Strategy                                     │
│ ├─ Day +7: Send dunning_1 (Friendly)                  │
│ ├─ Day +14: Send dunning_2 (Firm)                     │
│ ├─ Day +30: Send dunning_3 (Urgent)                   │
│ ├─ Day +45: Send dunning_4 (Escalation)               │
│ └─ Day +60: Send dunning_5 (Final)                    │
│ [Can be customized]                                    │
│                                                          │
│ 🕐 Timezone & Currency                                │
│ ├─ Timezone: UTC                                       │
│ ├─ Currency: USD                                       │
│ [Can be changed per company]                           │
│                                                          │
│ 💬 Slack Integration                                   │
│ ├─ Webhook: [encrypted-webhook-url]                   │
│ ├─ Daily Digest: 8 AM UTC                             │
│ ├─ Payment Alerts: Real-time                          │
│ [Can connect their Slack]                             │
│                                                          │
│ 📈 Integrations                                        │
│ ├─ ✅ Stripe: Connected                               │
│ ├─ ✅ SendGrid: Connected                             │
│ ├─ ✅ Anthropic: Connected                            │
│ └─ 🔴 Chargebee: Not connected                        │
│                                                          │
│ [ Save Changes ]                                       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Client insight:** "We can customize exactly how the system works for our needs."

---

## 📊 COMPLETE DEMO SCRIPT (5-10 Minutes)

### Timeline

| Time | Action | What Client Sees |
|------|--------|------------------|
| 0:00 | Click "Try Demo" | Loading spinner |
| 0:05 | Dashboard loads | 4 metric cards + charts + customer list |
| 1:00 | Click customer "Nina Patel" | Full risk score + payment history |
| 2:00 | Go back to invoices | Invoice list with all statuses |
| 3:00 | Click unpaid invoice | Invoice detail |
| 3:30 | Click "Preview Email" | All 5 email stages visible + engagement data |
| 5:00 | Show payment plan | AI recommendation + installment schedule |
| 6:00 | Show email metrics | 67% open rate, 46% click rate |
| 7:00 | Toggle dark mode | UI switches to dark theme |
| 8:00 | Show settings page | Configuration options for dunning strategy |
| 9:00 | "Any questions?" | Ready to connect their Stripe account |

---

## 🎯 KEY SELLING POINTS (What Client Experiences)

1. **Instant Data** ✅
   - No setup needed, demo data loads in 1 second
   - Immediately see real-looking AR data

2. **Beautiful UI** ✅
   - Professional dashboard
   - Mobile responsive
   - Dark mode included

3. **AI Intelligence** ✅
   - Risk scores that make sense
   - Personalized emails (not templates)
   - Smart payment plan recommendations

4. **Real Metrics** ✅
   - 50% recovery rate (demo data)
   - 67% email open rate
   - 46% click rate
   - Complete payment history

5. **Automation** ✅
   - 5-stage dunning sequence
   - No manual work needed
   - Intelligent escalation

6. **Integration Ready** ✅
   - Stripe already set up
   - Settings page shows integration options
   - Can connect with real account immediately

---

## 🚀 NEXT STEPS (After Demo)

**Client says:** "This looks great. How do we get started?"

**Response:**
1. **"Let's connect your Stripe account"** (15 minutes)
   - OAuth flow
   - Auto-imports all open invoices
   - Immediately starts processing

2. **"Configure your dunning strategy"** (5 minutes)
   - Customize email timing
   - Set Slack notifications
   - Adjust payment plan terms

3. **"Go live"** (same day)
   - System starts sending emails
   - Tracks engagement
   - Offers payment plans
   - Records all payments

---

## ✅ SUMMARY

**What frontend shows:**
- Landing page with "Try Demo" button
- Authenticated dashboard with real-looking demo data
- 8 customer profiles with risk scores
- 24 invoices in various states
- AI-generated emails (5 stages)
- Payment plans with AI recommendations
- Email engagement metrics
- Mobile responsive design
- Dark mode support
- Settings customization

**Demo time:** 30 seconds to see initial dashboard, 5-10 minutes for full demo

**No sign-up needed:** One button click and everything is ready

**Production ready:** Can scale from demo to real data by connecting Stripe account

---

**RecoverAI Frontend** — Beautiful UI + Real Data = Instant "WOW!" from clients 🎉
