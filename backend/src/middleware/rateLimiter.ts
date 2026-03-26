import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { Request, Response, NextFunction } from 'express';
import { RedisStore } from 'rate-limit-redis';
import { RATE_LIMITS, getRateLimit, isDevEnvironment } from '../config/rateLimits';
import { redisClient } from '../config/redis';

// ============================================================================
// RATE LIMITERS - Used to protect API endpoints from abuse
// ============================================================================
// Configuration is in src/config/rateLimits.ts
// All limits are environment-aware:
// - DEV: Generous limits for testing and development
// - PROD: Strict limits for security and reliability
// ============================================================================

const limits = RATE_LIMITS;
const isDev = isDevEnvironment();

/**
 * Create a Redis store for rate limiting (fails gracefully if Redis unavailable)
 * Returns undefined to fall back to in-memory store if Redis is not ready
 */
function makeRedisStore(prefix: string) {
  try {
    // Check if Redis client is ready before creating store
    const client = redisClient as any;
    if (!client || !client.sendCommand || !client.isOpen) {
      return undefined;
    }

    return new RedisStore({
      sendCommand: (...args: string[]) => client.sendCommand(args),
      prefix: `rl:${prefix}:`,
    });
  } catch (err) {
    // Silently fall back to memory store if Redis fails
    // This can happen if Redis is not available or client is closed
    return undefined;
  }
}

/**
 * Wrapper to disable rate limiting in development mode
 * In dev: returns a no-op middleware (no rate limiting)
 * In prod: returns the actual rate limiter
 */
function createLimiter(limiterConfig: any) {
  if (isDev) {
    // In development, don't rate limit - just pass through
    return (req: Request, res: Response, next: NextFunction) => next();
  }
  return rateLimit(limiterConfig);
}

/**
 * General API rate limiter
 * Dev: Disabled (no rate limiting in development)
 * Prod: 100 requests per 15 minutes
 */
export const apiLimiter = createLimiter({
  windowMs: limits.api.windowMs,
  max: getRateLimit('api'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
  store: makeRedisStore('api'),
});

/**
 * Authentication rate limiter (brute force protection)
 * Dev: Disabled (no rate limiting in development)
 * Prod: 10 attempts per 15 minutes
 */
export const authLimiter = createLimiter({
  windowMs: limits.auth.windowMs,
  max: getRateLimit('auth'),
  message: { error: 'Too many login attempts. Please wait 15 minutes.' },
  store: makeRedisStore('auth'),
});

/**
 * Progressive delay for auth attempts
 * Reduces credential-stuffing attacks by adding delays after repeated attempts
 * Dev: No delay (disabled in development)
 * Prod: Delay after 3 attempts (500ms, max 4s)
 */
export const authSlowDown = slowDown({
  windowMs: limits.authSlowDown.windowMs,
  delayAfter: isDev ? 999999 : limits.authSlowDown.delayAfter.prod, // Effectively disabled in dev
  delayMs: () => (isDev ? 0 : limits.authSlowDown.delayMs.prod),
  maxDelayMs: isDev ? 0 : limits.authSlowDown.maxDelayMs.prod,
});

/**
 * Stripe sync rate limiter (expensive external API calls)
 * Dev: Disabled (no rate limiting in development)
 * Prod: 5 syncs per 10 minutes
 */
export const syncLimiter = createLimiter({
  windowMs: limits.stripe.windowMs,
  max: getRateLimit('stripe'),
  message: { error: 'Sync limit reached. Try again in a few minutes.' },
  store: makeRedisStore('sync'),
});

/**
 * AI endpoints rate limiter (calls expensive LLM APIs)
 * Dev: Disabled (no rate limiting in development)
 * Prod: 20 requests per minute
 */
export const aiLimiter = createLimiter({
  windowMs: limits.ai.windowMs,
  max: getRateLimit('ai'),
  message: { error: 'AI rate limit reached. Please slow down.' },
});

/**
 * Demo endpoint limiter
 * Dev: Disabled (no rate limiting in development)
 * Prod: Limited to 5 per minute for demo protection
 */
export const demoLimiter = createLimiter({
  windowMs: limits.demo.windowMs,
  max: getRateLimit('demo'),
  message: { error: 'Demo requests exceeded. Please try again later.' },
});

/**
 * Email endpoints limiter
 * Dev: Disabled (no rate limiting in development)
 * Prod: 50 per 5 minutes
 */
export const emailLimiter = createLimiter({
  windowMs: limits.email.windowMs,
  max: getRateLimit('email'),
  message: { error: 'Email rate limit reached. Please slow down.' },
  store: makeRedisStore('email'),
});

/**
 * Webhook limiter (no auth required, needs extra protection)
 * Dev: Disabled (no rate limiting in development)
 * Prod: 100 per minute
 */
export const webhookLimiter = createLimiter({
  windowMs: limits.webhook.windowMs,
  max: getRateLimit('webhook'),
  message: { error: 'Webhook rate limit reached.' },
  store: makeRedisStore('webhook'),
});

/**
 * Audit OTP limiter (email verification)
 * Dev: Disabled (no rate limiting in development)
 * Prod: 5 OTP sends per 15 minutes
 */
export const auditOtpLimiter = createLimiter({
  windowMs: limits.auditOtp.windowMs,
  max: getRateLimit('auditOtp'),
  message: { error: 'Too many OTP requests. Wait 15 minutes.' },
  store: makeRedisStore('audit-otp'),
  keyGenerator: ipKeyGenerator,
});

/**
 * Public form limiter (pilot request, payment plan accept, audit request)
 * Dev: Disabled (no rate limiting in development)
 * Prod: 10 submissions per hour
 */
export const publicFormLimiter = createLimiter({
  windowMs: limits.publicForm.windowMs,
  max: getRateLimit('publicForm'),
  message: { error: 'Too many requests. Try again in an hour.' },
  store: makeRedisStore('public-form'),
  keyGenerator: ipKeyGenerator,
});

