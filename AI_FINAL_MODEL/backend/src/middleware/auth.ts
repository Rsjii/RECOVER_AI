import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../config/db';
import { config } from '../config/env';
import { logger } from '../config/logger';
import { AuthRequest } from '../types';

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies?.cm_token || req.headers.authorization?.substring(7);

  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    const result = await db.query(
      `SELECT u.id, u.github_username, u.email, u.avatar_url, u.org_id, u.access_token,
              tm.role
       FROM users u
       LEFT JOIN team_members tm ON tm.user_id = u.id AND tm.org_id = u.org_id
       WHERE u.id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) return res.status(401).json({ error: 'User not found' });

    req.userId = result.rows[0].id;
    req.orgId  = result.rows[0].org_id;
    req.user   = result.rows[0];
    next();
  } catch (error: any) {
    logger.error({ err: error }, 'Auth middleware error');
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Must have an org context (not a brand-new user pre-setup)
  if (!req.orgId) {
    return res.status(403).json({ error: 'No organization context' });
  }
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};
