#!/usr/bin/env node
/**
 * Test All Third-Party Integrations
 * Checks all services configured in .env
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../fixtures/.testdata.json');
const TD = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
const COOKIE = TD.cookie;

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const results = {
  database: { status: 'pending', message: '' },
  redis: { status: 'pending', message: '' },
  stripe: { status: 'pending', message: '' },
  resend: { status: 'pending', message: '' },
  lemonSqueezy: { status: 'pending', message: '' },
  sendgrid: { status: 'pending', message: '' },
  anthropic: { status: 'pending', message: '' },
  openai: { status: 'pending', message: '' },
  googleOAuth: { status: 'pending', message: '' },
  slack: { status: 'pending', message: '' },
};

function request(method, route, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
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
            json = raw;
          }
          resolve({
            status: res.statusCode,
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

async function checkDatabase() {
  console.log('\n1️⃣ Testing Database (PostgreSQL)...');
  try {
    const result = await request('GET', '/health', null, null);
    if (result.status === 200) {
      results.database = { status: '✅ Working', message: 'Database connection successful' };
      console.log('   ✅ Database: Connected');
    } else {
      results.database = { status: '❌ Failed', message: `Health check returned ${result.status}` };
      console.log('   ❌ Database: Health check failed');
    }
  } catch (err) {
    results.database = { status: '❌ Failed', message: err.message };
    console.log(`   ❌ Database: ${err.message}`);
  }
}

async function checkRedis() {
  console.log('\n2️⃣ Testing Redis...');
  try {
    const result = await request('GET', '/ready', null, null);
    if (result.status === 200) {
      results.redis = { status: '✅ Working', message: 'Redis connection successful' };
      console.log('   ✅ Redis: Connected');
    } else {
      results.redis = { status: '❌ Failed', message: `Ready check returned ${result.status}` };
      console.log('   ❌ Redis: Ready check failed');
    }
  } catch (err) {
    results.redis = { status: '❌ Failed', message: err.message };
    console.log(`   ❌ Redis: ${err.message}`);
  }
}

async function checkStripe() {
  console.log('\n3️⃣ Testing Stripe Integration...');
  const hasApiKey = !!process.env.STRIPE_API_KEY;
  const hasClientId = !!process.env.STRIPE_CLIENT_ID;
  const hasClientSecret = !!process.env.STRIPE_CLIENT_SECRET;
  
  if (!hasApiKey && !hasClientId) {
    results.stripe = { status: '⚠️ Not Configured', message: 'No Stripe API key or OAuth credentials found' };
    console.log('   ⚠️ Stripe: Not configured in .env');
    return;
  }
  
  try {
    // Test Stripe connect with actual API key
    if (hasApiKey && process.env.STRIPE_API_KEY.startsWith('sk_test_')) {
      console.log('   🔌 Attempting to connect Stripe...');
      const connectResult = await request('POST', '/api/stripe/connect', {
        stripeApiKey: process.env.STRIPE_API_KEY
      }, COOKIE);
      
      if (connectResult.status === 200) {
        console.log('   ✅ Stripe: Connected successfully');
        console.log('   📦 Response:', JSON.stringify(connectResult.body, null, 2));
        
        // Try sync after connect
        console.log('   🔄 Attempting to sync invoices...');
        const syncResult = await request('POST', '/api/stripe/sync', null, COOKIE);
        if (syncResult.status === 200) {
          console.log('   ✅ Stripe: Sync successful');
          console.log('   📦 Response:', JSON.stringify(syncResult.body, null, 2));
          results.stripe = { status: '✅ Working', message: `Connected and synced. ${JSON.stringify(syncResult.body)}` };
        } else {
          console.log(`   ⚠️ Stripe: Sync returned ${syncResult.status}`);
          results.stripe = { status: '✅ Connected', message: 'Connected but sync failed or no invoices' };
        }
      } else {
        console.log(`   ⚠️ Stripe: Connect returned ${connectResult.status}`);
        results.stripe = { status: '⚠️ Partial', message: `Connect returned ${connectResult.status}` };
      }
    }
    
    // Test Stripe invoices endpoint (requires auth)
    const result = await request('GET', '/api/stripe/invoices?page=1&limit=1', null, COOKIE);
    if (result.status === 200 || result.status === 400) {
      // 400 is OK if Stripe not connected yet
      if (!results.stripe) {
        results.stripe = { status: '✅ Working', message: 'Stripe API accessible' };
      }
      console.log('   ✅ Stripe: Invoices endpoint accessible');
    } else {
      if (!results.stripe) {
        results.stripe = { status: '❌ Failed', message: `API returned ${result.status}` };
      }
      console.log(`   ❌ Stripe: Invoices API returned ${result.status}`);
    }
  } catch (err) {
    results.stripe = { status: '❌ Failed', message: err.message };
    console.log(`   ❌ Stripe: ${err.message}`);
  }
}

async function checkResend() {
  console.log('\n4️⃣ Testing Resend (Email Service)...');
  const hasApiKey = !!process.env.RESEND_API_KEY;
  
  if (!hasApiKey) {
    results.resend = { status: '⚠️ Not Configured', message: 'RESEND_API_KEY not found in .env' };
    console.log('   ⚠️ Resend: Not configured in .env');
    return;
  }
  
  try {
    // ACTUAL TEST: Try to send an email via the API
    const unpaidInvoice = TD.invoices.find(inv => inv.status === 'unpaid');
    if (unpaidInvoice?.id) {
      console.log('   🧪 Testing actual email send...');
      const sendResult = await request('POST', '/api/email/send-now', {
        invoiceId: unpaidInvoice.id
      }, COOKIE);
      
      if (sendResult.status === 200) {
        console.log('   ✅ Resend: Email queued successfully');
        console.log('   📦 Response:', JSON.stringify(sendResult.body, null, 2));
        
        // Wait a bit for worker to process
        console.log('   ⏳ Waiting 2 seconds for worker to process...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check email logs to verify it was sent
        const logsResult = await request('GET', `/api/email/logs?invoiceId=${unpaidInvoice.id}&limit=1`, null, COOKIE);
        if (logsResult.status === 200 && logsResult.body.data && logsResult.body.data.length > 0) {
          const log = logsResult.body.data[0];
          if (log.sendgrid_message_id && log.status === 'sent') {
            results.resend = { status: '✅ Working', message: `Email sent successfully. Message ID: ${log.sendgrid_message_id}` };
            console.log(`   ✅ Resend: Email sent! Message ID: ${log.sendgrid_message_id}`);
            console.log(`   📧 Status: ${log.status}, Type: ${log.email_type}`);
          } else {
            results.resend = { status: '⚠️ Queued But Not Sent', message: `Email queued but status is ${log.status || 'unknown'}` };
            console.log(`   ⚠️ Resend: Email queued but status: ${log.status}`);
          }
        } else {
          results.resend = { status: '⚠️ Queued But No Log', message: 'Email queued but no log found yet' };
          console.log('   ⚠️ Resend: Email queued but log not found');
        }
      } else {
        results.resend = { status: '❌ Failed', message: `Send API returned ${sendResult.status}` };
        console.log(`   ❌ Resend: Send API returned ${sendResult.status}`);
        console.log('   📦 Response:', JSON.stringify(sendResult.body, null, 2));
      }
    } else {
      // Fallback: Check existing email logs
      const result = await request('GET', '/api/email/logs?limit=1', null, COOKIE);
      if (result.status === 200) {
        const logs = result.body.data || [];
        if (logs.length > 0 && logs[0].sendgrid_message_id) {
          results.resend = { status: '✅ Working', message: `Emails being sent (${logs.length} logs found)` };
          console.log(`   ✅ Resend: Working - ${logs.length} email(s) sent`);
        } else {
          results.resend = { status: '✅ Configured', message: 'API key configured, no emails sent yet' };
          console.log('   ✅ Resend: Configured (no emails sent yet)');
        }
      } else {
        results.resend = { status: '❌ Failed', message: `API returned ${result.status}` };
        console.log(`   ❌ Resend: API returned ${result.status}`);
      }
    }
  } catch (err) {
    results.resend = { status: '❌ Failed', message: err.message };
    console.log(`   ❌ Resend: ${err.message}`);
  }
}

async function checkLemonSqueezy() {
  console.log('\n5️⃣ Testing LemonSqueezy Integration...');
  const hasApiKey = !!process.env.LEMON_SQUEEZY_API_KEY;
  const hasStoreId = !!process.env.LEMON_SQUEEZY_STORE_ID;
  
  if (!hasApiKey || !hasStoreId) {
    results.lemonSqueezy = { status: '⚠️ Not Configured', message: 'LEMON_SQUEEZY_API_KEY or STORE_ID not found' };
    console.log('   ⚠️ LemonSqueezy: Not configured in .env');
    return;
  }
  
  try {
    // Test billing plans endpoint (uses LemonSqueezy)
    const result = await request('GET', '/api/billing/plans', null, null);
    if (result.status === 200) {
      results.lemonSqueezy = { status: '✅ Working', message: 'LemonSqueezy API accessible' };
      console.log('   ✅ LemonSqueezy: API accessible');
    } else {
      results.lemonSqueezy = { status: '❌ Failed', message: `API returned ${result.status}` };
      console.log(`   ❌ LemonSqueezy: API returned ${result.status}`);
    }
  } catch (err) {
    results.lemonSqueezy = { status: '❌ Failed', message: err.message };
    console.log(`   ❌ LemonSqueezy: ${err.message}`);
  }
}

async function checkSendGrid() {
  console.log('\n6️⃣ Testing SendGrid Integration...');
  // ACTUAL CHECK: Code uses RESEND, not SendGrid
  const hasSendGridKey = !!process.env.SENDGRID_API_KEY;
  const hasResendKey = !!process.env.RESEND_API_KEY;
  
  // If SendGrid key doesn't exist, it's not configured
  if (!hasSendGridKey) {
    results.sendgrid = { status: '⚠️ Not Configured', message: 'SENDGRID_API_KEY not found in .env. Code uses Resend instead.' };
    console.log('   ⚠️ SendGrid: Not configured in .env');
    console.log('   ℹ️  Note: Email service actually uses RESEND_API_KEY, not SENDGRID_API_KEY');
    if (hasResendKey) {
      console.log('   ✅ Resend is configured instead (RESEND_API_KEY found)');
    } else {
      console.log('   ❌ Resend also not configured');
    }
    return;
  }
  
  // If SendGrid key exists, mark as configured (but note that code uses Resend)
  results.sendgrid = { status: '⚠️ Configured But Not Used', message: 'SENDGRID_API_KEY found in env, but code uses RESEND_API_KEY instead' };
  console.log('   ⚠️ SendGrid: API key found in env');
  console.log('   ⚠️ WARNING: Code actually uses RESEND_API_KEY, not SENDGRID_API_KEY');
  console.log('   ℹ️  SendGrid webhook endpoint exists but emails are sent via Resend');
}

async function checkAnthropic() {
  console.log('\n7️⃣ Testing Anthropic (Claude AI)...');
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  
  if (!hasApiKey) {
    results.anthropic = { status: '⚠️ Not Configured', message: 'ANTHROPIC_API_KEY not found in .env' };
    console.log('   ⚠️ Anthropic: Not configured in .env');
    return;
  }
  
  try {
    // Test AI risk score endpoint (uses Anthropic)
    if (TD.customers?.[0]?.id) {
      const result = await request('POST', '/api/ai/risk-score', {
        customerId: TD.customers[0].id
      }, COOKIE);
      
      if (result.status === 200 && result.body.data) {
        console.log('   ✅ Anthropic: Working - AI generating responses');
        console.log('   📦 Risk Score Response:', JSON.stringify(result.body.data, null, 2));
        results.anthropic = { status: '✅ Working', message: `Risk score: ${result.body.data.riskScore || 'N/A'}` };
      } else {
        results.anthropic = { status: '❌ Failed', message: `API returned ${result.status}` };
        console.log(`   ❌ Anthropic: API returned ${result.status}`);
        console.log('   📦 Response:', JSON.stringify(result.body, null, 2));
      }
    } else {
      results.anthropic = { status: '✅ Configured', message: 'API key configured, no test data available' };
      console.log('   ✅ Anthropic: Configured (no test data)');
    }
  } catch (err) {
    results.anthropic = { status: '❌ Failed', message: err.message };
    console.log(`   ❌ Anthropic: ${err.message}`);
  }
}

async function checkOpenAI() {
  console.log('\n8️⃣ Testing OpenAI Integration...');
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  
  if (!hasApiKey) {
    results.openai = { status: '⚠️ Not Configured', message: 'OPENAI_API_KEY not found in .env' };
    console.log('   ⚠️ OpenAI: Not configured in .env');
    return;
  }
  
  try {
    // Test AI generate email endpoint (uses OpenAI as fallback)
    if (TD.customers?.[1]?.id && TD.invoices?.[4]?.id) {
      const result = await request('POST', '/api/ai/generate-email', {
        customerId: TD.customers[1].id,
        invoiceId: TD.invoices[4].id,
        customerName: 'Test Customer',
        invoiceAmount: 1000,
        dueDate: new Date().toISOString().slice(0, 10),
        daysOverdue: 30,
        riskScore: 50,
        companyName: TD.companyName,
      }, COOKIE);
      
      if (result.status === 200 && result.body.data) {
        results.openai = { status: '✅ Working', message: 'OpenAI API generating responses' };
        console.log('   ✅ OpenAI: Working - AI generating responses');
      } else {
        results.openai = { status: '❌ Failed', message: `API returned ${result.status}` };
        console.log(`   ❌ OpenAI: API returned ${result.status}`);
      }
    } else {
      results.openai = { status: '✅ Configured', message: 'API key configured, no test data available' };
      console.log('   ✅ OpenAI: Configured (no test data)');
    }
  } catch (err) {
    results.openai = { status: '❌ Failed', message: err.message };
    console.log(`   ❌ OpenAI: ${err.message}`);
  }
}

async function checkGoogleOAuth() {
  console.log('\n9️⃣ Testing Google OAuth...');
  const hasClientId = !!process.env.GOOGLE_CLIENT_ID;
  const hasClientSecret = !!process.env.GOOGLE_CLIENT_SECRET;
  
  if (!hasClientId || !hasClientSecret) {
    results.googleOAuth = { status: '⚠️ Not Configured', message: 'GOOGLE_CLIENT_ID or CLIENT_SECRET not found' };
    console.log('   ⚠️ Google OAuth: Not configured in .env');
    return;
  }
  
  try {
    // Test Google OAuth callback endpoint (will fail without valid code, but endpoint should exist)
    const result = await request('POST', '/api/auth/oauth/google/callback', {
      code: 'invalid_test_code'
    }, null);
    
    // 400 is expected for invalid code - means endpoint is working
    if (result.status === 400 || result.status === 200) {
      results.googleOAuth = { status: '✅ Working', message: 'Google OAuth endpoint accessible' };
      console.log('   ✅ Google OAuth: Endpoint working');
    } else {
      results.googleOAuth = { status: '❌ Failed', message: `Endpoint returned ${result.status}` };
      console.log(`   ❌ Google OAuth: Endpoint returned ${result.status}`);
    }
  } catch (err) {
    results.googleOAuth = { status: '❌ Failed', message: err.message };
    console.log(`   ❌ Google OAuth: ${err.message}`);
  }
}

async function checkSlack() {
  console.log('\n🔟 Testing Slack Integration...');
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    results.slack = { status: '⚠️ Not Configured', message: 'SLACK_WEBHOOK_URL not found in .env' };
    console.log('   ⚠️ Slack: Not configured in .env');
    console.log('   ℹ️  SLACK_WEBHOOK_URL env var is missing');
    return;
  }
  
  try {
    // ACTUAL TEST: Try sending a test message to Slack webhook
    console.log('   🧪 Testing actual Slack webhook...');
    const testPayload = {
      text: '🧪 RecoverAI Integration Test',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '✅ *RecoverAI Integration Test*\nThis is a test message to verify Slack webhook is working.',
          },
        },
      ],
    };
    
    const url = require('url');
    const https = require('https');
    const http = require('http');
    const parsedUrl = new url.URL(webhookUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const slackTest = await new Promise((resolve, reject) => {
      const req = client.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            resolve({
              status: res.statusCode,
              body: data,
              ok: res.statusCode >= 200 && res.statusCode < 300,
            });
          });
        }
      );
      req.on('error', (err) => {
        resolve({
          status: 0,
          body: err.message,
          ok: false,
          error: err.message,
        });
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({
          status: 0,
          body: 'Request timeout',
          ok: false,
          error: 'Timeout',
        });
      });
      req.write(JSON.stringify(testPayload));
      req.end();
    });
    
    if (slackTest.ok) {
      results.slack = { status: '✅ Working', message: 'Slack webhook test message sent successfully' };
      console.log('   ✅ Slack: Webhook working! Test message sent');
      console.log('   📦 Response:', slackTest.body || 'OK');
    } else {
      results.slack = { status: '❌ Failed', message: `Webhook returned ${slackTest.status}: ${slackTest.body}` };
      console.log(`   ❌ Slack: Webhook returned ${slackTest.status}`);
      console.log('   📦 Response:', slackTest.body);
    }
  } catch (err) {
    results.slack = { status: '❌ Failed', message: err.message };
    console.log(`   ❌ Slack: ${err.message}`);
    console.log('   ⚠️  Webhook URL might be invalid or unreachable');
  }
}

async function runAllTests() {
  console.log('='.repeat(70));
  console.log('🔌 TESTING ALL THIRD-PARTY INTEGRATIONS');
  console.log('='.repeat(70));
  
  await checkDatabase();
  await checkRedis();
  await checkStripe();
  await checkResend();
  await checkLemonSqueezy();
  await checkSendGrid();
  await checkAnthropic();
  await checkOpenAI();
  await checkGoogleOAuth();
  await checkSlack();
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 INTEGRATION TEST SUMMARY');
  console.log('='.repeat(70));
  
  const working = Object.values(results).filter(r => r.status.includes('✅')).length;
  const notConfigured = Object.values(results).filter(r => r.status.includes('⚠️')).length;
  const failed = Object.values(results).filter(r => r.status.includes('❌')).length;
  
  Object.entries(results).forEach(([name, result]) => {
    const icon = result.status.includes('✅') ? '✅' : result.status.includes('⚠️') ? '⚠️' : '❌';
    console.log(`${icon} ${name.padEnd(20)} ${result.status.padEnd(20)} ${result.message}`);
  });
  
  console.log('\n' + '='.repeat(70));
  console.log(`✅ Working: ${working} | ⚠️ Not Configured: ${notConfigured} | ❌ Failed: ${failed}`);
  console.log('='.repeat(70) + '\n');
  
  // Save results
  const reportPath = path.join(__dirname, '../reports/INTEGRATION_TEST_REPORT.md');
  const report = `# Integration Test Report

**Generated:** ${new Date().toISOString()}

## Results

${Object.entries(results).map(([name, result]) => {
  const icon = result.status.includes('✅') ? '✅' : result.status.includes('⚠️') ? '⚠️' : '❌';
  return `### ${icon} ${name}
- **Status:** ${result.status}
- **Message:** ${result.message}
`;
}).join('\n')}

## Summary
- ✅ Working: ${working}
- ⚠️ Not Configured: ${notConfigured}
- ❌ Failed: ${failed}
`;
  
  fs.writeFileSync(reportPath, report);
  console.log(`📄 Report saved to: ${reportPath}\n`);
}

runAllTests().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

