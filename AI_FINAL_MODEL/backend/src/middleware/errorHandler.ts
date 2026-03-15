import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { isProd, config } from '../config/env';

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const errorHandlerMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
  const isApiRequest = req.originalUrl.startsWith('/api/');

  logger.error({
    err: err,
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  }, '❌ ERROR - Full stack trace:');

  if (isApiRequest) {
    return res.status(500).json({
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR',
    });
  }

  if (isProd) {
    return res.status(500).json({
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR',
    });
  }

  return res.status(500).json({
    error: err.message || 'An unexpected error occurred',
    errorCode: 'INTERNAL_ERROR',
  });
};
