#!/usr/bin/env node
/**
 * Test Email Sending Functionality
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../fixtures/.testdata.json');
const TD = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
const COOKIE = TD.cookie;

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

async function testEmailSending() {
  console.log('📧 Testing Email Sending Functionality\n');
  console.log('='.repeat(70));
  
  // Get an unpaid invoice
  const unpaidInvoice = TD.invoices.find(inv => inv.status === 'unpaid') || TD.invoices[4];
  const invoiceId = unpaidInvoice.id;
  
  console.log(`\n1️⃣ Testing: POST /api/email/send-now`);
  console.log(`   Invoice ID: ${invoiceId}`);
  console.log(`   Customer: ${unpaidInvoice.customer}`);
  
  const sendResult = await request('POST', '/api/email/send-now', {
    invoiceId: invoiceId
  }, COOKIE);
  
  console.log(`   Status: ${sendResult.status}`);
  console.log(`   Response:`, JSON.stringify(sendResult.body, null, 2));
  
  if (sendResult.status === 200) {
    console.log(`\n✅ Email queued successfully!`);
    console.log(`   Job ID: ${sendResult.body.data?.jobId}`);
    
    // Wait a bit for worker to process
    console.log(`\n⏳ Waiting 3 seconds for worker to process...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check email logs
    console.log(`\n2️⃣ Checking Email Logs:`);
    const logsResult = await request('GET', `/api/email/logs?invoiceId=${invoiceId}&limit=3`, null, COOKIE);
    console.log(`   Status: ${logsResult.status}`);
    
    if (logsResult.status === 200 && logsResult.body.data) {
      const logs = logsResult.body.data;
      console.log(`   📧 Found ${logs.length} email log(s):`);
      logs.forEach((log, idx) => {
        console.log(`\n   Email ${idx + 1}:`);
        console.log(`     ID: ${log.id}`);
        console.log(`     Type: ${log.email_type}`);
        console.log(`     To: ${log.recipient_email}`);
        console.log(`     Subject: ${log.subject}`);
        console.log(`     Status: ${log.status}`);
        console.log(`     Sent At: ${log.sent_at || 'Not sent yet'}`);
        console.log(`     Message ID: ${log.sendgrid_message_id || 'N/A'}`);
        if (log.body) {
          const preview = log.body.substring(0, 100);
          console.log(`     Body Preview: ${preview}...`);
        }
      });
    }
    
    // Check queue stats
    console.log(`\n3️⃣ Checking Queue Stats:`);
    const statsResult = await request('GET', '/api/email/queue/stats', null, COOKIE);
    console.log(`   Status: ${statsResult.status}`);
    if (statsResult.status === 200) {
      console.log(`   Queue Stats:`, JSON.stringify(statsResult.body.data, null, 2));
    }
  } else {
    console.log(`\n❌ Failed to queue email`);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('\n✅ Email sending test complete!\n');
}

testEmailSending().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});

