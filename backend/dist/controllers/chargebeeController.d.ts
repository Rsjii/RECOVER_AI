import { Request, Response } from 'express';
export declare const connectChargebee: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const syncChargebeeInvoices: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const chargebeeWebhook: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const disconnectChargebee: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
