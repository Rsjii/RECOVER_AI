# RecoverAI — Claude Instructions (Critical Rules Only)

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

---

## Build Status (as of 2026-04-24)

✅ **LAUNCH READY FOR SERVICE AGENCIES** — One autonomous AR agent live + Slack bot + user controls

### Current Phase 1 (AR Agent):
- Frontend: ✅ Builds clean (0 errors)
- Backend: ✅ Builds clean (0 errors)
- Autonomous agent: ✅ All 7 execution engines live (detection → scoring → decision → email → send → tracking → forecast)
- Slack integration: ✅ Conversational Claude AI + non-blocking alerts
- User controls: ✅ Pause/resume, tone override, aggressive mode (wired into agent loop)
- Database: ✅ 15 tables + proper indexes, 600x faster queries

---

## Do NOT do

- **NEVER commit without updating memory first** — always update status, bugs fixed, changes made
- **NEVER read or modify `.env` files** — these contain secrets/credentials. Only read `.env.example` for reference. If you need to change configuration, ask the user first.
- Don't add SendGrid code — project uses **Resend** for email
- Don't add features beyond Phase 1 AR agent without explicit user approval — Phase 2 (AP/Cash) is driven by customer feedback, not guesses
- Don't use `sendgrid_message_id` field for new code — use `resend_message_id`
- Don't run `git push` without explicit user confirmation
- Don't create new workers/queues without asking — all 5 existing ones are optimized, don't add more

---

## 📚 Reference Docs

- **Agent Architecture** → See [memory/AGENT_ARCHITECTURE.md](C:\Users\rsji1\.claude\projects\c--dev-AGENTIC-AR\memory\AGENT_ARCHITECTURE.md) — 7 engines, phases, hero metric
- **GTM & ICP Strategy** → See [memory/GTM_STRATEGY.md](C:\Users\rsji1\.claude\projects\c--dev-AGENTIC-AR\memory\GTM_STRATEGY.md) — service agencies, pricing, messaging
- **Memory Index** → See [memory/MEMORY.md](C:\Users\rsji1\.claude\projects\c--dev-AGENTIC-AR\memory\MEMORY.md) — all features, flows, research

---

**Repo root**: `c:\dev\AGENTIC_AR\`
- `backend/` — Node.js + Express + TypeScript
- `frontend/` — React 18 + Vite + TypeScript + Tailwind CSS v4
- `docs/` — PLAN.md (requirements), updates/CURRENT.md (progress), backlog/LATER.md (gaps)
