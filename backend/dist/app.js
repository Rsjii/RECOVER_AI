"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const compression_1 = __importDefault(require("compression"));
const crypto_1 = require("crypto");
const env_1 = require("./config/env");
const auth_1 = __importDefault(require("./routes/auth"));
const stripe_1 = __importDefault(require("./routes/stripe"));
const ai_1 = __importDefault(require("./routes/ai"));
const email_1 = __importDefault(require("./routes/email"));
const paymentPlan_1 = __importDefault(require("./routes/paymentPlan"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const invoices_1 = __importDefault(require("./routes/invoices"));
const customers_1 = __importDefault(require("./routes/customers"));
const settings_1 = __importDefault(require("./routes/settings"));
const billing_1 = __importDefault(require("./routes/billing"));
const team_1 = __importDefault(require("./routes/team"));
const compliance_1 = __importDefault(require("./routes/compliance"));
const policy_1 = __importDefault(require("./routes/policy"));
const entitlements_1 = __importDefault(require("./routes/entitlements"));
const featureFlags_1 = __importDefault(require("./routes/featureFlags"));
const quickbooks_1 = __importDefault(require("./routes/quickbooks"));
const chargebee_1 = __importDefault(require("./routes/chargebee"));
const demo_1 = __importDefault(require("./routes/demo"));
const logger_1 = require("./utils/logger");
const rateLimiter_1 = require("./middleware/rateLimiter");
const app = (0, express_1.default)();
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            frameAncestors: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
        },
    },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
}));
app.use((0, compression_1.default)());
const defaultAllowedOrigins = ['http://localhost:5173', 'http://localhost:3001'];
const envAllowedOrigins = (env_1.config.frontendUrl || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envAllowedOrigins]));
(0, logger_1.logInfo)('app', 'cors', 'Allowed frontend origins configured', { allowedOrigins });
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Non-browser clients do not need CORS headers.
        if (!origin) {
            return callback(null, false);
        }
        if (allowedOrigins.includes(origin)) {
            return callback(null, origin);
        }
        (0, logger_1.logWarn)('app', 'cors', 'Blocked CORS origin', { origin, allowedOrigins });
        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
}));
// Webhooks must receive raw body (before json parser)
app.use('/webhooks', express_1.default.raw({ type: 'application/json' }));
app.use('/api/stripe/webhook', express_1.default.raw({ type: 'application/json' }));
app.use('/api/email/webhook/sendgrid', express_1.default.json());
// CSV upload receives plain text body
app.use('/api/invoices/csv-upload', express_1.default.text({ type: '*/*', limit: '5mb' }));
app.use(express_1.default.json({ limit: '2mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
// Request correlation middleware
app.use((req, res, next) => {
    const incomingRequestId = req.header('x-request-id');
    const requestId = incomingRequestId && incomingRequestId.length <= 128
        ? incomingRequestId
        : (0, crypto_1.randomUUID)();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    const context = (0, logger_1.getRequestContext)(req);
    return (0, logger_1.withRequestContext)(context, next);
});
// Normalize error response shape across controllers.
app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (payload) => {
        if (res.statusCode >= 400 && payload && typeof payload === 'object') {
            const hasError = typeof payload.error === 'string';
            const hasCode = typeof payload.code === 'string';
            if (hasError && !hasCode) {
                const normalized = {
                    code: res.statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
                    error: payload.error,
                    details: payload.details,
                    requestId: req.requestId || req.header('x-request-id') || undefined,
                };
                return originalJson(normalized);
            }
        }
        return originalJson(payload);
    };
    next();
});
// Request logger
app.use((req, res, next) => {
    if (req.path.includes('/api/')) {
        const startedAt = Date.now();
        (0, logger_1.logInfo)('app', 'request', 'Incoming API request');
        res.on('finish', () => {
            (0, logger_1.logInfo)('app', 'request', 'API request completed', {
                statusCode: res.statusCode,
                elapsedMs: Date.now() - startedAt,
            });
        });
    }
    next();
});
// Rate limiters (must be before routes)
app.use('/api/auth/login', rateLimiter_1.authLimiter);
app.use('/api/auth/signup', rateLimiter_1.authLimiter);
app.use('/api/auth/login', rateLimiter_1.authSlowDown);
app.use('/api/auth/signup', rateLimiter_1.authSlowDown);
app.use('/api/auth/forgot-password', rateLimiter_1.authSlowDown);
app.use('/api/stripe/sync', rateLimiter_1.syncLimiter);
app.use('/api/ai', rateLimiter_1.aiLimiter);
app.use('/api/', rateLimiter_1.apiLimiter);
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/stripe', stripe_1.default);
app.use('/api/ai', ai_1.default);
app.use('/api/email', email_1.default);
app.use('/api/payment-plans', paymentPlan_1.default);
app.use('/api/dashboard', dashboard_1.default);
app.use('/api/invoices', invoices_1.default);
app.use('/api/customers', customers_1.default);
app.use('/api/settings', settings_1.default);
app.use('/api/billing', billing_1.default);
app.use('/api/team', team_1.default);
app.use('/api/compliance', compliance_1.default);
app.use('/api/policy', policy_1.default);
app.use('/api/entitlements', entitlements_1.default);
app.use('/api/feature-flags', featureFlags_1.default);
app.use('/api/quickbooks', quickbooks_1.default);
app.use('/api/chargebee', chargebee_1.default);
app.use('/api/demo', demo_1.default);
// Health check
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        env: env_1.config.nodeEnv,
    });
});
app.get('/ready', (_req, res) => {
    res.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        env: env_1.config.nodeEnv,
    });
});
app.get('/live', (_req, res) => {
    res.json({
        status: 'live',
        timestamp: new Date().toISOString(),
    });
});
// 404 handler
app.use((_req, res) => {
    res.status(404).json({
        code: 'NOT_FOUND',
        error: 'Not found',
        requestId: _req.requestId || _req.header('x-request-id') || undefined,
    });
});
// Global error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
    (0, logger_1.logError)('app', 'globalErrorHandler', 'Unhandled error', err);
    res.status(500).json({
        code: 'INTERNAL_ERROR',
        error: env_1.config.nodeEnv === 'production' ? 'Internal server error' : err.message,
        requestId: _req.requestId || _req.header('x-request-id') || undefined,
    });
});
exports.default = app;
