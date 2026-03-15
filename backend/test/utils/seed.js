#!/usr/bin/env node
/**
 * Seed Test Data
 * Creates test users, companies, customers, and invoices
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const PORT = process.env.PORT || 3000;
const OUTPUT_FILE = path.join(__dirname, '../fixtures/.testdata.json');

function request(method, route, body, cookie, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const isJson = typeof body === 'string' && !body.includes('\n') && (body.startsWith('{') || body.startsWith('['));
    const contentType = extraHeaders['Content-Type'] || (isJson ? 'application/json' : 'text/plain');
    const payload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';
    
    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path: route,
        method,
        headers: {
          'Content-Type': contentType,
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
            json = raw;
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

async function seed() {
  console.log('🌱 Seeding test data...\n');

  const testData = {
    _createdAt: new Date().toISOString(),
    _description: 'RecoverAI test seed data — do not commit to git',
    port: PORT,
    email: 'recoverai_test@example.com',
    password: 'TestPass123!',
    companyName: 'RecoverAI Test Co',
  };

  try {
    // 1. Signup
    console.log('1️⃣ Creating test user and company...');
    const signupResult = await request('POST', '/api/auth/signup', {
      companyName: testData.companyName,
      email: testData.email,
      password: testData.password,
      firstName: 'Owner',
      lastName: 'User',
      timezone: 'America/New_York',
      preferredCurrency: 'USD',
    });

    if (signupResult.status === 201) {
      testData.userId = signupResult.body.user?.id;
      testData.companyId = signupResult.body.company?.id;
      testData.cookie = extractCookie(signupResult.headers);
      console.log('   ✅ User and company created');
    } else {
      // User exists or other error, try login
      console.log('   ⚠️  User may exist, trying login...');
      const loginResult = await request('POST', '/api/auth/login', {
        email: testData.email,
        password: testData.password,
      });
      if (loginResult.status === 200) {
        testData.cookie = extractCookie(loginResult.headers);
        const meResult = await request('GET', '/api/auth/me', null, testData.cookie);
        if (meResult.status === 200 && meResult.body.user) {
          testData.userId = meResult.body.user.id;
          testData.companyId = meResult.body.company.id;
          console.log('   ✅ Logged in successfully');
        } else {
          throw new Error('Failed to get user info after login');
        }
      } else {
        throw new Error(`Login failed: ${loginResult.status} - ${JSON.stringify(loginResult.body)}`);
      }
    }

    if (!testData.cookie) {
      throw new Error('Failed to get authentication cookie');
    }

    // 2. Create customers
    console.log('\n2️⃣ Creating test customers...');
    const customers = [
      { name: 'Alice Johnson', email: 'alice@goodpayer.com', companyName: 'GoodPayer Inc', phone: '+1-555-0101', industry: 'SaaS', notes: 'Reliable customer, always pays on time' },
      { name: 'Bob Smith', email: 'bob@latepayer.com', companyName: 'LatePayer LLC', phone: '+1-555-0202', industry: 'Retail', notes: 'Frequently late, needs follow-up' },
      { name: 'Charlie Brown', email: 'charlie@newcustomer.com', companyName: 'NewCustomer Corp', phone: '+1-555-0303', industry: 'Healthcare', notes: 'Brand new customer' },
    ];

    // Create customers via CSV upload (which creates customers automatically)
    console.log('   Creating customers via invoice CSV upload...');
    const csvData = customers.map(c => 
      `${c.name},${c.email},100,USD,${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}`
    ).join('\n');
    const csvHeader = 'customer_name,customer_email,amount,currency,due_date\n';
    
    const csvResult = await request('POST', '/api/invoices/csv-upload', 
      csvHeader + csvData, 
      testData.cookie,
      { 'Content-Type': 'text/csv' }
    );
    
    // Get actual customers from database
    const customersResult = await request('GET', '/api/customers?limit=10', null, testData.cookie);
    if (customersResult.status === 200 && customersResult.body.data) {
      testData.customers = customersResult.body.data.slice(0, 3).map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        type: c.name.includes('Alice') ? 'good_payer' : c.name.includes('Bob') ? 'late_payer' : 'new_customer'
      }));
      console.log(`   ✅ Created ${testData.customers.length} customer records`);
    } else {
      // Fallback: create placeholder IDs
      testData.customers = customers.map((c, idx) => ({
        id: `customer-${Date.now()}-${idx}`,
        ...c,
        type: c.name.includes('Alice') ? 'good_payer' : c.name.includes('Bob') ? 'late_payer' : 'new_customer'
      }));
      console.log(`   ⚠️  Using placeholder customer IDs`);
    }

    // 3. Create invoices
    console.log('\n3️⃣ Creating test invoices...');
    const now = Date.now();
    const invoices = [
      { customer: 'Alice', amount: 500, status: 'paid', daysAgo: 60 },
      { customer: 'Alice', amount: 750, status: 'paid', daysAgo: 30 },
      { customer: 'Alice', amount: 1200, status: 'unpaid', daysAgo: 10 },
      { customer: 'Bob', amount: 3000, status: 'paid', daysAgo: 90 },
      { customer: 'Bob', amount: 2500, status: 'unpaid', daysAgo: 45 },
      { customer: 'Bob', amount: 1800, status: 'unpaid', daysAgo: 15 },
      { customer: 'Charlie', amount: 950, status: 'unpaid', daysAgo: 5 },
    ];

    // Create invoices
    testData.invoices = [];
    for (const inv of invoices) {
      const customer = testData.customers.find(c => {
        if (inv.customer === 'Alice') return c.name.includes('Alice') || c.email.includes('alice');
        if (inv.customer === 'Bob') return c.name.includes('Bob') || c.email.includes('bob');
        if (inv.customer === 'Charlie') return c.name.includes('Charlie') || c.email.includes('charlie');
        return false;
      });
      
      if (customer) {
        const dueDate = new Date(now - inv.daysAgo * 24 * 60 * 60 * 1000);
        const invoiceResult = await request('POST', '/api/invoices/manual', {
          customer_id: customer.id,
          amount: inv.amount,
          currency: 'USD',
          due_date: dueDate.toISOString().slice(0, 10),
          issued_date: new Date(dueDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        }, testData.cookie, {});

        if (invoiceResult.status === 201 && invoiceResult.body.data?.id) {
          testData.invoices.push({
            id: invoiceResult.body.data.id,
            customer: inv.customer,
            amount: inv.amount,
            status: inv.status,
          });
        }
      }
    }
    
    // Get actual invoices if creation failed
    if (testData.invoices.length === 0) {
      const invoicesResult = await request('GET', '/api/invoices?limit=10', null, testData.cookie);
      if (invoicesResult.status === 200 && invoicesResult.body.data) {
        testData.invoices = invoicesResult.body.data.slice(0, 7).map(inv => ({
          id: inv.id,
          customer: inv.customer_name || 'Unknown',
          amount: parseFloat(inv.amount),
          status: inv.status,
        }));
      }
    }
    console.log(`   ✅ Created ${testData.invoices.length} invoice records`);

    // 4. Save to file
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(testData, null, 2));
    console.log(`\n✅ Test data saved to: ${OUTPUT_FILE}`);
    console.log(`\n📋 Test Credentials:`);
    console.log(`   Email: ${testData.email}`);
    console.log(`   Password: ${testData.password}`);
    console.log(`   Company: ${testData.companyName}`);
    console.log(`\n🎯 Ready to run tests!\n`);

  } catch (error) {
    console.error('❌ Error seeding data:', error.message);
    process.exit(1);
  }
}

seed();

