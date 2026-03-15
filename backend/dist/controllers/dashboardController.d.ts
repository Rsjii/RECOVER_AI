import { Request, Response } from 'express';
/**
 * GET /api/dashboard/stats
 * Recovery stats: total owed, recovered, recovery rate, overdue
 */
export declare const getStats: (req: Request, res: Response) => Promise<void>;
/**
 * GET /api/dashboard/pipeline
 * Invoice counts by status
 */
export declare const getPipeline: (req: Request, res: Response) => Promise<void>;
/**
 * GET /api/dashboard/risk-list?limit=20
 * Customers ranked by risk score with unpaid invoice totals
 */
export declare const getRiskList: (req: Request, res: Response) => Promise<void>;
/**
 * GET /api/dashboard/timeline?period=monthly&months=6
 * Recovery timeline data for charts
 */
export declare const getRecoveryTimeline: (req: Request, res: Response) => Promise<void>;
