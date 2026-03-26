import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
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
 */
function makeRedisStore(prefix: string) {
  try {
    return new RedisStore({
      sendCommand: (...args: string[]) => (redisClient as any).sendCommand(args),
      prefix: `rl:${prefix}:`,
    });
  } catch (err) {
    // Fall back to memory store if Redis fails
    return undefined;
  }
}

/**
 * General API rate limiter
 * Dev: 1000 requests per 15 minutes
 * Prod: 100 requests per 15 minutes
 */
export const apiLimiter = rateLimit({
  windowMs: limits.api.windowMs,
  max: getRateLimit('api'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
  store: makeRedisStore('api'),
});

/**
 * Authentication rate limiter (brute force protection)
 * Dev: 100 attempts per 15 minutes
 * Prod: 10 attempts per 15 minutes
 */
export const authLimiter = rateLimit({
  windowMs: limits.auth.windowMs,
  max: getRateLimit('auth'),
  message: { error: 'Too many login attempts. Please wait 15 minutes.' },
  store: makeRedisStore('auth'),
});

/**
 * Progressive delay for auth attempts
 * Reduces credential-stuffing attacks by adding delays after repeated attempts
 * Dev: Delay after 50 attempts (100ms, max 1s)
 * Prod: Delay after 3 attempts (500ms, max 4s)
 */
export const authSlowDown = slowDown({
  windowMs: limits.authSlowDown.windowMs,
  delayAfter: isDev ? limits.authSlowDown.delayAfter.dev : limits.authSlowDown.delayAfter.prod,
  delayMs: () => (isDev ? limits.authSlowDown.delayMs.dev : limits.authSlowDown.delayMs.prod),
  maxDelayMs: isDev ? limits.authSlowDown.maxDelayMs.dev : limits.authSlowDown.maxDelayMs.prod,
});

/**
 * Stripe sync rate limiter (expensive external API calls)
 * Dev: 50 syncs per 10 minutes
 * Prod: 5 syncs per 10 minutes
 */
export const syncLimiter = rateLimit({
  windowMs: limits.stripe.windowMs,
  max: getRateLimit('stripe'),
  message: { error: 'Sync limit reached. Try again in a few minutes.' },
  store: makeRedisStore('sync'),
});

/**
 * AI endpoints rate limiter (calls expensive LLM APIs)
 * Dev: 200 requests per minute
 * Prod: 20 requests per minute
 */
export const aiLimiter = rateLimit({
  windowMs: limits.ai.windowMs,
  max: getRateLimit('ai'),
  message: { error: 'AI rate limit reached. Please slow down.' },
});

/**
 * Demo endpoint limiter
 * Dev: Unlimited (10000 per minute)
 * Prod: Limited to 5 per minute for demo protection
 */
export const demoLimiter = rateLimit({
  windowMs: limits.demo.windowMs,
  max: getRateLimit('demo'),
  message: { error: 'Demo requests exceeded. Please try again later.' },
});

/**
 * Email endpoints limiter
 * Dev: 500 per 5 minutes
 * Prod: 50 per 5 minutes
 */
export const emailLimiter = rateLimit({
  windowMs: limits.email.windowMs,
  max: getRateLimit('email'),
  message: { error: 'Email rate limit reached. Please slow down.' },
  store: makeRedisStore('email'),
});

/**
 * Webhook limiter (no auth required, needs extra protection)
 * Dev: 1000 per minute
 * Prod: 100 per minute
 */
export const webhookLimiter = rateLimit({
  windowMs: limits.webhook.windowMs,
  max: getRateLimit('webhook'),
  message: { error: 'Webhook rate limit reached.' },
  store: makeRedisStore('webhook'),
});

/**
 * Audit OTP limiter (email verification)
 * Dev: 100 OTP sends per 15 minutes
 * Prod: 5 OTP sends per 15 minutes
 */
export const auditOtpLimiter = rateLimit({
  windowMs: limits.auditOtp.windowMs,
  max: getRateLimit('auditOtp'),
  message: { error: 'Too many OTP requests. Wait 15 minutes.' },
  store: makeRedisStore('audit-otp'),
  keyGenerator: (req) => req.ip || 'unknown',
});

/**
 * Public form limiter (pilot request, payment plan accept, audit request)
 * Dev: 100 submissions per hour
 * Prod: 10 submissions per hour
 */
export const publicFormLimiter = rateLimit({
  windowMs: limits.publicForm.windowMs,
  max: getRateLimit('publicForm'),
  message: { error: 'Too many requests. Try again in an hour.' },
  store: makeRedisStore('public-form'),
  keyGenerator: (req) => req.ip || 'unknown',
});

