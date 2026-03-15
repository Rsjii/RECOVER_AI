🧪 COMPLETE TESTING GUIDE: RecoverAI (A-Z)
Let me break down everything logically:

PHASE 1: UNDERSTAND CURRENT STATE ✅
From CURRENT.md, tumhara status:

✅ Backend: 34/34 tests passing, all 23 endpoints live
✅ Frontend: React app built, production-ready
✅ Database: PostgreSQL with 11 tables, auto-migrations
✅ Queue: BullMQ + Redis for email/agent jobs
✅ Integration: Stripe webhooks, SendGrid emails, Google OAuth
What this means: Your code works. Ab test karni zaroori hai real scenarios ke saath.

PHASE 2: WHAT WE NEED TO TEST (5 Categories)

1. LOCAL DEVELOPMENT (fake data)
2. STRIPE INTEGRATION (real or test account)
3. EMAIL QUEUE (SendGrid)
4. AUTONOMOUS AGENT (risk scoring + dunning emails)
5. END-TO-END (full user journey)
PHASE 3: LOCAL TESTING SETUP (A-Z)
Step A: Fresh Start - Clean Setup

# 1. Go to backend
cd backend

# 2. Make sure .env is set up
cat .env  # Check these are present:
# DATABASE_URL=postgresql://...
# REDIS_URL=rediss://...
# JWT_SECRET=...
# STRIPE_API_KEY=sk_test_...
# ANTHROPIC_API_KEY=sk-ant-...
# SENDGRID_API_KEY=SG....

# 3. Install fresh
npm install

# 4. Start backend server
npm run dev
# Should see: "✅ Server running on http://localhost:3000"
# Should see: "✅ Database migrated"
# Should see: "✅ Redis connected"
# Should see: "✅ Dunning worker started"
✅ Backend is now LIVE locally at http://localhost:3000

Step B: Seed Test Data (Fake Invoices)

# In backend directory, run:
node -r dotenv/config test/seed.js --force

# Output should show:
# ✅ Created test user: recoverai_test@example.com
# ✅ Created company: RecoverAI Test Co
# ✅ Created 3 customers (Alice, Bob, Charlie)
# ✅ Created 7 invoices (mixed paid/unpaid)
# ✅ Created 3 payment records
# ✅ Saved IDs to .testdata.json
What this creates:

1 test user account (you can now log in)
1 company with fake Stripe API key
3 fake customers with different payment histories
7 invoices (ranging from day 1 to 90+ days overdue)
3 payment records (to give AI history data)
Step C: Run Full Test Suite

# Run all 34 tests
node -r dotenv/config test/run-all.js

# Expected output:
# ✅ Platform: 2/2 PASS
# ✅ Auth: 9/9 PASS
# ✅ Stripe: 7/8 PASS (1 minor)
# ✅ AI: 9/9 PASS
# ✅ Email: 5/5 PASS
# ✅ Dashboard: 2/2 PASS
# ✅ ...
# TOTAL: 34/34 PASS ✅
If you see any RED ❌, let me know immediately. We'll fix.

PHASE 4: MANUAL API TESTING (Postman/Curl)
Step D: Test Authentication Flow

# 1. Signup
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePass123!",
    "companyName": "Test Company"
  }'

# Response: 201
# { "user": { "id": "...", "email": "..." }, "company": { "id": "...", "name": "..." } }

# 2. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePass123!"
  }' \
  -c cookies.txt

# Response: 200
# { "user": { ... }, "accessToken": "..." }
# Note: httpOnly cookie saved in cookies.txt

# 3. Get current user (uses cookie)
curl -X GET http://localhost:3000/api/auth/me \
  -b cookies.txt

# Response: 200
# { "user": { "id": "...", "email": "..." } }
✅ Auth works if you see 200 responses

Step E: Test Invoice Creation (Fake Data)

# Get company ID from test data
COMPANY_ID=$(cat test/.testdata.json | jq -r '.companies[0].id')
CUSTOMER_ID=$(cat test/.testdata.json | jq -r '.customers[0].id')

# Create manual invoice
curl -X POST http://localhost:3000/api/invoices/manual \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "customer_id": "'$CUSTOMER_ID'",
    "amount": 5000,
    "currency": "USD",
    "due_date": "2026-02-15",
    "notes": "Test invoice for manual creation"
  }'

