import { Request, Response } from 'express';
export declare const connectStripe: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const syncInvoices: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const stripeWebhook: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const stripeOAuthAuthorize: (req: Request, res: Response) => Promise<void | Response<any, Record<string, any>>>;
/**
 * POST /api/stripe/oauth/exchange
 * Frontend calls this after Stripe redirects to /stripe/oauth/callback with ?code=
 * Exchanges the code for an access token server-side.
 */
export declare const stripeOAuthExchange: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const stripeOAuthCallback: (req: Request, res: Response) => Promise<void | Response<any, Record<string, any>>>;
