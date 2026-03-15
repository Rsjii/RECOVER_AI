"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.testDbConnection = testDbConnection;
exports.query = query;
exports.transaction = transaction;
const pg_1 = require("pg");
const env_1 = require("./env");
const logger_1 = require("../utils/logger");
if (!env_1.config.databaseUrl) {
    throw new Error('DATABASE_URL is required');
}
// Supabase sometimes gives Python-format URL (postgresql+psycopg://)
// Node.js pg library needs postgresql:// or postgres://
const cleanDbUrl = env_1.config.databaseUrl
    .replace('postgresql+psycopg://', 'postgresql://')
    .replace('postgres+psycopg://', 'postgresql://');
const poolConfig = {
    connectionString: cleanDbUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
};
// SSL required for Supabase (both dev and prod)
if (cleanDbUrl.includes('supabase') || env_1.config.nodeEnv === 'production') {
    poolConfig.ssl = { rejectUnauthorized: false };
}
exports.pool = new pg_1.Pool(poolConfig);
const originalPoolQuery = exports.pool.query.bind(exports.pool);
exports.pool.query = async (...args) => {
    const context = (0, logger_1.getCurrentRequestContext)();
    const companyId = typeof context.companyId === 'string' ? context.companyId : undefined;
    if (!companyId) {
        if (args.length === 1) {
            return originalPoolQuery(args[0]);
        }
        return originalPoolQuery(args[0], args[1]);
    }
    const client = await exports.pool.connect();
    try {
        await client.query(`SELECT set_config('app.current_company_id', $1, true)`, [companyId]);
        if (args.length === 1) {
            return client.query(args[0]);
        }
        return client.query(args[0], args[1]);
    }
    finally {
        client.release();
    }
};
exports.pool.on('error', (err) => {
    (0, logger_1.logError)('database', 'pool', 'Idle client error', err);
});
async function testDbConnection() {
    const client = await exports.pool.connect();
    try {
        await client.query('SELECT 1');
        (0, logger_1.logInfo)('database', 'testDbConnection', 'Connected to Supabase');
    }
    finally {
        client.release();
    }
}
async function query(sql, params) {
    const result = await exports.pool.query(sql, params);
    return { rows: result.rows, rowCount: result.rowCount };
}
async function transaction(fn) {
    const client = await exports.pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