# Response: 201
# { "id": "invoice_xxx", "customer_id": "...", "amount": 5000, ... }
✅ Invoice created successfully

Step F: Test AI Agent (Risk Scoring)

# Using test customer (good payer)
CUSTOMER_ID=$(cat test/.testdata.json | jq -r '.customers[0].id')

curl -X POST http://localhost:3000/api/ai/risk-score \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "customerId": "'$CUSTOMER_ID'",
    "invoiceAmount": 5000,
    "daysOverdue": 15,
    "companyFoundedYear": 2020,
    "industry": "SaaS"
  }'

# Response: 200
# {
#   "riskScore": 35,
#   "reasoning": "Good payment history, recent invoice",
#   "recommendation": "Send friendly reminder"
# }
Risk Score Guide:

0-30: Low risk (send friendly email)
30-60: Medium risk (send follow-up)
60-90: High risk (offer payment plan)
90+: Critical (formal notice + escalation)
✅ AI is scoring correctly

Step G: Test Email Generation

curl -X POST http://localhost:3000/api/ai/generate-email \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "customerName": "Alice Company",
    "invoiceAmount": 5000,
    "daysOverdue": 15,
    "riskScore": 35,
    "emailType": "dunning_1",
    "companyName": "RecoverAI"
  }'

# Response: 200
# {
#   "subject": "Your invoice #XXX is due - Let's resolve this together",
#   "bodyText": "Hi Alice...",
#   "bodyHtml": "<p>Hi Alice...</p>",
#   "tone": "friendly"
# }
✅ AI generates personalized emails

PHASE 5: STRIPE INTEGRATION TESTING
Step H: Connect Real Stripe Account (TEST MODE)
Prerequisites:

Create Stripe account: https://dashboard.stripe.com
Get TEST API Key from Stripe dashboard
Create some TEST invoices in Stripe
Connect to RecoverAI:


curl -X POST http://localhost:3000/api/stripe/connect \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "stripe_api_key": "sk_test_4eC39HqLyjWDarhtT657j32e"
  }'

# Response: 200
# { "success": true, "message": "Stripe connected successfully" }
✅ Stripe API key saved (encrypted)

Step I: Sync Invoices from Stripe

curl -X POST http://localhost:3000/api/stripe/sync \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{}'

# Response: 200
# {
#   "synced": 5,
#   "skipped": 2,
#   "errors": 0,
#   "message": "Synced 5 invoices from Stripe"
# }
✅ Your real Stripe invoices now in RecoverAI database

Step J: List and View Invoices

# List all invoices
curl -X GET 'http://localhost:3000/api/invoices?status=unpaid&limit=10' \
  -b cookies.txt

# Response: 200
# {
#   "invoices": [
#     { "id": "inv_xxx", "customer": "...", "amount": 1000, "status": "unpaid", ... }
#   ],
#   "total": 5,
#   "page": 1
# }

# Get single invoice
INVOICE_ID=$(cat test/.testdata.json | jq -r '.invoices[0].id')
curl -X GET http://localhost:3000/api/invoices/$INVOICE_ID \
  -b cookies.txt

# Response: 200
# { "id": "...", "customer": "...", "amount": 1000, ... }
✅ Invoices retrieved from database

PHASE 6: AUTONOMOUS AGENT TESTING
Step K: Trigger Agent Manually

# Agent runs every 6 hours automatically, but you can trigger manually:
curl -X POST http://localhost:3000/api/dashboard/agent/trigger \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{}'

# Response: 200
# {
#   "success": true,
#   "message": "Agent run completed",
#   "emailsQueued": 3,
#   "paymentPlansOffered": 1
# }
What happens behind the scenes:

Agent scans all unpaid invoices
Calculates risk score for each
Decides which email to send (dunning_1/2/3/4/5)
Queues emails to BullMQ
For high-risk invoices (15+ days overdue), offers payment plan
✅ Agent is working autonomously

Step L: Check Email Queue Status

curl -X GET http://localhost:3000/api/email/queue/stats \
  -b cookies.txt

# Response: 200
# {
#   "waiting": 3,
#   "active": 1,
#   "completed": 45,
#   "failed": 0,
#   "delayed": 0
# }
What this means:

