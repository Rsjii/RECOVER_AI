"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bullRedisUrl = exports.redisClient = void 0;
exports.isRedisConnected = isRedisConnected;
exports.connectRedis = connectRedis;
const redis_1 = require("redis");
const env_1 = require("./env");
const logger_1 = require("../utils/logger");
if (!env_1.config.redisUrl) {
    throw new Error('REDIS_URL is required');
}
// rediss:// URL already signals TLS to the redis client automatically.
// Socket options: reconnect strategy with backoff, no explicit tls field needed
exports.redisClient = (0, redis_1.createClient)({
    url: env_1.config.redisUrl,
    socket: {
        reconnectStrategy: (retries) => {
            if (retries > 5) {
                if (env_1.config.nodeEnv !== 'development') {
                    (0, logger_1.logError)('redis', 'reconnectStrategy', 'Max reconnection attempts (5) reached - giving up');
                }
                return new Error('Max Redis reconnections exceeded');
            }
            if (env_1.config.nodeEnv !== 'development') {
                const delay = Math.min(retries * 500, 3000);
                (0, logger_1.logWarn)('redis', 'reconnectStrategy', 'Reconnection scheduled', {
                    attempt: retries + 1,
                    delayMs: delay,
                });
            }
            return Math.min(retries * 500, 3000);
        },
    },
});
// Connection lifecycle logging - only in non-dev or after successful connection
exports.redisClient.on('connect', () => {
    if (env_1.config.nodeEnv !== 'development' || exports.redisClient.isOpen) {
        (0, logger_1.logInfo)('redis', 'event:connect', 'Connected');
    }
});
exports.redisClient.on('ready', () => {
    if (env_1.config.nodeEnv !== 'development' || exports.redisClient.isOpen) {
        (0, logger_1.logInfo)('redis', 'event:ready', 'Ready');
    }
});
// Suppress error logging during dev mode - connectRedis will handle it
exports.redisClient.on('error', (err) => {
    if (env_1.config.nodeEnv !== 'development') {
        (0, logger_1.logError)('redis', 'event:error', 'Redis client error', err);
    }
});
exports.redisClient.on('reconnecting', () => {
    if (env_1.config.nodeEnv !== 'development') {
        (0, logger_1.logWarn)('redis', 'event:reconnecting', 'Reconnecting...');
    }
});
function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)),
    ]);
}
// Flag to track if Redis connection is available
let redisConnected = false;
function isRedisConnected() {
    return redisConnected;
}
async function connectRedis() {
    try {
        (0, logger_1.logInfo)('redis', 'connectRedis', 'Starting connection...');
        if (!exports.redisClient.isOpen) {
            (0, logger_1.logInfo)('redis', 'connectRedis', 'Connecting to Upstash', { timeoutMs: 8000 });
            try {
                await withTimeout(exports.redisClient.connect(), 8000);
                (0, logger_1.logInfo)('redis', 'connectRedis', 'Connected, sending ping...');
            }
            catch (connectErr) {
                throw new Error(`Redis connect failed: ${connectErr.message}`);
            }
        }
        const pong = await withTimeout(exports.redisClient.ping(), 5000);
        (0, logger_1.logInfo)('redis', 'connectRedis', 'Connected to Upstash', { ping: pong });
        redisConnected = true;
    }
    catch (err) {
        if (env_1.config.nodeEnv === 'development') {
            (0, logger_1.logWarn)('redis', 'connectRedis', 'Connection failed (continuing in dev mode without Redis)');
            (0, logger_1.logWarn)('redis', 'connectRedis', 'Connection error', { error: err.message });
            (0, logger_1.logWarn)('redis', 'connectRedis', 'Verify REDIS_URL in .env and Upstash availability');
            redisConnected = false;
            // Don't throw - let server continue without Redis in dev mode
        }
        else {
            (0, logger_1.logError)('redis', 'connectRedis', 'Connection failed', err);
            throw err;
        }
    }
}
exports.bullRedisUrl = env_1.config.redisUrl;
