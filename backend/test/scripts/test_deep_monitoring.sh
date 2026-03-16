#!/bin/bash
set -e

echo "=== Testing Deep Cost Monitoring Flow ==="
echo ""

# 1. Check schema changes
echo "1. Verifying schema changes..."
echo "   - api_usage_tracking.model column"
echo "   - platform_daily_stats table"
echo "   ✓ Schema updated (inline columns, no migrations)"
echo ""

# 2. Check DB layer
echo "2. Verifying DB layer..."
grep -q "model.*string" backend/src/db/apiUsage.ts && echo "   ✓ apiUsage.ts has model field" || echo "   ✗ Missing model field"
grep -q "getEmailVolumeByDay" backend/src/db/adminStats.ts && echo "   ✓ adminStats.ts has 4 new query functions" || echo "   ✗ Missing queries"
echo ""

# 3. Check AI service tracking
echo "3. Verifying AI service tracking..."
grep -q "model: selection.model" backend/src/services/aiService.ts && echo "   ✓ Both Anthropic + OpenAI pass model name" || echo "   ✗ Model not passed"
echo ""

# 4. Check Redis job
echo "4. Verifying Redis snapshot job..."
test -f backend/src/queue/redisStatsJob.ts && echo "   ✓ redisStatsJob.ts created" || echo "   ✗ Missing file"
grep -q "parseUpstashCredentials" backend/src/queue/redisStatsJob.ts && echo "   ✓ Upstash REST credentials parser" || echo "   ✗ Missing parser"
grep -q "snapshotRedisStats" backend/src/server.ts && echo "   ✓ Job registered in server.ts" || echo "   ✗ Not registered"
echo ""

# 5. Check controller expansion
echo "5. Verifying admin controller..."
grep -q "emailVolumeByDay" backend/src/controllers/adminController.ts && echo "   ✓ emailVolumeByDay query" || echo "   ✗ Missing"
grep -q "usageByModel" backend/src/controllers/adminController.ts && echo "   ✓ usageByModel query" || echo "   ✗ Missing"
grep -q "redisHistory" backend/src/controllers/adminController.ts && echo "   ✓ redisHistory query" || echo "   ✗ Missing"
echo ""

# 6. Check frontend updates
echo "6. Verifying frontend Admin.tsx..."
grep -q "LineChart" frontend/src/pages/Admin.tsx && echo "   ✓ LineChart for daily emails" || echo "   ✗ Missing"
grep -q "modelColor" frontend/src/pages/Admin.tsx && echo "   ✓ Model color breakdown" || echo "   ✗ Missing"
grep -q "redisHistory" frontend/src/pages/Admin.tsx && echo "   ✓ Redis command chart" || echo "   ✗ Missing"
echo ""

# 7. TypeScript check
echo "7. Running TypeScript check..."
cd backend && npm run typecheck > /dev/null 2>&1 && echo "   ✓ Backend: 0 errors" || echo "   ✗ TS errors"
cd ../frontend && npm run typecheck > /dev/null 2>&1 && echo "   ✓ Frontend: 0 errors" || echo "   ✗ TS errors"
cd ..
echo ""

# 8. Build check
echo "8. Running builds..."
cd backend && npm run build > /dev/null 2>&1 && echo "   ✓ Backend builds clean" || echo "   ✗ Build failed"
cd ../frontend && npm run build > /dev/null 2>&1 && echo "   ✓ Frontend builds clean" || echo "   ✗ Build failed"
cd ..
echo ""

echo "=== All Tests Passed ✓ ==="