waiting: Emails queued, not yet processed
active: Currently being sent
completed: Successfully sent
failed: Failed to send (check logs)
✅ Email queue is running

Step M: View Email Logs

INVOICE_ID=$(cat test/.testdata.json | jq -r '.invoices[0].id')

curl -X GET "http://localhost:3000/api/email/logs?invoiceId=$INVOICE_ID" \
  -b cookies.txt

# Response: 200
# {
#   "logs": [
#     {
#       "id": "email_log_xxx",
#       "emailType": "dunning_1",
#       "subject": "Your invoice is due",
#       "sentAt": "2026-03-06T10:30:00Z",
#       "openedAt": "2026-03-06T11:00:00Z",
#       "status": "opened"
#     }
#   ],
#   "total": 3
# }
✅ Emails tracked with open/click events

PHASE 7: PAYMENT PLAN TESTING
Step N: Create Payment Plan

INVOICE_ID=$(cat test/.testdata.json | jq -r '.invoices[2].id')

curl -X POST http://localhost:3000/api/payment-plans \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "invoice_id": "'$INVOICE_ID'",
    "num_installments": 3,
    "downPaymentPercent": 30
  }'

# Response: 201
# {
#   "id": "plan_xxx",
#   "invoice_id": "...",
#   "status": "active",
#   "installments": [
#     { "amount": 1500, "dueDate": "2026-04-06", "paid": false },
#     { "amount": 1500, "dueDate": "2026-05-06", "paid": false },
#     { "amount": 1000, "dueDate": "2026-06-06", "paid": false }
#   ]
# }
✅ Payment plan created with 3 installments

PHASE 8: DASHBOARD METRICS
Step O: Get Recovery Stats

curl -X GET http://localhost:3000/api/dashboard/stats \
  -b cookies.txt

# Response: 200
# {
#   "totalAR": 150000,
#   "recoveredThisMonth": 45000,
#   "recoveryRate": 0.68,
#   "avgDSO": 38,
#   "overdueInvoices": 12
# }
Metrics explained:

totalAR: Total unpaid invoices amount
recoveredThisMonth: Paid + arranged this month
recoveryRate: % of invoices recovered
avgDSO: Average Days Sales Outstanding
overdueInvoices: Count of 30+ days overdue
✅ Dashboard metrics are real

Step P: Get Pipeline Breakdown

curl -X GET http://localhost:3000/api/dashboard/pipeline \
  -b cookies.txt

# Response: 200
# {
#   "unpaid": { "count": 8, "totalAmount": 80000 },
#   "arranged": { "count": 2, "totalAmount": 15000 },
#   "paid": { "count": 5, "totalAmount": 50000 },
#   "disputed": { "count": 0, "totalAmount": 0 }
# }
✅ Invoice breakdown by status

Step Q: Get Risk-Ranked Customers

curl -X GET 'http://localhost:3000/api/dashboard/risk-list?limit=10' \
  -b cookies.txt

# Response: 200
# {
#   "customers": [
#     {
#       "id": "cust_xxx",
#       "name": "Bob Company",
#       "email": "bob@company.com",
#       "riskScore": 92,
#       "unpaidAmount": 25000,
#       "daysOverdue": 85
#     }
#   ],
#   "total": 3
# }
✅ Top risky customers ranked by score

PHASE 9: FRONTEND TESTING
Step R: Start Frontend Dev Server

cd frontend
npm install
npm run dev

# Output:
# ➜  Local:   http://localhost:5173/
# ➜  CORS:    http://localhost:3000
✅ Frontend running at http://localhost:5173

Step S: Test Full User Journey
Scenario 1: New User Signup


1. Go to http://localhost:5173/signup
2. Enter:
   - Email: newtester@example.com
   - Company: My Test Company
   - Password: TestPass123!
   - First Name: John
   - Last Name: Doe
3. Click "Sign Up"
4. Should see: "/setup" page (Stripe connect form)
Scenario 2: Login with Existing User


1. Go to http://localhost:5173/login
2. Enter:
   - Email: recoverai_test@example.com
   - Password: TestPass123!
3. Click "Login"
4. Should see: Dashboard with stats
Scenario 3: Connect Stripe


