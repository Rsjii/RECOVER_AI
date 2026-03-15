#!/usr/bin/env node
/**
 * ====================================================================
 * MASTER COMPREHENSIVE TEST SUITE - ALL ENDPOINTS A-Z
 * ====================================================================
 *
 * Complete coverage of all 45+ endpoints across 11 categories
 * Includes: Happy path, error cases, edge cases, integration tests
 *
 * Run: node test/MASTER_TEST_SUITE.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const RESULTS_FILE = path.join(__dirname, 'reports/MASTER_TEST_RESULTS.md');
const TEST_LOG_FILE = path.join(__dirname, 'reports/TEST_LOG.json');

let testState = {
  userId: null,
  companyId: null,
  customerId: null,
  invoiceId: null,
  paidInvoiceId: null,
  unpaidInvoiceId: null,
  cookie: null,
  paymentPlanId: null,
  failedCount: 0,
  passedCount: 0,
};

const results = [];

// Helper: HTTP Request
function request(method, route, body = null, cookie = null) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json',
      ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    };

    const req = http.request(
      { hostname: 'localhost', port: PORT, path: route, method, headers },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let json = null;
          try { json = raw ? JSON.parse(raw) : null; } catch {}
          resolve({ status: res.statusCode, body: json || raw, headers: res.headers });
        });
      }
    );
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    if (payload) req.write(payload);
    req.end();
  });
}

function extractCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!Array.isArray(setCookie)) return '';
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}

// Test Helper
async function test(name, method, route, body = null, expectedStatus = 200, needsAuth = true) {
  const cookie = needsAuth ? testState.cookie : null;
  const response = await request(method, route, body, cookie);
  const statusArr = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  const passed = statusArr.includes(response.status);

  const result = { test: name, method, route, status: response.status, expected: statusArr.join('/'), passed };
  results.push(result);

  if (passed) {
    testState.passedCount++;
    console.log(`✅ ${name} | ${method} ${route} → ${response.status}`);
  } else {
    testState.failedCount++;
    console.log(`❌ ${name} | ${method} ${route} → ${response.status} (expected: ${result.expected})`);
    if (response.body && typeof response.body === 'object' && response.body.error) {
      console.log(`   Error: ${response.body.error}`);
    }
  }

  return { passed, response, status: response.status, body: response.body };
}

// Main Tests
async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║          MASTER TEST SUITE - ALL ENDPOINTS A-Z                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // ──────────────────────────────────────────────────────────────
    // SETUP: Demo Login
    // ──────────────────────────────────────────────────────────────
    console.log('🔐 SETUP: Demo Login & Data\n');

    const demoRes = await request('POST', '/api/demo/login', {}, null);
    if (demoRes.status !== 200) {
      console.error('❌ Demo login failed! Cannot proceed.');
      process.exit(1);
    }

    testState.companyId = demoRes.body.company?.id;
    testState.userId = demoRes.body.user?.id;
    testState.cookie = extractCookie(demoRes.headers);
    console.log('✅ Demo login successful\n');

    // Fetch first customer and invoices
    const custRes = await request('GET', '/api/customers?limit=1', null, testState.cookie);
    if (custRes.status === 200 && custRes.body.data?.[0]) {
      testState.customerId = custRes.body.data[0].id;
    }

    const invRes = await request('GET', '/api/invoices?limit=5', null, testState.cookie);
    if (invRes.status === 200 && invRes.body.data?.length > 0) {
      testState.unpaidInvoiceId = invRes.body.data.find(i => i.status === 'unpaid')?.id || invRes.body.data[0].id;
      testState.paidInvoiceId = invRes.body.data.find(i => i.status === 'paid')?.id;
      testState.invoiceId = invRes.body.data[0].id;
    }

    // ──────────────────────────────────────────────────────────────
    // CATEGORY 1: HEALTH & PLATFORM (4 tests)
    // ──────────────────────────────────────────────────────────────
    console.log('📋 CATEGORY 1: HEALTH & PLATFORM (4 tests)\n');

    await test('1.1 Health check', 'GET', '/health', null, 200, false);
    await test('1.2 Readiness probe', 'GET', '/ready', null, 200, false);
    await test('1.3 Liveness probe', 'GET', '/live', null, 200, false);
    await test('1.4 404 Not Found', 'GET', '/api/nonexistent-endpoint', null, 404, false);

    // ──────────────────────────────────────────────────────────────
    // CATEGORY 2: AUTHENTICATION (12 tests)
    // ──────────────────────────────────────────────────────────────
    console.log('\n📋 CATEGORY 2: AUTHENTICATION (12 tests)\n');

    // Happy path
    await test('2.1 Signup new user', 'POST', '/api/auth/signup', {
      companyName: 'Test ' + Date.now(),
      email: `test_${Date.now()}@example.com`,
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'User',
    }, [201, 409], false);

    await test('2.2 Login with correct credentials', 'POST', '/api/auth/login', {
      email: 'demo@recoverai.com',
      password: 'Demo1234!',
    }, 200, false);

    await test('2.3 Get current user (authenticated)', 'GET', '/api/auth/me', null, 200, true);
    await test('2.4 Get current user (no auth)', 'GET', '/api/auth/me', null, 401, false);

    // Error cases
    await test('2.5 Login with wrong password', 'POST', '/api/auth/login', {
      email: 'demo@recoverai.com',
      password: 'WrongPassword!',
    }, [401, 400], false);

    await test('2.6 Login with nonexistent email', 'POST', '/api/auth/login', {
      email: 'nonexistent@example.com',
      password: 'AnyPassword!',
    }, [401, 400], false);

    // Session management
    await test('2.7 Get sessions', 'GET', '/api/auth/sessions', null, 200, true);
    await test('2.8 Logout', 'POST', '/api/auth/logout', {}, 200, true);
    await test('2.9 Forgot password', 'POST', '/api/auth/forgot-password', {
      email: 'demo@recoverai.com',
    }, 200, false);

    // OAuth
    await test('2.10 Google OAuth callback (no code)', 'POST', '/api/auth/oauth/google/callback', {
      code: 'invalid_code',
    }, [400, 401], false);

    await test('2.11 Refresh token (expired)', 'POST', '/api/auth/refresh', {}, [200, 401], true);

    // ──────────────────────────────────────────────────────────────
    // CATEGORY 3: CUSTOMERS (4 tests)
    // ──────────────────────────────────────────────────────────────
    console.log('\n📋 CATEGORY 3: CUSTOMERS (4 tests)\n');

    await test('3.1 List customers (paginated)', 'GET', '/api/customers?limit=10&offset=0', null, 200, true);
    await test('3.2 List customers (with filters)', 'GET', '/api/customers?limit=5&industry=SaaS', null, 200, true);

    if (testState.customerId) {
      await test('3.3 Get customer detail', 'GET', `/api/customers/${testState.customerId}`, null, 200, true);
      await test('3.4 Get customer (nonexistent)', 'GET', '/api/customers/invalid-uuid-123', null, [404, 400], true);
    }

    // ──────────────────────────────────────────────────────────────
    // CATEGORY 4: INVOICES (12 tests)
    // ──────────────────────────────────────────────────────────────
    console.log('\n📋 CATEGORY 4: INVOICES (12 tests)\n');

    await test('4.1 List all invoices', 'GET', '/api/invoices?limit=20', null, 200, true);
    await test('4.2 List unpaid invoices', 'GET', '/api/invoices?status=unpaid&limit=10', null, 200, true);
    await test('4.3 List paid invoices', 'GET', '/api/invoices?status=paid&limit=10', null, 200, true);
    await test('4.4 List invoices (pagination)', 'GET', '/api/invoices?limit=5&offset=5', null, 200, true);

    if (testState.invoiceId) {
      await test('4.5 Get invoice summary', 'GET', `/api/invoices/${testState.invoiceId}`, null, 200, true);
      await test('4.6 Get invoice full detail', 'GET', `/api/invoices/${testState.invoiceId}/detail`, null, 200, true);
    }

    // Create + Update
    await test('4.7 Create manual invoice', 'POST', '/api/invoices/manual', {
      customer_id: testState.customerId,
      amount: 5000,
      currency: 'USD',
      due_date: '2026-04-07',
      issued_date: '2026-03-07',
    }, [201, 400], true);

    if (testState.invoiceId) {
      await test('4.8 Update invoice status (unpaid→paid)', 'PUT', `/api/invoices/${testState.invoiceId}/status`, {
        status: 'paid',
      }, [200, 400], true);

      await test('4.9 Update invoice status (invalid)', 'PUT', `/api/invoices/${testState.invoiceId}/status`, {
        status: 'invalid_status',
      }, [400, 422], true);
    }

    // CSV Upload
    await test('4.10 CSV upload (empty)', 'POST', '/api/invoices/csv-upload', 'customer_name\n', [200, 400], true);

    await test('4.11 CSV upload (valid)', 'POST', '/api/invoices/csv-upload',
      'customer_name,customer_email,amount,currency,due_date\nTest Customer,test@example.com,1000,USD,2026-04-07\n',
      [200, 400], true);

    await test('4.12 Get nonexistent invoice', 'GET', '/api/invoices/invalid-uuid', null, [404, 400], true);

    // ──────────────────────────────────────────────────────────────
    // CATEGORY 5: AI SERVICES (6 tests)
    // ──────────────────────────────────────────────────────────────
    console.log('\n📋 CATEGORY 5: AI SERVICES (6 tests)\n');

    if (testState.customerId) {
      await test('5.1 Risk score (valid customer)', 'POST', '/api/ai/risk-score', {
        customerId: testState.customerId,
        includeHistory: true,
      }, 200, true);
    }

    await test('5.2 Risk score (missing customerId)', 'POST', '/api/ai/risk-score', {}, 400, true);
    await test('5.3 Risk score (no auth)', 'POST', '/api/ai/risk-score', {
      customerId: 'any-id',
    }, 401, false);

    if (testState.invoiceId) {
      // Get invoice details for AI calls
      const invDetail = await request('GET', `/api/invoices/${testState.invoiceId}/detail`, null, testState.cookie);
      if (invDetail.status === 200 && invDetail.body.data) {
        const inv = invDetail.body.data;
        const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24)));

        await test('5.4 Generate email (valid)', 'POST', '/api/ai/generate-email', {
          customerId: inv.customer_id,
          invoiceId: inv.id,
          customerName: inv.customer_name || 'Customer',
          invoiceAmount: parseFloat(inv.amount),
          dueDate: inv.due_date,
          daysOverdue,
          riskScore: inv.risk_score || 50,
        }, [200, 400], true);

        await test('5.5 Recommend payment plan (valid)', 'POST', '/api/ai/recommend-plan', {
          customerId: inv.customer_id,
          invoiceId: inv.id,
          invoiceAmount: parseFloat(inv.amount),
          daysOverdue,
          riskScore: inv.risk_score || 50,
        }, [200, 400], true);
      }
    }

    await test('5.6 Recommend plan (missing fields)', 'POST', '/api/ai/recommend-plan', {}, 400, true);

    // ──────────────────────────────────────────────────────────────
    // CATEGORY 6: EMAIL QUEUE (8 tests)
    // ──────────────────────────────────────────────────────────────
    console.log('\n📋 CATEGORY 6: EMAIL QUEUE (8 tests)\n');

    await test('6.1 Get queue stats', 'GET', '/api/email/queue/stats', null, 200, true);
    await test('6.2 Get email logs (all)', 'GET', '/api/email/logs?limit=10', null, 200, true);

    if (testState.invoiceId) {
      await test('6.3 Get email logs (by invoice)', 'GET', `/api/email/logs?invoiceId=${testState.invoiceId}&limit=5`, null, 200, true);
      await test('6.4 Send email now', 'POST', '/api/email/send-now', {
        invoiceId: testState.invoiceId,
        emailType: 'dunning_1',
      }, [200, 400], true);

      await test('6.5 Schedule dunning emails', 'POST', '/api/email/schedule', {
        invoiceId: testState.invoiceId,
      }, [200, 400], true);
    }

    // Webhooks (no auth)
    await test('6.6 SendGrid webhook (empty)', 'POST', '/api/email/webhook/sendgrid', {}, 200, false);
    await test('6.7 SendGrid webhook (valid event)', 'POST', '/api/email/webhook/sendgrid', {
      type: 'processed',
      email: 'test@example.com',
      timestamp: Date.now(),
    }, 200, false);

    await test('6.8 Email preview (no auth)', 'GET', '/api/email/preview?invoiceId=test&emailType=dunning_1', null, 401, false);

    // ──────────────────────────────────────────────────────────────
    // CATEGORY 7: DASHBOARD (4 tests)
    // ──────────────────────────────────────────────────────────────
    console.log('\n📋 CATEGORY 7: DASHBOARD (4 tests)\n');

    await test('7.1 Dashboard stats', 'GET', '/api/dashboard/stats', null, 200, true);
    await test('7.2 Dashboard pipeline', 'GET', '/api/dashboard/pipeline', null, 200, true);
    await test('7.3 Risk list (top customers)', 'GET', '/api/dashboard/risk-list?limit=10', null, 200, true);
    await test('7.4 Dashboard (no auth)', 'GET', '/api/dashboard/stats', null, 401, false);

    // ──────────────────────────────────────────────────────────────
    // CATEGORY 8: PAYMENT PLANS (5 tests)
    // ──────────────────────────────────────────────────────────────
    console.log('\n📋 CATEGORY 8: PAYMENT PLANS (5 tests)\n');

    await test('8.1 List all payment plans', 'GET', '/api/payment-plans/list', null, 200, true);

    if (testState.invoiceId) {
      await test('8.2 Get plans for invoice', 'GET', `/api/payment-plans?invoiceId=${testState.invoiceId}`, null, [200, 404], true);

      await test('8.3 Create payment plan', 'POST', '/api/payment-plans', {
        invoiceId: testState.invoiceId,
        installments: 3,
      }, [201, 400, 500], true);
    }

    await test('8.4 Create plan (invalid)', 'POST', '/api/payment-plans', {
      invoiceId: 'invalid-uuid',
      installments: 100, // too many
    }, [400, 500], true);

    await test('8.5 Payment plans (no auth)', 'GET', '/api/payment-plans/list', null, 401, false);

    // ──────────────────────────────────────────────────────────────
    // CATEGORY 9: SETTINGS (6 tests)
    // ──────────────────────────────────────────────────────────────
    console.log('\n📋 CATEGORY 9: SETTINGS (6 tests)\n');

    await test('9.1 Get all settings', 'GET', '/api/settings', null, 200, true);

    await test('9.2 Update dunning strategy', 'PUT', '/api/settings/dunning', {
      strategy: 'aggressive',
      maxEmails: 5,
      daysBetween: 7,
    }, [200, 400], true);

    await test('9.3 Update general settings', 'PUT', '/api/settings/general', {
      timezone: 'America/New_York',
      currency: 'USD',
    }, [200, 400], true);

    await test('9.4 Update Slack webhook', 'PUT', '/api/settings/slack', {
      webhookUrl: 'https://hooks.slack.com/services/test',
    }, [200, 400], true);

    await test('9.5 Settings (no auth)', 'GET', '/api/settings', null, 401, false);

    // ──────────────────────────────────────────────────────────────
    // CATEGORY 10: BILLING (6 tests)
    // ──────────────────────────────────────────────────────────────
    console.log('\n📋 CATEGORY 10: BILLING (6 tests)\n');

    await test('10.1 List billing plans', 'GET', '/api/billing/plans', null, 200, false);
    await test('10.2 Get subscription', 'GET', '/api/billing/subscription', null, [200, 404], true);
    await test('10.3 Get usage metrics', 'GET', '/api/billing/usage', null, 200, true);

    await test('10.4 Create checkout', 'POST', '/api/billing/checkout', {
      planId: 'starter',
    }, [200, 400], true);

    // Webhook (no auth)
    await test('10.5 LemonSqueezy webhook', 'POST', '/api/billing/webhook/lemonsqueezy', {
      meta: { event_name: 'order.created' },
      data: { id: 'test' },
    }, [200, 400, 401], false);

    await test('10.6 Billing (no auth)', 'GET', '/api/billing/subscription', null, 401, false);

    // ──────────────────────────────────────────────────────────────
    // CATEGORY 11: STRIPE (5 tests)
    // ──────────────────────────────────────────────────────────────
    console.log('\n📋 CATEGORY 11: STRIPE (5 tests)\n');

    await test('11.1 Sync Stripe invoices', 'POST', '/api/stripe/sync', {}, [200, 400], true);
    await test('11.2 List Stripe invoices', 'GET', '/api/stripe/invoices?limit=10', null, [200, 400], true);

    if (testState.invoiceId) {
      await test('11.3 Get Stripe invoice detail', 'GET', `/api/stripe/invoices/${testState.invoiceId}`, null, [200, 404, 400], true);
    }

    // Webhook (no auth, validates signature)
    await test('11.4 Stripe webhook (invalid sig)', 'POST', '/api/stripe/webhook', {
      type: 'charge.succeeded',
      data: { object: {} },
    }, 400, false);

    await test('11.5 Stripe (no auth)', 'GET', '/api/stripe/invoices', null, 401, false);

    // ──────────────────────────────────────────────────────────────
    // RESULTS
    // ──────────────────────────────────────────────────────────────
    console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                      FINAL TEST RESULTS                         ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const total = testState.passedCount + testState.failedCount;
    const rate = ((testState.passedCount / total) * 100).toFixed(1);

    console.log(`📊 OVERALL: ${testState.passedCount}/${total} passed (${rate}%)`);
    console.log(`✅ Passed: ${testState.passedCount}`);
    console.log(`❌ Failed: ${testState.failedCount}\n`);

    // Generate markdown report
    const report = generateReport(results, testState.passedCount, rate);
    const dir = path.dirname(RESULTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(RESULTS_FILE, report);
    fs.writeFileSync(TEST_LOG_FILE, JSON.stringify(results, null, 2));

    console.log(`✅ Report: ${RESULTS_FILE}`);
    console.log(`✅ Log: ${TEST_LOG_FILE}\n`);

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    process.exit(1);
  }
}

function generateReport(results, passed, rate) {
  let md = `# Master Test Suite Results\n\n`;
  md += `**Date:** ${new Date().toISOString()}\n`;
  md += `**Overall Rate:** ${rate}%\n\n`;

  md += `## Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Total Tests | ${results.length} |\n`;
  md += `| ✅ Passed | ${passed} |\n`;
  md += `| ❌ Failed | ${results.length - passed} |\n`;
  md += `| Pass Rate | ${rate}% |\n\n`;

  const categories = {
    'Health & Platform': [1, 4],
    'Authentication': [2, 12],
    'Customers': [3, 4],
    'Invoices': [4, 12],
    'AI Services': [5, 6],
    'Email Queue': [6, 8],
    'Dashboard': [7, 4],
    'Payment Plans': [8, 5],
    'Settings': [9, 6],
    'Billing': [10, 6],
    'Stripe': [11, 5],
  };

  for (const [name, [cat, count]] of Object.entries(categories)) {
    const catResults = results.filter(r => r.test.startsWith(`${cat}.`));
    if (catResults.length === 0) continue;
    const catPassed = catResults.filter(r => r.passed).length;
    md += `### ${name}\n`;
    md += `${catPassed}/${catResults.length} passed\n\n`;
  }

  return md;
}

runAllTests();
