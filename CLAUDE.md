# RecoverAI — Claude Instructions

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

**What it is**: Autonomous AR recovery agent for B2B SaaS companies. Sends AI-generated dunning emails, offers payment plans, tracks payments — all without human approval.

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

## Agent Architecture (7 Autonomous Engines)

✅ **ALL LIVE** (no manual work required):

1. **Payment Detection Engine** — `stripeService.ts` — webhook detects unpaid invoices
2. **Risk Scoring Engine** — `riskScoringService.ts` + `aiService.ts` — AI-based scoring (0-100)
3. **Decision Engine** — `agentLoop.ts:runDecisionEngine()` — runs every 6h, decides which action (email type, payment plan, escalation)
4. **Email Generation Engine** — `aiService.ts:generateDunningEmail()` — Claude API generates personalized emails
5. **Email Sending Engine** — `emailService.ts` → Resend — sends emails automatically
6. **Payment Tracking Engine** — `stripeService.ts` webhook — detects payment, updates invoice status
7. **Forecast Update Engine** — `cashPositionService.ts` — linear regression on recovery_timeline, 90-day forecast

**Also running:**
- Billing Optimization Agent — `queue/billingOptimizationJob.ts` — weekly Sunday 02:00 UTC, detects anomalies
- Smart AR Report Agent — `slackService.ts` — daily 08:00 UTC, AI customer targeting recommendations

### Hero Metric: Working Capital Freed
= AR Recovered (last 30d) + Billing Errors Confirmed (last 30d)
Shown in KPIBanner card 5. Powers the $2,499 + 1% pricing story for CFOs.

---

## Build Status (as of 2026-04-01)

✅ **PRODUCTION READY** — All 7 autonomous engines live + 10/10 Redis optimization

### Latest Changes (2026-04-01):
1. **Agent loop wired** — agentLoop.ts connected to scheduler (every 6h)
2. **Smart AR Report added** — Daily Slack intelligence with AI customer targeting
3. **CSV worker optimized** — Lazy initialization (zero idle Redis)
4. **Redis audit complete** — All workers properly optimized (0 idle commands/day)

### Current Status:
- Frontend: ✅ Builds clean (0 errors)
- Backend: ✅ Builds clean (0 errors)
- Autonomous agents: ✅ All 7 live (detection → scoring → decision → email → send → tracking → forecast)
- Database: ✅ 15 tables, proper indexes (600x faster)
- Redis: ✅ 10/10 optimized (zero idle polling)
- Slack: ✅ Smart AR with AI targeting
- Cron jobs: ✅ 8 scheduled (all database-only, zero Redis)

### Critical Bugs (FIXED as of 2026-04-01):
1. ✅ Agent loop was placeholder → Now running every 6h
2. ✅ SMS/Voice workers polling idle → Now zero idle polling (not created on startup)
3. ✅ CSV worker polling → Now lazy initialized

Full history: `C:\Users\rsji1\.claude\projects\c--dev-AGENTIC-AR\memory\COMPLETE_REDIS_AUDIT.md`

## Do NOT do

- **NEVER commit without updating CLAUDE.md first** — always update status, bugs fixed, changes made
- **NEVER read or modify `.env` files** — these contain secrets/credentials. Only read `.env.example` for reference. If you need to change configuration, ask the user first.
- Don't add SendGrid code — project uses **Resend** for email
- Don't add Stripe flat billing — pricing is **$2.5k base + 1% recovery** (outcome-based)
- Don't use `sendgrid_message_id` field for new code — use `resend_message_id`
- Don't run `git push` without explicit user confirmation
- Don't add features not in PLAN.md scope without asking
- Don't create new workers/queues without asking — all 5 existing ones are optimized, don't add more
