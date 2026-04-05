# RecoverAI — FINAL SECURITY & QUALITY AUDIT (A-Z HYPERDEPTH)
**Date**: 2026-04-05
**Scope**: Full backend + frontend, pre-launch hardening review
**Verdict**: **NOT YET LAUNCH-READY** — 4 CRITICAL issues must be fixed first (est. 4-6 hours work)

---

## EXECUTIVE SUMMARY

| Severity | Count | Must fix before launch? |
|----------|-------|------------------------|
| 🔴 CRITICAL | 4 | YES |
| 🟠 HIGH | 9 | YES |
| 🟡 MEDIUM | 11 | Week 1 |
| 🟢 LOW | 7 | Nice-to-have |

**Good news**: Core architecture is solid. JWT + httpOnly cookies + tenant scoping + RBAC + AES-256-GCM encryption + parameterized SQL + helmet CSP + structured logging with redaction are all correctly implemented. Webhook idempotency, session rotation, and audit logging are in place.

**Bad news**: Slack webhook routes have **zero signature verification** (catastrophic auth bypass), LemonSqueezy/Razorpay webhook signature verification is **broken by design** (re-stringifying parsed JSON), the dev OTP `'123456'` is gated only on `NODE_ENV === 'production'` (if the env var isn't set in prod, every account becomes takeover-able), and `npm audit` shows 4 high-severity vulns including one in `express-rate-limit` itself.

---

## 🔴 CRITICAL (BLOCK LAUNCH)

### C1. Slack routes have NO signature verification
**File**: [backend/src/routes/slack.ts](backend/src/routes/slack.ts)
**Impact**: Catastrophic. Any attacker on the internet can POST to `/api/slack/events`, `/api/slack/commands`, `/api/slack/interactions` with a forged payload and:
- Impersonate ANY `user_id` / `team_id`
- Trigger slash commands as any Slack user
- Execute interactive button handlers
- Leak AR data via crafted queries to `handleSlackCommand`

**Evidence**: Routes accept `req.body.user_id`, `req.body.command`, etc. directly with no HMAC check against `SLACK_SIGNING_SECRET`. The env var itself is not even defined in [config/env.ts](backend/src/config/env.ts) — the feature was never implemented.

**Fix**:
1. Add `SLACK_SIGNING_SECRET` to `config.slack` in [config/env.ts](backend/src/config/env.ts).
2. Mount raw-body parser on `/api/slack/*` before the JSON parser (like Stripe).
3. Build a middleware that verifies `X-Slack-Signature` using HMAC-SHA256 of `v0:{timestamp}:{rawBody}` and rejects requests where `timestamp` drifts >5 min.
4. Apply the middleware to all three routes.

---

### C2. Dev OTP `'123456'` hardcoded, gated only on `NODE_ENV`
**Files**:
- [backend/src/services/authService.ts:70-71](backend/src/services/authService.ts#L70-L71)
- [backend/src/controllers/authController.ts:95-96, 262-263, 743-744](backend/src/controllers/authController.ts#L95-L96)

**Impact**: If `NODE_ENV` is missing or misspelled in the production environment (Railway/Vercel), EVERY signup OTP becomes `123456`. Combined with the email-enumeration leak in signup, this is a **full account takeover** vector for any email that ever starts a signup.

**Evidence**: [config/env.ts:2](backend/src/config/env.ts#L2) defaults `nodeEnv` to `'development'` when `process.env.NODE_ENV` is unset. `authController.signup` then sees `isDev = true` and hardcodes OTP.

**Fix**:
1. **Fail-closed**: refuse to start the server if `NODE_ENV` is not one of `['production', 'staging', 'development']`.
2. Remove the hardcoded `'123456'` entirely — even in dev, generate a random OTP and print it to the server console so devs can read it.
3. Add a `config.isProduction` boolean derived from `NODE_ENV === 'production'` and use it everywhere instead of `NODE_ENV !== 'production'` (the latter fails-open).

---

### C3. LemonSqueezy / Razorpay webhook signature verification is broken
**Files**:
- [backend/src/controllers/billingController.ts:405-411](backend/src/controllers/billingController.ts#L405-L411) (LemonSqueezy)
- [backend/src/controllers/billingController.ts:556-557](backend/src/controllers/billingController.ts#L556-L557) (Razorpay)

**Impact**: HMAC webhook verification requires the **original raw bytes** of the request body. Here the code does `JSON.stringify(req.body)` **after** Express has already parsed it — the re-serialized JSON has different whitespace and key order than what the provider signed, so:
- Either verification always fails (legit payments silently ignored), OR
- If the service falls back to `false` somewhere, attackers can forge billing events to mark their own company as paid.

Neither route mounts `express.raw()` before the JSON parser. Only `/api/stripe/webhook` does that correctly ([app.ts:108](backend/src/app.ts#L108)).

**Fix**:
1. Add `app.use('/api/billing/webhook', express.raw({ type: 'application/json' }))` and `app.use('/api/billing/razorpay/webhook', express.raw(...))` before the global JSON parser in [app.ts](backend/src/app.ts).
2. Change handlers to call `crypto.createHmac('sha256', secret).update(req.body as Buffer).digest('hex')` and compare with `crypto.timingSafeEqual`.
3. Only `JSON.parse(rawBody)` **after** signature verification passes.

---

### C4. CORS wildcards `*.vercel.app` (any Vercel app can hit prod API)
**File**: [backend/src/app.ts:93-96](backend/src/app.ts#L93-L96)

**Impact**: The CORS origin check allows any origin ending in `.vercel.app`. Anyone can deploy a malicious React app to `attacker.vercel.app`, host a login form, and — combined with `credentials: true` and `sameSite: 'none'` cookies in prod — exfiltrate authenticated user data via XHR. This turns every Vercel preview URL into a potential XSS launchpad against prod.

**Fix**: Replace the wildcard with an explicit allowlist of the production frontend URL + any named preview deployments. Use `FRONTEND_URL` env var as comma-separated list, no suffix matching.

```ts
// WRONG (current)
if (origin.endsWith('.vercel.app')) return callback(null, origin);

// RIGHT
// Only the exact production + explicit preview URLs from env.
```

---

## 🟠 HIGH (FIX BEFORE LAUNCH)

### H1. Password complexity schema defined but never enforced
**Files**:
- [backend/src/types/schemas.ts:3-12](backend/src/types/schemas.ts#L3-L12) — `signupSchema` requires uppercase, digit, special char, min 8.
- [backend/src/routes/auth.ts:37](backend/src/routes/auth.ts#L37) — signup route does NOT apply `validate(signupSchema)`.
- [backend/src/controllers/authController.ts:81, 249](backend/src/controllers/authController.ts#L81) — controller only checks `password.length < 8`.

**Fix**: Add `validate(signupSchema)` to the signup route. Same for bootstrap, change-password, reset-password.

### H2. Email enumeration on signup
**File**: [backend/src/controllers/authController.ts:87-89, 254-256](backend/src/controllers/authController.ts#L87)
Returns `'Email already registered. Please sign in.'`. Attackers can enumerate valid user emails.

**Fix**: Return a generic `'If this email is available, a verification code has been sent'` and still put the caller through the OTP flow. Let the final verification step silently fail for existing emails.

### H3. JWT `verify()` without explicit `algorithms`
**File**: [backend/src/middleware/auth.ts:23](backend/src/middleware/auth.ts#L23)

`verify(token, config.jwtSecret)` does not pass `{ algorithms: ['HS256'] }`. jsonwebtoken 9.x is hardened against `alg:none`, but best practice is explicit. If a future dev ever introduces RS256 keys in the same secret string, algorithm-confusion becomes possible.

**Fix**: `verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as JWTPayload`.

### H4. bcrypt cost factor = 10 (should be 12)
**Files**: Every `bcrypt.hash(pw, 10)` site (authService, authController, invite onboarding).
In 2026 the NIST / OWASP recommendation is ≥12 rounds for bcrypt. 10 rounds is ~4x faster to brute-force.

**Fix**: Bump to `12` and re-hash on next successful login for existing users (opportunistic upgrade).

### H5. Two bcrypt libraries installed simultaneously
**File**: [backend/package.json](backend/package.json) — both `bcrypt@^6.0.0` and `bcryptjs@^3.0.3`.
`authService.ts` imports `bcryptjs`, `authController.ts` imports `bcrypt`. Bundle bloat + confusion. Hashes are compatible but future devs will slip up.

**Fix**: Pick one (recommend native `bcrypt` for speed in prod), uninstall the other, grep-replace imports.

### H6. `npm audit` high-severity: express-rate-limit ITSELF vulnerable
```
express-rate-limit  8.2.0 - 8.2.1  HIGH
  IPv4-mapped IPv6 addresses bypass per-client rate limiting on dual-stack servers
```
Railway runs dual-stack. This means an attacker can bypass **all** of your rate limiters (auth, api, webhook, ai, demo) by sending IPv4-mapped IPv6 source addresses.

Also flagged: `path-to-regexp` (ReDoS), `lodash` (prototype pollution), `brace-expansion` (ReDoS).

**Fix**: `cd backend && npm audit fix` — the fixes are non-breaking.

### H7. Signup stores bcrypt hash in Redis for 15 min (pending signup)
**Files**: [authController.ts:98-103, 267-272](backend/src/controllers/authController.ts#L98)
Pending bcrypt hashes sit in Redis keyed by email. If Redis is ever dumped, exposed, or MITMed (TLS required!), every in-flight signup password hash is harvestable.

**Fix**: Either (a) don't pre-hash — verify OTP first, then hash on account creation, or (b) verify Redis connection uses `rediss://` TLS in prod.

### H8. No CSRF token; relies on CORS allowlist only
**Files**: [authController.ts:29-44](backend/src/controllers/authController.ts#L29), [app.ts:116-117](backend/src/app.ts#L116)
In production cookies use `sameSite: 'none'`. The JSON body parser + `express.urlencoded` means a cross-site form POST with `Content-Type: application/x-www-form-urlencoded` can reach the backend as a "simple request" (no preflight), and Express will parse the body. Because CORS is only validated on the **response**, the mutation already ran by then.

**Fix**: Two options:
- (Preferred) Remove `express.urlencoded` entirely — only accept `application/json`. Simple CORS preflight then blocks cross-origin POSTs.
- Add a double-submit CSRF cookie or `X-CSRF-Token` header check for non-GET routes under `/api/`.

### H9. Stripe webhook fallback brute-forces every company's secret
**File**: [stripeService.ts:365-419](backend/src/services/stripeService.ts#L365-L419)

When `account` ID is missing from the payload, the code tries EVERY company's webhook secret in a loop until one verifies. This is:
- O(n) per webhook → scales poorly at 100+ customers
- Timing-side-channel (different secrets take slightly different CPU time)
- Effectively grants a "any valid secret accepts any webhook" semantic

**Fix**: Require accounts to configure a unique webhook endpoint per company (use `companyId` as a URL path segment: `/api/stripe/webhook/:companyId`) so lookup is O(1) and signature is tied to one specific secret.

---

## 🟡 MEDIUM (FIX IN WEEK 1)

### M1. `/api/stripe/validate-key` saves API key without calling Stripe
**File**: [routes/stripe.ts:28-65](backend/src/routes/stripe.ts#L28-L65). Only regex-checks `sk_live_|sk_test_`. Should call `stripe.accounts.retrieve()` before saving.

### M2. `updateCompany` / `updateUser` dynamic key builder
**Files**: [db/companies.ts:41-50](backend/src/db/companies.ts#L41), [db/users.ts:82-91](backend/src/db/users.ts#L82)
Concatenates `Object.keys(updates)` into SQL. Currently safe (all callers use hardcoded keys), but the API shape invites SQL injection. Add a key whitelist check inside the function.

### M3. Request-ID header length 128 chars (log-spam vector)
**File**: [app.ts:122-125](backend/src/app.ts#L122-L125). Attacker can send arbitrary-but-≤128 chars `X-Request-Id` that ends up in every log line. Trim to 36 chars (UUID length) and reject non-UUID patterns.

### M4. JSON body limit = 10 MB (DoS vector for AI/email endpoints)
**File**: [app.ts:116](backend/src/app.ts#L116). A single unauth request to `/api/auth/login` can allocate 10 MB of JSON. Drop to `1mb` globally and raise selectively on CSV/customer-import routes only.

### M5. Access token cookie lifetime (24h) > JWT exp (1h)
**File**: [authController.ts:35 vs authService.ts:288](backend/src/controllers/authController.ts#L35)
Users get cookies for 24h but the JWT inside expires after 1h. Every `/api/auth/refresh` call masks the mismatch, but an offline token that's cached by a proxy stays "valid-looking" to tools. Align them.

### M6. Refresh token cookie 30d vs JWT 7d — same mismatch

### M7. Signup sends bcrypt hash and password both in one flow but still in DEV log line
**File**: [authController.ts:74](backend/src/controllers/authController.ts#L74) — logs `{ email, companyName }`. Email is PII under GDPR. Add `'email'` to `REDACT_KEYS` in [logger.ts:21](backend/src/utils/logger.ts#L21) or hash emails before logging.

### M8. Bootstrap endpoint has no rate limit
**File**: [routes/auth.ts:34](backend/src/routes/auth.ts#L34)
Endpoint is guarded by "only works on empty DB", but the DB-count query is hit on every request. Add `publicFormLimiter` anyway.

### M9. CSV parser uses naive `split(',')`
**File**: [invoiceController.ts:415, 422, 469](backend/src/controllers/invoiceController.ts#L415)
Breaks on any quoted field containing a comma (`"Smith, John"`). Use `papaparse` or similar.

### M10. Frontend has `vite ^5.4.21` + `esbuild` moderate CVE
`esbuild <=0.24.2` — any website can send requests to dev server. Dev-only, but still worth fixing. `npm audit fix --force` upgrades to Vite 6.

### M11. Health endpoints leak env name
**File**: [app.ts:247](backend/src/app.ts#L247) — `/health` returns `env: config.nodeEnv`. Minor info disclosure. Drop in prod.

---

## 🟢 LOW (NICE-TO-HAVE)

### L1. `config/env.ts:69` admin default `'admin@company.com,founder@company.com'` — if `ADMIN_EMAILS` missing in prod, these literal emails become platform admins. Fail-closed instead.

### L2. HTTP Strict Transport Security not explicitly set. Helmet includes HSTS by default (max-age=180 days), but should be extended to `max-age: 63072000; includeSubDomains; preload` for hardening.

### L3. `trust proxy: 1` in [app.ts:51](backend/src/app.ts#L51) — trusts ONE hop. If Railway adds an LB in front, rate-limiter will see the LB IP and rate-limit everyone. Use `'uniquelocal'` or the exact proxy CIDR.

### L4. `frameAncestors: ["'none'"]` is set — good. But `X-Frame-Options: DENY` is not explicitly set; helmet sets it, just confirm after deploy.

### L5. `/ready` and `/live` endpoints duplicate `/health` with no auth. For internal probes only — add a `?secret=` or move to a different port.

### L6. AI service fallback (anthropic → openai) silently downgrades quality. Log + alert when happening so you can track outages.

### L7. Dashboard in-memory rate limiter ([routes/dashboard.ts:24](backend/src/routes/dashboard.ts#L24)) uses a `Map` — won't survive process restart or multi-pod scale-out. Move to Redis when you scale beyond one pod.

---

## ✅ WHAT'S DONE CORRECTLY (the good news)

These are handled well — **do not refactor**:

| Area | Implementation |
|------|----------------|
| HTTP hardening | helmet with strict CSP, COOP, no-referrer ([app.ts:53-69](backend/src/app.ts#L53)) |
| Token storage | httpOnly + secure cookies, no JWT in localStorage ✅ |
| Stripe webhooks | Raw body, signature verified, replay protection (24h), idempotency via `registerWebhookEvent` + sha256 payload hash |
| Field encryption | AES-256-GCM with authTag, IV rotation per record ([lib/encryption.ts](backend/src/lib/encryption.ts)) |
| Tenant isolation | `tenantScopeGuard` rejects cross-tenant `companyId` in body/query ([middleware/tenantScope.ts](backend/src/middleware/tenantScope.ts)) |
| RBAC | `requireRole` checks hierarchical role weights; applied to settings, billing, invites, policy, feature-flags |
| Platform-admin access | Email whitelist via `config.admin.emails` enforced inside controllers |
| Rate limiting | Per-route: auth (10/15m), ai (20/min), sync (5/10m), public form (10/hr), webhook (100/min), api (100/15m) |
| Progressive slowdown | `express-slow-down` on auth endpoints (500ms → 4s) |
| Logger redaction | `password`, `token`, `secret`, `authorization`, `cookie`, `api_key` stripped at serialization |
| SQL | 100% parameterized via `pool.query($1, $2...)`, `company_id` in every tenant-scoped WHERE |
| Frontend XSS | No `dangerouslySetInnerHTML`, no `eval`, no `innerHTML =`, no `document.write` |
| Dark mode | 1,439 `dark:` utility occurrences across 40 pages — consistent |
| Demo mode | `demoBlocker` rejects POST/PUT/DELETE/PATCH for demo users; wired after auth in every route file |
| Session rotation | Refresh tokens rotated on each `/refresh` call; replay attacks revoke all sessions |
| Audit logging | Every successful mutation logged to `event_logs` asynchronously; never blocks response |
| Error sanitization | `parseError` + `sanitizeErrorMessage` strip SQL / stack traces / file paths from client responses in prod |
| Business model match | All 7 autonomous engines live (detection → scoring → decision → email → send → tracking → forecast) per MEMORY.md ✅ |

---

## 🚀 FIX-BEFORE-LAUNCH CHECKLIST (in order)

Estimated effort: **one focused afternoon**.

1. **[C2]** Remove `'123456'` OTP, fail-closed on `NODE_ENV` validation — 20 min
2. **[C4]** Replace `*.vercel.app` wildcard with explicit origin list — 5 min
3. **[C1]** Add Slack signing-secret verification middleware + raw body parsing on `/api/slack/*` — 45 min
4. **[C3]** Fix LemonSqueezy + Razorpay webhook raw-body handling + HMAC verification — 30 min
5. **[H6]** `cd backend && npm audit fix` — 2 min + re-test auth/webhook
6. **[H1]** Apply `validate(signupSchema)` to signup/bootstrap routes — 10 min
7. **[H2]** Change email-enumeration response in signup to generic — 5 min
8. **[H3]** Add `{ algorithms: ['HS256'] }` to `jwt.verify` — 2 min
9. **[H4/H5]** Bump bcrypt to 12 rounds, remove `bcryptjs` — 15 min
10. **[H8]** Drop `express.urlencoded` middleware — 5 min
11. **[M4]** Reduce JSON body limit from 10mb → 1mb globally — 5 min

Smoke-test after each fix, then `npm run build` both backend and frontend, then deploy.

---

## 📊 FILE-BY-FILE ISSUE MAP

| File | Critical | High | Medium |
|------|----------|------|--------|
| [backend/src/app.ts](backend/src/app.ts) | C4 | H8 | M3, M4, M11 |
| [backend/src/routes/slack.ts](backend/src/routes/slack.ts) | C1 | — | — |
| [backend/src/controllers/billingController.ts](backend/src/controllers/billingController.ts) | C3 | — | — |
| [backend/src/services/authService.ts](backend/src/services/authService.ts) | C2 | H1, H4, H7 | — |
| [backend/src/controllers/authController.ts](backend/src/controllers/authController.ts) | C2 | H1, H2, H4, H5, H7 | M5, M6, M7 |
| [backend/src/middleware/auth.ts](backend/src/middleware/auth.ts) | — | H3 | — |
| [backend/src/services/stripeService.ts](backend/src/services/stripeService.ts) | — | H9 | — |
| [backend/src/routes/stripe.ts](backend/src/routes/stripe.ts) | — | — | M1 |
| [backend/src/db/companies.ts](backend/src/db/companies.ts), [backend/src/db/users.ts](backend/src/db/users.ts) | — | — | M2 |
| [backend/src/routes/auth.ts](backend/src/routes/auth.ts) | — | H1 | M8 |
| [backend/src/controllers/invoiceController.ts](backend/src/controllers/invoiceController.ts) | — | — | M9 |
| [frontend/package.json](frontend/package.json) | — | — | M10 |
| [backend/package.json](backend/package.json) | — | H5, H6 | — |
| [backend/src/utils/logger.ts](backend/src/utils/logger.ts) | — | — | M7 |
| [backend/src/config/env.ts](backend/src/config/env.ts) | C2 | — | L1 |

---

**Audit methodology**: Read every middleware, every route file, every auth/crypto code path, every webhook handler, all 20 DB modules for parameterization, grepped for `dangerouslySetInnerHTML`/`eval`/hardcoded secrets, ran `npm audit` on both workspaces, verified 1,439 dark-mode utility usages, cross-referenced against memory's 7-engines architecture claim.

**Next step after fixes**: re-run `npm run build && npm audit` on both workspaces, redeploy, then smoke-test signup → Stripe connect → invoice sync → dunning trigger → payment webhook → Slack notification end-to-end.