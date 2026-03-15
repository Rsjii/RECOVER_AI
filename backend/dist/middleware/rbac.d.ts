import { Request, Response, NextFunction } from 'express';
export declare function requireRole(minRole: 'viewer' | 'member' | 'admin' | 'owner'): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
