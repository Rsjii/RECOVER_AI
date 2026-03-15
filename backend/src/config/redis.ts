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
        if (config.nodeEnv !== 'development') {
          logError('redis', 'reconnectStrategy', 'Max reconnection attempts (5) reached - giving up');
        }
        return new Error('Max Redis reconnections exceeded');
      }
      if (config.nodeEnv !== 'development') {
        const delay = Math.min(retries * 500, 3000);
        logWarn('redis', 'reconnectStrategy', 'Reconnection scheduled', {
          attempt: retries + 1,
          delayMs: delay,
        });
      }
      return Math.min(retries * 500, 3000);
    },
  },
});

// Connection lifecycle logging - only in non-dev or after successful connection
redisClient.on('connect', () => {
  if (config.nodeEnv !== 'development' || redisClient.isOpen) {
    logInfo('redis', 'event:connect', 'Connected');
  }
});

redisClient.on('ready', () => {
  if (config.nodeEnv !== 'development' || redisClient.isOpen) {
    logInfo('redis', 'event:ready', 'Ready');
  }
});

// Suppress error logging during dev mode - connectRedis will handle it
redisClient.on('error', (err: Error) => {
  if (config.nodeEnv !== 'development') {
    logError('redis', 'event:error', 'Redis client error', err);
  }
});

redisClient.on('reconnecting', () => {
  if (config.nodeEnv !== 'development') {
    logWarn('redis', 'event:reconnecting', 'Reconnecting...');
  }
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
      logInfo('redis', 'connectRedis', 'Connecting to Upstash', { timeoutMs: 8000 });
      try {
        await withTimeout(redisClient.connect(), 8000);
        logInfo('redis', 'connectRedis', 'Connected, sending ping...');
      } catch (connectErr: any) {
        throw new Error(`Redis connect failed: ${connectErr.message}`);
      }
    }

    const pong = await withTimeout(redisClient.ping(), 5000);
    logInfo('redis', 'connectRedis', 'Connected to Upstash', { ping: pong });
    redisConnected = true;
  } catch (err: any) {
    if (config.nodeEnv === 'development') {
      logWarn('redis', 'connectRedis', 'Connection failed (continuing in dev mode without Redis)');
      logWarn('redis', 'connectRedis', 'Connection error', { error: err.message });
      logWarn('redis', 'connectRedis', 'Verify REDIS_URL in .env and Upstash availability');
      redisConnected = false;
      // Don't throw - let server continue without Redis in dev mode
    } else {
      logError('redis', 'connectRedis', 'Connection failed', err);
      throw err;
    }
  }
}

export const bullRedisUrl = config.redisUrl;
