# Pilot Program Testing Guide (2026-03-24)

## Overview
This guide provides step-by-step instructions to validate the pilot program implementation.
**Total Time: 30-45 minutes**

---

## PHASE 1: BUILD VALIDATION ✅

### Test 1.1: Backend TypeScript Compilation
```bash
cd /c/dev/AGENTIC_AR/backend
npm run typecheck
```
**Expected**: ✅ 0 errors
**Status**: ✅ PASS

### Test 1.2: Frontend TypeScript Compilation & Build
```bash
cd /c/dev/AGENTIC_AR/frontend
npm run build
```
**Expected**: ✅ Clean build, 1186+ modules transformed
**Status**: ✅ PASS

---

## PHASE 2: FRONTEND VALIDATION (Manual Browser Testing)

### Test 2.1: Landing Page "Become a Pilot" Button
1. Start frontend dev server: `npm run dev`
2. Navigate to: http://localhost:5173
3. **Expected**: Hero section shows "Become a Pilot" button (not "Start free trial")
4. **Verify**: Button text, color, positioning

### Test 2.2: Pilot Request Modal
1. Click "Become a Pilot" button on landing page
2. **Expected**: Modal opens with form
3. **Verify fields**:
   - First Name (text input)
   - Last Name (text input)
   - Work Email (email input)
   - Company Name (text input)
   - Phone (tel input)
   - Invoices per Month (dropdown: 50-100, 100-500, 500-1000, 1000+)
   - "Apply for Pilot" button
   - Close button (X) in top right

### Test 2.3: Pilot Form Submission
1. Fill all fields with test data:
   ```
   First Name: John
   Last Name: Doe
   Email: john.doe@testcompany.com
   Company: TestCorp Inc
   Phone: +1-555-123-4567
   Invoices/Month: 500-1000
   ```
2. Click "Apply for Pilot"
3. **Expected**: Success message "You're In! 🎉"
4. **Verify**: Modal closes after 3 seconds
5. **Backend verification**: Check pilots table:
   ```sql
   SELECT * FROM pilots WHERE email = 'john.doe@testcompany.com';
   ```

### Test 2.4: Pricing Page CTA Update
1. Navigate to: http://localhost:5173/pricing
2. **Verify**:
   - Title: "Custom pricing based on your company size..."
   - NO explicit pricing numbers visible (✅)
   - NO tier names visible (✅)
   - NO recovery percentages visible (✅)
   - Main CTA: "Become a Pilot" button
   - Secondary CTA: "Contact Sales" link

---

## PHASE 3: BACKEND API VALIDATION

### Test 3.1: Pilot Request API (POST /api/pilots/request)
```bash
curl -X POST http://localhost:3000/api/pilots/request \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane.smith@example.com",
    "companyName": "Example Corp",
    "phone": "+1-555-987-6543",
    "invoicesPerMonth": "100-500"
  }'
```
**Expected Response**:
```json
{
  "success": true,
  "message": "Thanks for applying! We'll review your application and contact you within 24 hours.",
  "pilotId": "uuid-here"
}
```
**Verify**: Entry created in pilots table

### Test 3.2: Pilot Request Validation
1. **Missing fields test**:
   ```bash
   curl -X POST http://localhost:3000/api/pilots/request \
     -H "Content-Type: application/json" \
     -d '{"firstName": "Test"}'
   ```
   **Expected**: 400 error "Missing required fields"

2. **Duplicate email test**:
   ```bash
   # Try submitting same email twice
   curl -X POST http://localhost:3000/api/pilots/request \
     -H "Content-Type: application/json" \
     -d '{
       "firstName": "Jane",
       "lastName": "Smith",
       "email": "jane.smith@example.com",
       ...
     }'
   ```
   **Expected**: 409 error "Email already submitted"

### Test 3.3: Admin Create Pilot Company
```bash
# 1. Get JWT token (login as admin)
JWT=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}' \
  | jq -r '.token')

# 2. Create company
curl -X POST http://localhost:3000/api/admin/pilot-company \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pilot Test Corp",
    "email": "pilot@testcorp.com",
    "timezone": "America/New_York"
  }'
```
**Expected Response**:
```json
{
  "success": true,
  "companyId": "uuid-here",
  "company": {...}
}
```
**Verify**: companies table shows account_type='pilot', pilot_ends_at = NOW() + 3 months

### Test 3.4: Admin Create Pilot User
```bash
curl -X POST http://localhost:3000/api/admin/pilot-user \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": "company-uuid-from-test-3.3",
    "email": "user@pilotcorp.com",
    "firstName": "John",
    "lastName": "User",
    "role": "owner"
  }'
```
**Expected Response**:
```json
{
  "success": true,
  "userId": "uuid-here",
  "setupToken": "token-for-password-setup",
  "user": {...}
}
```
**Verify**:
- users table has new entry
- setup_token is generated
- email_verified = false

### Test 3.5: Setup Pilot Password
```bash
curl -X POST http://localhost:3000/api/pilots/setup-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "setup-token-from-test-3.4",
    "password": "VerySecurePassword123!"
  }'
```
**Expected Response**:
```json
{
  "success": true,
  "message": "Password set successfully. You can now log in.",
  "email": "user@pilotcorp.com"
}
```
**Verify**:
- users.password_hash is set
- users.email_verified = true
- users.setup_token = NULL

