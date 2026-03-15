import { Request, Response } from 'express';
/**
 * Calculate risk score for a customer
 * POST /api/ai/risk-score
 */
export declare const calculateRiskScore: (req: Request, res: Response) => Promise<void>;
/**
 * Generate dunning email
 * POST /api/ai/generate-email
 */
export declare const generateDunningEmail: (req: Request, res: Response) => Promise<void>;
/**
 * Recommend payment plan
 * POST /api/ai/recommend-plan
 */
export declare const recommendPaymentPlan: (req: Request, res: Response) => Promise<void>;
