import { Request, Response } from 'express';
export declare const listCustomers: (req: Request, res: Response) => Promise<void>;
export declare const getCustomer: (req: Request, res: Response) => Promise<void>;
/**
 * POST /api/customers/unsubscribe (no auth — customers click link from email)
 * Body: { token } where token = base64(email:companyId)
 */
export declare const unsubscribeCustomer: (req: Request, res: Response) => Promise<void>;
