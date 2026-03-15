import { Pool } from 'pg';
import { config } from './env';
import { DB_RETRY, DB_POOL_CONFIG } from './constants';
import { logger } from './logger';

const databaseUrl = config.databaseUrl || '';
const isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
const sslModeDisabled = databaseUrl.includes('sslmode=disable');

const poolConfig: any = {
  connectionString: databaseUrl,
  ...DB_POOL_CONFIG,
  statement_timeout: 30000,
  query_timeout: 30000,
};

if (sslModeDisabled || isLocalhost) {
  poolConfig.ssl = false;
}

const pool = new Pool(poolConfig);

pool.on('error', (err: any) => {
  if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') return;
  logger.error({ err }, '[DB_POOL_ERROR] Unexpected database pool error');
});

export const db = {
  query: async (text: string, params?: any[]) => {
    const start = Date.now();
    let attempts = 0;
    while (attempts < DB_RETRY.MAX_ATTEMPTS) {
      try {
        const res = params && params.length > 0
          ? await pool.query(text, params)
          : await pool.query(text);
        return res;
      } catch (error: any) {
        attempts++;
        logger.error({ err: error, query: text.substring(0, 200), attempt: attempts }, '[DB] query error');
        if (attempts >= DB_RETRY.MAX_ATTEMPTS) throw error;
        await new Promise(r => setTimeout(r, DB_RETRY.BASE_DELAY_MS * attempts));
      }
    }
    throw new Error('DB query failed after all retries');
  },

  getClient: async () => pool.connect(),
  close: async () => pool.end(),
};

export default db;
export { pool };
