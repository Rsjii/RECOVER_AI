import { Request, Response, NextFunction } from 'express';
import { verify } from 'jsonwebtoken';
import { config } from '../config/env';
import { JWTPayload } from '../types/auth';
import { getRequestContext, logError, logInfo } from '../utils/logger';

const LOG_MODULE = 'authMiddleware';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.access_token;

    if (!token) {
      logInfo(LOG_MODULE, 'authMiddleware', 'No access token', getRequestContext(req));
      return res.status(401).json({ error: 'No access token' });
    }

    if (!config.jwtSecret) {
      logError(LOG_MODULE, 'authMiddleware', 'JWT_SECRET not configured', undefined, getRequestContext(req));
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    const decoded = verify(token, config.jwtSecret) as JWTPayload;

    // Attach to request object
    (req as any).userId = decoded.userId;
    (req as any).companyId = decoded.companyId;
    (req as any).email = decoded.email;
    (req as any).isDemo = decoded.is_demo || false;  // Extract demo flag from JWT

    next();
  } catch (err: any) {
    const reason = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    logInfo(LOG_MODULE, 'authMiddleware', reason, getRequestContext(req));
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
