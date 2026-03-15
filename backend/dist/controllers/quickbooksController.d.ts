import { Request, Response } from 'express';
export declare const qbOAuthAuthorize: (req: Request, res: Response) => Promise<void>;
export declare const qbOAuthCallback: (req: Request, res: Response) => Promise<void>;
export declare const syncQBInvoices: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const disconnectQB: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
