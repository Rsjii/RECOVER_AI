"use strict";
/**
 * Rate Limiting Configuration
 *
 * Different limits for development vs production
 * DEV: Generous limits for testing and development
 * PROD: Strict limits for security and reliability
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RATE_LIMITS = void 0;
exports.getRateLimit = getRateLimit;
exports.isDevEnvironment = isDevEnvironment;
const env_1 = require("./env");
const isDev = env_1.config.nodeEnv === 'development' || env_1.config.nodeEnv === 'dev' || !env_1.config.nodeEnv;
exports.RATE_LIMITS = {
    // General API endpoints
    api: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        dev: 1000,
        prod: 100,
        description: 'General API rate limit',
    },
    // Authentication endpoints (stricter for security)
    auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        dev: 100,
        prod: 10, // Brute force protection
        description: 'Login/signup rate limit - strict to prevent brute force attacks',
    },
    // Auth slowdown (progressive delay after repeated attempts)
    authSlowDown: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        delayAfter: {
            dev: 50, // Start slowing down after 50 attempts
            prod: 3, // Start slowing down after 3 attempts
        },
        delayMs: {
            dev: 100, // 100ms delay
            prod: 500, // 500ms delay
        },
        maxDelayMs: {
            dev: 1000, // Max 1s delay
            prod: 4000, // Max 4s delay
        },
        description: 'Progressive delay to reduce credential-stuffing impact',
    },
    // Stripe sync (expensive operations)
    stripe: {
        windowMs: 10 * 60 * 1000, // 10 minutes
        dev: 50,
        prod: 5,
        description: 'Stripe sync - strict because it hits external API',
    },
    // AI endpoints (expensive operations)
    ai: {
        windowMs: 60 * 1000, // 1 minute
        dev: 200,
        prod: 20,
        description: 'AI generation - strict because it calls expensive LLM APIs',
    },
    // Demo endpoint (no limits - for demo/testing)
    demo: {
        windowMs: 60 * 1000,
        dev: 10000, // No limit in dev
        prod: 5, // Protect in prod - only 5 per minute
        description: 'Demo login endpoint - generous in dev, limited in prod',
    },
    // Email endpoints
    email: {
        windowMs: 5 * 60 * 1000, // 5 minutes
        dev: 500,
        prod: 50,
        description: 'Email sending endpoints',
    },
    // Webhook endpoints (no auth required, need protection)
    webhook: {
        windowMs: 60 * 1000, // 1 minute
        dev: 1000,
        prod: 100,
        description: 'Webhook endpoints - should validate signature anyway',
    },
};
/**
 * Get the appropriate rate limit for the current environment
 */
function getRateLimit(endpoint) {
    const limits = exports.RATE_LIMITS[endpoint];
    // Handle both standard (dev/prod) and complex structures
    return isDev ? limits.dev : limits.prod;
}
/**
 * Check if we're in development mode
 */
function isDevEnvironment() {
    return isDev;
}
