import { Request, Response } from 'express';
export declare const listFeatureFlags: (req: Request, res: Response) => Promise<void>;
export declare const upsertFeatureFlag: (req: Request, res: Response) => Promise<void>;