1. On Setup page, enter TEST Stripe API key
2. Click "Connect Stripe"
3. Should see: Success message
4. Dashboard should show sync of invoices
Scenario 4: View Invoices


1. Click "Invoices" in sidebar
2. Should see: Table of invoices with:
   - Customer name
   - Amount
   - Days overdue
   - Risk score (color-coded)
   - Status badge
3. Click on any invoice → View details
Scenario 5: Create Manual Invoice


1. On Invoices page, click "New Invoice"
2. Fill form:
   - Customer name: Test Customer
   - Email: test@customer.com
   - Amount: 1000
   - Due date: 2026-02-15
3. Click "Create"
4. Should appear in invoice list
✅ Frontend works with backend APIs

PHASE 10: LIVE DEPLOYMENT TESTING
Step T: Docker Build (for Railway/Vercel)

# Backend Docker build
cd backend
docker build -t recoverai-backend:latest .
docker run -p 3000:3000 recoverai-backend:latest

# Frontend Docker build
cd frontend
docker build -t recoverai-frontend:latest .
docker run -p 80:80 recoverai-frontend:latest
✅ Both apps containerized

Step U: CI/CD Pipeline Check
GitHub Actions workflows (from CURRENT.md):

CI (ci.yml): Runs on every push/PR

Backend typecheck + build
Frontend typecheck + build
CD (deploy.yml): Runs on push to main

Railway deploys backend
Vercel deploys frontend

# Check logs:
# GitHub → Your repo → Actions → View workflow runs
# Should see: ✅ All checks passed
✅ CI/CD ready

PHASE 11: END-TO-END TEST SCENARIO (COMPLETE FLOW)
Step V: Full Dunning Sequence
Day 1: Invoice created (due today)


curl -X POST http://localhost:3000/api/invoices/manual \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "customer_id": "'$CUSTOMER_ID'",
    "amount": 5000,
    "currency": "USD",
    "due_date": "2026-03-06"
  }'
Day 2: Agent runs, sends Email 1 (friendly)


curl -X POST http://localhost:3000/api/dashboard/agent/trigger \
  -b cookies.txt \
  -d '{}'

# Check queue:
curl -X GET http://localhost:3000/api/email/queue/stats \
  -b cookies.txt
# Should show: { "waiting": 1, ... }
Day 8 (15 days overdue): Agent sends Email 2 + offers payment plan


# Agent runs automatically every 6 hours
# Check payment plans:
curl -X GET 'http://localhost:3000/api/payment-plans/list' \
  -b cookies.txt
Day 20: Customer pays (simulated by updating invoice)


curl -X PUT http://localhost:3000/api/invoices/$INVOICE_ID/status \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{ "status": "paid" }'

# Dashboard updates:
curl -X GET http://localhost:3000/api/dashboard/stats \
  -b cookies.txt
# Should show: recoveredThisMonth increased
✅ Complete dunning sequence works

PHASE 12: MONITORING & DEBUGGING
Step W: Check Backend Logs

# Terminal where backend is running (npm run dev):
# Should see structured logs like:

[2026-03-06 10:30:15] [invoiceController] [createManualInvoice] 201 (125ms)
[2026-03-06 10:30:16] [agentLoop] [runAgent] Starting agent loop (scheduled)
[2026-03-06 10:30:17] [aiService] [risk-score] ✅ Score: 35 (provider: anthropic)
[2026-03-06 10:30:18] [emailService] [generateEmail] ✅ Generated subject (457ms)
[2026-03-06 10:30:19] [dunningQueue] [worker] Processing job: email_dunning_1
✅ Logs show what's happening

Step X: Check Database

# Connect to Postgres (using tool like pgAdmin or CLI):
psql -U postgres -h localhost -d recoverai

# Check recent invoices:
SELECT id, customer_id, amount, status, due_date FROM invoices ORDER BY created_at DESC LIMIT 5;

# Check email logs:
SELECT id, email_type, status, sent_at, opened_at FROM email_logs ORDER BY sent_at DESC LIMIT 10;

# Check payment plans:
SELECT id, invoice_id, status, created_at FROM payment_plans ORDER BY created_at DESC LIMIT 5;
✅ Database has all records

Step Y: Check Redis Queue

# If you have Redis CLI:
redis-cli -u rediss://user:pass@host:port

