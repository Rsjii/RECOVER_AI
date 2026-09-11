import { createClient } from 'redis';
import { config } from './env';
import { logError, logInfo, logWarn } from '../utils/logger';

if (!config.redisUrl) {
  throw new Error('REDIS_URL is required');
}

// rediss:// URL already signals TLS to the redis client automatically.
// Socket options: reconnect strategy with backoff, no explicit tls field needed
export const redisClient = createClient({
  url: config.redisUrl,
  socket: {
    reconnectStrategy: (retries: number) => {
      if (retries > 5) {
        logWarn('redis', 'reconnectStrategy', 'Max reconnection attempts (5) reached - giving up');
        return new Error('Max Redis reconnections exceeded');
      }
      const delay = Math.min(retries * 500, 3000);
      logWarn('redis', 'reconnectStrategy', 'Reconnection scheduled', {
        attempt: retries + 1,
        delayMs: delay,
      });
      return delay;
    },
  },
});

// Connection lifecycle logging
redisClient.on('connect', () => {
  logInfo('redis', 'event:connect', 'Connected');
});

redisClient.on('ready', () => {
  logInfo('redis', 'event:ready', 'Ready');
});

// Errors are expected when Redis is unreachable (demo mode) - warn, don't crash.
// connectRedis() below decides whether to fail startup.
redisClient.on('error', (err: Error) => {
  logWarn('redis', 'event:error', 'Redis client error (non-fatal)', { errorMessage: err.message });
});

redisClient.on('reconnecting', () => {
  logWarn('redis', 'event:reconnecting', 'Reconnecting...');
});

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// Flag to track if Redis connection is available
let redisConnected = false;

export function isRedisConnected(): boolean {
  return redisConnected;
}

export async function connectRedis(): Promise<void> {
  try {
    logInfo('redis', 'connectRedis', 'Starting connection...');

    if (!redisClient.isOpen) {
      logInfo('redis', 'connectRedis', 'Connecting to Redis', { timeoutMs: 8000 });
      await withTimeout(redisClient.connect(), 8000);
      logInfo('redis', 'connectRedis', 'Connected, sending ping...');
    }

    const pong = await withTimeout(redisClient.ping(), 5000);
    logInfo('redis', 'connectRedis', 'Connected to Redis', { ping: pong });
    redisConnected = true;
  } catch (err: any) {
    // Demo mode: Redis is optional. Log and continue instead of crashing the server.
    // Password login and Supabase-backed reads work without Redis; only OTP
    // signup, email-preview cache, and risk-score cache degrade.
    logWarn('redis', 'connectRedis', 'Connection failed - continuing without Redis (cache/OTP/queues disabled)', {
      error: err.message,
    });
    redisConnected = false;
  }
}

export const bullRedisUrl = config.redisUrl;
