import { Request, Response, NextFunction } from 'express';

/**
 * App-level tenant guard to prevent accidental cross-tenant access
 * when endpoints accept company_id/companyId from client payload.
 */
export function tenantScopeGuard(req: Request, res: Response, next: NextFunction) {
  const tokenCompanyId = (req as any).companyId as string | undefined;
  if (!tokenCompanyId) {
    return res.status(401).json({ error: 'Missing tenant scope' });
  }

  const bodyCompanyId = (req.body?.companyId || req.body?.company_id) as string | undefined;
  const queryCompanyId = (req.query?.companyId || req.query?.company_id) as string | undefined;

  if (bodyCompanyId && bodyCompanyId !== tokenCompanyId) {
    return res.status(403).json({ error: 'Cross-tenant body access denied' });
  }
  if (queryCompanyId && queryCompanyId !== tokenCompanyId) {
    return res.status(403).json({ error: 'Cross-tenant query access denied' });
  }

  return next();
}


