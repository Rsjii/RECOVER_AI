#!/usr/bin/env node
/**
 * Run: node scripts/setup-db.js
 * Applies schema.sql to the configured database.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
else dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL is not set');
  process.exit(1);
}

// Normalize URL: strip +psycopg driver specifier if present
const normalizedUrl = databaseUrl.replace('postgresql+psycopg://', 'postgresql://');

const pool = new Pool({
  connectionString: normalizedUrl,
  ssl: normalizedUrl.includes('localhost') ? false : { rejectUnauthorized: false },
});

const schemaPath = path.resolve(__dirname, '../schema.sql');
const sql = fs.readFileSync(schemaPath, 'utf8');

async function run() {
  const client = await pool.connect();
  try {
    console.log('Connected to database. Applying schema...');
    await client.query(sql);
    console.log('Schema applied successfully.');
  } catch (err) {
    console.error('Failed to apply schema:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
