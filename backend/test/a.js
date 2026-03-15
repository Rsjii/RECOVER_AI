/**
 * Simple script to DELETE ALL TABLES from database
 * Usage: node md/extra/a.js
 */

const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

// Load .env from multiple possible locations
// Try backend/.env first (most common location)
const backendEnvPath = path.resolve(__dirname, '../.env');
// Try root .env
const rootEnvPath = path.resolve(__dirname, '../../.env');

let result = dotenv.config({ path: backendEnvPath });

if (result.error) {
  console.warn(`⚠️  Could not load .env from ${backendEnvPath}`);
  console.warn(`   Trying to load from root: ${rootEnvPath}`);
  result = dotenv.config({ path: rootEnvPath });
  
  if (result.error) {
    console.warn(`⚠️  Could not load .env from ${rootEnvPath}`);
    console.warn('   Trying default dotenv behavior (current directory)...');
    dotenv.config(); // Try default behavior
  }
}

// Check DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env file!');
  process.exit(1);
}

// Extract hostname for display
let dbHostname = 'unknown';
let isLocalhost = false;
let isRailway = false;
let sslModeInUrl = null;

try {
  const url = new URL(process.env.DATABASE_URL);
  dbHostname = url.hostname;
  isLocalhost = dbHostname.includes('localhost') || dbHostname.includes('127.0.0.1');
  isRailway = dbHostname.includes('railway') || dbHostname.includes('rlwy.net') || dbHostname.includes('railway.app');
  
  // Check if sslmode is in connection string
  if (url.searchParams.has('sslmode')) {
    sslModeInUrl = url.searchParams.get('sslmode');
  }
  
  console.log(`🔍 Connecting to: ${dbHostname}`);
  if (sslModeInUrl) {
    console.log(`   SSL Mode: ${sslModeInUrl}`);
  }
  console.log('');
} catch (e) {
  console.warn('⚠️  Could not parse DATABASE_URL');
}

// Configure pool with proper SSL handling
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
};

// SSL configuration logic:
// Railway proxy (shuttle.proxy.rlwy.net) doesn't support SSL connections
// Must disable SSL for Railway proxy
// For other databases, use connection string's sslmode

if (sslModeInUrl === 'disable' || isLocalhost || isRailway) {
  poolConfig.ssl = false;
  if (isRailway) {
    console.log('🔓 SSL disabled (Railway proxy doesn\'t support SSL)\n');
  } else {
    console.log('🔓 SSL disabled (sslmode=disable or localhost)\n');
  }
} else {
  // For Supabase and other providers, let connection string handle SSL
  // Don't set SSL object - pg library will use connection string's sslmode
  console.log('🔒 SSL handled by connection string\n');
}

const pool = new Pool(poolConfig);

async function deleteAllTables() {
  try {
    console.log('🗑️  Deleting all tables...\n');

    // Test connection first
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful\n');

    // Get all table names
    const result = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);

    const tables = result.rows.map(row => row.tablename);
    
    if (tables.length === 0) {
      console.log('✅ No tables found. Database is already empty.');
      await pool.end();
      process.exit(0);
    }

    console.log(`Found ${tables.length} table(s): ${tables.join(', ')}\n`);

    // Drop all tables with CASCADE
    for (const table of tables) {
      try {
        await pool.query(`DROP TABLE IF EXISTS "${table}" CASCADE;`);
        console.log(`✅ Deleted: ${table}`);
      } catch (error) {
        console.error(`❌ Failed to delete ${table}:`, error.message);
      }
    }

    console.log('\n✅ All tables deleted!');
    await pool.end();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    // Helpful error messages
    if (error.code === 'ENOTFOUND') {
      console.error('\n💡 DNS Resolution Failed!');
      console.error(`   Cannot resolve hostname: ${dbHostname}`);
      console.error('\n   Diagnosis:');
      console.error('   - DNS might be returning only IPv6 (Node.js may need IPv4)');
      console.error('   - Or Supabase project might be paused/deleted');
      console.error('\n   Possible fixes:');
      console.error('   1. Check Supabase dashboard - is project active?');
      console.error('   2. Get fresh DATABASE_URL from Supabase dashboard');
      console.error('   3. Check your internet connection');
      console.error('   4. Disable VPN/Proxy if active');
      console.error('   5. Try: ipconfig /flushdns');
      console.error('   6. Enable IPv6 in Windows if disabled');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Connection Refused!');
      console.error('   Database server is not accepting connections');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('\n💡 Connection Timeout!');
      console.error('   Database server did not respond');
    }
    
    await pool.end();
    process.exit(1);
  }
}

deleteAllTables();

