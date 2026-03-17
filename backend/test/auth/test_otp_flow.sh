#!/bin/bash

API="http://localhost:3000/api"

echo "=== TEST 1: Create new user (signup) ==="
SIGNUP=$(curl -s -X POST $API/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email":"testflow_'$(date +%s)'@test.com",
    "password":"Test1234!",
    "companyName":"TestFlow Inc"
  }')

echo $SIGNUP | jq '.'
TOKEN=$(echo $SIGNUP | jq -r '.data.tokens.access // empty')
USER_ID=$(echo $SIGNUP | jq -r '.data.user.id // empty')
EMAIL=$(echo $SIGNUP | jq -r '.data.user.email // empty')

if [ -z "$TOKEN" ] || [ -z "$USER_ID" ]; then
  echo "❌ Signup failed"
  exit 1
fi

echo ""
echo "✅ Signup successful"
echo "Token: ${TOKEN:0:20}..."
echo "Email: $EMAIL"
echo "UserID: $USER_ID"

echo ""
echo "=== TEST 2: Check user status (should have emailVerified: false) ==="
curl -s -X GET $API/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq '.data | {id, email, emailVerified}'

echo ""
echo "=== TEST 3: Try accessing dashboard (should fail if emailVerified check is enforced) ==="
echo "Note: Can't test full dashboard without frontend, but check auth would work"

echo ""
echo "=== TEST 4: Resend OTP ==="
RESEND=$(curl -s -X POST $API/auth/resend-otp \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\"}")
echo $RESEND | jq '.'

echo ""
echo "=== TEST 5: Get OTP from database (for testing) ==="
echo "Note: In real flow, user receives OTP in email"
echo "For testing, checking what's stored..."

