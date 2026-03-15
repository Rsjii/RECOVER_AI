import { Request, Response } from 'express';
/**
 * Schedule all dunning emails for an invoice
 * POST /api/email/schedule
 */
export declare const scheduleInvoiceEmails: (req: Request, res: Response) => Promise<void>;
/**
 * Send a dunning email immediately (manual trigger)
 * POST /api/email/send-now
 */
export declare const sendEmailNow: (req: Request, res: Response) => Promise<void>;
/**
 * List email logs for a company (optionally filtered by invoice)
 * GET /api/email/logs?invoiceId=xxx
 */
export declare const getEmailLogs: (req: Request, res: Response) => Promise<void>;
/**
 * SendGrid webhook — track email delivery events (open, click, bounce, etc.)
 * POST /api/email/webhook/sendgrid
 * No auth required — raw body, verified by IP or basic signature
 */
export declare const sendgridWebhook: (req: Request, res: Response) => Promise<void>;
/**
 * Get queue stats (jobs waiting, active, completed, failed)
 * GET /api/email/queue/stats
 */
export declare const getQueueStats: (req: Request, res: Response) => Promise<void>;
/**
 * Preview AI-generated email for an invoice
 * GET /api/email/preview?invoiceId=xxx&emailType=dunning_1
 */
export declare const previewEmail: (req: Request, res: Response) => Promise<void>;
/**
 * GET /api/email/track/open?logId=xxx
 * Called when email client loads the tracking pixel.
 */
export declare const trackEmailOpen: (req: Request, res: Response) => Promise<void>;
/**
 * GET /api/email/track/click?logId=xxx&url=https://...
 * Records click and 302-redirects to the original URL.
 */
export declare const trackEmailClick: (req: Request, res: Response) => Promise<void>;
