# 🎯 Demo Account Setup & Testing Guide

**Status:** ✅ Ready for Client Demo

---

## Demo Account Credentials

```
Email:    demo@recoverai.com
Password: Demo1234!
```

---

## What's in the Demo Account?

✅ **8 Customer Accounts** (different industries & payment history)
✅ **24 Invoices** (8 paid, 4 arranged in payment plans, 12 unpaid)
✅ **Realistic Payment History** (on-time rates, avg days late, payment patterns)
✅ **Email Logs** (dunning sequence, open rates, click tracking)
✅ **Dashboard Metrics** (recovery rate, DSO, risk scores)

---

## Testing the Demo Flow

### Option 1: Quick Demo (Frontend)

```
1. Visit http://localhost:5173
2. Click "Try live demo" button
3. → Creates demo account + data automatically
4. → Redirects to /dashboard (demo data loaded)
5. Click "Try demo data" to refresh/reset data
```

### Option 2: Test Account Login (Recommended for Client)

```
1. Visit http://localhost:5173
2. Click "Login" in navigation
3. Enter credentials:
   - Email: demo@recoverai.com
   - Password: Demo1234!
4. → Authenticates with demo data
5. → Redirects to /dashboard (persistent session)
6. Page refresh = still authenticated ✅
```

### Option 3: API Test

```bash
# Create fresh demo data
curl -X POST http://localhost:3000/api/demo/login

# Login with demo account
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@recoverai.com","password":"Demo1234!"}' \
  -c cookies.txt

# Verify session
curl -X GET http://localhost:3000/api/auth/me -b cookies.txt

# Check demo data
curl -X GET "http://localhost:3000/api/dashboard/stats" -b cookies.txt
```

---

## Demo Data Breakdown

### Customers (8 Total)

| Name | Company | Industry | On-Time Rate | Avg Days Late |
|------|---------|----------|--------------|---------------|
| Sarah Chen | Nexflow Inc | SaaS | 92% | 2 days |
| Mike Johnson | BuildRight LLC | Construction | 65% | 12 days |
| David Park | TechWave Co | SaaS | 40% | 28 days |
| Priya Mehta | HealthSync | HealthTech | 80% | 5 days |
| Jason Torres | CloudGate Inc | Cloud | 55% | 22 days |
| Emma Williams | DataCore AI | Analytics | 75% | 8 days |
| Ryan Lee | Swiftly Inc | Logistics | 88% | 3 days |
| Nina Patel | DevFirst | DevTools | 30% | 45 days |

### Invoice Status Distribution

```
📊 24 Total Invoices

✅ PAID (8 invoices)
   → Successfully recovered
   → Show recovery power

⏳ IN PAYMENT PLAN (4 invoices)
   → Arranged with flexible terms
   → Show AI negotiation power

⚠️  UNPAID (12 invoices)
   → Active recovery in progress
   → Show dunning sequence
   → Show risk scoring accuracy
```

### Features to Showcase

1. **Dashboard Metrics**
   - Total owed amount
   - Recovery rate (%)
   - Days Sales Outstanding (DSO)
   - Top at-risk customers

2. **Invoice Management**
   - Filter by status (paid/unpaid/arranged)
   - Risk score visualization (0-100)
   - Payment history per customer
   - Email activity log

3. **Customer Profiles**
   - Payment history graph
   - On-time rate
   - Days late trend
   - Total invoices & payments

4. **AI Features** (demo data pre-generated)
   - Risk scores (0-100 per invoice)
   - Email dunning sequence (5 emails per invoice)
   - Email open/click rates
   - Payment plan arrangements

5. **Settings** (pre-configured)
   - Dunning strategy
   - Timezone & currency
   - Slack alerts (if webhook configured)

---

## Reset Demo Data

To get fresh demo data during client call:

### Via Frontend
```
1. Already authenticated
2. Click "Try demo data" button (on landing page)
3. → Resets all demo invoices + customers
4. → New data loaded in dashboard
```

### Via API
```bash
curl -X POST http://localhost:3000/api/demo/login
```

---

## Common Demo Flow (5-10 min)

```
1. ✅ Show Landing Page
   - Product overview
   - Key features

2. ✅ Login with Demo Account
   - demo@recoverai.com / Demo1234!
   - Show persistent session

3. ✅ Dashboard Overview
   - Recovery metrics
   - Pipeline by status
   - Risk list

4. ✅ Customer Detail
   - Click on customer
   - Show payment history
   - Show email activity

5. ✅ Invoice Detail
   - Show risk score
   - Show dunning sequence
   - Show payment plan options

6. ✅ Settings
   - Show configuration options
   - Show integration points

7. ✅ Reset Demo (if needed)
   - Click "Try demo data"
   - Fresh invoices loaded
```

---

## Troubleshooting

### "Login failed" error
- Check backend is running: `npm run dev` from `/backend`
- Verify database has demo data: Run tests first

### "Session lost after refresh"
- This shouldn't happen with test account login
- If using "Try demo", that's expected (cookies don't persist)
- Solution: Use "test account login" instead

### Demo data not showing in dashboard
- Run: `node -r dotenv/config backend/test/suites/MASTER_TEST_SUITE.js`
- Then login again

---

## Files Modified for Demo Account

| File | Change |
|------|--------|
| `backend/src/controllers/demoController.ts` | Creates demo user + seeds data |
| `backend/src/routes/demo.ts` | `/api/demo/login` endpoint |
| `frontend/src/pages/Landing.tsx` | "Try demo" + demo account login options |
| `frontend/src/contexts/AuthContext.tsx` | `setAuthState()` method for direct login |

---

## Production Notes

⚠️ **Demo endpoint is rate-limited:**
- Dev: 10,000/min (unlimited for testing)
- Prod: 5/min (prevents abuse)

See `backend/src/config/rateLimits.ts` for full configuration.

---

## Next Steps

1. ✅ Backend: All APIs working
2. ✅ Demo Data: 24 invoices + customers
3. ✅ Frontend: Landing page ready
4. 🔄 **Ready for client demo!**

Test the flow and let me know if any adjustments needed.