---

## PHASE 4: DATABASE VALIDATION

### Test 4.1: Pilots Table Structure
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'pilots'
ORDER BY ordinal_position;
```
**Expected columns**:
- id (UUID)
- first_name (VARCHAR)
- last_name (VARCHAR)
- email (VARCHAR, UNIQUE)
- company_name (VARCHAR)
- phone (VARCHAR)
- invoices_per_month (VARCHAR)
- status (VARCHAR)
- company_id (UUID, FK)
- created_at (TIMESTAMPTZ)
- approved_at (TIMESTAMPTZ)

### Test 4.2: Companies Table Pilot Columns
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'companies'
AND column_name IN ('account_type', 'pilot_ends_at');
```
**Expected**:
- account_type (VARCHAR, DEFAULT 'paid')
- pilot_ends_at (TIMESTAMPTZ)

### Test 4.3: Pilot Record Verification
```sql
SELECT
  p.id,
  p.email,
  p.status,
  c.account_type,
  c.pilot_ends_at
FROM pilots p
LEFT JOIN companies c ON p.company_id = c.id
WHERE p.email = 'jane.smith@example.com';
```
**Expected**: Single row with status='pending' and account_type='pilot'

---

## PHASE 5: INTEGRATION VALIDATION

### Test 5.1: End-to-End Pilot Flow
1. **Frontend**: Submit pilot request form → Success modal
2. **API**: Verify POST /api/pilots/request created record
3. **Admin**: Create company and user accounts
4. **User**: Use setup-password endpoint to set password
5. **Login**: User can login with new password

### Test 5.2: Pilot Account Restrictions
```bash
# Check that pilot company has no billing
curl -X GET http://localhost:3000/api/admin/company/company-uuid/billing \
  -H "Authorization: Bearer $JWT"
```
**Expected**: Billing disabled or $0 amount (free pilot)

---

## SUCCESS CRITERIA ✅

### Critical (Must Pass)
- [ ] Backend compiles: 0 TS errors
- [ ] Frontend builds: clean build
- [ ] Pilot modal renders on landing page
- [ ] Form submission succeeds
- [ ] Pilot request API works (POST /api/pilots/request)
- [ ] Admin company creation works
- [ ] Admin user creation works
- [ ] Password setup endpoint works
- [ ] pilots table has records
- [ ] companies.account_type = 'pilot' for test account

### Important (Should Pass)
- [ ] Pricing page updated with correct CTAs
- [ ] Form validation works (missing fields)
- [ ] Duplicate email prevention works
- [ ] Modal closes after successful submission
- [ ] Setup token expires after 24 hours
- [ ] Password hash stored securely

### Nice-to-Have
- [ ] Email notifications sent (TODO: not yet implemented)
- [ ] Slack notification sent to admin (TODO: not yet implemented)
- [ ] Pilot dashboard shows special banner (TODO: not yet implemented)

---

## ISSUE RESOLUTION

### Issue: "Cannot find module 'lucide-react'"
**Fix**: ✅ Already fixed - using inline SVG instead

### Issue: "showNotification not found"
**Fix**: ✅ Already fixed - using addToast from useNotification hook

### Issue: "DATABASE_URL not set"
**Fix**: Ensure DATABASE_URL is exported in shell or use Railway credentials

### Issue: "401 Unauthorized on /api/admin/* endpoints"
**Fix**: Ensure JWT token is valid and not expired

---

## NEXT STEPS (After Testing Passes)

1. **Deploy to Production**
   - Run migrations: `npm run migrate`
   - Deploy backend to Railway
   - Deploy frontend to Vercel

2. **Launch Pilot Program**
   - Post on Indie Hackers
   - Post on Twitter/X
   - Email network contacts
   - Monitor pilot applications

3. **Onboard First Pilots**
   - Review applications in pilots table
   - Create company + user records
   - Send setup password emails
   - Support first login

4. **Iterate Based on Feedback**
   - Collect pilot feedback
   - Fix bugs/UX issues
   - Document case study results
   - Prepare for broader launch

---

## Commands Reference

```bash
# Start backend dev server
cd backend && npm run dev

# Start frontend dev server
cd frontend && npm run dev

# Typecheck backend
npm run typecheck

# Build frontend
npm run build

# Run database migrations
npm run migrate

# Test pilot request API
curl -X POST http://localhost:3000/api/pilots/request \
  -H "Content-Type: application/json" \
  -d '{...}'

# Check pilots table
psql $DATABASE_URL -c "SELECT * FROM pilots LIMIT 5;"

# Check companies pilot flag
psql $DATABASE_URL -c "SELECT id, name, account_type, pilot_ends_at FROM companies WHERE account_type='pilot';"
```

---

**Document Generated**: 2026-03-24
**Total Changes**: 14 frontend/backend changes + database schema
**Test Coverage**: 5 phases, 25+ test cases
**Estimated Completion Time**: 2-3 weeks to first pilot customer
