# RecoverAI Onboarding Flow — Final Implementation Plan (2026-04-04)

## ✅ SUMMARY: What Exists vs What Needs To Be Done

### **Backend: 95% DONE** ✅
- ✅ `POST /api/audit-stages/stage/1` — Email+password + OTP OR Google OAuth
- ✅ `POST /api/audit-stages/stage/1/verify-otp` — Verify OTP → Create account + set cookies
- ✅ `POST /api/audit-stages/stage/1/details` — Update company name (OPTIONAL, skip for now)
- ✅ `GET /api/audit-stages/stage/2` — Check Stripe integration status
- ✅ `POST /api/stripe/oauth/authorize` — Redirect to Stripe OAuth
- ✅ `POST /api/stripe/oauth/exchange` — Exchange OAuth code
- ✅ `POST /api/stripe/connect` — Manual API key validation
- ✅ `POST /api/audit-stages/stage/2/proceed` — Sync invoices from Stripe
- ⚠️ `GET /api/audit-stages/stage/3/analysis` — Audit analysis (SKIP FROM ONBOARDING)
- ⚠️ `POST /api/audit-stages/stage/3/start-trial` — Start trial (SKIP FROM ONBOARDING)

**What needs backend change:**
- Remove "verify account first" requirement — allow direct dashboard access after Stripe connection
- Update `proceedFromStage4` to set `onboarding_stage: 'trial_active'` instead of `'audit_report'`

---

### **Frontend: 40% DONE** ✅❌

**Exists:**
- ✅ `/signup` page component (Signup.tsx) — Form UI ready
- ✅ `/integrations` page component (Integrations.tsx) — Stripe connect logic ready
- ✅ ProtectedRoute guards (ProtectedRoute.tsx) — Stage checking logic ready
- ✅ AuthContext (AuthContext.tsx) — Auth flow ready

**Missing:**
- ❌ `/signup` page NOT wired to audit-stages API
- ❌ `/verify-email` page NOT handling OTP verification
- ❌ Dashboard onboarding completion check

---

## 🎯 OPTIMAL FLOW (What User Sees)

```
START → /signup
    ↓
User fills: email, password, firstName, lastName, companyName
    ↓
POST /api/audit-stages/stage/1
    ← Response: "OTP sent"
    ↓
/verify-email
    ↓
User enters 6-digit OTP
    ↓
POST /api/audit-stages/stage/1/verify-otp
    ← Response: "Account created, next_stage: 3" + AUTH COOKIES SET
    ↓ [User is now AUTHENTICATED]
/integrations
    ↓
User clicks "Connect with Stripe" OR pastes API key
    ↓
POST /api/stripe/oauth/authorize (OAuth) OR POST /api/stripe/connect (manual key)
    ← Stripe connection saved, onboarding_stage = 'integrations'
    ↓
User clicks "Continue"
    ↓
POST /api/audit-stages/stage/2/proceed
    ← Invoices synced, onboarding_stage = 'trial_active'
    ↓
/dashboard
    ↓ [FULL ACCESS — Agent running autonomously]
Show live agent activity (emails sent, payments received, etc.)
```

---

## 🔑 CRITICAL RULES (What User Expects)

### **1. No Account Until OTP Verified** ✅
- User fills `/signup` form
- No account created yet (data in Redis, not DB)
- If user closes browser → start over, no wasted account
- Only after OTP verified → account created in DB + cookies set

### **2. Authenticated User Can't Go Back** ✅
- After OTP verified → user has auth cookies
- If user tries to go to `/signup` → redirect to `/integrations`
- If user tries to go to `/login` → redirect to `/integrations`
- User MUST complete integrations to access dashboard

### **3. Integrations Page is Mandatory** ✅
- After OTP verified → must go to `/integrations`
- User CANNOT skip → "Continue" button disabled until Stripe connected
- If user closes browser → on next login, redirect back to `/integrations` (stage = 'integrations')
- User CANNOT access `/dashboard` without Stripe connection

### **4. After Stripe Connected → Direct to Dashboard** ✅
- NO audit analysis page
- NO trial offer screen
- NO separate confirmation steps
- Just: Stripe connected → Sync invoices → Dashboard
- Set `onboarding_stage = 'trial_active'` immediately

### **5. Dashboard Shows Live Agent Activity** ✅
- Agent already running (auto-started after Stripe sync)
- Show: "Syncing invoices...", "Agent analyzing...", "First emails queued..."
- After 30-60 sec: Show real results (emails sent, opens, payments, etc.)
- No static "audit report" — only live metrics

---

## 📋 IMPLEMENTATION CHECKLIST

### **Phase 1: Fix Backend (1 hour)**
- [ ] Update `proceedFromStage4` to set `onboarding_stage: 'trial_active'` (not 'audit_report')
- [ ] Ensure Stripe connection immediately updates stage
- [ ] Test: POST to stage/1 → OTP → verify → stage/2 → proceed → stage = 'trial_active'

### **Phase 2: Wire Signup to Audit-Stages API (2 hours)**
- [ ] Modify `Signup.tsx`:
  - [ ] Change from `/api/auth/signup` to `/api/audit-stages/stage/1`
  - [ ] Handle `requires_otp_verification: true` response
  - [ ] Redirect to `/verify-email` (pass email in state)
  - [ ] Store email in localStorage (for OTP input)
- [ ] Create `/verify-email` page:
  - [ ] Accept email from state/localStorage
  - [ ] Input field for 6-digit OTP
  - [ ] "Resend code" button
  - [ ] POST to `/api/audit-stages/stage/1/verify-otp`
  - [ ] On success → redirect to `/integrations`

