# RecoverAI - Quick Reference & Checklists

## 🎯 At-a-Glance Summary

**Product:** Autonomous agent that recovers unpaid invoices for SaaS companies ($2-5M ARR)
**Timeline:** 4 weeks (3.5 MVP + deployment)
**Tech Stack:** React + Node.js + PostgreSQL + Bull + Claude API
**Theme:** Dark (#060910) + Indigo brand (#6366f1)
**Launch:** Week 4 with 1-2 trial customers
**Target:** $10k MRR by Month 4, Series A ready by Month 6

---

## 📋 WEEK 1: Data Integrations + Database

### Day 1-2: Project Setup
- [ ] Backend: Node.js + TypeScript + Express initialized
- [ ] Frontend: React + TypeScript + Vite initialized
- [ ] Database: PostgreSQL running (Docker)
- [ ] Schema: schema.sql imported, tables created
- [ ] Config: .env files set up (secrets encrypted)
- [ ] Logging: Winston/Pino configured
- [ ] git init, first commit

**Status Check:** `npm start` → Backend on :3000, Frontend on :3001

### Day 3: Auth Layer
- [ ] User model (email, password_hash, org_id)
- [ ] POST /api/auth/signup (validate, hash, create user)
- [ ] POST /api/auth/login (verify password, return JWT)
- [ ] POST /api/auth/refresh (new token)
- [ ] AuthMiddleware (verify JWT on protected routes)
- [ ] Test with Postman/Thunder Client

**Status Check:** Can sign up, login, get token

### Day 4-5: Stripe Integration
- [ ] Get Stripe API key (test mode first)
- [ ] OAuth endpoint: /api/integrations/stripe/connect
- [ ] Stripe.invoices.list() implementation
- [ ] Map Stripe fields → DB schema
- [ ] Bull job: syncStripeInvoices (hourly)
- [ ] Test: Connect account → Invoices in DB ✅

**Status Check:** 50+ invoices in DB from Stripe

### Day 6: QB & Chargebee
- [ ] QB OAuth + API integration
- [ ] Query QB invoices endpoint
- [ ] Chargebee API + sync implementation
- [ ] CSV upload endpoint (parse, validate, insert)
- [ ] All three sources syncing to DB

**Status Check:** Data from 3 sources in DB

---

## 📋 WEEK 2: Risk Scoring + Email Agent

### Day 8-9: Risk Scoring
- [ ] Calculate days_overdue (0-30, 30-60, 60-90, 90+)
- [ ] Bucket amounts (<1k, 1-5k, 5-10k, 10k+)
- [ ] Query customer payment history (avg_days_late, on_time_rate)
- [ ] Risk formula:
  ```typescript
  base = days_overdue * 15 + amount_bucket * 10;
  adjust = on_time_rate > 80 ? -10 : +10;
  score = Math.min(100, base + adjust);
  ```
- [ ] Bull job: updateRiskScores (every 6h)
- [ ] Verify scores 0-100 on sample invoices

**Status Check:** All invoices have risk_score 0-100

### Day 10-11: Claude Email Generation
- [ ] Set up Anthropic API client
- [ ] Email prompts (Dunning 1-5) in /services/claudeService.ts
- [ ] Tone adjustment based on risk_score
- [ ] Generate Email 1: "Invoice due" (friendly)
- [ ] Generate Email 2: "Getting overdue" (slight pressure)
- [ ] Generate Email 3: "Payment plan" (helpful)
- [ ] Generate Email 4: "Formal notice" (urgent)
- [ ] Generate Email 5: "Escalation" (legal tone)
- [ ] Test: Generate 5 emails, review quality

**Status Check:** Emails sound natural, personalized, tone appropriate

### Day 12-13: Payment Plan Terms
- [ ] Claude prompt for payment plan generation
- [ ] Risk-adjusted splits:
  - Risk 0-30: 50/50
  - Risk 30-60: 30/70
  - Risk 60-90: 20/80
  - Risk 90+: 10/90
- [ ] Generate payment plan emails
- [ ] Test terms generation logic

**Status Check:** Terms generated correctly for different risk levels

### Day 14: Autonomous Agent
- [ ] Decision tree logic (no approval needed)
- [ ] sendEmail via SendGrid integration
- [ ] Bull job: runDunningAgent (every 6h)
- [ ] Log all actions to email_logs table
- [ ] Verify agent runs autonomously

**Status Check:** Agent runs, emails sent, no human approval required

---

## 📋 WEEK 3: Payment Tracking + Frontend Dashboard

### Day 15-16: Payment Webhooks
- [ ] /webhooks/stripe endpoint (verify signature)
- [ ] Handle charge.succeeded event
- [ ] Update invoice status = 'paid'
- [ ] Update customer.payment_history
- [ ] Re-score remaining invoices
- [ ] Sync back to QB (if API allows)

**Status Check:** Payment received → Invoice marked paid → DSO updated

### Day 17: Slack Integration
- [ ] Slack webhook URL configuration
- [ ] Daily digest job (8am):
  - "🎉 Recovered $X today"
  - "📈 This week: $Y"
  - "📊 DSO: Z days"
- [ ] Real-time alerts on payment

**Status Check:** Slack message received daily, payment alerts working

### Day 18-19: React Dashboard
- [ ] Layout (Sidebar + Header + Content)
- [ ] Dashboard page:
  - Stats: Total AR, Recovered, At-Risk, DSO
  - Charts: Recovery trend, Risk breakdown
  - Tables: Recent payments, top customers
- [ ] Invoices page:
  - Table with sorting/filtering
  - Color-coded risk badges
  - Pagination
- [ ] Invoice detail modal
- [ ] Settings page (integrations)
- [ ] Dark theme with Tailwind

**Status Check:** Dashboard loads, shows real data, looks polished

### Day 20: Auth + Security
- [ ] AuthContext (useAuth hook)
- [ ] ProtectedRoute component
- [ ] API client (axios + interceptors)
- [ ] JWT token storage + refresh
- [ ] HTTPS enforcement

**Status Check:** Can login → Dashboard accessible → Token refreshes

### Day 21: Testing + Polish
- [ ] End-to-end flow test (invoice → email → payment → dashboard update)
- [ ] Error handling (API failures, retries)
- [ ] Load testing (1000+ invoices)
- [ ] UI polish (responsive, animations)

**Status Check:** MVP works end-to-end, ready for customer

---

## 📋 WEEK 4: Deployment + Customer

### Day 22-23: Docker + Deploy
- [ ] Dockerfile (backend)
- [ ] Dockerfile (frontend)
- [ ] docker-compose.yml (local dev)
- [ ] Deploy backend (Railway/Render)
- [ ] Deploy frontend (Vercel)
- [ ] Environment variables (prod)
- [ ] SSL + domain setup
- [ ] Health check: /health endpoint working

**Status Check:** Live at productiondomain.com ✅

### Day 24-25: First Customer
- [ ] Email 50 SaaS founders (personalized)
- [ ] Book 2-3 demo calls
- [ ] Onboarding: Sign up → Connect Stripe → Invoices appear
- [ ] Trial customer #1 live

**Status Check:** 1-2 customers in trial, agent running

### Day 26-27: Support + Iterate
- [ ] Monitor agent behavior
- [ ] Collect customer feedback
- [ ] Iterate on email copy, payment terms
- [ ] Fix bugs
- [ ] Build confidence in product

**Status Check:** Trial customer happy, product working

### Day 28: Proof of Value
- [ ] Calculate recovery: "Customer X recovered $Y in Z days"
- [ ] Compare vs baseline
- [ ] Document case study
- [ ] Prepare for next sales push

**Status Check:** Proof of concept data ready for sales pitch

---

## 🗂️ FILE STRUCTURE AT-A-GLANCE

```
BACKEND (Node.js + TypeScript)
├── config/         (env, logger, db)
├── middleware/     (auth, errors, rate limit)
├── modules/        (organized by feature)
│   ├── auth/
│   ├── invoices/
│   ├── risk-scoring/
│   ├── email-agent/
│   ├── payments/
│   ├── integrations/ (Stripe, QB, Chargebee)
│   └── slack/
├── services/       (Claude, Stripe, SendGrid, etc.)
├── jobs/           (Bull queue jobs)
├── types/          (TypeScript interfaces)
└── app.ts, server.ts

FRONTEND (React + TypeScript)
├── components/     (Layout, Dashboard, UI)
├── pages/          (Login, Dashboard, Invoices, Reports, Settings)
├── contexts/       (Auth, Invoice state)
├── hooks/          (useAuth, useApi, etc.)
├── lib/            (API client, utilities)
├── config/         (constants, colors)
└── App.tsx, main.tsx
```

---

## 🎨 Color Scheme (Copy-Paste Ready)

```typescript
// tailwind.config.ts
colors: {
  brand: {
    50: '#eef2ff',
    500: '#6366f1',    // Primary
    600: '#4f46e5',    // Hover
  },
  surface: {
    DEFAULT: '#060910',
    card: '#0d1424',
    hover: '#111827',
    border: '#1a2035',
  },
  risk: {
    critical: '#ef4444',  // Red 90-100
    high: '#f97316',      // Orange 60-89
    medium: '#eab308',    // Yellow 30-59
    low: '#22c55e',       // Green 0-29
  },
}

// Usage in components:
// <div className="bg-surface-card border border-surface-border">
// <Badge className={risk_score > 80 ? 'bg-risk-critical' : '...'}>
```

---

## 📊 Key Metrics to Track

### MVP Success Metrics
- ✅ Server uptime > 99%
- ✅ API response time < 200ms (p95)
- ✅ Database queries < 100ms
- ✅ Dashboard loads in < 2s
- ✅ Emails sent: 100% delivery rate
- ✅ Agent runs: 0 errors / 100 jobs

### Customer Success Metrics
- Recovery rate: Target 60-70% (vs 20-30% baseline)
- DSO improvement: Target -10 days
- Email open rate: Target 35-45%
- Payment plan acceptance: Target 40-50%
- Customer ROI: Target 5:1 (recovered vs paid)

---

## 🔐 Security Checklist

- [ ] JWT with 1h expiry + 7d refresh token
- [ ] Encrypt sensitive data at rest (stripe_api_key, etc.)
- [ ] HTTPS only in production
- [ ] Rate limiting: 5 req/min (auth), 100 req/min (API)
- [ ] CORS: Only allow frontend domain
- [ ] SQL injection: Use parameterized queries
- [ ] XSS: React auto-escapes HTML
- [ ] CSRF: Validate origin headers
- [ ] Input validation: Email, amount, dates
- [ ] No API keys in git (.env in .gitignore)
- [ ] Error messages don't leak secrets
- [ ] Audit logs for sensitive operations

---

## 📦 Dependencies (Minimal MVP)

### Backend
```json
{
  "express": "^4.18",
  "axios": "^1.4",
  "pg": "^8.10",         // PostgreSQL client
  "redis": "^4.6",       // Redis client
  "bull": "^4.11",       // Job queue
  "jsonwebtoken": "^9.0", // JWT
  "bcryptjs": "^2.4",    // Password hashing
  "helmet": "^7.0",      // Security headers
  "cors": "^2.8",        // CORS
  "dotenv": "^16.0",     // Env vars
  "winston": "^3.8",     // Logging
  "@anthropic-ai/sdk": "^0.7", // Claude API
  "stripe": "^12.0",     // Stripe API
  "nodemailer": "^6.9"   // Email (fallback to SendGrid)
}
```

### Frontend
```json
{
  "react": "^18.2",
  "react-router-dom": "^6.11",
  "axios": "^1.4",
  "tailwindcss": "^3.3",
  "recharts": "^2.7",    // Charts
  "react-icons": "^4.8"  // Icons
}
```

---

## 🚀 Common Commands

```bash
# Backend
npm run dev              # Start dev server
npm run build           # Build TypeScript
npm start               # Start production
npm run migrate         # Run DB migrations
npm run queue:monitor   # View Bull queue dashboard

# Frontend
npm run dev             # Vite dev server
npm run build           # Build for production
npm run preview         # Preview production build
npm run lint            # ESLint

# Docker
docker-compose up -d    # Start services
docker-compose logs -f  # View logs
docker-compose down     # Stop services

# Database
psql -U postgres        # Connect to DB
\dt                     # List tables
SELECT * FROM invoices; # Query invoices
```

---

## 💬 Slack Integration Setup

1. Go to your Slack workspace → Settings → Apps & Integrations
2. Create Incoming Webhook
3. Copy webhook URL
4. Add to .env: `SLACK_WEBHOOK_URL=https://hooks.slack.com/...`
5. Test:
```bash
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Test message"}' \
  YOUR_WEBHOOK_URL
```

---

## 🔌 Stripe Setup

1. Get API key from https://dashboard.stripe.com/apikeys
2. Test key: `sk_test_...`
3. Live key: `sk_live_...` (after launch)
4. Add to .env: `STRIPE_API_KEY=sk_test_...`
5. Test OAuth redirect:
```
https://dashboard.stripe.com/...
Redirect URI: http://localhost:3000/api/integrations/stripe/callback
```

---

## 🧪 Testing Checklist

### Before Week 4 Deployment
- [ ] Unit tests: Services, utilities (>80% coverage)
- [ ] Integration tests: API endpoints (CRUD, auth)
- [ ] E2E test: Full flow (invoice → email → payment → dashboard)
- [ ] Load test: 1000+ invoices, multiple concurrent requests
- [ ] Security scan: OWASP Top 10
- [ ] Mobile responsive: Check on phone/tablet
- [ ] Dark theme: All components tested
- [ ] Error handling: Network failures, API errors, edge cases

### Manual Test Checklist
- [ ] Sign up → Create org → Connect Stripe
- [ ] Stripe sync → Invoices appear
- [ ] Risk scoring → Scores 0-100
- [ ] Agent trigger → Email sent → Log recorded
- [ ] Payment webhook → Invoice marked paid
- [ ] Dashboard → Stats updated real-time
- [ ] Settings → Disconnect/reconnect integration
- [ ] Slack → Daily digest received
- [ ] Mobile → Dashboard responsive
- [ ] Logout → Can't access protected routes

---

## 📈 First Customer Sales Script

```
Subject: You have $67,000 stuck in unpaid invoices

Hi [Name],

Question: Of your $3.2M ARR, how much is sitting in unpaid invoices?

For most SaaS founders, it's 40-50%. That's $1.3M-$1.6M at risk.

What if 60% could be recovered in 30 days?

We built an autonomous agent that:
✅ Detects unpaid invoices (Stripe, QB, Chargebee)
✅ Risk-scores each one
✅ Autonomously sends personalized emails
✅ Offers flexible payment terms
✅ Tracks everything in Slack

You only pay 1% of what we recover. So if we recover $67k,
you pay $670 + $2.5k base = $3.17k this month.

Worth a 10-min call?

[Book Call Button]
```

---

## 🎓 Key Concepts to Remember

1. **Risk Score (0-100):** Higher = more urgent to collect
2. **Autonomous:** Agent runs WITHOUT human approval
3. **Outcome-based:** You only profit if customer recovers money
4. **Multi-source:** Stripe, QB, Chargebee, CSV all feed one system
5. **Agent Decision Tree:** Automatic email selection based on days_overdue + risk
6. **Payment Plans:** Reduce payment friction via Stripe Billing
7. **Real-time:** Webhooks detect payments instantly
8. **Slack Notifications:** Founder sees $$ recovered daily
9. **Moat:** SaaS payment behavior data compounds over time

---

## ❓ FAQ During Development

**Q: Why no approval for emails?**
A: Founders don't have time. Emails are professional. Worst case: unsubscribe. Best case: $X recovered.

**Q: Why Claude API?**
A: Advanced reasoning to personalize emails + payment terms. Can't use static templates.

**Q: Why Bull Queue?**
A: Reliable, retry logic, observable, can schedule jobs. Better than cron.

**Q: Why PostgreSQL + Redis?**
A: Following AI_FINAL_MODEL pattern. Postgres for data, Redis for caching/queue.

**Q: How often does agent run?**
A: Every 6 hours. Frequent enough to catch opportunity, but not spam.

**Q: What if customer disagrees with email?**
A: Log feedback, adjust prompts. Future: "approval mode" toggle if needed.

**Q: How do we measure success?**
A: Recovery rate (% of AR collected) vs baseline (20-30% → target 60-70%)

---

## 📞 During Launch Week Reminders

✅ Have Slack channel open to monitor alerts
✅ Check email_logs table regularly (are emails being sent?)
✅ Monitor Stripe webhook logs (payments coming in?)
✅ Daily standup: "Did agent run? Did customers respond?"
✅ Customer feedback: "Is email copy good?"
✅ Iterate fast: Change prompt, redeploy (no downtime)
✅ Document everything: Case studies, metrics, learnings
✅ Celebrate wins: "We recovered $X! 🎉"

---

This quick reference should help you move fast during the 4-week build.
Print it out, check items off as you go, and celebrate each completed day! 🚀
