# Testing Checklist — Signup Flow ✅

## Pre-Testing Setup

```bash
# Terminal 1: Backend
cd /c/dev/AGENTIC_AR/backend
npm run dev

# Terminal 2: Frontend  
cd /c/dev/AGENTIC_AR/frontend
npm run dev

# Open browser
http://localhost:5173
```

---

## ✅ Test 1: Happy Path (Complete Signup → Dashboard)

**Steps:**
1. Click "Sign Up" link (or go to `/signup`)
2. Fill form:
   - First name: `John`
   - Last name: `Doe`
   - Company name: `Acme Corp`
   - Work email: `john@acme.com`
   - Password: `TestPass123`
3. Click "Create account"

**Expected:**
- ✅ Loading spinner shows
- ✅ Toast: "Verification code sent to your email!"
- ✅ Auto-redirect to `/verify-email`
- ✅ Page shows "Verify Your Email"

**Continue:**
4. Enter OTP: `123456` (dev mode hardcoded)
5. Click "Verify Email"

**Expected:**
- ✅ Loading spinner shows
- ✅ Toast: "Email verified! Completing setup..."
- ✅ Auto-redirect to `/integrations`
- ✅ Page shows "Connect Your Billing"
- ✅ Stripe card visible with "Connect with Stripe" button

**Continue:**
6. Click "🔓 Connect with Stripe"

**Expected:**
- ✅ Redirects to Stripe OAuth
- ✅ (In test mode) Returns to `/stripe/oauth/callback`
- ✅ Auto-redirect back to `/integrations`
- ✅ Stripe card shows "✓ Connected" (green badge)
- ✅ "Continue to Dashboard" button is now ENABLED

**Continue:**
7. Click "Continue to Dashboard" (was "Go to Dashboard")

**Expected:**
- ✅ Loading spinner shows
- ✅ Invoice sync starts in background
- ✅ Auto-redirect to `/dashboard`
- ✅ Dashboard loads with KPI cards
- ✅ Agent is active (onboarding complete) ✅

---

## ✅ Test 2: Back Button at OTP Page

**Steps:**
1. Go to `/signup`
2. Fill and submit form → get to `/verify-email`
3. Click "← Wrong email? Start over"

**Expected:**
- ✅ Redirect to `/signup`
- ✅ Form is empty (ready for new entry)
- ✅ No account created in DB (confirm via logs: "Error: email already registered" should NOT appear)

**Confirm:**
4. Signup again with different email: `jane@acme.com`
5. Complete flow

**Expected:**
- ✅ No errors about account existing
- ✅ Flow works for second user

---

## ✅ Test 3: Cannot Skip Integrations

**Steps:**
1. Complete signup up to `/integrations` (Stripe NOT connected)
2. Try to navigate to `/dashboard` directly (paste URL in address bar)

**Expected:**
- ✅ URL changes to `/dashboard`
- ✅ ProtectedRoute detects stage='integrations'
- ✅ Auto-redirect back to `/integrations`
- ✅ User cannot bypass integration page

---

## ✅ Test 4: Refresh at Each Stage

**Test 4a: Refresh on integrations page (Stripe not connected)**
1. Land on `/integrations` after OTP verify
2. Press F5 (refresh)

**Expected:**
- ✅ Page reloads
- ✅ Still on `/integrations`
- ✅ Stripe status: "Not Connected"
- ✅ "Go to Dashboard" button is DISABLED

**Test 4b: Refresh on integrations page (Stripe connected)**
1. Complete Stripe connection
2. Press F5 (refresh)

**Expected:**
- ✅ Page reloads
- ✅ Still on `/integrations`
- ✅ Stripe status: "✓ Connected"
- ✅ "Go to Dashboard" button is ENABLED

---

## ✅ Test 5: OTP Expiry (Advanced)

**Setup:** Set `node-redis` TTL to 1 minute for testing (or wait 15+ min in prod)

**Steps:**
1. Go to `/signup`
2. Submit form → OTP sent
3. Wait 15+ minutes (or trigger via Redis TTL)
4. Try to enter OTP: `123456`

**Expected:**
- ✅ Error: "Code expired — click Resend to get a new one"
- ✅ Input cleared, focus on first digit

**Continue:**
5. Click "Resend Code"

**Expected:**
- ✅ Toast: "OTP sent to your email"
- ✅ "Resend in 60s" button (cooldown active)
- ✅ New OTP: `123456` (dev mode)
6. Enter new OTP and verify

**Expected:**
- ✅ Works successfully
- ✅ Continues to integrations

---

## ✅ Test 6: Logout & Login Again

**Steps:**
1. Complete signup to `/dashboard`
2. Click profile icon → "Logout"

