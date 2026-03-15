export const DB_RETRY = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY_MS: 1000,
} as const;

export const DB_POOL_CONFIG = {
  max: process.env.NODE_ENV === 'production' ? 20 : 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  acquireTimeoutMillis: 30000,
  createTimeoutMillis: 30000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
} as const;
