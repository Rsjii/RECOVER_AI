import { Request, Response } from 'express';
export declare const listInvoices: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getInvoice: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * GET /api/invoices/:id/detail
 * Full invoice detail: invoice + customer + payments + email logs + payment plan
 */
export declare const getInvoiceDetail: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * POST /api/invoices/manual
 * Create a manual invoice (not from Stripe/QB)
 */
export declare const createManualInvoice: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * PUT /api/invoices/:id/status
 * Manually update invoice status
 */
export declare const updateInvoiceStatus: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
/**
 * POST /api/invoices/csv-upload
 * Upload invoices from CSV file
 */
export declare const uploadCSVFile: (req: Request, res: Response) => Promise<void>;
/**
 * POST /api/invoices/upload-csv
 * Upload invoices from CSV data (JSON array)
 */
export declare const uploadCSV: (req: Request, res: Response) => Promise<void>;
