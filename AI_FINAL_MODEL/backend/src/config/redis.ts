import IORedis from 'ioredis';
import { config } from './env';
import { logger } from './logger';

export const redis = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: false,
  tls: config.redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
  retryStrategy: (times) => {
    if (times > 5) return null; // give up after 5 attempts — avoids console spam when Redis is unreachable
    return Math.min(times * 500, 3000);
  },
  connectTimeout: 5000,
  showFriendlyErrorStack: false,
});

// Only log initial connection, not reconnects
let initialConnectionLogged = false;

redis.on('ready', () => {
  if (!initialConnectionLogged) {
    logger.info('[Redis] Connected');
    initialConnectionLogged = true;
  }
});

// Suppress common connection errors that are normal during reconnects
redis.on('error', (err: any) => {
  // Ignore common connection reset/refused errors
  const ignorableErrors = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNABORTED'];
  if (!ignorableErrors.includes(err.code)) {
    logger.error({ err }, '[Redis] Error');
  }
});

export default redis;
