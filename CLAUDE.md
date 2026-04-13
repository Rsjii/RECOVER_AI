# RecoverAI — Claude Instructions

## 🚨 CRITICAL INTERACTION RULES (READ FIRST)

### Mode Switching Rule
**NEVER switch to plan mode, worktree mode, or any special execution mode without EXPLICIT USER PERMISSION.**
- ❌ Do NOT use EnterPlanMode, EnterWorktree, or similar without asking first
- ✅ Default: Assume user wants immediate action, not planning discussions
- ✅ Always ask: "Should I switch to plan mode?" before entering special modes
- User values speed and directness — mode switches are disruptive

---

## AUTO-MEMORY RULE (MANDATORY)

After EVERY code change in this project, update the relevant memory file:
- **Path**: `C:\Users\rsji1\.claude\projects\c--dev-AGENTIC-AR\memory\`
- **MEMORY.md** — update status, critical bugs list, or route list if changed
- **gaps_plan.md** — mark fixed items as ✅, add new gaps discovered
- Use Edit tool (not Write) to update existing entries — never duplicate

### What to save after each change:
1. Which file was changed and why
2. New status of the feature (fixed/partial/broken)
3. Any new bugs discovered during the change
4. Updated build/test status if relevant

### Format for marking fixes:
```
### Fix 1: StripeCallback Page ✅ DONE (2026-03-09)
Files changed: frontend/src/pages/StripeCallback.tsx (NEW), frontend/src/App.tsx (+route)
```

---

## Project: RecoverAI

**What it is**: Autonomous Finance/Operations Agent that replaces human revenue operations staff. Starts by autonomously recovering AR, then expands to AP, cash, contracts, forecasting. Decision-making without human approval. One autonomous entity, not a feature bundle.

**Vision (2026-2036)**:
- Year 1: Service agencies (AR agent) → $1M ARR
- Year 2: AR + AP expansion → $5M ARR  
- Year 3: Mid-market enters, agent scope expands (Cash, Forecasting) → $15M ARR
- Year 4-5: Enterprise tier, full autonomous ops agent → $40M+ ARR
- Year 5-10: Path to $100M-$1B+ ARR

**ICP Priority**:
1. **Phase 1 (NOW)**: Service agencies ($500K-$5M ARR) — clear labor replacement, 70% expansion rate
2. **Phase 2 (Year 2)**: Mid-market SaaS/professional services ($5M-$50M) — larger budgets, complex ops
3. **Phase 3 (Year 3+)**: Enterprise ($50M+) — full autonomous ops stack replacement

**Pricing Model** (Expansion Revenue):
- Service agencies: $2,500-$5,000/month Year 1 (AR only)
- Same customer: +$1,500-$3,000/month Year 2 (AP addition)
- Same customer: +$1,000-$2,000/month Year 3 (Cash/Forecasting)
- LTV per service agency customer: $100K-$200K (3-year)
- Expansion revenue: 60-70% of existing customers upgrade each year

**Repo root**: `c:\dev\AGENTIC_AR\`
- `backend/` — Node.js + Express + TypeScript
- `frontend/` — React 18 + Vite + TypeScript + Tailwind CSS v4
- `docs/` — PLAN.md (requirements), updates/CURRENT.md (progress), backlog/LATER.md (gaps)

## Code Standards

### Architecture (must follow everywhere)
```
Route → Controller (validate input) → Service (business logic) → DB (parameterized SQL)
```

### Required in every controller
- `try/catch` around all async operations
- Structured logging: `logInfo(MODULE, handler, message, data?)`
- Non-blocking audit writes (wrap in try/catch, never throw)
- Return `{ data: ... }` for success, `{ error: ..., code: ... }` for errors

### Required in every DB function
- Parameterized queries only (never string concatenation)
- Include `company_id` in WHERE for all tenant-scoped queries
- No ORM — raw SQL via `pool.query()`

### TypeScript
- Strict mode enabled
- All new types go in `src/types/` (or inline if single-use)
- No `any` unless absolutely necessary

### Frontend
- Tailwind CSS v4 (uses `@import "tailwindcss"`, NOT `@tailwind` directives)
- Dark mode supported on all pages (`dark:` variants)
- Skeleton loaders for async content (not just spinners)
- Toast notifications via `useNotification()` hook

## Autonomous Agent Architecture (Phase 1: AR Module)

**ONE Autonomous Agent with Multiple Execution Engines**

The agent makes autonomous decisions (no human approval) across:

### PHASE 1 (CURRENT): AR Module — 7 Live Execution Engines
✅ **ALL LIVE** (agent is operational for AR):

1. **Payment Detection Engine** — `stripeService.ts` — webhook detects unpaid invoices, triggers agent evaluation
2. **Risk Scoring Engine** — `riskScoringService.ts` + `aiService.ts` — AI-based scoring (0-100) determines urgency/approach
3. **Decision Engine** — `agentLoop.ts:runDecisionEngine()` — runs every 6h, agent decides: dunning tier, email tone, escalation path (no human needed)
4. **Email Generation Engine** — `aiService.ts:generateDunningEmail()` — Claude API generates personalized dunning emails autonomously
5. **Email Sending Engine** — `emailService.ts` → Resend — sends emails automatically, no approval queue
6. **Payment Tracking Engine** — `stripeService.ts` webhook — detects payment response, updates invoice status, learns customer pattern
7. **Forecast Update Engine** — `cashPositionService.ts` — linear regression on recovery_timeline, forecasts working capital freed

**Slack Bot & Notifications** (Agent communication layer):
- Conversational Claude AI understands customer questions, recommends agent actions
- Non-blocking alerts on all decisions (payments, escalations, anomalies)
- User can override (pause/resume), but agent continues autonomously

### PHASE 2 (PLANNED): AP + Cash Module
- **AP Payment Optimization** — Agent autonomously optimizes payment timing based on cash forecasts
- **Cash Flow Forecasting** — Agent predicts 90-day cash position, recommends pricing adjustments
- Reuses same decision engine infrastructure + adds AP invoice detection/scheduling

### PHASE 3 (PLANNED): Contracts + Tax + Compliance
- Full revenue ops agent replacing entire Finance/Operations team
- Same ICP moves from "recovering AR" to "autonomous ops engine"

### Hero Metric: Working Capital Freed
= AR Recovered (last 30d) + AP Payment Optimized (last 30d) + Billing Errors Prevented
Messaging for Phase 1: "Service agencies recovered $X in unpaid invoices, eliminated Y hours of manual dunning"
Expansion messaging for Phase 2+: "Agent now manages AP, cash, and [next module] — agent complexity compounds, switching costs rise, LTV multiplies"

---

## Build Status (as of 2026-04-11)

✅ **LAUNCH READY FOR SERVICE AGENCIES** — One autonomous AR agent live + Slack bot + user controls

### Current Phase 1 (AR Agent):
- Frontend: ✅ Builds clean (0 errors)
- Backend: ✅ Builds clean (0 errors)
- Autonomous agent: ✅ All 7 execution engines live (detection → scoring → decision → email → send → tracking → forecast)
- Slack integration: ✅ Conversational Claude AI + non-blocking alerts
- User controls: ✅ Pause/resume, tone override, aggressive mode (wired into agent loop)
- Database: ✅ 15 tables + proper indexes, 600x faster queries
- Redis: ✅ Optimized (zero idle polling)
- Cron jobs: ✅ 8 scheduled (database-only, zero Redis)

### NEXT PRIORITY (BEFORE EXECUTION):
1. **Landing page redesign** — Target service agencies, NOT SaaS founders
   - Messaging: "Autonomous agent recovers unpaid invoices. Your AR team — on autopilot."
   - Hero: Labor replacement value ($80K-$200K ops person saved)
   - CTA: "Start 21-day free trial" (remove all pricing)
   
2. **Cold email list** — 1,000+ service agency founders (via LinkedIn Recruiter/Apollo)
   - Filters: 11-50 employees, Founder/CEO/Owner, Industries: Dev Shops/Design/IT Services/Marketing Agencies/Staffing
   - Outcome-based subject: "I recovered $50K in unpaid invoices for a dev shop like yours"
   
3. **Manual MVP validation** — First 5 customers via cold email, not network
   - Free 3-week trial (agent runs autonomously, user watches it work)
   - Day 21 call: "What would make this agent 10x better?"
   - Feedback → Phase 2 roadmap (AP? Cash? Contracts?)

### Ready for:
✅ Service agency customer acquisition (cold email)
✅ 21-day free trial launches (no pricing shown)
✅ First 5 customers on manual MVP (feedback → Phase 2)

## Do NOT do

- **NEVER commit without updating CLAUDE.md first** — always update status, bugs fixed, changes made
- **NEVER read or modify `.env` files** — these contain secrets/credentials. Only read `.env.example` for reference. If you need to change configuration, ask the user first.
- Don't add SendGrid code — project uses **Resend** for email
- Don't add features beyond Phase 1 AR agent without explicit user approval — Phase 2 (AP/Cash) is driven by customer feedback, not guesses
- Don't use `sendgrid_message_id` field for new code — use `resend_message_id`
- Don't run `git push` without explicit user confirmation
- Don't create new workers/queues without asking — all 5 existing ones are optimized, don't add more
- **CRITICAL GTM RULES:**
  - Don't pitch to SaaS founders — TAM is too small, expansion revenue is zero. Pitch to **service agencies only** (dev shops, design firms, IT consultants, marketing agencies)
  - Don't use fake case studies ($50K story without customer) — instead, focus on cold email to service agencies with outcome-based offer: "I recovered $X in unpaid invoices for a dev shop like yours. Want to see how?"
  - Don't message warm network first — validate with cold email to service agencies first. Real customers → real proof → THEN activate warm network
  - Don't show pricing on landing page — free 21-day trial only. Pricing is custom based on company size/complexity (discussed during onboarding)
