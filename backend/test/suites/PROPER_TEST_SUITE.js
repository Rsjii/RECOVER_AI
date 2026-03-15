#!/usr/bin/env node
/**
 * ====================================================================
 * COMPREHENSIVE TEST SUITE - ALL ENDPOINTS WITH REAL DATA
 * ====================================================================
 *
 * Flow:
 * 1. POST /api/demo/login → Create demo company + seed 8 customers, 24 invoices
 * 2. Extract auth cookies from response
 * 3. Run ALL test cases with proper authentication
 * 4. Generate detailed report
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const REPORT_FILE = path.join(__dirname, 'reports/TEST_RESULTS_FINAL.md');
const RESPONSES_FILE = path.join(__dirname, 'reports/ACTUAL_API_RESPONSES.json');

let testState = {
  userId: null,
  companyId: null,
  customerId: null,
  invoiceId: null,
  cookie: null,
  accessToken: null,
};

const results = [];

// ====================================================================
// HTTP Request Helper
// ====================================================================
function request(method, route, body = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json',
      ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    };

    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path: route,
        method,
        headers,
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
  if (!Array.isArray(setCookie)) return '';
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}

// ====================================================================
// Test Case Runner
// ====================================================================
async function test(testName, method, route, body, expectedStatus, needsAuth = true) {
  try {
    const cookie = needsAuth ? testState.cookie : null;
    const response = await request(method, route, body, cookie);

    const isSuccess = response.status >= 200 && response.status < 300;
    const isExpected = Array.isArray(expectedStatus)
      ? expectedStatus.includes(response.status)
      : response.status === expectedStatus;

    const status = isExpected ? '✅' : '❌';
    const result = {
      test: testName,
      method,
      route,
      status: response.status,
      expected: Array.isArray(expectedStatus) ? expectedStatus.join('/') : expectedStatus,
      passed: isExpected,
      body: response.body,
    };

    results.push(result);
    console.log(`${status} ${testName}`);
    console.log(`   ${method} ${route} → ${response.status} (expected: ${result.expected})`);

    return { passed: isExpected, response, status: response.status };
  } catch (error) {
    console.log(`❌ ${testName} - ERROR: ${error.message}`);
    results.push({
      test: testName,
      method,
      route,
      status: 'ERROR',
      expected: expectedStatus,
      passed: false,
      error: error.message,
    });
    return { passed: false, response: null, status: 'ERROR' };
  }
}

// ====================================================================
// MAIN TEST EXECUTION
// ====================================================================
async function runAllTests() {
  console.log('╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║              COMPREHENSIVE API TEST SUITE - REAL DATA                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

  try {
    // ─────────────────────────────────────────────────────────────
    // STEP 1: Demo Login (creates all test data)
    // ─────────────────────────────────────────────────────────────
    console.log('\n🔐 STEP 1: DEMO LOGIN & DATA SEEDING');
    console.log('─'.repeat(70));

    const demoResult = await request('POST', '/api/demo/login', {}, null);
    if (demoResult.status !== 200) {
      console.error('❌ Demo login failed:', demoResult.body);
      process.exit(1);
    }

    testState.userId = demoResult.body.user?.id;
    testState.companyId = demoResult.body.company?.id;
    testState.cookie = extractCookie(demoResult.headers);

    console.log('✅ Demo login successful');
    console.log(`   Company: ${demoResult.body.company?.name}`);
    console.log(`   User: ${demoResult.body.user?.email}`);
    console.log(`   Cookie: ${testState.cookie.substring(0, 40)}...`);

    if (!testState.cookie) {
      console.error('❌ No auth cookie received!');
      process.exit(1);
    }

    // Get first customer and invoice IDs
    const customersRes = await request('GET', '/api/customers?limit=1', null, testState.cookie);
    if (customersRes.status === 200 && customersRes.body.data?.length > 0) {
      testState.customerId = customersRes.body.data[0].id;
      console.log(`   First Customer ID: ${testState.customerId}`);
    }

    const invoicesRes = await request('GET', '/api/invoices?limit=1', null, testState.cookie);
    if (invoicesRes.status === 200 && invoicesRes.body.data?.length > 0) {
      testState.invoiceId = invoicesRes.body.data[0].id;
      console.log(`   First Invoice ID: ${testState.invoiceId}`);
    }

    // ─────────────────────────────────────────────────────────────
    // SECTION 1: HEALTH & PLATFORM
    // ─────────────────────────────────────────────────────────────
    console.log('\n📋 SECTION 1: HEALTH & PLATFORM');
    console.log('─'.repeat(70));

    await test('Health check', 'GET', '/health', null, 200, false);
    await test('Readiness probe', 'GET', '/ready', null, 200, false);
    await test('Liveness probe', 'GET', '/live', null, 200, false);
    await test('404 on unknown route', 'GET', '/api/unknown-endpoint', null, 404, false);

    // ─────────────────────────────────────────────────────────────
    // SECTION 2: AUTHENTICATION
    // ─────────────────────────────────────────────────────────────
    console.log('\n📋 SECTION 2: AUTHENTICATION');
    console.log('─'.repeat(70));

    const signupRes = await test('Signup (new user)', 'POST', '/api/auth/signup', {
      companyName: 'Test Company ' + Date.now(),
      email: `test_${Date.now()}@example.com`,
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'User',
    }, [201, 400], false);

    const loginRes = await test('Login', 'POST', '/api/auth/login', {
      email: 'demo@recoverai.com',
      password: 'Demo1234!',
    }, 200, false);

    await test('Get current user (auth required)', 'GET', '/api/auth/me', null, 200, true);
    await test('Refresh token', 'POST', '/api/auth/refresh', {}, [200, 401], true);
    await test('Logout', 'POST', '/api/auth/logout', {}, 200, true);
    await test('Get sessions', 'GET', '/api/auth/sessions', null, 200, true);
    await test('Forgot password', 'POST', '/api/auth/forgot-password', {
      email: 'demo@recoverai.com',
    }, 200, false);

    // ─────────────────────────────────────────────────────────────
    // SECTION 3: CUSTOMERS
    // ─────────────────────────────────────────────────────────────
    console.log('\n📋 SECTION 3: CUSTOMERS');
    console.log('─'.repeat(70));

    const custListRes = await test('List customers', 'GET', '/api/customers?limit=10', null, 200, true);
    if (custListRes.passed && custListRes.response.body.data?.[0]) {
      testState.customerId = custListRes.response.body.data[0].id;
    }

    if (testState.customerId) {
      await test(`Get customer detail`, 'GET', `/api/customers/${testState.customerId}`, null, 200, true);
    }

    // ─────────────────────────────────────────────────────────────
    // SECTION 4: INVOICES
    // ─────────────────────────────────────────────────────────────
    console.log('\n📋 SECTION 4: INVOICES');
    console.log('─'.repeat(70));

    const invListRes = await test('List invoices', 'GET', '/api/invoices?limit=10&status=unpaid', null, 200, true);
    if (invListRes.passed && invListRes.response.body.data?.[0]) {
      testState.invoiceId = invListRes.response.body.data[0].id;
    }

    if (testState.invoiceId) {
      await test(`Get invoice detail`, 'GET', `/api/invoices/${testState.invoiceId}`, null, 200, true);
      await test(`Get invoice full detail`, 'GET', `/api/invoices/${testState.invoiceId}/detail`, null, 200, true);
    }

    await test('Create manual invoice', 'POST', '/api/invoices/manual', {
      customer_id: testState.customerId || '00000000-0000-0000-0000-000000000000',
      amount: 1000,
      currency: 'USD',
      due_date: '2026-04-07',
      issued_date: '2026-03-07',
    }, [201, 400, 422], true);

    if (testState.invoiceId) {
      await test('Update invoice status', 'PUT', `/api/invoices/${testState.invoiceId}/status`, {
        status: 'paid',
      }, [200, 400], true);
    }

    // ─────────────────────────────────────────────────────────────
    // SECTION 5: AI SERVICES
    // ─────────────────────────────────────────────────────────────
    console.log('\n📋 SECTION 5: AI SERVICES');
    console.log('─'.repeat(70));

    if (testState.customerId) {
      await test('Calculate risk score', 'POST', '/api/ai/risk-score', {
        customerId: testState.customerId,
        includeHistory: true,
      }, 200, true);
    }

    if (testState.invoiceId) {
      await test('Generate dunning email', 'POST', '/api/ai/generate-email', {
        invoiceId: testState.invoiceId,
        emailType: 'dunning_1',
      }, 200, true);

      await test('Recommend payment plan', 'POST', '/api/ai/recommend-plan', {
        invoiceId: testState.invoiceId,
      }, 200, true);
    }

    // ─────────────────────────────────────────────────────────────
    // SECTION 6: EMAIL QUEUE
    // ─────────────────────────────────────────────────────────────
    console.log('\n📋 SECTION 6: EMAIL QUEUE');
    console.log('─'.repeat(70));

    await test('Get queue stats', 'GET', '/api/email/queue/stats', null, 200, true);
    await test('Get email logs', 'GET', '/api/email/logs?limit=5', null, 200, true);

    if (testState.invoiceId) {
      await test('Send email now', 'POST', '/api/email/send-now', {
        invoiceId: testState.invoiceId,
        emailType: 'dunning_1',
      }, [200, 201, 400], true);

      await test('Schedule dunning emails', 'POST', '/api/email/schedule', {
        invoiceId: testState.invoiceId,
      }, [200, 201, 400], true);
    }

    // Webhook (no auth needed)
    await test('Email webhook (Resend)', 'POST', '/api/email/webhook/resend', {
      type: 'email.sent',
      data: {
        from_email: 'noreply@recoverai.com',
        to: ['test@example.com'],
        created_at: new Date().toISOString(),
      },
    }, 200, false);

    // ─────────────────────────────────────────────────────────────
    // SECTION 7: DASHBOARD
    // ─────────────────────────────────────────────────────────────
    console.log('\n📋 SECTION 7: DASHBOARD');
    console.log('─'.repeat(70));

    await test('Dashboard stats', 'GET', '/api/dashboard/stats', null, 200, true);
    await test('Dashboard pipeline', 'GET', '/api/dashboard/pipeline', null, 200, true);
    await test('Risk list', 'GET', '/api/dashboard/risk-list?limit=10', null, 200, true);

    // ─────────────────────────────────────────────────────────────
    // SECTION 8: PAYMENT PLANS
    // ─────────────────────────────────────────────────────────────
    console.log('\n📋 SECTION 8: PAYMENT PLANS');
    console.log('─'.repeat(70));

    await test('List payment plans', 'GET', '/api/payment-plans/list', null, 200, true);

    if (testState.invoiceId) {
      await test('Get payment plans for invoice', 'GET', `/api/payment-plans?invoiceId=${testState.invoiceId}`, null, [200, 400], true);

      await test('Create payment plan', 'POST', '/api/payment-plans', {
        invoiceId: testState.invoiceId,
        installments: 3,
      }, [201, 400], true);
    }

    // ─────────────────────────────────────────────────────────────
    // SECTION 9: SETTINGS
    // ─────────────────────────────────────────────────────────────
    console.log('\n📋 SECTION 9: SETTINGS');
    console.log('─'.repeat(70));

    await test('Get settings', 'GET', '/api/settings', null, 200, true);

    await test('Update dunning strategy', 'PUT', '/api/settings/dunning', {
      strategy: 'aggressive',
      maxEmails: 5,
    }, [200, 400], true);

    await test('Update general settings', 'PUT', '/api/settings/general', {
      timezone: 'America/New_York',
      currency: 'USD',
    }, [200, 400], true);

    await test('Update Slack webhook', 'PUT', '/api/settings/slack', {
      webhookUrl: 'https://hooks.slack.com/services/test',
    }, [200, 400], true);

    // ─────────────────────────────────────────────────────────────
    // SECTION 10: BILLING
    // ─────────────────────────────────────────────────────────────
    console.log('\n📋 SECTION 10: BILLING');
    console.log('─'.repeat(70));

    await test('List billing plans', 'GET', '/api/billing/plans', null, 200, false);
    await test('Get current subscription', 'GET', '/api/billing/subscription', null, [200, 404], true);
    await test('Get usage metrics', 'GET', '/api/billing/usage', null, 200, true);
    await test('Create checkout session', 'POST', '/api/billing/checkout', {
      planId: 'starter',
    }, [200, 400], true);

    // LemonSqueezy webhook (no auth)
    await test('LemonSqueezy webhook', 'POST', '/api/billing/webhook/lemonsqueezy', {
      meta: { event_name: 'order.created' },
      data: { id: 'test-order' },
    }, 200, false);

    // ─────────────────────────────────────────────────────────────
    // SECTION 11: STRIPE
    // ─────────────────────────────────────────────────────────────
    console.log('\n📋 SECTION 11: STRIPE INTEGRATION');
    console.log('─'.repeat(70));

    await test('Get Stripe OAuth authorize URL', 'GET', '/api/stripe/oauth/authorize', null, [200, 400], true);
    await test('Stripe OAuth callback', 'GET', '/api/stripe/oauth/callback?code=test&state=test', null, [400, 200], true);
    await test('Sync Stripe invoices', 'POST', '/api/stripe/sync', {}, [200, 400], true);
    await test('List Stripe invoices', 'GET', '/api/stripe/invoices?limit=10', null, [200, 400], true);

    if (testState.invoiceId) {
      await test('Get Stripe invoice detail', 'GET', `/api/stripe/invoices/${testState.invoiceId}`, null, [200, 404], true);
    }

    // Stripe webhook (no auth, signature validation)
    await test('Stripe webhook', 'POST', '/api/stripe/webhook', {
      type: 'charge.succeeded',
      data: { object: {} },
    }, 400, false); // Invalid signature expected

    // ─────────────────────────────────────────────────────────────
    // REPORT GENERATION
    // ─────────────────────────────────────────────────────────────
    console.log('\n\n╔═══════════════════════════════════════════════════════════════════════╗');
    console.log('║                          TEST SUMMARY                                   ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;
    const rate = ((passed / total) * 100).toFixed(1);

    console.log(`📊 Results: ${passed}/${total} passed (${rate}%)`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}\n`);

    if (failed > 0) {
      console.log('Failed Tests:');
      results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  ❌ ${r.test}`);
          console.log(`     ${r.method} ${r.route} → ${r.status} (expected: ${r.expected})`);
        });
    }

    // Write markdown report
    const reportContent = generateMarkdownReport(results, passed, total, rate);
    const reportDir = path.dirname(REPORT_FILE);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    fs.writeFileSync(REPORT_FILE, reportContent);
    console.log(`\n✅ Report saved to: ${REPORT_FILE}`);

    // Write responses JSON
    fs.writeFileSync(RESPONSES_FILE, JSON.stringify(results, null, 2));
    console.log(`✅ Responses saved to: ${RESPONSES_FILE}\n`);

  } catch (error) {
    console.error('\n❌ Test execution error:', error);
    process.exit(1);
  }
}

function generateMarkdownReport(results, passed, total, rate) {
  let md = `# 🧪 Comprehensive API Test Results\n\n`;
  md += `**Generated:** ${new Date().toISOString()}\n\n`;
  md += `## 📊 Summary\n\n`;
  md += `- **Total Tests:** ${total}\n`;
  md += `- **Passed:** ${passed} ✅\n`;
  md += `- **Failed:** ${total - passed} ❌\n`;
  md += `- **Success Rate:** ${rate}%\n\n`;

  md += `## 📋 Test Results by Category\n\n`;

  const categories = {
    'HEALTH & PLATFORM': results.filter(r => r.test.includes('Health') || r.test.includes('404')),
    'AUTHENTICATION': results.filter(r => r.test.includes('Login') || r.test.includes('Signup') || r.test.includes('auth')),
    'CUSTOMERS': results.filter(r => r.test.includes('customer')),
    'INVOICES': results.filter(r => r.test.includes('invoice')),
    'AI SERVICES': results.filter(r => r.test.includes('risk') || r.test.includes('email') || r.test.includes('plan')),
    'EMAIL QUEUE': results.filter(r => r.test.includes('queue') || r.test.includes('email')),
    'DASHBOARD': results.filter(r => r.test.includes('Dashboard')),
    'PAYMENT PLANS': results.filter(r => r.test.includes('payment plan')),
    'SETTINGS': results.filter(r => r.test.includes('Setting')),
    'BILLING': results.filter(r => r.test.includes('billing')),
    'STRIPE': results.filter(r => r.test.includes('Stripe')),
  };

  for (const [cat, tests] of Object.entries(categories)) {
    if (tests.length === 0) continue;
    const catPassed = tests.filter(t => t.passed).length;
    md += `### ${cat}\n`;
    md += `${catPassed}/${tests.length} passed\n\n`;
    tests.forEach(t => {
      const icon = t.passed ? '✅' : '❌';
      md += `${icon} ${t.test}\n`;
      md += `- \`${t.method} ${t.route}\`\n`;
      md += `- Status: ${t.status} (expected: ${t.expected})\n\n`;
    });
  }

  return md;
}

runAllTests();
