# RecoverAI - Complete Setup & Testing Guide
**Date:** 2026-03-09
**Status:** ✅ QB FULLY WORKING (20 invoices synced). Now testing Chargebee integration.

---

## 🎯 QUICK PROGRESS

| Component | Status | Details |
|-----------|--------|---------|
| **QuickBooks** | ✅ DONE | OAuth connected, 20 invoices synced, dashboard working |
| **Chargebee** | ⏳ NEXT | Waiting for sandbox API key |
| **Dashboard** | ✅ FIXED | Bug fixed - now auto-redirects authenticated users |
| **Risk Scores** | ⏳ PENDING | Calculated by background agent loop (every 6 hours) |
| **Reports/Activity** | ⏳ PENDING | Populated as system is used |
| **Email Features** | 🔜 TODO | After Chargebee setup |

---

## 📋 PHASE 1: Get Sandbox Credentials

### 1.1 QuickBooks Sandbox Setup

**✅ STATUS: COMPLETE**

**Credentials Configured:**
```env
QB_CLIENT_ID=ABRQFVNypVWu24nsYvcKcdjpCeV1HGk925hr9H3wrNxR03lNek
QB_CLIENT_SECRET=q4Jgr3Vekc8PMZcenOlS6OekuIo3uxjq9oCxdKkC
QB_ENVIRONMENT=sandbox
QB_REALM_ID=9341456557624919
```

**OAuth Flow Tested:**
✅ OAuth redirect URL generated correctly
✅ Intuit OAuth login completed
✅ Realm ID obtained from QB
✅ Tokens stored encrypted in database

**Invoices Synced:**
✅ 20 real QB invoices imported
✅ Customers: Red Rock Diner, Bill's Windsurf Shop, etc.
✅ Dashboard stats updated: $5,281.52 owed, 11 overdue

**Login Credentials Used:**
- Email: `a@gmail.com`
- Password: `A123456a!`
- Company: `Rudra18`

**Test QB Connection:**
```bash
# QB OAuth is working. To test:
1. Go to http://localhost:5173/login
2. Login with a@gmail.com / A123456a!
3. Go to Settings → QuickBooks → Shows "Connected"
4. See 20 invoices in Dashboard
```

---

### 1.2 Chargebee Sandbox Setup

**⏳ STATUS: PENDING (Next task)**

