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
}