**Expected:**
- ✅ Session cleared (cookies deleted)
- ✅ Redirect to `/login`

**Continue:**
3. Login with same email: `john@acme.com` + `TestPass123`

**Expected:**
- ✅ Authenticated
- ✅ ProtectedRoute checks: stage='integrations'
- ✅ Redirect to `/integrations`

**Continue:**
4. Stripe already connected, click "Go to Dashboard"

**Expected:**
- ✅ Redirect to `/dashboard`
- ✅ All data preserved (company, invoices, etc.)

---

## ✅ Test 7: Mobile Responsive (iPhone 12)

**Steps:**
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select "iPhone 12" (390px width)
4. Test flow: /signup → /verify-email → /integrations → /dashboard

**Expected on each page:**
- ✅ All text readable (no overflow)
- ✅ Input fields full width
- ✅ Buttons clickable (min 44px height)
- ✅ No horizontal scroll
- ✅ Dark mode toggle works

**Special checks:**
- ✅ OTP digit inputs (6 boxes) responsive
- ✅ Stripe card readable
- ✅ Dashboard KPIs stack vertically

---

## ✅ Test 8: Dark Mode

**Steps:**
1. Go to `/signup`
2. Toggle theme (usually in header or settings)
3. Test each page in dark mode

**Expected:**
- ✅ Text visible on dark bg
- ✅ Input fields contrast good
- ✅ Borders visible
- ✅ Buttons readable
- ✅ No white-on-white text

---

## ✅ Test 9: Error Cases

**Test 9a: Invalid OTP**
1. Go to `/verify-email`
2. Enter: `000000`
3. Click "Verify Email"

**Expected:**
- ✅ Error: "Invalid or expired code"
- ✅ Input cleared

**Test 9b: Invalid Email on Signup**
1. Go to `/signup`
2. Enter email: `notanemail`
3. Click "Create Account"

**Expected:**
- ✅ Error: "Enter a valid email"
- ✅ Form not submitted

**Test 9c: Weak Password**
1. Go to `/signup`
2. Enter password: `test`
3. Try to submit

**Expected:**
- ✅ Error: "Min 8 chars, 1 uppercase, 1 number"
- ✅ Password strength bar shows red

**Test 9d: Stripe Connection Fails**
1. On `/integrations`, click "Or paste API key manually"
2. Paste invalid key: `sk_test_invalid123`
3. Click "Validate Key"

**Expected:**
- ✅ Error: "Invalid API key"
- ✅ Button returns to normal state
- ✅ User can try again

---

## ✅ Test 10: Browser Console (Dev Tools)

**Steps:**
1. Open DevTools (F12)
2. Go to Console tab
3. Complete signup flow

**Expected:**
- ✅ No errors (red X icons)
- ✅ No unhandled promise rejections
- ✅ Network tab shows successful requests:
  - `POST /api/audit-stages/stage/1` → 200
  - `POST /api/audit-stages/stage/1/verify-otp` → 200
  - `POST /api/stripe/oauth/authorize` → 302 redirect
  - `POST /api/audit-stages/stage/2/proceed` → 200

---

## ✅ Quick Smoke Test (5 minutes)

Run this if you just want to verify everything works:

```
1. /signup → fill form → "Create account"
2. /verify-email → enter 123456 → "Verify Email"
3. /integrations → "Connect with Stripe" → mock Stripe
4. "Go to Dashboard" → land on /dashboard
5. Open DevTools Console → no errors
✅ Done!
```

---

## ❌ Debugging Tips

**If stuck on /signup:**
- Check: Is backend running? (`npm run dev` in backend dir)
- Check: API endpoint `/api/audit-stages/stage/1` returning 200?
- Check: console.log(response) in handleSubmit

**If stuck on /verify-email:**
- Check: Email in localStorage? (`localStorage.getItem('signup_email')`)
- Check: Redis storing OTP? (backend logs: "OTP sent for email verification")
- Check: Entering `123456` (dev mode) in OTP input?

**If stuck on /integrations:**
- Check: Stripe account connected? (backend logs: "Stripe connected successfully")
- Check: Is `/api/audit-stages/stage/2` returning `stripe_connected: true`?
- Check: Button enabled? (should be disabled until `stripe_connected=true`)

**If stuck on /dashboard:**
- Check: `onboarding_stage = 'trial_active'` in DB? (SELECT * FROM companies WHERE id=?)
- Check: ProtectedRoute allowing access? (stage='trial_active' should pass)
- Check: Agent actually running? (check backend cron logs)

---

## 🎉 All Tests Pass?

Once all 10 tests pass:
- ✅ Signup flow is production-ready
- ✅ Ready to deploy
- ✅ Ready for first customer signup

Congrats! 🚀

