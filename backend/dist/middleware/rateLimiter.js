"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookLimiter = exports.emailLimiter = exports.demoLimiter = exports.aiLimiter = exports.syncLimiter = exports.authSlowDown = exports.authLimiter = exports.apiLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_slow_down_1 = __importDefault(require("express-slow-down"));
const rateLimits_1 = require("../config/rateLimits");
// ============================================================================
// RATE LIMITERS - Used to protect API endpoints from abuse
// ============================================================================
// Configuration is in src/config/rateLimits.ts
// All limits are environment-aware:
// - DEV: Generous limits for testing and development
// - PROD: Strict limits for security and reliability
// ============================================================================
const limits = rateLimits_1.RATE_LIMITS;
const isDev = (0, rateLimits_1.isDevEnvironment)();
/**
 * General API rate limiter
 * Dev: 1000 requests per 15 minutes
 * Prod: 100 requests per 15 minutes
 */
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: limits.api.windowMs,
    max: (0, rateLimits_1.getRateLimit)('api'),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
});
/**
 * Authentication rate limiter (brute force protection)
 * Dev: 100 attempts per 15 minutes
 * Prod: 10 attempts per 15 minutes
 */
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: limits.auth.windowMs,
    max: (0, rateLimits_1.getRateLimit)('auth'),
    message: { error: 'Too many login attempts. Please wait 15 minutes.' },
});
/**
 * Progressive delay for auth attempts
 * Reduces credential-stuffing attacks by adding delays after repeated attempts
 * Dev: Delay after 50 attempts (100ms, max 1s)
 * Prod: Delay after 3 attempts (500ms, max 4s)
 */
exports.authSlowDown = (0, express_slow_down_1.default)({
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
exports.syncLimiter = (0, express_rate_limit_1.default)({
    windowMs: limits.stripe.windowMs,
    max: (0, rateLimits_1.getRateLimit)('stripe'),
    message: { error: 'Sync limit reached. Try again in a few minutes.' },
});
/**
 * AI endpoints rate limiter (calls expensive LLM APIs)
 * Dev: 200 requests per minute
 * Prod: 20 requests per minute
 */
exports.aiLimiter = (0, express_rate_limit_1.default)({
    windowMs: limits.ai.windowMs,
    max: (0, rateLimits_1.getRateLimit)('ai'),
    message: { error: 'AI rate limit reached. Please slow down.' },
});
/**
 * Demo endpoint limiter
 * Dev: Unlimited (10000 per minute)
 * Prod: Limited to 5 per minute for demo protection
 */
exports.demoLimiter = (0, express_rate_limit_1.default)({
    windowMs: limits.demo.windowMs,
    max: (0, rateLimits_1.getRateLimit)('demo'),
    message: { error: 'Demo requests exceeded. Please try again later.' },
});
/**
 * Email endpoints limiter
 * Dev: 500 per 5 minutes
 * Prod: 50 per 5 minutes
 */
exports.emailLimiter = (0, express_rate_limit_1.default)({
    windowMs: limits.email.windowMs,
    max: (0, rateLimits_1.getRateLimit)('email'),
    message: { error: 'Email rate limit reached. Please slow down.' },
});
/**
 * Webhook limiter (no auth required, needs extra protection)
 * Dev: 1000 per minute
 * Prod: 100 per minute
 */
exports.webhookLimiter = (0, express_rate_limit_1.default)({
    windowMs: limits.webhook.windowMs,
    max: (0, rateLimits_1.getRateLimit)('webhook'),
    message: { error: 'Webhook rate limit reached.' },
});
