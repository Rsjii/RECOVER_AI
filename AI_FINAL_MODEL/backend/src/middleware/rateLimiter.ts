import rateLimit from 'express-rate-limit';

// Auth endpoints: 20 req / 15 min (prevents brute-force)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication requests. Please wait and try again.' },
});

// Search: triggers Claude API call — limit to 10/min per IP
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Search rate limit exceeded. Please wait a moment.' },
});

// General API: 200 req/min, skip health checks
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
  skip: (req) => req.path === '/health',
});
