import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { logInfo } from '../utils/logger';

const ROLE_WEIGHT: Record<string, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
};

export function requireRole(minRole: 'viewer' | 'member' | 'admin' | 'owner') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).userId as string | undefined;
    const companyId = (req as any).companyId as string | undefined;
    if (!userId || !companyId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await pool.query<{ role: string }>(
      `SELECT COALESCE(om.role, u.role) AS role
       FROM users u
       LEFT JOIN organization_members om ON om.user_id = u.id AND om.company_id = u.company_id
       WHERE u.id = $1 AND u.company_id = $2
       LIMIT 1`,
      [userId, companyId]
    );

    const actual = result.rows[0]?.role || 'viewer';
    if ((ROLE_WEIGHT[actual] || 0) < ROLE_WEIGHT[minRole]) {
      logInfo('rbac', 'requireRole', 'Forbidden role', { userId, companyId, required: minRole, actual });
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    (req as any).role = actual;
    next();
  };
}


