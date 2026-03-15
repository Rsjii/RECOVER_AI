import { Request, Response } from 'express';
/**
 * GET /api/settings
 * Returns company settings (dunning strategy, timezone, slack configured, integrations status)
 */
export declare const getSettings: (req: Request, res: Response) => Promise<void>;
/**
 * PUT /api/settings/dunning
 * Update dunning strategy: num_emails, days_between, approval_required
 */
export declare const updateDunningSettings: (req: Request, res: Response) => Promise<void>;
/**
 * PUT /api/settings/slack
 * Save Slack webhook URL (encrypted)
 */
export declare const updateSlackSettings: (req: Request, res: Response) => Promise<void>;
/**
 * PUT /api/settings/general
 * Update timezone, preferred currency
 */
export declare const updateGeneralSettings: (req: Request, res: Response) => Promise<void>;