**Steps to Complete:**
1. Go to [chargebee.com](https://www.chargebee.com)
2. Create account or login to existing
3. Get Sandbox API Key:
   - Dashboard → Settings → API Keys & Webhooks
   - Copy API Key (format: `test_...`)
4. Get Site URL:
   - Dashboard → Settings → Plan & Billing
   - Shows `https://your-site-test.chargebee.com`

**Add to `.env`:**
```env
CHARGEBEE_API_KEY=test_xyz123456789abcdefghijklmnop
CHARGEBEE_SITE_URL=https://your-site-test.chargebee.com
```

**Restart backend:**
```bash
cd backend
npm run dev
```

**Test Chargebee Connection (via UI):**
1. Go to http://localhost:5173/login
2. Login with a@gmail.com / A123456a!
3. Settings → Chargebee
4. Paste Site URL + API Key
5. Click "Connect"
6. Should show "Connected"

**Alternative: Test via API:**
```bash
curl -X POST http://localhost:3000/api/chargebee/connect \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"site":"your-site-test","apiKey":"test_xyz123456789"}'
# Should validate and store encrypted key
```

---

## 📊 PHASE 2: Add Fake Invoices for Testing

### 2.1 Create Fake Invoices via API

**Option A: CSV Upload (Bulk)**
```bash
# Create invoices.csv
cat > invoices.csv << 'EOF'
customer_name,customer_email,amount,currency,due_date
Acme Corp,contact@acme.com,5000,USD,2026-04-01
Tech Startup,billing@techstartup.io,3500,USD,2026-04-15
SaaS Company,accounting@saasco.com,2500,USD,2026-03-25
Enterprise Inc,ap@enterprise.com,15000,USD,2026-04-08
Small Biz,owner@smallbiz.net,800,USD,2026-03-20
EOF

# Upload
curl -X POST http://localhost:3000/api/invoices/csv-upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: text/plain" \
  --data-binary @invoices.csv
# Returns: { created: 5, skipped: 0 }
```

**Option B: Manual Create via UI**
- Login to app
- Go to Invoices → "New Invoice" button
- Fill: Customer name, email, amount, currency, due date
- Click "Create" → Invoice added

**Option C: Manual Invoice API**
```bash
curl -X POST http://localhost:3000/api/invoices/manual \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Test Company",
    "customerEmail": "test@company.com",
    "amount": 5000,
    "currency": "USD",
    "dueDate": "2026-04-01",
    "issuedDate": "2026-03-08"
  }'
# Returns: { invoiceId: "xxx", status: "unpaid" }
```

---

### 2.2 Sync from QuickBooks

**✅ STATUS: COMPLETE**

**Already Synced:**
- 20 real QB invoices imported
- Real customers and amounts from QB sandbox
- All unpaid/open invoices captured
- Dashboard stats updated

**To Sync Again (if added new invoices in QB):**
```bash
# Via API:
curl -X POST http://localhost:3000/api/quickbooks/sync \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
# Returns: { created: X, updated: Y, skipped: Z }

# Via UI:
1. Go to Settings → QuickBooks → "Sync Now" button
2. Invoices update automatically
```

---

### 2.3 Sync from Chargebee

**Create test subscriptions in Chargebee Sandbox:**
1. Login to Chargebee sandbox
2. Create 2-3 test customers
3. Create subscriptions for each
4. Set different renewal dates

**Sync to RecoverAI:**
```bash
curl -X POST http://localhost:3000/api/chargebee/sync \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
# Should fetch subscriptions and convert to invoices
# Each subscription becomes an invoice with due_date = renewal_date
```

---

## 🧪 PHASE 3: End-to-End Testing Workflow

### 3.1 Signup & Login
```bash
# Create new test account
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-user@test.com",
    "password": "TestPassword123!",
    "companyName": "Test Recovery Co",
    "firstName": "Test",
    "lastName": "User"
  }'
# Returns: { user: {...}, company: {...}, token: "jwt..." }
# Cookie set: access_token, refresh_token

# Login (alternative)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-user@test.com",
    "password": "TestPassword123!"
  }'
# Returns same as signup
```

### 3.2 Connect QB (Test OAuth Flow)
```bash
# Step 1: Get OAuth authorization URL
curl -X GET http://localhost:3000/api/quickbooks/authorize \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
# Returns: { authorizationUrl: "https://appcenter.intuit.com/connect/..." }

# Step 2: User clicks link, logs into QB, approves
# QB redirects back to: http://localhost:3000/api/quickbooks/callback?code=xxx&realmId=123

# Step 3: Backend automatically handles callback
# - Exchanges code for access token
# - Stores encrypted token + realm ID in database
# - User can now sync QB invoices

# Step 4: Verify connection
curl -X GET http://localhost:3000/api/settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Check response: { integrations: { qb_connected: true, ... } }
```

### 3.3 Connect Chargebee (API Key)
```bash
# One-step: POST API key
curl -X POST http://localhost:3000/api/chargebee/connect \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"test_xyz123456789abcdefghijklmnop"}'
# Returns: { success: true, message: "Chargebee connected" }

# Verify connection
curl -X GET http://localhost:3000/api/settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Check response: { integrations: { chargebee_connected: true, ... } }
```

### 3.4 Test Dashboard (Real Data)
```bash
# Add fake invoices (see Phase 2)
# Then get stats

curl -X GET http://localhost:3000/api/dashboard/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Returns: {
#   totalOwed: 26300,
#   totalRecovered: 5000,
#   recoveryRate: 19.0,
#   overdueDays30: 3,
#   invoiceCount: 5
# }

curl -X GET http://localhost:3000/api/dashboard/pipeline \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Returns: {
#   unpaid: 5,
#   paid: 0,
#   inPaymentPlan: 0,
#   overdue: 3
# }

curl -X GET http://localhost:3000/api/dashboard/risk-list?limit=5 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Returns: [
#   { customerId, customerName, riskScore: 75, unpaidAmount: 5000 },
#   ...
# ]
```

### 3.5 Test AI Features
```bash
# Get first invoice ID from dashboard/invoices
INVOICE_ID="71609d0c-8306-425d-88ab-7ac76fa1bd95"
CUSTOMER_ID="7c0cb408-e3ce-4d89-88f9-ddd315958f7a"

# 1. Risk Score
curl -X POST http://localhost:3000/api/ai/risk-score \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"customerId":"'$CUSTOMER_ID'","includeHistory":true}'
# Returns: { score: 65, reason: "...", recommendation: "Send dunning email" }

# 2. Generate Email Preview
curl -X GET "http://localhost:3000/api/email/preview?invoiceId=$INVOICE_ID&emailType=dunning_1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Returns: { subject: "Payment reminder", body: "Dear...", tone: "friendly" }

# 3. Recommend Payment Plan
curl -X POST http://localhost:3000/api/ai/recommend-plan \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceId":"'$INVOICE_ID'",
    "customerId":"'$CUSTOMER_ID'",
    "totalAmount":5000,
    "daysOverdue":25
  }'
# Returns: {
#   recommendedPlan: { installments: 3, installmentAmount: 1667, frequency: "weekly" },
#   alternativePlans: [...]
# }
```

### 3.6 Test Email Preview Modal (Frontend)
```bash
# 1. Login to app: http://localhost:5173/login
#    Use email: test-user@test.com, password: TestPassword123!

# 2. Navigate to: Invoices → Click on invoice → Details tab

# 3. Click "Preview Next Email" button
#    Modal shows:
#    - Dropdown: dunning_1 (Day 0) / dunning_2 (Day 7) / dunning_3 (Day 14) / dunning_4 (Day 30) / dunning_5 (Day 60)
#    - Shows tone badge (friendly/firm/urgent)
#    - Shows AI-generated subject + body
#    - "Send Now" button to send immediately

# 4. Test all 5 email types by changing dropdown
```

### 3.7 Test Payment Plans
```bash
# Get invoice ID
INVOICE_ID="71609d0c-8306-425d-88ab-7ac76fa1bd95"

# Create payment plan
curl -X POST http://localhost:3000/api/payment-plans \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceId":"'$INVOICE_ID'",
    "numberOfInstallments": 3
  }'
# Returns: { planId: "xxx", status: "active", installments: [...] }

# Get payment plan
curl -X GET "http://localhost:3000/api/payment-plans?invoiceId=$INVOICE_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Returns: { planId, numberOfInstallments, installments: [...], status }

# List all plans
curl -X GET http://localhost:3000/api/payment-plans/list \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Returns: [{ planId, invoiceId, status, ... }, ...]
```

---

## 🔄 Complete Testing Checklist

### Backend Integration Tests (Already 100% Pass ✅)
- [x] Health checks (health, ready, live)
- [x] Auth (signup, login, logout, refresh)
- [x] Customers (list, detail, filters)
- [x] Invoices (list, detail, CSV upload, manual create, status update)
- [x] AI (risk score, email generation, plan recommendation)
- [x] Email queue (logs, preview, schedule, send)
- [x] Dashboard (stats, pipeline, risk list)
- [x] Payment plans (create, list, detail)
- [x] Settings (get, update)
- [x] Billing (plans, subscription, usage)
- [x] Stripe (sync, list, detail, webhook)

### Integration Tests (Need Real Credentials)
- [ ] **QuickBooks OAuth Flow**
  - [ ] Get authorization URL
  - [ ] User approves in QB sandbox
  - [ ] Callback received + tokens stored
  - [ ] Verify QB connection in settings
  - [ ] Sync QB invoices (if QB invoices exist)

- [ ] **Chargebee API Connection**
  - [ ] POST API key
  - [ ] Verify API key validates
  - [ ] Key stored encrypted in DB
  - [ ] Verify connection in settings
  - [ ] Sync Chargebee subscriptions (if subscriptions exist)

### Frontend E2E Tests (Manual)
- [ ] Landing page loads without errors
- [ ] Signup form works, redirects to dashboard
- [ ] Login works with credentials
- [ ] Google OAuth login works (if credentials set)
- [ ] Dashboard shows real invoice stats
- [ ] Invoices page lists all invoices with pagination
- [ ] Invoice detail page shows full info
- [ ] Email preview modal shows all 5 email types
- [ ] Payment plan creation works
- [ ] Settings page shows QB + Chargebee connection buttons
- [ ] QB OAuth button opens QB consent screen
- [ ] Chargebee API key form accepts + validates
- [ ] Demo login creates realistic test data

---

## 🚀 Quick Start Script

```bash
#!/bin/bash
# start-dev.sh - Start full dev stack

# 1. Update .env with your credentials
echo "Update backend/.env with:"
echo "  QB_CLIENT_ID=your_real_id"
echo "  QB_CLIENT_SECRET=your_real_secret"
echo "  CHARGEBEE_API_KEY=your_real_key"
echo "  CHARGEBEE_SITE_URL=https://your-site.chargebee.com"
read -p "Press enter when .env is updated..."

# 2. Start backend
cd backend
npm run dev &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"
sleep 5

# 3. Check health
curl -s http://localhost:3000/health
echo "✅ Backend healthy"

# 4. Start frontend
cd ../frontend
npm run dev &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID)"
sleep 3

# 5. Open browser
echo "🚀 Opening http://localhost:5173"
# open http://localhost:5173  # macOS
# start http://localhost:5173  # Windows
# xdg-open http://localhost:5173  # Linux

echo "✅ Dev environment ready!"
echo "Backend: http://localhost:3000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Test Flow:"
echo "1. Signup at http://localhost:5173/signup"
echo "2. Connect QB: Settings → QB OAuth"
echo "3. Connect Chargebee: Settings → API Key"
echo "4. Create invoices: Invoices → New Invoice or CSV Upload"
echo "5. Test dashboard: Dashboard → View stats"
```

---

## 🎯 What Happens When Tests Pass

When all integrations work:

**QB Flow:**
1. User clicks "Connect QuickBooks"
2. Redirected to QB OAuth consent
3. QB redirects back with auth code
4. RecoverAI exchanges code for access token
5. Token stored encrypted in DB
6. User can sync QB open invoices
7. QB invoices appear in RecoverAI dashboard
8. AI analyzes QB invoices for risk
9. Dunning emails sent automatically for overdue QB invoices
10. Payment plans offered for QB invoices

**Chargebee Flow:**
1. User enters Chargebee API key
2. RecoverAI validates key
3. Key stored encrypted in DB
4. User clicks "Sync Chargebee"
5. RecoverAI fetches all subscriptions from Chargebee
6. Subscriptions converted to invoices (due_date = renewal_date)
7. Chargebee invoices appear in dashboard
8. AI analyzes for risk
9. Dunning emails sent for subscriptions due soon
10. Payment plans offered

**Demo Data:**
1. Visit `/demo/login` (unauthenticated)
2. Creates realistic demo company with:
   - 8 customers (various industries)
   - 50+ invoices (mixed statuses)
   - Email logs showing open/click tracking
   - Payment plans for some invoices
3. Auto-redirects to dashboard
4. All data is realistic and safe to explore

---

## 📞 Troubleshooting

### QB OAuth Not Working
```bash
# Check .env
grep QB_ backend/.env

# Verify callback URL is registered
# Settings → Redirect URIs → Should include http://localhost:3000/api/quickbooks/callback

# Check logs
tail -f /tmp/backend.log | grep quickbooks
```

### Chargebee Not Connecting
```bash
# Test API key
curl -X GET https://your-site.chargebee.com/api/v2/customers/list \
  -u "test_xyz123456789abcdefghijklmnop:"

# If 401: API key is wrong
# If 200: API key works, test in RecoverAI
```

### CSV Upload Failing
```bash
# Test endpoint
curl -X POST http://localhost:3000/api/invoices/csv-upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: text/plain" \
  -d "customer_name,customer_email,amount,currency,due_date\nTest,test@test.com,1000,USD,2026-04-01\n"

# Should return: { created: 1, skipped: 0 }
# If error: Check column names match exactly
```

---

## ✅ Success Criteria

All done when:
- [ ] Backend 70/70 tests pass ✅ (Already done!)
- [ ] Frontend builds without errors ✅ (Already done!)
- [ ] QB OAuth flow works end-to-end
- [ ] Chargebee API connection works
- [ ] Fake invoices appear in dashboard
- [ ] AI risk scores are generated
- [ ] Email preview modal shows all 5 types
- [ ] Payment plans can be created
- [ ] Demo login creates realistic test company

Good luck! 🚀
