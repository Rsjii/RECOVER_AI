import { Request, Response, NextFunction } from 'express';
import { logWarn } from '../utils/logger';

const LOG_MODULE = 'demoBlocker';

/**
 * Middleware to block all mutations (POST, PUT, DELETE, PATCH) for demo accounts
 * Demo users can only READ data (GET requests)
 */
/**
 * Middleware to block all mutations (POST, PUT, DELETE, PATCH) for demo accounts
 * IMPORTANT: This must run AFTER authMiddleware sets req.isDemo
 * Applied as a route middleware, not global, to ensure proper execution order
 */
export const demoBlocker = (req: Request, res: Response, next: NextFunction) => {
  // Only check on mutation methods
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    return next();
  }

  // Check if user is demo (set by authMiddleware)
  const isDemo = (req as any).isDemo;
  if (isDemo === true) {  // Explicit true check — must be set by authMiddleware
    logWarn(LOG_MODULE, 'demoBlocker', 'Demo user attempted mutation', {
      userId: (req as any).userId,
      method: req.method,
      path: req.path,
    });

    return res.status(403).json({
      error: 'Demo Mode — Read-only',
      code: 'DEMO_READ_ONLY',
      message: 'Demo accounts cannot make changes. This is a read-only demonstration.',
    });
  }

  next();
};
