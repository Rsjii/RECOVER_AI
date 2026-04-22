import { Pool, PoolClient, PoolConfig } from 'pg';
import { config } from './env';
import { getCurrentRequestContext, logError, logInfo } from '../utils/logger';

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

// Supabase sometimes gives Python-format URL (postgresql+psycopg://)
// Node.js pg library needs postgresql:// or postgres://
const cleanDbUrl = config.databaseUrl
  .replace('postgresql+psycopg://', 'postgresql://')
  .replace('postgres+psycopg://', 'postgresql://');

const poolConfig: PoolConfig = {
  connectionString: cleanDbUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // SSL required for Supabase (disable cert verification for self-signed certs)
  ssl: {
    rejectUnauthorized: false,
  },
};

export const pool = new Pool(poolConfig);

const originalPoolQuery = pool.query.bind(pool);
(pool as any).query = async (...args: any[]) => {
  const context = getCurrentRequestContext();
  const companyId = typeof context.companyId === 'string' ? context.companyId : undefined;

  if (!companyId) {
    if (args.length === 1) {
      return originalPoolQuery(args[0]);
    }
    return originalPoolQuery(args[0], args[1]);
  }

  const client = await pool.connect();
  try {
    await client.query(`SELECT set_config('app.current_company_id', $1, true)`, [companyId]);
    if (args.length === 1) {
      return client.query(args[0]);
    }
    return client.query(args[0], args[1]);
  } finally {
    client.release();
  }
};

pool.on('error', (err: Error) => {
  logError('database', 'pool', 'Idle client error', err);
});

export async function testDbConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    logInfo('database', 'testDbConnection', 'Connected to Supabase');
  } finally {
    client.release();
  }
}

export async function query<T = any>(
  sql: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number | null }> {
  const result = await pool.query(sql, params);
  return { rows: result.rows as T[], rowCount: result.rowCount };
}

export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

