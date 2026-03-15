#!/usr/bin/env node
/**
 * Backup/restore evidence generator.
 * Produces a JSON evidence file by checking core table counts and DB reachability.
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

  const startedAt = new Date().toISOString();
  const checks = {};
  const tables = ['companies', 'users', 'customers', 'invoices', 'payments', 'billing_invoices'];

  try {
    await pool.query('SELECT 1');
    for (const table of tables) {
      const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
      checks[table] = result.rows[0].count;
    }
    const evidence = {
      generatedAt: new Date().toISOString(),
      startedAt,
      status: 'ok',
      checks,
      note: 'Restore drill should include loading latest backup into staging and re-running this script.',
    };
    const outDir = path.join(process.cwd(), 'artifacts');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `backup-restore-evidence-${Date.now()}.json`);
    fs.writeFileSync(outFile, JSON.stringify(evidence, null, 2));
    console.log(`[backup-evidence] written: ${outFile}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[backup-evidence] failed:', err.message);
  process.exit(1);
});







