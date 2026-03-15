import { Request, Response, NextFunction } from 'express';
/**
 * App-level tenant guard to prevent accidental cross-tenant access
 * when endpoints accept company_id/companyId from client payload.
 */
export declare function tenantScopeGuard(req: Request, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
