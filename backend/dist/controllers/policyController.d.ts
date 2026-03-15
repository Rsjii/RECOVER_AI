import { Request, Response } from 'express';
export declare const getPolicySettings: (req: Request, res: Response) => Promise<void>;
export declare const updatePolicySettings: (req: Request, res: Response) => Promise<void>;
export declare const simulatePolicyDecision: (req: Request, res: Response) => Promise<void>;
export declare const listApprovalQueue: (req: Request, res: Response) => Promise<void>;
export declare const decideApprovalQueueItem: (req: Request, res: Response) => Promise<void>;