### **Phase 3: Wire Integrations Page (1 hour)**
- [ ] Update `Integrations.tsx`:
  - [ ] Change endpoint from `/api/audits/stage/2` to `/api/audit-stages/stage/2`
  - [ ] Change endpoint from `/api/audits/stage/2/proceed` to `/api/audit-stages/stage/2/proceed`
  - [ ] On "Continue" success → redirect to `/dashboard` (not `/audit-report`)
  - [ ] Show progress indicator: "✓ Account → 2. Integrations (active) → 3. Dashboard"

### **Phase 4: Update App.tsx Routes (1 hour)**
- [ ] Wire `/verify-email` route (already exists in ProtectedRoute)
- [ ] Wire `/integrations` route to show only at stage='integrations'
- [ ] Ensure `/signup` route exists (already added)
- [ ] Update redirect logic in ProtectedRoute

### **Phase 5: Dashboard Onboarding State (1 hour)**
- [ ] Check if company stage = 'trial_active' on dashboard load
- [ ] If not, show overlay: "Completing setup..."
- [ ] Start agent loop automatically (backend scheduled job)
- [ ] Show activity feed: "Agent syncing invoices...", "Analyzing payment patterns...", etc.
- [ ] After 30-60 sec, show real metrics

### **Phase 6: Testing & Polish (1 hour)**
- [ ] E2E test: signup → OTP → integrations → dashboard
- [ ] Test refresh at each stage → correct redirect
- [ ] Test browser back button → correct redirect
- [ ] Test manual logout → can login again, redirect to integrations
- [ ] Test Stripe oauth flow → callback works
- [ ] Test manual API key → validation works

---

## 📂 FILES TO MODIFY

### **Backend**
1. `backend/src/controllers/auditStagesController.ts`
   - Update `proceedFromStage4` (line 317+)
   - Change: `onboarding_stage: 'audit_report'` → `'trial_active'`

### **Frontend**
1. `frontend/src/pages/Signup.tsx` — Wire to audit-stages API
2. `frontend/src/pages/VerifyEmail.tsx` — OTP verification (already exists, needs wiring)
3. `frontend/src/pages/Integrations.tsx` — Update API endpoints + redirect logic
4. `frontend/src/App.tsx` — Route wiring (already done)
5. `frontend/src/components/ProtectedRoute.tsx` — May need small update for stage checks

---

## 🎨 UI/UX Details

### **Signup Page**
- Title: "Start recovering revenue"
- Subtitle: "No credit card required"
- Fields: firstName, lastName, company_name, email, password
- Button: "Create Account" (disabled until OTP page shown)
- Links: Terms, Privacy, "Already have an account? Sign in"

### **Verify Email Page**
- Title: "Verify your email"
- Subtitle: "We sent a 6-digit code to user@company.com"
- Input: 6-digit code (auto-focus)
- Button: "Verify Code"
- Link: "Resend code" (rate-limited: 30 sec cooldown)
- Error handling: "Invalid or expired code"

### **Integrations Page**
- Progress bar: ✓ Account → 2. Integrations → 3. Dashboard
- Title: "Connect Your Billing"
- Subtitle: "We need access to your invoices to power the agent"
- Stripe card with two options:
  1. "🔓 Connect with Stripe" (OAuth)
  2. "Or paste API key manually" (toggle to form)
- Continue button (disabled until Stripe connected)

### **Dashboard (Onboarding Complete)**
- Show banner: "🚀 Agent is active and running"
- Timeline of agent activity:
  - "✓ Synced 1,234 invoices from Stripe"
  - "📊 Analyzing payment patterns..."
  - "💬 Generating personalized emails..."
  - "✉️ Email 1 sent to acme@corp.com"
  - "👁️ Email opened by John Smith"
  - "💳 Payment received: $5,000"
- KPI cards: AR, Overdue, Recovery Rate (live)

---

## ⚠️ GOTCHAS TO AVOID

1. **Redis cleanup** — Make sure stage/1 data cleared after OTP verify
2. **Cookie scope** — OAuth callback must set cookies correctly
3. **Redirect loops** — After OTP, user is authenticated but not at dashboard stage yet
4. **Manual key validation** — stripeService.connectStripe() must validate key before saving
5. **Stripe webhook delays** — Invoice sync may take 5-10 sec, show spinner
6. **Dark mode** — All new pages must have dark:* classes
7. **Mobile responsive** — Test on mobile screens

---

## 🔄 State Transitions (onboarding_stage values)

```
[unauthenticated]
    ↓ POST /stage/1
[Redis: stage1_pending]
    ↓ POST /stage/1/verify-otp
[create_account] ← Account created, authenticated
    ↓ GET /stage/2 (auto-update if needed)
[integrations] ← Waiting for Stripe
    ↓ POST /stripe/connect or /stripe/oauth/exchange
[integrations] ← Still integrations stage
    ↓ POST /stage/2/proceed
[trial_active] ← DASHBOARD ACCESS UNLOCKED
    ↓ Agent running autonomously
```

---

## ✨ Success Criteria

- [ ] User can signup without invlink
- [ ] OTP email received within 5 sec (dev: 123456 hardcoded)
- [ ] After OTP verify → authenticated with cookies
- [ ] Integrations page mandatory → skip button removed
- [ ] Stripe connect works (OAuth + manual key)
- [ ] Dashboard shows "Agent Active" state
- [ ] Back button prevents re-signup loop
- [ ] Refresh at any stage → correct redirect
- [ ] Mobile responsive on all screens
- [ ] Dark mode works on all pages
