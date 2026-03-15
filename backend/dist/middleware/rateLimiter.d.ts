/**
 * General API rate limiter
 * Dev: 1000 requests per 15 minutes
 * Prod: 100 requests per 15 minutes
 */
export declare const apiLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Authentication rate limiter (brute force protection)
 * Dev: 100 attempts per 15 minutes
 * Prod: 10 attempts per 15 minutes
 */
export declare const authLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Progressive delay for auth attempts
 * Reduces credential-stuffing attacks by adding delays after repeated attempts
 * Dev: Delay after 50 attempts (100ms, max 1s)
 * Prod: Delay after 3 attempts (500ms, max 4s)
 */
export declare const authSlowDown: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Stripe sync rate limiter (expensive external API calls)
 * Dev: 50 syncs per 10 minutes
 * Prod: 5 syncs per 10 minutes
 */
export declare const syncLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * AI endpoints rate limiter (calls expensive LLM APIs)
 * Dev: 200 requests per minute
 * Prod: 20 requests per minute
 */
export declare const aiLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Demo endpoint limiter
 * Dev: Unlimited (10000 per minute)
 * Prod: Limited to 5 per minute for demo protection
 */
export declare const demoLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Email endpoints limiter
 * Dev: 500 per 5 minutes
 * Prod: 50 per 5 minutes
 */
export declare const emailLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Webhook limiter (no auth required, needs extra protection)
 * Dev: 1000 per minute
 * Prod: 100 per minute
 */
export declare const webhookLimiter: import("express-rate-limit").RateLimitRequestHandler;
