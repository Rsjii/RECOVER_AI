# Integration Test Report

**Generated:** 2026-03-06T11:54:38.821Z

## Results

### ✅ database
- **Status:** ✅ Working
- **Message:** Database connection successful

### ✅ redis
- **Status:** ✅ Working
- **Message:** Redis connection successful

### ⚠️ stripe
- **Status:** ⚠️ Partial
- **Message:** Connect returned 400

### ✅ resend
- **Status:** ✅ Working
- **Message:** Email sent successfully. Message ID: 0696ef1a-5997-4cb7-bdec-e2804218cc4a

### ✅ lemonSqueezy
- **Status:** ✅ Working
- **Message:** LemonSqueezy API accessible

### ⚠️ sendgrid
- **Status:** ⚠️ Configured But Not Used
- **Message:** SENDGRID_API_KEY found in env, but code uses RESEND_API_KEY instead

### ✅ anthropic
- **Status:** ✅ Working
- **Message:** Risk score: 40

### ✅ openai
- **Status:** ✅ Working
- **Message:** OpenAI API generating responses

### ✅ googleOAuth
- **Status:** ✅ Working
- **Message:** Google OAuth endpoint accessible

### ❌ slack
- **Status:** ❌ Failed
- **Message:** Webhook returned 404: no_team


## Summary
- ✅ Working: 7
- ⚠️ Not Configured: 2
- ❌ Failed: 1
