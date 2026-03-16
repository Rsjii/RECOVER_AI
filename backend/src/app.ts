import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { randomUUID } from 'crypto';
import { config } from './config/env';
import authRoutes from './routes/auth';
import stripeRoutes from './routes/stripe';
import aiRoutes from './routes/ai';
import emailRoutes from './routes/email';
import paymentPlanRoutes from './routes/paymentPlan';
import dashboardRoutes from './routes/dashboard';
import invoiceRoutes from './routes/invoices';
import customerRoutes from './routes/customers';
import settingsRoutes from './routes/settings';
import billingRoutes from './routes/billing';
import teamRoutes from './routes/team';
import complianceRoutes from './routes/compliance';
import policyRoutes from './routes/policy';
import entitlementsRoutes from './routes/entitlements';
import featureFlagsRoutes from './routes/featureFlags';
import quickbooksRoutes from './routes/quickbooks';
import chargebeeRoutes from './routes/chargebee';
import demoRoutes from './routes/demo';
import adminRoutes from './routes/admin';
import { getRequestContext, logError, logInfo, logWarn, withRequestContext } from './utils/logger';
import { apiLimiter, authLimiter, authSlowDown, syncLimiter, aiLimiter } from './middleware/rateLimiter';

const app = express();

// Trust proxy for rate limiting and logging (important for Railway/production)
app.set('trust proxy', 1);

app.use(helmet({
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
app.use(compression());

const defaultAllowedOrigins = ['http://localhost:5173', 'http://localhost:3001'];
const envAllowedOrigins = (config.frontendUrl || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envAllowedOrigins]));

logInfo('app', 'cors', 'Allowed frontend origins configured', { allowedOrigins });

app.use(cors({
  origin: (origin, callback) => {
    // Non-browser clients do not need CORS headers.
    if (!origin) {
      return callback(null, false);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, origin);
    }

    logWarn('app', 'cors', 'Blocked CORS origin', { origin, allowedOrigins });
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
}));

// Webhooks must receive raw body (before json parser)
app.use('/webhooks', express.raw({ type: 'application/json' }));
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use('/api/email/webhook/sendgrid', express.json());

// CSV upload receives plain text body
app.use('/api/invoices/csv-upload', express.text({ type: '*/*', limit: '5mb' }));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request correlation middleware
app.use((req, res, next) => {
  const incomingRequestId = req.header('x-request-id');
  const requestId = incomingRequestId && incomingRequestId.length <= 128
    ? incomingRequestId
    : randomUUID();

  (req as any).requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const context = getRequestContext(req);
  return withRequestContext(context, next);
});

// Normalize error response shape across controllers.
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  (res as any).json = (payload: any) => {
    if (res.statusCode >= 400 && payload && typeof payload === 'object') {
      const hasError = typeof payload.error === 'string';
      const hasCode = typeof payload.code === 'string';
      if (hasError && !hasCode) {
        const normalized = {
          code: res.statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
          error: payload.error,
          details: payload.details,
          requestId: (req as any).requestId || req.header('x-request-id') || undefined,
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
    logInfo('app', 'request', 'Incoming API request');
    res.on('finish', () => {
      logInfo('app', 'request', 'API request completed', {
        statusCode: res.statusCode,
        elapsedMs: Date.now() - startedAt,
      });
    });
  }
  next();
});

// Rate limiters (must be before routes)
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/login', authSlowDown);
app.use('/api/auth/signup', authSlowDown);
app.use('/api/auth/forgot-password', authSlowDown);
app.use('/api/stripe/sync', syncLimiter);
app.use('/api/ai', aiLimiter);
app.use('/api/', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/payment-plans', paymentPlanRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/policy', policyRoutes);
app.use('/api/entitlements', entitlementsRoutes);
app.use('/api/feature-flags', featureFlagsRoutes);
app.use('/api/quickbooks', quickbooksRoutes);
app.use('/api/chargebee', chargebeeRoutes);
app.use('/api/demo', demoRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
  });
});

app.get('/ready', (_req: Request, res: Response) => {
  res.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
  });
});

app.get('/live', (_req: Request, res: Response) => {
  res.json({
    status: 'live',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    error: 'Not found',
    requestId: (_req as any).requestId || _req.header('x-request-id') || undefined,
  });
});

// Global error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logError('app', 'globalErrorHandler', 'Unhandled error', err);
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    error: config.nodeEnv === 'production' ? 'Internal server error' : err.message,
    requestId: (_req as any).requestId || _req.header('x-request-id') || undefined,
  });
});

export default app;
