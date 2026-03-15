import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { RATE_LIMITS, getRateLimit, isDevEnvironment } from '../config/rateLimits';

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
});

