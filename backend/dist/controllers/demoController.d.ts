import { Request, Response } from 'express';
/**
 * POST /api/demo/login
 * Creates demo company + seeds realistic data + logs in as demo user.
 * Safe to call multiple times — resets data on each call.
 */
export declare const demoLogin: (req: Request, res: Response) => Promise<void>;
