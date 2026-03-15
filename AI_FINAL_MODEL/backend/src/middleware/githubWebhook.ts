import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config/env';
import { logger } from '../config/logger';

export const verifyGithubWebhook = (req: Request, res: Response, next: NextFunction) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  const payload = JSON.stringify(req.body);

  if (!signature) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  const hmac = crypto.createHmac('sha256', config.github.webhookSecret || '');
  const digest = 'sha256=' + hmac.update(payload).digest('hex');

  if (signature !== digest) {
    logger.warn('Invalid GitHub webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
};
