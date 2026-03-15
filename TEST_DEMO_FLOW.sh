#!/bin/bash

# Test Demo Account Flow
# This script tests the complete demo account login and navigation flow

echo "🧪 Testing Demo Account Flow..."
echo ""

# Wait for servers to start
echo "⏳ Waiting for servers to be ready..."
sleep 3

# Test 1: Demo login endpoint
echo "1️⃣  Testing POST /api/demo/login (Create demo data)"
DEMO_RESPONSE=$(curl -s -X POST http://localhost:3000/api/demo/login \
  -H "Content-Type: application/json" \
  -c /tmp/cookies.txt)

DEMO_EMAIL=$(echo $DEMO_RESPONSE | jq -r '.user.email' 2>/dev/null)
DEMO_COMPANY=$(echo $DEMO_RESPONSE | jq -r '.company.name' 2>/dev/null)

if [ "$DEMO_EMAIL" = "demo@recoverai.com" ]; then
  echo "✅ Demo login successful"
  echo "   Email: $DEMO_EMAIL"
  echo "   Company: $DEMO_COMPANY"
else
  echo "❌ Demo login failed"
  echo "Response: $DEMO_RESPONSE"
  exit 1
fi

echo ""

# Test 2: Standard login with demo credentials
echo "2️⃣  Testing POST /api/auth/login (Login with demo@recoverai.com)"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@recoverai.com","password":"Demo1234!"}' \
  -c /tmp/login_cookies.txt)

LOGIN_EMAIL=$(echo $LOGIN_RESPONSE | jq -r '.user.email' 2>/dev/null)

if [ "$LOGIN_EMAIL" = "demo@recoverai.com" ]; then
  echo "✅ Demo account login successful"
  echo "   Email: $LOGIN_EMAIL"
else
  echo "❌ Demo account login failed"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo ""

# Test 3: Verify auth with cookies
echo "3️⃣  Testing GET /api/auth/me (Verify authenticated session)"
ME_RESPONSE=$(curl -s -X GET http://localhost:3000/api/auth/me \
  -b /tmp/login_cookies.txt)

ME_EMAIL=$(echo $ME_RESPONSE | jq -r '.user.email' 2>/dev/null)

if [ "$ME_EMAIL" = "demo@recoverai.com" ]; then
  echo "✅ Session authenticated"
  echo "   User: $ME_EMAIL"
else
  echo "❌ Session auth failed"
  echo "Response: $ME_RESPONSE"
  exit 1
fi

echo ""

# Test 4: Check demo data was created
echo "4️⃣  Testing GET /api/dashboard/stats (Verify demo data)"
STATS_RESPONSE=$(curl -s -X GET "http://localhost:3000/api/dashboard/stats" \
  -b /tmp/login_cookies.txt)

TOTAL_OWED=$(echo $STATS_RESPONSE | jq -r '.totalOwed' 2>/dev/null)

if [ ! -z "$TOTAL_OWED" ] && [ "$TOTAL_OWED" != "null" ]; then
  echo "✅ Demo data loaded successfully"
  echo "   Total owed: \$$TOTAL_OWED"
else
  echo "❌ Demo data not found"
  echo "Response: $STATS_RESPONSE"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ALL TESTS PASSED!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Demo Account Credentials:"
echo "   Email: demo@recoverai.com"
echo "   Password: Demo1234!"
echo ""
echo "🎯 Frontend Test Flow:"
echo "   1. Visit http://localhost:5173"
echo "   2. Click 'Try live demo' button OR"
echo "   3. Click 'Demo Account Login' (if added)"
echo "   4. Should redirect to /dashboard with demo data"
echo ""
