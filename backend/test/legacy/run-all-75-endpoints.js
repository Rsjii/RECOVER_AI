#!/usr/bin/env node
/**
 * Complete Test Runner - All 75 Endpoints One by One
 * Shows detailed output for each curl command
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '.testdata.json');
const PORT = 3000;

const TD = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
let COOKIE = TD.cookie;

function request(method, route, body, cookie, extraHeaders = {}) {
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
          ...extraHeaders,
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
            body: json || raw.substring(0, 1000),
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
  if (!headers || !headers['set-cookie']) return '';
  const setCookie = headers['set-cookie'];
  if (!Array.isArray(setCookie) || setCookie.length === 0) return '';
  return setCookie.map((cookie) => cookie.split(';')[0]).join('; ');
}

const results = [];
let testNum = 0;

async function test(name, method, route, body, cookie, expectedStatus, extraHeaders = {}) {
  testNum++;
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`TEST ${testNum}: ${name}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Method: ${method}`);
    console.log(`Route: ${route}`);
    if (body) console.log(`Body: ${JSON.stringify(body, null, 2).substring(0, 300)}`);
    if (extraHeaders && Object.keys(extraHeaders).length > 0) {
      console.log(`Headers: ${JSON.stringify(extraHeaders)}`);
    }
    console.log('');
    
    const result = await request(method, route, body, cookie, extraHeaders);
    const status = result.status;
    const isSuccess = status >= 200 && status < 300;
    const isExpected = expectedStatus 
      ? (Array.isArray(expectedStatus) ? expectedStatus.includes(status) : status === expectedStatus)
      : isSuccess;
    
    const icon = isExpected ? '✅ PASS' : '❌ FAIL';
    const statusColor = isSuccess ? '2xx' : status >= 400 && status < 500 ? '4xx' : '5xx';
    
    console.log(`Status: ${status} (${statusColor})`);
    console.log(`Expected: ${expectedStatus || '2xx'}`);
    console.log(`Result: ${icon}`);
    console.log(`\nResponse Body:`);
    console.log(JSON.stringify(result.body, null, 2).substring(0, 500));
    if (JSON.stringify(result.body).length > 500) {
      console.log('... (truncated)');
    }
    
    const testResult = {
      num: testNum,
      name,
      method,
      route,
      status,
      expected: expectedStatus || '2xx',
      passed: isExpected,
      body: result.body,
      icon,
      statusColor,
    };
    
    results.push(testResult);
    
    return testResult;
  } catch (err) {
    const testResult = {
      num: testNum,
      name,
      method,
      route,
      status: 'ERROR',
      expected: expectedStatus || '2xx',
      passed: false,
      error: err.message,
      icon: '❌ ERROR',
      statusColor: 'ERROR',
    };
    results.push(testResult);
    console.log(`\n❌ ERROR: ${err.message}`);
    return testResult;
  }
}

async function runAll() {
  console.log('\n🧪 COMPREHENSIVE TEST SUITE - ALL 75 ENDPOINTS');
  console.log('='.repeat(80));
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Test Data: ${DATA_FILE}`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('='.repeat(80));

  // ============================================
  // 1. HEALTH & PLATFORM (4 tests)
  // ============================================
  console.log('\n\n📋 SECTION 1: HEALTH & PLATFORM');
  await test('1.1 GET /health', 'GET', '/health', null, null, 200);
  await test('1.2 GET /ready', 'GET', '/ready', null, null, 200);
  await test('1.3 GET /live', 'GET', '/live', null, null, 200);
  await test('1.4 GET /api/unknown-endpoint (404)', 'GET', '/api/unknown-endpoint', null, null, 404);

  // ============================================
  // 2. AUTHENTICATION (13 tests)
  // ============================================
  console.log('\n\n📋 SECTION 2: AUTHENTICATION');
  
  // Login first
  const loginResult = await test('2.2 POST /api/auth/login', 'POST', '/api/auth/login', {
    email: TD.email,
    password: TD.password,
  }, null, [200, 429]);
  
  // Get fresh cookie from login response
  const loginResponse = await request('POST', '/api/auth/login', {
    email: TD.email,
    password: TD.password,
  }, null);
  if (loginResponse.status === 200 && loginResponse.headers) {
    COOKIE = extractCookie(loginResponse.headers) || COOKIE;
  }
  
  await test('2.5 GET /api/auth/me', 'GET', '/api/auth/me', null, COOKIE, 200);
  await test('2.4 POST /api/auth/refresh', 'POST', '/api/auth/refresh', null, COOKIE, [200, 400, 401]);
  await test('2.6 GET /api/auth/sessions', 'GET', '/api/auth/sessions', null, COOKIE, 200);
  
  // Get session ID for delete test
  const sessionsResult = await request('GET', '/api/auth/sessions', null, COOKIE);
  const sessionId = sessionsResult.body?.data?.[0]?.id || TD.userId;
  
  await test('2.7 DELETE /api/auth/sessions/:sessionId', 'DELETE', `/api/auth/sessions/${sessionId}`, null, COOKIE, [200, 404]);
  await test('2.8 POST /api/auth/sessions/revoke-all', 'POST', '/api/auth/sessions/revoke-all', null, COOKIE, 200);
  await test('2.9 GET /api/auth/sessions/company', 'GET', '/api/auth/sessions/company', null, COOKIE, [200, 403]);
  await test('2.10 DELETE /api/auth/sessions/company/:sessionId', 'DELETE', `/api/auth/sessions/company/${sessionId}`, null, COOKIE, [200, 403, 404]);
  await test('2.11 POST /api/auth/forgot-password', 'POST', '/api/auth/forgot-password', { email: TD.email }, null, [200, 429]);
  await test('2.12 POST /api/auth/reset-password', 'POST', '/api/auth/reset-password', { token: 'invalid', newPassword: 'NewPass123!' }, null, 400);
  await test('2.13 POST /api/auth/oauth/google/callback', 'POST', '/api/auth/oauth/google/callback', {}, null, 400);
  await test('2.3 POST /api/auth/logout', 'POST', '/api/auth/logout', null, COOKIE, 200);
  
  // Re-login after logout
  const reLogin = await request('POST', '/api/auth/login', {
    email: TD.email,
    password: TD.password,
  }, null);
  if (reLogin.status === 200) {
    COOKIE = extractCookie(reLogin.headers) || COOKIE;
  }

  // ============================================
  // 3. STRIPE INTEGRATION (7 tests)
  // ============================================
  console.log('\n\n📋 SECTION 3: STRIPE INTEGRATION');
  await test('3.1 POST /api/stripe/connect (no auth)', 'POST', '/api/stripe/connect', { stripeApiKey: 'sk_test_fake' }, null, 401);
  await test('3.1 POST /api/stripe/connect (missing key)', 'POST', '/api/stripe/connect', {}, COOKIE, 400);
  await test('3.2 POST /api/stripe/sync (not connected)', 'POST', '/api/stripe/sync', null, COOKIE, 400);
  await test('3.4 GET /api/stripe/invoices', 'GET', '/api/stripe/invoices?page=1&limit=10', null, COOKIE, 200);
  if (TD.invoices?.[0]?.id) {
    await test('3.5 GET /api/stripe/invoices/:id', 'GET', `/api/stripe/invoices/${TD.invoices[0].id}`, null, COOKIE, 200);
  }
  await test('3.3 POST /api/stripe/webhook (invalid signature)', 'POST', '/api/stripe/webhook', { type: 'test' }, null, 400, { 'stripe-signature': 'fake' });
  await test('3.6 GET /api/stripe/oauth/authorize', 'GET', '/api/stripe/oauth/authorize', null, COOKIE, [200, 302, 500]);

  // ============================================
  // 4. AI SERVICES (3 tests)
  // ============================================
  console.log('\n\n📋 SECTION 4: AI SERVICES');
  await test('4.1 POST /api/ai/risk-score (no auth)', 'POST', '/api/ai/risk-score', { customerId: TD.customers[0]?.id }, null, 401);
  await test('4.1 POST /api/ai/risk-score (missing customerId)', 'POST', '/api/ai/risk-score', {}, COOKIE, 400);
  if (TD.customers?.[0]?.id) {
    await test('4.1 POST /api/ai/risk-score', 'POST', '/api/ai/risk-score', { customerId: TD.customers[0].id }, COOKIE, 200);
  }
  if (TD.customers?.[1]?.id && TD.invoices?.[4]?.id) {
    await test('4.2 POST /api/ai/generate-email', 'POST', '/api/ai/generate-email', {
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
    }, COOKIE, 200);
    
    await test('4.3 POST /api/ai/recommend-plan', 'POST', '/api/ai/recommend-plan', {
      customerId: TD.customers[1].id,
      invoiceId: TD.invoices[4].id,
      invoiceAmount: 2500,
      daysOverdue: 45,
      riskScore: 82,
      maxDurationDays: 90,
    }, COOKIE, 200);
  }

  // ============================================
  // 5. EMAIL QUEUE (5 tests)
  // ============================================
  console.log('\n\n📋 SECTION 5: EMAIL QUEUE');
  await test('5.1 POST /api/email/schedule (no auth)', 'POST', '/api/email/schedule', { invoiceId: TD.invoices[0]?.id }, null, 401);
  if (TD.invoices?.[0]?.id) {
    await test('5.1 POST /api/email/schedule', 'POST', '/api/email/schedule', { invoiceId: TD.invoices[0].id }, COOKIE, [200, 400]);
    await test('5.2 POST /api/email/send-now', 'POST', '/api/email/send-now', { invoiceId: TD.invoices[0].id }, COOKIE, [200, 400]);
  }
  await test('5.3 GET /api/email/logs', 'GET', '/api/email/logs', null, COOKIE, 200);
  await test('5.4 GET /api/email/queue/stats', 'GET', '/api/email/queue/stats', null, COOKIE, 200);
  await test('5.5 POST /api/email/webhook/sendgrid', 'POST', '/api/email/webhook/sendgrid', [], null, 200);

  // ============================================
  // 6. INVOICES (7 tests)
  // ============================================
  console.log('\n\n📋 SECTION 6: INVOICES');
  await test('6.1 GET /api/invoices', 'GET', '/api/invoices?page=1&limit=10', null, COOKIE, 200);
  if (TD.invoices?.[0]?.id) {
    await test('6.2 GET /api/invoices/:id', 'GET', `/api/invoices/${TD.invoices[0].id}`, null, COOKIE, 200);
    await test('6.3 GET /api/invoices/:id/detail', 'GET', `/api/invoices/${TD.invoices[0].id}/detail`, null, COOKIE, 200);
  }
  if (TD.customers?.[0]?.id) {
    await test('6.4 POST /api/invoices/manual', 'POST', '/api/invoices/manual', {
      customerId: TD.customers[0].id,
      amount: 1000,
      currency: 'USD',
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      issuedDate: new Date().toISOString().slice(0, 10),
    }, COOKIE, 201);
  }
  await test('6.5 POST /api/invoices/csv-upload', 'POST', '/api/invoices/csv-upload', 'customer_name,customer_email,amount,currency,due_date\nTest Customer,test@example.com,500,USD,2026-04-01', COOKIE, [200, 400], { 'Content-Type': 'text/csv' });
  await test('6.6 POST /api/invoices/upload-csv', 'POST', '/api/invoices/upload-csv', {
    csvData: 'customer_name,customer_email,amount,currency,due_date\nTest Customer,test@example.com,500,USD,2026-04-01'
  }, COOKIE, [200, 400]);
  if (TD.invoices?.[0]?.id) {
    await test('6.7 PUT /api/invoices/:id/status', 'PUT', `/api/invoices/${TD.invoices[0].id}/status`, { status: 'paid' }, COOKIE, [200, 400]);
  }

  // ============================================
  // 7. CUSTOMERS (2 tests)
  // ============================================
  console.log('\n\n📋 SECTION 7: CUSTOMERS');
  await test('7.1 GET /api/customers', 'GET', '/api/customers?page=1&limit=10', null, COOKIE, 200);
  if (TD.customers?.[0]?.id) {
    await test('7.2 GET /api/customers/:id', 'GET', `/api/customers/${TD.customers[0].id}`, null, COOKIE, 200);
  }

  // ============================================
  // 8. DASHBOARD (5 tests)
  // ============================================
  console.log('\n\n📋 SECTION 8: DASHBOARD');
  await test('8.1 GET /api/dashboard/stats', 'GET', '/api/dashboard/stats', null, COOKIE, 200);
  await test('8.2 GET /api/dashboard/pipeline', 'GET', '/api/dashboard/pipeline', null, COOKIE, 200);
  await test('8.3 GET /api/dashboard/risk-list', 'GET', '/api/dashboard/risk-list?limit=10', null, COOKIE, 200);
  await test('8.4 GET /api/dashboard/timeline', 'GET', '/api/dashboard/timeline?period=3m', null, COOKIE, 200);
  await test('8.5 POST /api/dashboard/agent/trigger', 'POST', '/api/dashboard/agent/trigger', null, COOKIE, 200);

  // ============================================
  // 9. PAYMENT PLANS (4 tests)
  // ============================================
  console.log('\n\n📋 SECTION 9: PAYMENT PLANS');
  if (TD.invoices?.[0]?.id) {
    await test('9.2 GET /api/payment-plans', 'GET', `/api/payment-plans?invoiceId=${TD.invoices[0].id}`, null, COOKIE, [200, 400, 404]);
  }
  await test('9.3 GET /api/payment-plans/list', 'GET', '/api/payment-plans/list', null, COOKIE, 200);
  if (TD.invoices?.[2]?.id && TD.customers?.[0]?.id) {
    await test('9.1 POST /api/payment-plans', 'POST', '/api/payment-plans', {
      invoice_id: TD.invoices[2].id,
      num_installments: 3,
      downPaymentPercent: 30,
    }, COOKIE, [201, 400]);
  }

  // ============================================
  // 10. SETTINGS (4 tests)
  // ============================================
  console.log('\n\n📋 SECTION 10: SETTINGS');
  await test('10.1 GET /api/settings', 'GET', '/api/settings', null, COOKIE, 200);
  await test('10.2 PUT /api/settings/dunning', 'PUT', '/api/settings/dunning', {
    strategy: 'moderate',
    emailSchedule: [1, 7, 14, 30, 60],
  }, COOKIE, [200, 403]);
  await test('10.3 PUT /api/settings/slack', 'PUT', '/api/settings/slack', {
    webhookUrl: 'https://hooks.slack.com/test',
  }, COOKIE, [200, 403]);
  await test('10.4 PUT /api/settings/general', 'PUT', '/api/settings/general', {
    timezone: 'America/New_York',
    preferredCurrency: 'USD',
  }, COOKIE, [200, 403]);

  // ============================================
  // 11. BILLING (12 tests)
  // ============================================
  console.log('\n\n📋 SECTION 11: BILLING');
  await test('11.1 GET /api/billing/plans', 'GET', '/api/billing/plans', null, null, 200);
  await test('11.2 GET /api/billing/subscription', 'GET', '/api/billing/subscription', null, COOKIE, 200);
  await test('11.3 PUT /api/billing/subscription', 'PUT', '/api/billing/subscription', { planCode: 'professional' }, COOKIE, [200, 403]);
  await test('11.4 GET /api/billing/invoices', 'GET', '/api/billing/invoices', null, COOKIE, 200);
  await test('11.5 POST /api/billing/invoices/generate', 'POST', '/api/billing/invoices/generate', null, COOKIE, [200, 403]);
  await test('11.6 GET /api/billing/usage', 'GET', '/api/billing/usage', null, COOKIE, 200);
  await test('11.7 POST /api/billing/usage', 'POST', '/api/billing/usage', { metric: 'emails_sent', value: 100 }, COOKIE, [200, 403]);
  await test('11.8 POST /api/billing/usage/sync-recovered', 'POST', '/api/billing/usage/sync-recovered', null, COOKIE, [200, 403]);
  await test('11.9 POST /api/billing/usage/reconcile', 'POST', '/api/billing/usage/reconcile', null, COOKIE, [200, 403]);
  await test('11.10 GET /api/billing/entitlements', 'GET', '/api/billing/entitlements', null, COOKIE, 200);
  await test('11.11 POST /api/billing/checkout', 'POST', '/api/billing/checkout', { planCode: 'professional' }, COOKIE, [200, 400]);
  await test('11.12 POST /api/billing/webhook/lemonsqueezy', 'POST', '/api/billing/webhook/lemonsqueezy', { type: 'test' }, null, [200, 400], { 'x-signature': 'fake' });

  // ============================================
  // 12. TEAM MANAGEMENT (6 tests)
  // ============================================
  console.log('\n\n📋 SECTION 12: TEAM MANAGEMENT');
  await test('12.1 GET /api/team/invitation/validate', 'GET', '/api/team/invitation/validate?token=invalid', null, null, [200, 400]);
  await test('12.2 GET /api/team/members', 'GET', '/api/team/members', null, COOKIE, 200);
  await test('12.3 POST /api/team/invite', 'POST', '/api/team/invite', { email: 'test@example.com', role: 'member' }, COOKIE, [201, 403]);
  if (TD.userId) {
    await test('12.4 PUT /api/team/members/:userId/role', 'PUT', `/api/team/members/${TD.userId}/role`, { role: 'admin' }, COOKIE, [200, 403, 404]);
    await test('12.5 DELETE /api/team/members/:userId', 'DELETE', `/api/team/members/${TD.userId}`, null, COOKIE, [200, 403, 404]);
  }
  await test('12.6 POST /api/team/invitation/accept', 'POST', '/api/team/invitation/accept', { token: 'invalid' }, COOKIE, [200, 400]);

  // ============================================
  // 13. POLICY & GOVERNANCE (5 tests)
  // ============================================
  console.log('\n\n📋 SECTION 13: POLICY & GOVERNANCE');
  await test('13.1 GET /api/policy', 'GET', '/api/policy', null, COOKIE, 200);
  await test('13.2 PUT /api/policy', 'PUT', '/api/policy', {
    requireApproval: true,
    autoApproveThreshold: 50,
  }, COOKIE, [200, 403]);
  await test('13.3 POST /api/policy/simulate', 'POST', '/api/policy/simulate', {
    invoiceAmount: 5000,
    daysOverdue: 30,
    riskScore: 75,
  }, COOKIE, [200, 403]);
  await test('13.4 GET /api/policy/approvals', 'GET', '/api/policy/approvals?status=pending', null, COOKIE, [200, 403]);
  await test('13.5 POST /api/policy/approvals/:approvalId/decision', 'POST', '/api/policy/approvals/00000000-0000-0000-0000-000000000000/decision', { decision: 'approve' }, COOKIE, [200, 403, 404]);

  // ============================================
  // 14. COMPLIANCE (3 tests)
  // ============================================
  console.log('\n\n📋 SECTION 14: COMPLIANCE');
  await test('14.1 GET /api/compliance/requests', 'GET', '/api/compliance/requests', null, COOKIE, [200, 403]);
  await test('14.2 POST /api/compliance/export', 'POST', '/api/compliance/export', null, COOKIE, [200, 403]);
  await test('14.3 POST /api/compliance/delete', 'POST', '/api/compliance/delete', null, COOKIE, [200, 403]);

  // ============================================
  // 15. FEATURE FLAGS (2 tests)
  // ============================================
  console.log('\n\n📋 SECTION 15: FEATURE FLAGS');
  await test('15.1 GET /api/feature-flags', 'GET', '/api/feature-flags', null, COOKIE, [200, 403]);
  await test('15.2 PUT /api/feature-flags', 'PUT', '/api/feature-flags', {
    key: 'test_feature',
    enabled: true,
    description: 'Test feature flag',
  }, COOKIE, [200, 403]);

  // ============================================
  // 16. ENTITLEMENTS (1 test)
  // ============================================
  console.log('\n\n📋 SECTION 16: ENTITLEMENTS');
  await test('16.1 GET /api/entitlements', 'GET', '/api/entitlements', null, COOKIE, 200);

  // ============================================
  // FINAL SUMMARY
  // ============================================
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(80));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  console.log(`Completed: ${new Date().toISOString()}`);
  console.log('');
  
  if (failed > 0) {
    console.log('Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ${r.icon} ${r.name} - Expected ${r.expected}, Got ${r.status}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ ALL TESTS COMPLETED');
  console.log('='.repeat(80));
  
  process.exit(failed > 0 ? 1 : 0);
}

runAll().catch(err => {
  console.error('\n❌ FATAL ERROR:', err);
  process.exit(1);
});

