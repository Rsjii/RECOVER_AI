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

## Agent Architecture (4 Agents)

1. **AR Agent** — `queue/agentLoop.ts` — runs every 6h, scores invoices, queues dunning emails
2. **Dunning Agent** — `queue/dunningQueue.ts` — BullMQ worker, sends emails via Resend
3. **Billing Optimization Agent** — `queue/billingOptimizationJob.ts` — weekly Sunday 02:00 UTC, detects anomalies (duplicates, amount spikes, billing gaps, failed payment clusters), stores in `billing_anomalies` table
4. **Cash Forecasting Agent** — `services/cashPositionService.getEnhancedCashForecast()` — on-demand, linear regression on `recovery_timeline`, returns 90-day day-by-day forecast

### Hero Metric: Working Capital Freed
= AR Recovered (last 30d) + Billing Errors Confirmed (last 30d)
Shown in KPIBanner card 5. Powers the $2,499 + 1% pricing story for CFOs.

---

## Critical Bugs (as of 2026-03-09)

1. `/stripe/oauth/callback` — NO frontend route → customer connecting Stripe gets 404
2. `recovery_timeline` not seeded in demo data → Reports page chart empty
3. No email unsubscribe link → CAN-SPAM violation
4. Agent trigger endpoint returns no useful summary

Full priority list: `C:\Users\rsji1\.claude\projects\c--dev-AGENTIC-AR\memory\gaps_plan.md`

## Do NOT do

- Don't add SendGrid code — project uses **Resend** for email
- Don't add Stripe flat billing — pricing is **$2.5k base + 1% recovery** (outcome-based)
- Don't use `sendgrid_message_id` field for new code — use `resend_message_id`
- Don't run `git push` without explicit user confirmation
- Don't add features not in PLAN.md scope without asking
