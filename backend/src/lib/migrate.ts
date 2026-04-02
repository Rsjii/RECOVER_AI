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
  } catch (err: any) {
    logError('migrate', 'applySchemaAlterations', 'Schema alteration failed', err);
    throw err;
  } finally {
    client.release();
  }
}
