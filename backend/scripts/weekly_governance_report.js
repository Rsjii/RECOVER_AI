#!/usr/bin/env node
/**
 * Generates a weekly governance report for pilot operations.
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function cleanDbUrl(raw) {
  return raw
    .replace('postgresql+psycopg://', 'postgresql://')
    .replace('postgres+psycopg://', 'postgresql://');
}

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is required');
  const connectionString = cleanDbUrl(raw);
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('supabase') || process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : undefined,
  });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const report = {
    generatedAt: new Date().toISOString(),
    periodStart: sevenDaysAgo.toISOString(),
    metrics: {},
  };

  try {
    const [payments, incidents, approvals] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(amount), 0)::numeric::text AS recovered, COUNT(*)::int AS payment_count
         FROM payments
         WHERE status = 'succeeded' AND paid_at >= $1`,
        [sevenDaysAgo]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS incident_count
         FROM audit_logs
         WHERE action = 'INCIDENT'
           AND created_at >= $1`,
        [sevenDaysAgo]
      ),
      pool.query(
        `SELECT
            COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
            COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
            COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected
         FROM policy_approvals
         WHERE requested_at >= $1`,
        [sevenDaysAgo]
      ),
    ]);

    report.metrics = {
      recoveredAmountUsd: Number(payments.rows[0].recovered || 0),
      paymentCount: payments.rows[0].payment_count,
      incidentCount: incidents.rows[0].incident_count,
      approvals: approvals.rows[0],
    };

    const outDir = path.join(process.cwd(), 'artifacts');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `weekly-governance-report-${Date.now()}.json`);
    fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
    console.log(`[governance-report] written: ${outFile}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[governance-report] failed:', err.message);
  process.exit(1);
});







