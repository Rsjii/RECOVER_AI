# 🧪 Comprehensive API Test Results

**Generated:** 2026-03-07T11:01:13.748Z

## 📊 Summary

- **Total Tests:** 47
- **Passed:** 39 ✅
- **Failed:** 8 ❌
- **Success Rate:** 83.0%

## 📋 Test Results by Category

### HEALTH & PLATFORM
2/2 passed

✅ Health check
- `GET /health`
- Status: 200 (expected: 200)

✅ 404 on unknown route
- `GET /api/unknown-endpoint`
- Status: 404 (expected: 404)

### AUTHENTICATION
3/4 passed

✅ Signup (new user)
- `POST /api/auth/signup`
- Status: 201 (expected: 201/400)

✅ Login
- `POST /api/auth/login`
- Status: 200 (expected: 200)

✅ Get current user (auth required)
- `GET /api/auth/me`
- Status: 200 (expected: 200)

❌ Get Stripe OAuth authorize URL
- `GET /api/stripe/oauth/authorize`
- Status: 302 (expected: 200/400)

### CUSTOMERS
2/2 passed

✅ List customers
- `GET /api/customers?limit=10`
- Status: 200 (expected: 200)

✅ Get customer detail
- `GET /api/customers/d159e8cb-86e5-48d9-bd98-6f3c8b2219e5`
- Status: 200 (expected: 200)

### INVOICES
8/9 passed

✅ List invoices
- `GET /api/invoices?limit=10&status=unpaid`
- Status: 200 (expected: 200)

✅ Get invoice detail
- `GET /api/invoices/25a30dee-43b6-40f6-91d2-786d039ca1a0`
- Status: 200 (expected: 200)

✅ Get invoice full detail
- `GET /api/invoices/25a30dee-43b6-40f6-91d2-786d039ca1a0/detail`
- Status: 200 (expected: 200)

✅ Create manual invoice
- `POST /api/invoices/manual`
- Status: 400 (expected: 201/400/422)

✅ Update invoice status
- `PUT /api/invoices/25a30dee-43b6-40f6-91d2-786d039ca1a0/status`
- Status: 200 (expected: 200/400)

❌ Get payment plans for invoice
- `GET /api/payment-plans?invoiceId=25a30dee-43b6-40f6-91d2-786d039ca1a0`
- Status: 404 (expected: 200/400)

✅ Sync Stripe invoices
- `POST /api/stripe/sync`
- Status: 400 (expected: 200/400)

✅ List Stripe invoices
- `GET /api/stripe/invoices?limit=10`
- Status: 200 (expected: 200/400)

✅ Get Stripe invoice detail
- `GET /api/stripe/invoices/25a30dee-43b6-40f6-91d2-786d039ca1a0`
- Status: 200 (expected: 200/404)

### AI SERVICES
6/10 passed

✅ Calculate risk score
- `POST /api/ai/risk-score`
- Status: 200 (expected: 200)

❌ Generate dunning email
- `POST /api/ai/generate-email`
- Status: 400 (expected: 200)

❌ Recommend payment plan
- `POST /api/ai/recommend-plan`
- Status: 400 (expected: 200)

✅ Get email logs
- `GET /api/email/logs?limit=5`
- Status: 200 (expected: 200)

✅ Send email now
- `POST /api/email/send-now`
- Status: 200 (expected: 200/201/400)

✅ Schedule dunning emails
- `POST /api/email/schedule`
- Status: 400 (expected: 200/201/400)

✅ List payment plans
- `GET /api/payment-plans/list`
- Status: 200 (expected: 200)

❌ Get payment plans for invoice
- `GET /api/payment-plans?invoiceId=25a30dee-43b6-40f6-91d2-786d039ca1a0`
- Status: 404 (expected: 200/400)

❌ Create payment plan
- `POST /api/payment-plans`
- Status: 500 (expected: 201/400)

✅ List billing plans
- `GET /api/billing/plans`
- Status: 200 (expected: 200)

### EMAIL QUEUE
4/5 passed

❌ Generate dunning email
- `POST /api/ai/generate-email`
- Status: 400 (expected: 200)

✅ Get queue stats
- `GET /api/email/queue/stats`
- Status: 200 (expected: 200)

✅ Get email logs
- `GET /api/email/logs?limit=5`
- Status: 200 (expected: 200)

✅ Send email now
- `POST /api/email/send-now`
- Status: 200 (expected: 200/201/400)

✅ Schedule dunning emails
- `POST /api/email/schedule`
- Status: 400 (expected: 200/201/400)

### DASHBOARD
2/2 passed

✅ Dashboard stats
- `GET /api/dashboard/stats`
- Status: 200 (expected: 200)

✅ Dashboard pipeline
- `GET /api/dashboard/pipeline`
- Status: 200 (expected: 200)

### PAYMENT PLANS
1/4 passed

❌ Recommend payment plan
- `POST /api/ai/recommend-plan`
- Status: 400 (expected: 200)

✅ List payment plans
- `GET /api/payment-plans/list`
- Status: 200 (expected: 200)

❌ Get payment plans for invoice
- `GET /api/payment-plans?invoiceId=25a30dee-43b6-40f6-91d2-786d039ca1a0`
- Status: 404 (expected: 200/400)

❌ Create payment plan
- `POST /api/payment-plans`
- Status: 500 (expected: 201/400)

### BILLING
1/1 passed

✅ List billing plans
- `GET /api/billing/plans`
- Status: 200 (expected: 200)

### STRIPE
4/6 passed

❌ Get Stripe OAuth authorize URL
- `GET /api/stripe/oauth/authorize`
- Status: 302 (expected: 200/400)

❌ Stripe OAuth callback
- `GET /api/stripe/oauth/callback?code=test&state=test`
- Status: 302 (expected: 400/200)

✅ Sync Stripe invoices
- `POST /api/stripe/sync`
- Status: 400 (expected: 200/400)

✅ List Stripe invoices
- `GET /api/stripe/invoices?limit=10`
- Status: 200 (expected: 200/400)

✅ Get Stripe invoice detail
- `GET /api/stripe/invoices/25a30dee-43b6-40f6-91d2-786d039ca1a0`
- Status: 200 (expected: 200/404)

✅ Stripe webhook
- `POST /api/stripe/webhook`
- Status: 400 (expected: 400)

