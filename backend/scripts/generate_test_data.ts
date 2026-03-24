/**
 * Generate realistic fake data for testing
 * Creates: 5 customers + 100 invoices across all aging stages
 *
 * Usage:
 *   npx ts-node -r dotenv/config scripts/generate_test_data.ts {COMPANY_ID} {COUNT}
 */

import { Pool } from 'pg';
import { config } from 'dotenv';

config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Realistic customer names & companies
const CUSTOMERS = [
  { name: 'Alice Johnson', email: 'alice@techflow.io', company: 'TechFlow Inc', phone: '+1-555-0101' },
  { name: 'Bob Smith', email: 'bob@growthco.com', company: 'GrowthCo', phone: '+1-555-0102' },
  { name: 'Carol White', email: 'carol@acmecorp.com', company: 'Acme Corp', phone: '+1-555-0103' },
  { name: 'David Brown', email: 'david@innovate.com', company: 'Innovate LLC', phone: '+1-555-0104' },
  { name: 'Emma Davis', email: 'emma@momentum.io', company: 'Momentum Labs', phone: '+1-555-0105' },
];

// Invoice amount ranges (realistic B2B SaaS)
const AMOUNT_RANGES = {
  small: { min: 1000, max: 5000 },
  medium: { min: 5000, max: 15000 },
  large: { min: 15000, max: 50000 },
  xlarge: { min: 50000, max: 100000 },
};

function randomAmount(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomInvoiceAmount(): number {
  const ranges = Object.values(AMOUNT_RANGES);
  const range = ranges[Math.floor(Math.random() * ranges.length)];
  return randomAmount(range.min, range.max);
}

async function generateTestData(companyId: string, count: number = 100) {
  console.log(`\n📊 Generating ${count} test invoices for company: ${companyId}`);

  try {
    // Step 1: Create 5 test customers
    console.log('\n👥 Creating 5 test customers...');
    const customers: string[] = [];

    for (const cust of CUSTOMERS) {
      const result = await pool.query(
        `INSERT INTO customers (company_id, name, email, phone, company_name, phone_opt_in, risk_tier, do_not_email)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (company_id, email) DO UPDATE SET name = $2
         RETURNING id`,
        [companyId, cust.name, cust.email, cust.phone, cust.company, true, 2, false]
      );
      customers.push(result.rows[0].id);
    }
    console.log(`✅ Created ${customers.length} customers`);

    // Step 2: Generate invoices
    console.log(`\n📄 Generating ${count} invoices...`);
    const now = new Date();
    let inserted = 0;

    // Distribution by days overdue
    const distribution = [
      { minDays: 1, maxDays: 30, count: 30 },   // Stage 1
      { minDays: 31, maxDays: 60, count: 25 },  // Stage 2
      { minDays: 61, maxDays: 90, count: 20 },  // Stage 3
      { minDays: 91, maxDays: 120, count: 25 }, // Stage 4
    ];

    for (const dist of distribution) {
      for (let i = 0; i < dist.count; i++) {
        const customer = customers[Math.floor(Math.random() * customers.length)];
        const daysOffset = randomAmount(dist.minDays, dist.maxDays);

        const issued_date = new Date(now.getTime() - daysOffset * 24 * 60 * 60 * 1000);
        const due_date = new Date(issued_date.getTime() + 30 * 24 * 60 * 60 * 1000);
        const amount = randomInvoiceAmount();

        try {
          await pool.query(
            `INSERT INTO invoices (
              company_id, customer_id, amount, currency, issued_date, due_date,
              status, source, source_id, risk_score
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              companyId,
              customer,
              amount,
              'USD',
              issued_date,
              due_date,
              'unpaid',
              'manual',
              `INV-${String(inserted + 1).padStart(6, '0')}`,
              Math.floor(Math.random() * 100),
            ]
          );
          inserted++;
          if (inserted % 20 === 0) process.stdout.write('.');
        } catch (err) {
          // Silently skip duplicates
        }
      }
    }
    console.log(`\n✅ Inserted ${inserted} invoices`);

    // Step 3: Simulate some payments
    console.log('\n💰 Simulating payment collections...');
    const invoiceRows = await pool.query(
      `SELECT id, amount FROM invoices WHERE company_id = $1 ORDER BY RANDOM() LIMIT 20`,
      [companyId]
    );

    for (const inv of invoiceRows.rows) {
      const paymentAmount = Math.floor(inv.amount * (0.5 + Math.random() * 0.5));
      await pool.query(
        `INSERT INTO payments (invoice_id, company_id, amount, currency, payment_method, paid_at, status)
         VALUES ($1, $2, $3, $4, $5, NOW(), 'succeeded')`,
        [inv.id, companyId, paymentAmount, 'USD', 'stripe']
      );
      await pool.query(`UPDATE invoices SET status = 'paid' WHERE id = $1`, [inv.id]);
    }
    console.log(`✅ Recorded ${invoiceRows.rows.length} payments`);

    // Step 4: Statistics
    console.log('\n📈 Data Summary:');
    const stats = await pool.query(
      `SELECT
        COUNT(*) as total_invoices,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid,
        COUNT(CASE WHEN status = 'unpaid' THEN 1 END) as unpaid,
        SUM(amount) as total_amount,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as recovered_amount
      FROM invoices WHERE company_id = $1`,
      [companyId]
    );

    const s = stats.rows[0];
    console.log(`
Total Invoices: ${s.total_invoices}
├─ Paid: ${s.paid}
└─ Unpaid: ${s.unpaid}

Total Amount: $${(s.total_amount / 100).toFixed(2)}
Recovered: $${(s.recovered_amount / 100).toFixed(2)}
Recovery Rate: ${((s.recovered_amount / s.total_amount) * 100).toFixed(1)}%
    `);

    console.log('✅ Test data generation complete!');
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await pool.end();
  }
}

const companyId = process.argv[2];
if (!companyId) {
  console.error('❌ Usage: npx ts-node -r dotenv/config scripts/generate_test_data.ts {COMPANY_ID} [COUNT]');
  console.error('Example: npx ts-node -r dotenv/config scripts/generate_test_data.ts 9ecd6dfe-c8c4-4459-af6a-58beb6765650 100');
  process.exit(1);
}

const count = parseInt(process.argv[3] || '100', 10);
generateTestData(companyId, count);
