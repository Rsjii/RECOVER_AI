#!/usr/bin/env node
/**
 * Comprehensive Test Runner - Tests ALL endpoints A-Z
 * Updates COMPREHENSIVE_TEST_CASES.md with results
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../fixtures/.testdata.json');
const RESULTS_FILE = path.join(__dirname, '../reports/COMPREHENSIVE_TEST_CASES.md');
const PORT = 3000;

// Load environment variables for Stripe API key
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const TD = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
const COOKIE = TD.cookie;

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
            body: json || raw.substring(0, 500),
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

const results = [];

async function test(name, method, route, body, cookie, expectedStatus, extraHeaders = {}, showResponse = false) {
  try {
    const result = await request(method, route, body, cookie, extraHeaders);
    const status = result.status;
    const isSuccess = status >= 200 && status < 300;
    const isExpected = expectedStatus 
      ? (Array.isArray(expectedStatus) ? expectedStatus.includes(status) : status === expectedStatus)
      : isSuccess;
    
    const icon = isExpected ? '✅' : '❌';
    const statusColor = isSuccess ? '2xx' : status >= 400 && status < 500 ? '4xx' : '5xx';
    
    const testResult = {
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
    
    console.log(`${icon} ${name}`);
    console.log(`   ${method} ${route}`);
    console.log(`   Status: ${status} (${statusColor})`);
    if (!isExpected) {
      console.log(`   Expected: ${expectedStatus || '2xx'}, Got: ${status}`);
    }
    
    // Show actual response for important endpoints
    if (showResponse && result.body && status >= 200 && status < 300) {
      console.log(`   📦 Response Body:`);
      try {
        const responseStr = typeof result.body === 'string' ? result.body : JSON.stringify(result.body, null, 2);
        // Limit output to 2000 chars to avoid overwhelming console
        const displayStr = responseStr.length > 2000 ? responseStr.substring(0, 2000) + '\n   ... (truncated)' : responseStr;
        const lines = displayStr.split('\n');
        lines.forEach(line => {
          console.log(`      ${line}`);
        });
      } catch (e) {
        console.log(`      ${result.body}`);
      }
    }
    console.log('');
    
    return testResult;
  } catch (err) {
    const testResult = {
      name,
      method,
      route,
      status: 'ERROR',
      expected: expectedStatus || '2xx',
      passed: false,
      error: err.message,
      icon: '❌',
      statusColor: 'ERROR',
    };
    results.push(testResult);
    console.log(`❌ ${name}`);
    console.log(`   Error: ${err.message}`);
    console.log('');
    return testResult;
  }
}

async function runAll() {
  console.log('🧪 COMPREHENSIVE TEST SUITE - ALL ENDPOINTS\n');
  console.log('='.repeat(70));
  console.log('');

  // ============================================
  // 1. HEALTH & PLATFORM
  // ============================================
  console.log('📋 1. HEALTH & PLATFORM');
  console.log('-'.repeat(70));
  await test('1.1 GET /health', 'GET', '/health', null, null, 200);
  await test('1.2 GET /ready', 'GET', '/ready', null, null, 200);
  await test('1.3 GET /live', 'GET', '/live', null, null, 200);
  await test('1.4 GET /api/unknown-endpoint (404)', 'GET', '/api/unknown-endpoint', null, null, 404);

  // ============================================
  // 2. AUTHENTICATION
  // ============================================
  console.log('📋 2. AUTHENTICATION');
  console.log('-'.repeat(70));
  
  // Login first to get fresh cookie - reuse this for all tests
  const loginResult = await request('POST', '/api/auth/login', {
    email: TD.email,
    password: TD.password,
  }, null);
  
  let freshCookie = COOKIE;
  if (loginResult.status === 200) {
    freshCookie = extractCookie(loginResult.headers) || COOKIE;
  }
  
  await test('2.2 POST /api/auth/login', 'POST', '/api/auth/login', {
    email: TD.email,
    password: TD.password,
  }, null, [200, 429]);
  
  await test('2.5 GET /api/auth/me', 'GET', '/api/auth/me', null, freshCookie, 200, {}, true);
  await test('2.4 POST /api/auth/refresh', 'POST', '/api/auth/refresh', null, freshCookie, [200, 400, 401]);
  await test('2.6 GET /api/auth/sessions', 'GET', '/api/auth/sessions', null, freshCookie, 200);
  await test('2.3 POST /api/auth/logout', 'POST', '/api/auth/logout', null, freshCookie, 200);
  
  // Re-login after logout - reuse cookie
  let newCookie = freshCookie;
  if (loginResult.status === 200) {
    const reLogin = await request('POST', '/api/auth/login', {
      email: TD.email,
      password: TD.password,
    }, null);
    if (reLogin.status === 200) {
      newCookie = extractCookie(reLogin.headers) || freshCookie;
    }
  }
  
  await test('2.7 DELETE /api/auth/sessions/:sessionId', 'DELETE', `/api/auth/sessions/${TD.userId}`, null, newCookie, [200, 404]);
  await test('2.8 POST /api/auth/sessions/revoke-all', 'POST', '/api/auth/sessions/revoke-all', null, newCookie, 200);
  await test('2.11 POST /api/auth/forgot-password', 'POST', '/api/auth/forgot-password', { email: TD.email }, null, [200, 429]);
  await test('2.13 POST /api/auth/oauth/google/callback', 'POST', '/api/auth/oauth/google/callback', {}, null, 400);

  // ============================================
  // 3. STRIPE
  // ============================================
  console.log('📋 3. STRIPE INTEGRATION');
  console.log('-'.repeat(70));
  
  // Reuse cookie for Stripe tests
  const stripeCookie = newCookie;
  
  await test('3.1 POST /api/stripe/connect (no auth)', 'POST', '/api/stripe/connect', { stripeApiKey: 'sk_test_fake' }, null, 401);
  await test('3.1 POST /api/stripe/connect (missing key)', 'POST', '/api/stripe/connect', {}, stripeCookie, 400);
  
  // Try actual Stripe connect if API key available
  const stripeApiKey = process.env.STRIPE_API_KEY;
  if (stripeApiKey && stripeApiKey.startsWith('sk_test_')) {
    const connectResult = await test('3.1 POST /api/stripe/connect (with API key)', 'POST', '/api/stripe/connect', { stripeApiKey }, stripeCookie, [200, 400], {}, true);
    if (connectResult.passed && connectResult.status === 200) {
      // If connect succeeded, try sync
      await test('3.2 POST /api/stripe/sync', 'POST', '/api/stripe/sync', null, stripeCookie, [200, 400], {}, true);
    }
  }
  
  await test('3.2 POST /api/stripe/sync (not connected)', 'POST', '/api/stripe/sync', null, stripeCookie, 400);
  await test('3.4 GET /api/stripe/invoices', 'GET', '/api/stripe/invoices?page=1&limit=10', null, stripeCookie, 200, {}, true);
  if (TD.invoices?.[0]?.id) {
    await test('3.5 GET /api/stripe/invoices/:id', 'GET', `/api/stripe/invoices/${TD.invoices[0].id}`, null, stripeCookie, 200, {}, true);
  }
  await test('3.3 POST /api/stripe/webhook (invalid signature)', 'POST', '/api/stripe/webhook', { type: 'test' }, null, 400, { 'stripe-signature': 'fake' });

  // ============================================
  // 4. AI SERVICES
  // ============================================
  console.log('📋 4. AI SERVICES');
  console.log('-'.repeat(70));
  
  const aiCookie = stripeCookie;
  
  await test('4.1 POST /api/ai/risk-score (no auth)', 'POST', '/api/ai/risk-score', { customerId: TD.customers[0].id }, null, 401);
  await test('4.1 POST /api/ai/risk-score (missing customerId)', 'POST', '/api/ai/risk-score', {}, aiCookie, 400);
  if (TD.customers?.[0]?.id) {
    await test('4.1 POST /api/ai/risk-score', 'POST', '/api/ai/risk-score', { customerId: TD.customers[0].id }, aiCookie, 200, {}, true);
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
    }, aiCookie, 200, {}, true);
    
    await test('4.3 POST /api/ai/recommend-plan', 'POST', '/api/ai/recommend-plan', {
      customerId: TD.customers[1].id,
      invoiceId: TD.invoices[4].id,
      invoiceAmount: 2500,
      daysOverdue: 45,
      riskScore: 82,
      maxDurationDays: 90,
    }, aiCookie, 200, {}, true);
  }

  // ============================================
  // 5. EMAIL QUEUE
  // ============================================
  console.log('📋 5. EMAIL QUEUE');
  console.log('-'.repeat(70));
  
  const emailCookie = aiCookie;
  
  await test('5.1 POST /api/email/schedule (no auth)', 'POST', '/api/email/schedule', { invoiceId: TD.invoices[0]?.id }, null, 401);
  if (TD.invoices?.[0]?.id) {
    await test('5.1 POST /api/email/schedule', 'POST', '/api/email/schedule', { invoiceId: TD.invoices[0].id }, emailCookie, [200, 400]);
    // Test email send-now with actual response
    const unpaidInvoice = TD.invoices.find(inv => inv.status === 'unpaid') || TD.invoices[0];
    if (unpaidInvoice?.id) {
      await test('5.2 POST /api/email/send-now', 'POST', '/api/email/send-now', { invoiceId: unpaidInvoice.id }, emailCookie, [200, 400], {}, true);
    }
  }
  await test('5.4 GET /api/email/queue/stats', 'GET', '/api/email/queue/stats', null, emailCookie, 200, {}, true);
  await test('5.3 GET /api/email/logs', 'GET', '/api/email/logs', null, emailCookie, 200, {}, true);
  await test('5.5 POST /api/email/webhook/sendgrid', 'POST', '/api/email/webhook/sendgrid', [], null, 200);

  // ============================================
  // 6. INVOICES
  // ============================================
  console.log('📋 6. INVOICES');
  console.log('-'.repeat(70));
  
  const invoiceCookie = emailCookie;
  
  await test('6.1 GET /api/invoices', 'GET', '/api/invoices?page=1&limit=10', null, invoiceCookie, 200, {}, true);
  if (TD.invoices?.[0]?.id) {
    await test('6.2 GET /api/invoices/:id', 'GET', `/api/invoices/${TD.invoices[0].id}`, null, invoiceCookie, 200, {}, true);
    await test('6.3 GET /api/invoices/:id/detail', 'GET', `/api/invoices/${TD.invoices[0].id}/detail`, null, invoiceCookie, 200, {}, true);
  }
  if (TD.customers?.[0]?.id) {
    await test('6.4 POST /api/invoices/manual', 'POST', '/api/invoices/manual', {
      customerId: TD.customers[0].id,
      amount: 1000,
      currency: 'USD',
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      issuedDate: new Date().toISOString().slice(0, 10),
    }, invoiceCookie, 201);
  }

  // ============================================
  // 7. CUSTOMERS
  // ============================================
  console.log('📋 7. CUSTOMERS');
  console.log('-'.repeat(70));
  
  const customerCookie = invoiceCookie;
  
  await test('7.1 GET /api/customers', 'GET', '/api/customers?page=1&limit=10', null, customerCookie, 200, {}, true);
  if (TD.customers?.[0]?.id) {
    await test('7.2 GET /api/customers/:id', 'GET', `/api/customers/${TD.customers[0].id}`, null, customerCookie, 200, {}, true);
  }

  // ============================================
  // 8. DASHBOARD
  // ============================================
  console.log('📋 8. DASHBOARD');
  console.log('-'.repeat(70));
  
  const dashboardCookie = customerCookie;
  
  await test('8.1 GET /api/dashboard/stats', 'GET', '/api/dashboard/stats', null, dashboardCookie, 200, {}, true);
  await test('8.2 GET /api/dashboard/pipeline', 'GET', '/api/dashboard/pipeline', null, dashboardCookie, 200, {}, true);
  await test('8.3 GET /api/dashboard/risk-list', 'GET', '/api/dashboard/risk-list?limit=10', null, dashboardCookie, 200, {}, true);
  await test('8.4 GET /api/dashboard/timeline', 'GET', '/api/dashboard/timeline?period=3m', null, dashboardCookie, 200, {}, true);
  await test('8.5 POST /api/dashboard/agent/trigger', 'POST', '/api/dashboard/agent/trigger', null, dashboardCookie, 200);

  // ============================================
  // 9. PAYMENT PLANS
  // ============================================
  console.log('📋 9. PAYMENT PLANS');
  console.log('-'.repeat(70));
  
  const planCookie = dashboardCookie;
  
  await test('9.1 GET /api/payment-plans/list', 'GET', '/api/payment-plans/list', null, planCookie, 200, {}, true);
  await test('9.2 GET /api/payment-plans', 'GET', '/api/payment-plans?invoiceId=' + (TD.invoices?.[0]?.id || ''), null, planCookie, [200, 400]);
  
  // Create payment plan for an unpaid invoice
  const unpaidInvoiceForPlan = TD.invoices.find(inv => inv.status === 'unpaid');
  if (unpaidInvoiceForPlan?.id) {
    const createPlanResult = await test('9.3 POST /api/payment-plans (create)', 'POST', '/api/payment-plans', {
      invoiceId: unpaidInvoiceForPlan.id,
      numInstallments: 3
    }, planCookie, [201, 400], {}, true);
    
    // If plan created, test status update (cancel/defaulted)
    if (createPlanResult.passed && createPlanResult.status === 201 && createPlanResult.body?.data?.id) {
      const planId = createPlanResult.body.data.id;
      await test('9.4 PATCH /api/payment-plans/:id/status (defaulted)', 'PATCH', `/api/payment-plans/${planId}/status`, {
        status: 'defaulted'
      }, planCookie, 200, {}, true);
    }
  }

  // ============================================
  // 10. SETTINGS
  // ============================================
  console.log('📋 10. SETTINGS');
  console.log('-'.repeat(70));
  
  const settingsCookie = planCookie;
  
  await test('10.1 GET /api/settings', 'GET', '/api/settings', null, settingsCookie, 200, {}, true);

  // ============================================
  // 11. BILLING
  // ============================================
  console.log('📋 11. BILLING');
  console.log('-'.repeat(70));
  
  await test('11.1 GET /api/billing/plans', 'GET', '/api/billing/plans', null, null, 200);
  
  const billingCookie = settingsCookie;
  
  await test('11.2 GET /api/billing/subscription', 'GET', '/api/billing/subscription', null, billingCookie, 200, {}, true);
  await test('11.4 GET /api/billing/invoices', 'GET', '/api/billing/invoices', null, billingCookie, 200, {}, true);
  await test('11.6 GET /api/billing/usage', 'GET', '/api/billing/usage', null, billingCookie, 200, {}, true);
  await test('11.10 GET /api/billing/entitlements', 'GET', '/api/billing/entitlements', null, billingCookie, 200, {}, true);

  // ============================================
  // 12. TEAM
  // ============================================
  console.log('📋 12. TEAM MANAGEMENT');
  console.log('-'.repeat(70));
  
  const teamCookie = billingCookie;
  
  await test('12.2 GET /api/team/members', 'GET', '/api/team/members', null, teamCookie, 200);

  // ============================================
  // 13. POLICY
  // ============================================
  console.log('📋 13. POLICY & GOVERNANCE');
  console.log('-'.repeat(70));
  
  const policyCookie = teamCookie;
  
  await test('13.1 GET /api/policy', 'GET', '/api/policy', null, policyCookie, 200);
  await test('13.4 GET /api/policy/approvals', 'GET', '/api/policy/approvals?status=pending', null, policyCookie, [200, 403]);

  // ============================================
  // 14. COMPLIANCE
  // ============================================
  console.log('📋 14. COMPLIANCE');
  console.log('-'.repeat(70));
  
  const complianceCookie = policyCookie;
  
  await test('14.1 GET /api/compliance/requests', 'GET', '/api/compliance/requests', null, complianceCookie, [200, 403]);

  // ============================================
  // 15. FEATURE FLAGS
  // ============================================
  console.log('📋 15. FEATURE FLAGS');
  console.log('-'.repeat(70));
  
  const flagsCookie = complianceCookie;
  
  await test('15.1 GET /api/feature-flags', 'GET', '/api/feature-flags', null, flagsCookie, [200, 403]);

  // ============================================
  // 16. ENTITLEMENTS
  // ============================================
  console.log('📋 16. ENTITLEMENTS');
  console.log('-'.repeat(70));
  
  const entitlementsCookie = flagsCookie;
  
  await test('16.1 GET /api/entitlements', 'GET', '/api/entitlements', null, entitlementsCookie, 200);

  // ============================================
  // SUMMARY
  // ============================================
  console.log('='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  console.log('');
  
  if (failed > 0) {
    console.log('Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.name} - Expected ${r.expected}, Got ${r.status}`);
      if (r.error) console.log(`     Error: ${r.error}`);
    });
  }
  
  // Update MD file
  updateMDfile();
  
  process.exit(failed > 0 ? 1 : 0);
}

function updateMDfile() {
  // Create report file if it doesn't exist
  if (!fs.existsSync(RESULTS_FILE)) {
    const dir = path.dirname(RESULTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(RESULTS_FILE, '# Comprehensive Test Cases\n\n## Test Results\n\n');
  }
  
  let mdContent = fs.readFileSync(RESULTS_FILE, 'utf-8');
  
  // Update each test result
  results.forEach(result => {
    const testNum = result.name.match(/^(\d+\.\d+)/)?.[1];
    if (!testNum) return;
    
    // Find the test case in MD
    const regex = new RegExp(`(### ${testNum.replace('.', '\\.')} [^\\n]+\\n[^#]*Status: )⏳ Pending`, 'g');
    const statusIcon = result.passed ? '✅' : '❌';
    const statusText = result.passed ? 'Passed' : `Failed (Expected ${result.expected}, Got ${result.status})`;
    
    mdContent = mdContent.replace(regex, `$1${statusIcon} ${statusText}`);
  });
  
  // Update summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  mdContent = mdContent.replace(
    /- \*\*Total Endpoints:\*\* ~\d+/,
    `- **Total Endpoints:** ${total}`
  );
  mdContent = mdContent.replace(
    /- \*\*Tested:\*\* \d+/,
    `- **Tested:** ${total}`
  );
  mdContent = mdContent.replace(
    /- \*\*Passed:\*\* \d+/,
    `- **Passed:** ${passed}`
  );
  mdContent = mdContent.replace(
    /- \*\*Failed:\*\* \d+/,
    `- **Failed:** ${failed}`
  );
  
  fs.writeFileSync(RESULTS_FILE, mdContent);
  console.log(`\n✅ Updated ${RESULTS_FILE} with test results`);
}

runAll().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});

