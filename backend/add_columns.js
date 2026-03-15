const { pool } = require('./dist/config/database');

async function addColumns() {
  const client = await pool.connect();
  try {
    console.log('Adding missing columns to users table...');
    
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'member',
      ADD COLUMN IF NOT EXISTS first_name VARCHAR,
      ADD COLUMN IF NOT EXISTS last_name VARCHAR,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
    `);
    
    console.log('✓ Columns added');
    
    await client.query(`
      ALTER TABLE audit_logs
      ADD COLUMN IF NOT EXISTS details JSONB
    `);
    
    console.log('✓ Audit logs updated');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

addColumns();
