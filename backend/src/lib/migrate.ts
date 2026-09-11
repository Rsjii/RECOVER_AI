import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';
import { logError, logInfo, logWarn } from '../utils/logger';

/**
 * Runs schema.sql against the database.
 * Safe to run multiple times - all statements use IF NOT EXISTS.
 * Tables that already exist are skipped automatically.
 */
export async function runMigrations(): Promise<void> {
  const schemaPath = path.join(__dirname, '../../schema.sql');

  if (!fs.existsSync(schemaPath)) {
    logWarn('migrate', 'runMigrations', 'schema.sql not found, skipping migrations');
    return;
  }

  const sql = fs.readFileSync(schemaPath, 'utf-8');

  const client = await pool.connect();
  try {
    await client.query(sql);
    logInfo('migrate', 'runMigrations', 'Schema applied');
  } catch (err: any) {
    logError('migrate', 'runMigrations', 'Migration failed', err);
    throw err;
  } finally {
    client.release();
  }

  // Run post-schema alterations (for existing databases)
  await applySchemaAlterations();
}

/**
 * Schema alterations for existing databases
 * Runs after initial schema setup
 * Idempotent — checks if change already applied before running
 */
async function applySchemaAlterations(): Promise<void> {
  const client = await pool.connect();
  try {
    // Alteration 1: Make customers.email nullable (allows customers without email)
    const emailColumn = await client.query(`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_name='customers' AND column_name='email'
    `);

    if (emailColumn.rows.length > 0 && emailColumn.rows[0].is_nullable === 'NO') {
      logInfo('migrate', 'applySchemaAlterations', 'Applying: customers.email nullable');
      await client.query(`ALTER TABLE customers ALTER COLUMN email DROP NOT NULL`);
      logInfo('migrate', 'applySchemaAlterations', 'Applied: customers.email nullable');
    } else {
      logInfo('migrate', 'applySchemaAlterations', 'Already applied: customers.email nullable');
    }

    // Alteration 2: Add payment_insights JSONB to customers (per-client behavioral profile)
    const insightsColumn = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name='customers' AND column_name='payment_insights'
    `);
    if (insightsColumn.rows.length === 0) {
      logInfo('migrate', 'applySchemaAlterations', 'Applying: customers.payment_insights');
      await client.query(`ALTER TABLE customers ADD COLUMN payment_insights JSONB DEFAULT NULL`);
      logInfo('migrate', 'applySchemaAlterations', 'Applied: customers.payment_insights');
    } else {
      logInfo('migrate', 'applySchemaAlterations', 'Already applied: customers.payment_insights');
    }

    // Alteration 3: Add monthly_burn_rate_usd to companies
    const burnRateColumn = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name='companies' AND column_name='monthly_burn_rate_usd'
    `);
    if (burnRateColumn.rows.length === 0) {
      logInfo('migrate', 'applySchemaAlterations', 'Applying: companies.monthly_burn_rate_usd');
      await client.query(`ALTER TABLE companies ADD COLUMN monthly_burn_rate_usd NUMERIC(12,2) DEFAULT 0`);
      logInfo('migrate', 'applySchemaAlterations', 'Applied: companies.monthly_burn_rate_usd');
    } else {
      logInfo('migrate', 'applySchemaAlterations', 'Already applied: companies.monthly_burn_rate_usd');
    }

    // Alteration 4: Add source_id to invoices (external invoice ID for CSV/Stripe/QB dedup) if missing
    const sourceIdColumn = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name='invoices' AND column_name='source_id'
    `);
    if (sourceIdColumn.rows.length === 0) {
      logInfo('migrate', 'applySchemaAlterations', 'Applying: invoices.source_id');
      await client.query(`ALTER TABLE invoices ADD COLUMN source_id VARCHAR(100)`);
      logInfo('migrate', 'applySchemaAlterations', 'Applied: invoices.source_id');
    } else {
      logInfo('migrate', 'applySchemaAlterations', 'Already applied: invoices.source_id');
    }

    // Alteration 5: Add UNIQUE(company_id, source, source_id) to invoices if missing
    // Required for the ON CONFLICT (company_id, source, source_id) clause used by CSV/Stripe/QB import.
    // Tables created before this constraint existed in schema.sql never got it (CREATE TABLE IF NOT EXISTS
    // skips the whole statement on an existing table), so it must be backfilled here.
    const uniqueConstraint = await client.query(`
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = 'invoices' AND c.contype = 'u'
        AND c.conkey = (
          SELECT array_agg(a.attnum ORDER BY a.attnum)
          FROM pg_attribute a
          WHERE a.attrelid = t.oid AND a.attname = ANY(ARRAY['company_id', 'source', 'source_id'])
        )
    `);
    if (uniqueConstraint.rows.length === 0) {
      logInfo('migrate', 'applySchemaAlterations', 'Applying: invoices UNIQUE(company_id, source, source_id)');
      try {
        await client.query(`ALTER TABLE invoices ADD CONSTRAINT invoices_company_id_source_source_id_key UNIQUE (company_id, source, source_id)`);
        logInfo('migrate', 'applySchemaAlterations', 'Applied: invoices UNIQUE(company_id, source, source_id)');
      } catch (constraintErr: any) {
        // Existing duplicate (company_id, source, source_id) rows would block this — needs manual cleanup.
        logError('migrate', 'applySchemaAlterations', 'Failed to add invoices unique constraint (likely duplicate rows exist) — CSV/Stripe/QB dedup will keep failing until this is resolved', constraintErr);
      }
    } else {
      logInfo('migrate', 'applySchemaAlterations', 'Already applied: invoices UNIQUE(company_id, source, source_id)');
    }
  } catch (err: any) {
    logError('migrate', 'applySchemaAlterations', 'Schema alteration failed', err);
    throw err;
  } finally {
    client.release();
  }
}
