import { Request, Response } from 'express';
/**
 * Create a payment plan for an invoice
 * POST /api/payment-plans
 * Body: { invoiceId, numInstallments }
 */
export declare const createPlan: (req: Request, res: Response) => Promise<void>;
/**
 * Get payment plan for an invoice
 * GET /api/payment-plans?invoiceId=xxx
 */
export declare const getPlan: (req: Request, res: Response) => Promise<void>;
/**
 * List all payment plans for the company
 * GET /api/payment-plans/list
 */
export declare const listPlans: (req: Request, res: Response) => Promise<void>;
/**
 * Mark a plan as defaulted (manual override)
 * PATCH /api/payment-plans/:planId/status
 * Body: { status: 'defaulted' | 'completed' | 'active' }
 */
export declare const updatePlanStatus: (req: Request, res: Response) => Promise<void>;