# View queues:
KEYS *
# Should show: bullmq:dunning:* (queue jobs)

# Check job count:
LLEN bullmq:dunning:waiting
✅ Queue has pending jobs

PHASE 13: TESTING CHECKLIST (FINAL)

BACKEND TESTS:
[ ] npm run typecheck → PASS
[ ] npm run build → PASS
[ ] node -r dotenv/config test/seed.js → PASS
[ ] node -r dotenv/config test/run-all.js → 34/34 PASS

AUTH TESTS:
[ ] Signup with new email → 201 ✓
[ ] Login with correct password → 200 ✓
[ ] Login with wrong password → 401 ✓
[ ] GET /api/auth/me without cookie → 401 ✓
[ ] GET /api/auth/me with valid cookie → 200 ✓

STRIPE TESTS:
[ ] Connect with valid API key → 200 ✓
[ ] Sync invoices from Stripe → synced > 0 ✓
[ ] List invoices → returns array ✓
[ ] Get single invoice → 200 or 404 ✓

AI TESTS:
[ ] Risk score with good payer → score < 50 ✓
[ ] Risk score with late payer → score > 50 ✓
[ ] Generate dunning email → subject + body returned ✓
[ ] Recommend payment plan → terms returned ✓

EMAIL TESTS:
[ ] Queue stats → waiting/active/completed shown ✓
[ ] Email logs → list by invoice ✓
[ ] Schedule emails → 5 emails queued ✓

INVOICE TESTS:
[ ] Create manual invoice → 201 ✓
[ ] List invoices with filters → pagination works ✓
[ ] Update invoice status → status changed ✓

DASHBOARD TESTS:
[ ] Get stats → totalAR, recovered, rate shown ✓
[ ] Get pipeline → by status breakdown ✓
[ ] Get risk list → customers ranked ✓
[ ] Trigger agent → emails queued ✓

FRONTEND TESTS:
[ ] Signup page loads → form visible ✓
[ ] Login with credentials → redirects to dashboard ✓
[ ] Dashboard shows stats → real data from API ✓
[ ] Create manual invoice → appears in list ✓
[ ] View invoice detail → full data shown ✓

PAYMENT PLAN TESTS:
[ ] Create payment plan → installments calculated ✓
[ ] List payment plans → by invoice ✓
[ ] Update plan status → active/completed ✓

INTEGRATION TESTS:
[ ] Stripe webhook triggers → invoice status updated ✓
[ ] Email logs updated → from webhook ✓
[ ] Payment recorded → in payments table ✓
[ ] Customer history updated → on-time rate changed ✓
PHASE 14: TROUBLESHOOTING
If tests fail:

# 1. Check .env file exists and has all required keys
cat backend/.env

# 2. Clear test data and reseed
node -r dotenv/config backend/test/seed.js --force

# 3. Restart backend
npm run dev

# 4. Run tests again
node -r dotenv/config backend/test/run-all.js
If Stripe doesn't work:
Make sure you're using TEST API key (starts with sk_test_)
Check Stripe dashboard for any failed requests
Try syncing again
If emails don't queue:
Check SendGrid API key is correct
Check Redis connection: npm run logs should show Redis startup
If frontend won't connect:
Check VITE_API_BASE_URL in frontend/.env
Should be: http://localhost:3000 (local) or deployed URL
Check CORS: backend should have FRONTEND_URL=http://localhost:5173
PHASE 15: READY FOR PRODUCTION?
YES, if all these are TRUE:

✅ All 34 backend tests pass
✅ Frontend builds without errors
✅ Can create invoices (manual + Stripe)
✅ Agent runs and sends emails
✅ Payment tracking works
✅ Dashboard shows accurate stats
✅ Stripe webhook functional
✅ All env vars configured for production
Then:

Deploy backend to Railway
Deploy frontend to Vercel
Configure production env vars
Test live endpoints
Monitor logs/errors
Ready to launch! 🚀
Sab kuch samjh gaya? Mujhe batao testing mein kya roadblock aa raha hai, main immediately fix karunga.

Next steps:

Run the test suite first (command mention kiya above)
Report any RED ❌ tests
Then we'll do manual API testing
Finally frontend testing
Chalo, start karo! 💪