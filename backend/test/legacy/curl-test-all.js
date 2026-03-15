#!/usr/bin/env node
/**
 * Manual curl test runner - tests all endpoints one by one
 * Verifies 2xx responses where expected
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '.testdata.json');
const TD = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
const PORT = 3000;
const COOKIE = TD.cookie;

function request(method, route, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path: route,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(cookie ? { Cookie: cookie } : {}),
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = null;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: json || raw,
          });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function extractCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!Array.isArray(setCookie) || setCookie.length === 0) return '';
  return setCookie.map((cookie) => cookie.split(';')[0]).join('; ');
}

async function test(name, method, route, body, cookie, expectedStatus) {
  try {
    const result = await request(method, route, body, cookie);
    const status = result.status;
    const isSuccess = status >= 200 && status < 300;
    const isExpected = expectedStatus ? (Array.isArray(expectedStatus) ? expectedStatus.includes(status) : status === expectedStatus) : isSuccess;
    
    const icon = isExpected ? '✅' : '❌';
    const statusColor = isSuccess ? '2xx' : status >= 400 && status < 500 ? '4xx' : '5xx';
    
    console.log(`${icon} ${name}`);
    console.log(`   Status: ${status} (${statusColor})`);
    if (!isExpected) {
      console.log(`   Expected: ${expectedStatus || '2xx'}, Got: ${status}`);
      console.log(`   Response: ${JSON.stringify(result.body).substring(0, 200)}`);
    }
    console.log('');
    
    return { name, status, expected: expectedStatus || '2xx', passed: isExpected };
  } catch (err) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${err.message}`);
    console.log('');
    return { name, status: 'ERROR', expected: expectedStatus || '2xx', passed: false };
  }
}

async function runAll() {
  console.log('🧪 MANUAL CURL TEST - All Endpoints\n');
  console.log('='.repeat(60));
  console.log('');

  const results = [];

  // 1. Health Check
  console.log('📋 HEALTH & PLATFORM');
  console.log('-'.repeat(60));
  results.push(await test('GET /health', 'GET', '/health', null, null, 200));

  // 2. Auth - Login (to get fresh cookie)
  console.log('📋 AUTHENTICATION');
  console.log('-'.repeat(60));
  const loginResult = await request('POST', '/api/auth/login', {
    email: TD.email,
    password: TD.password,
  }, null);
  const freshCookie = extractCookie(loginResult.headers) || COOKIE;
  results.push(await test('POST /api/auth/login', 'POST', '/api/auth/login', {
    email: TD.email,
    password: TD.password,
  }, null, [200, 429]));

  // 3. Auth - Get Me
  results.push(await test('GET /api/auth/me', 'GET', '/api/auth/me', null, freshCookie, 200));

  // 4. Auth - Refresh (use fresh cookie from login - session should be active)
  // Note: refresh_token cookie has path='/api/auth/refresh', so it should be sent automatically
  // Skip if we got rate limited (429) on login - session might not be created
  if (loginResult.status === 200) {
    results.push(await test('POST /api/auth/refresh', 'POST', '/api/auth/refresh', null, freshCookie, 200));
  } else {
    console.log('⏭️  POST /api/auth/refresh - Skipped (login was rate limited)');
    console.log('');
  }

  // 5. Auth - Sessions
  results.push(await test('GET /api/auth/sessions', 'GET', '/api/auth/sessions', null, freshCookie, 200));

  // 6. Auth - Logout (this will revoke session)
  results.push(await test('POST /api/auth/logout', 'POST', '/api/auth/logout', null, freshCookie, 200));
  
  // Re-login after logout for remaining tests
  const reLogin = await request('POST', '/api/auth/login', {
    email: TD.email,
    password: TD.password,
  }, null);
  const newCookie = extractCookie(reLogin.headers) || COOKIE;

  // 7. Stripe - List Invoices
  console.log('📋 STRIPE');
  console.log('-'.repeat(60));
  results.push(await test('GET /api/stripe/invoices', 'GET', '/api/stripe/invoices?page=1&limit=10', null, newCookie, 200));

  // 8. Stripe - Get Invoice by ID
  if (TD.invoices?.[0]?.id) {
    results.push(await test('GET /api/stripe/invoices/:id', 'GET', `/api/stripe/invoices/${TD.invoices[0].id}`, null, newCookie, 200));
  }

  // 9. AI - Risk Score
  console.log('📋 AI SERVICES');
  console.log('-'.repeat(60));
  if (TD.customers?.[0]?.id) {
    results.push(await test('POST /api/ai/risk-score', 'POST', '/api/ai/risk-score', {
      customerId: TD.customers[0].id,
    }, newCookie, 200));
  }

  // 10. AI - Generate Email
  if (TD.customers?.[1]?.id && TD.invoices?.[4]?.id) {
    results.push(await test('POST /api/ai/generate-email', 'POST', '/api/ai/generate-email', {
      customerId: TD.customers[1].id,
      invoiceId: TD.invoices[4].id,
      customerName: 'Bob Smith',
      invoiceAmount: 2500,
      dueDate: new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10),
      daysOverdue: 45,
      riskScore: 82,
      previousReminders: 2,
      companyName: TD.companyName,
      paymentLink: 'https://pay.recoverai.test/inv-005',
    }, newCookie, 200));
  }

  // 11. AI - Recommend Plan
  if (TD.customers?.[1]?.id && TD.invoices?.[4]?.id) {
    results.push(await test('POST /api/ai/recommend-plan', 'POST', '/api/ai/recommend-plan', {
      customerId: TD.customers[1].id,
      invoiceId: TD.invoices[4].id,
      invoiceAmount: 2500,
      daysOverdue: 45,
      riskScore: 82,
      maxDurationDays: 90,
    }, newCookie, 200));
  }

  // 12. Policy - Approvals
  console.log('📋 POLICY & FEATURE FLAGS');
  console.log('-'.repeat(60));
  results.push(await test('GET /api/policy/approvals', 'GET', '/api/policy/approvals?status=pending', null, newCookie, 200));

  // 13. Feature Flags
  results.push(await test('GET /api/feature-flags', 'GET', '/api/feature-flags', null, newCookie, 200));

  // Summary
  console.log('='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('');

  if (failed > 0) {
    console.log('Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.name} - Expected ${r.expected}, Got ${r.status}`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

runAll().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});

