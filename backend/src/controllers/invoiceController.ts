import { Request, Response } from 'express';
import * as InvoiceDB from '../db/invoices';
import * as CustomerDB from '../db/customers';
import * as PaymentDB from '../db/payments';
import { listEmailLogs } from '../db/emailLogs';
import { findPaymentPlanByInvoice } from '../db/paymentPlans';
import { logError as baseLogError, logInfo as baseLogInfo } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';
import { DUNNING_DECISION_TREE } from '../queue/agentLoop';

const LOG_MODULE = 'invoiceController';

function logInfo(handler: string, msg: string, data?: Record<string, unknown>): void {
  baseLogInfo(LOG_MODULE, handler, msg, data);
}

function logError(handler: string, msg: string, error?: unknown): void {
  baseLogError(LOG_MODULE, handler, msg, error);
}

export const listInvoices = async (req: Request, res: Response) => {
  const handler = 'listInvoices';
  const startTime = Date.now();

  try {
    const companyId = (req as any).companyId;
    const { status, customerId, page = '1', limit = '50' } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    logInfo(handler, 'Request received', { companyId, status, customerId, page: pageNum, limit: limitNum });

    const { data, total } = await InvoiceDB.listInvoices(companyId, { status, customerId }, limitNum, offset);

    logInfo(handler, `Completed in ${Date.now() - startTime}ms`, { total, returned: data.length });

    return res.status(200).json({
      data,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err: any) {
    logError(handler, `Failed after ${Date.now() - startTime}ms`, err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

export const getInvoice = async (req: Request, res: Response) => {
  const handler = 'getInvoice';
  const startTime = Date.now();

  try {
    const companyId = (req as any).companyId;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id) return sendErrorResponse(res, 400, 'Invoice ID is required');

    const invoice = await InvoiceDB.findInvoiceById(id, companyId);
    if (!invoice) return sendErrorResponse(res, 404, 'Invoice not found');

    logInfo(handler, `Completed in ${Date.now() - startTime}ms`, { invoiceId: id });

    return res.status(200).json({ id: invoice.id, data: invoice });
  } catch (err: any) {
    logError(handler, `Failed after ${Date.now() - startTime}ms`, err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/invoices/:id/detail
 * Full invoice detail: invoice + customer + payments + email logs + payment plan
 */
export const getInvoiceDetail = async (req: Request, res: Response) => {
  const handler = 'getInvoiceDetail';
  const startTime = Date.now();

  try {
    const companyId = (req as any).companyId;
    const id = req.params.id as string;

    const invoice = await InvoiceDB.findInvoiceById(id, companyId);
    if (!invoice) return sendErrorResponse(res, 404, 'Invoice not found');

    const [payments, emailLogs, paymentPlan] = await Promise.all([
      PaymentDB.listPaymentsByInvoice(id, companyId),
      listEmailLogs(companyId, id),
      findPaymentPlanByInvoice(id, companyId),
    ]);

    logInfo(handler, `Completed in ${Date.now() - startTime}ms`, { invoiceId: id });

    return res.status(200).json({
      data: {
        invoice,
        payments,
        emailLogs,
        paymentPlan: paymentPlan || null,
      },
    });
  } catch (err: any) {
    logError(handler, `Failed after ${Date.now() - startTime}ms`, err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/invoices/manual
 * Create a manual invoice (not from Stripe/QB)
 */
export const createManualInvoice = async (req: Request, res: Response) => {
  const handler = 'createManualInvoice';
  const startTime = Date.now();

  try {
    const companyId = (req as any).companyId;
    const { customerId, amount, currency = 'USD', dueDate, issuedDate, notes } = req.body;

    const missing = [];
    if (!customerId) missing.push('customerId');
    if (!amount) missing.push('amount');
    if (!dueDate) missing.push('dueDate');
    if (!issuedDate) missing.push('issuedDate');

    if (missing.length > 0) {
      return sendErrorResponse(res, 400, `Missing required fields: ${missing.join(', ')}`);
    }

    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return sendErrorResponse(res, 400, 'amount must be a positive number');
    }

    // Verify customer belongs to this company
    const customer = await CustomerDB.findCustomerById(customerId, companyId);
    if (!customer) return sendErrorResponse(res, 404, 'Customer not found');

    const invoice = await InvoiceDB.createManualInvoice({
      companyId,
      customerId,
      amount: parseFloat(amount),
      currency: currency.toUpperCase(),
      dueDate: new Date(dueDate),
      issuedDate: new Date(issuedDate),
      source: 'manual',
      notes,
    });

    logInfo(handler, `Manual invoice created in ${Date.now() - startTime}ms`, {
      invoiceId: invoice.id,
      companyId,
      customerId,
      amount,
    });

    return res.status(201).json({ data: invoice });
  } catch (err: any) {
    logError(handler, `Failed after ${Date.now() - startTime}ms`, err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

/**
 * PUT /api/invoices/:id/status
 * Manually update invoice status
 */
export const updateInvoiceStatus = async (req: Request, res: Response) => {
  const handler = 'updateInvoiceStatus';
  const startTime = Date.now();

  try {
    const companyId = (req as any).companyId;
    const id = req.params.id as string;
    const { status } = req.body;

    const validStatuses = ['unpaid', 'paid', 'arranged', 'disputed', 'uncollectable'];
    if (!status || !validStatuses.includes(status)) {
      return sendErrorResponse(res, 400, `status must be one of: ${validStatuses.join(', ')}`);
    }

    const invoice = await InvoiceDB.findInvoiceById(id, companyId);
    if (!invoice) return sendErrorResponse(res, 404, 'Invoice not found');

    const updated = await InvoiceDB.updateInvoiceStatus(id, companyId, status);

    logInfo(handler, `Status updated in ${Date.now() - startTime}ms`, { invoiceId: id, status });

    return res.status(200).json({ data: updated });
  } catch (err: any) {
    logError(handler, `Failed after ${Date.now() - startTime}ms`, err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/invoices/csv-upload
 * Upload invoices from CSV file
 */
export const uploadCSVFile = async (req: Request, res: Response): Promise<void> => {
  const handler = 'uploadCSVFile';
  const companyId = (req as any).companyId;
  const startTime = Date.now();

  try {
    // Handle file as raw text (sent from FormData)
    let csvText = '';
    if (typeof req.body === 'string') {
      csvText = req.body;
    } else if (req.body.csv) {
      csvText = req.body.csv;
    }

    if (!csvText || csvText.trim().length === 0) {
      sendErrorResponse(res, 400, 'CSV content is required');
      return;
    }

    // Parse CSV: expected format is customer_name,customer_email,amount,currency,due_date
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      sendErrorResponse(res, 400, 'CSV must contain at least a header row and one data row');
      return;
    }

    const header = lines[0].toLowerCase().split(',').map(h => h.trim());
    const invoices: Array<{ customerName: string; customerEmail: string; amount: number; currency: string; dueDate: string; issuedDate?: string }> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.every(v => !v)) continue; // Skip empty lines

      const row: Record<string, string> = {};
      header.forEach((col, idx) => {
        row[col] = values[idx] || '';
      });

      invoices.push({
        customerName: row['customer_name'] || row['name'] || '',
        customerEmail: row['customer_email'] || row['email'] || '',
        amount: parseFloat(row['amount'] || '0'),
        currency: (row['currency'] || 'USD').toUpperCase(),
        dueDate: row['due_date'] || new Date().toISOString().split('T')[0],
        issuedDate: row['issued_date'],
      });
    }

    if (invoices.length === 0) {
      sendErrorResponse(res, 400, 'No valid invoice rows found');
      return;
    }

    if (invoices.length > 500) {
      sendErrorResponse(res, 400, 'Maximum 500 invoices per upload');
      return;
    }

    let created = 0;
    let skipped = 0;

    for (const inv of invoices) {
      try {
        if (!inv.customerEmail || !inv.amount || inv.amount <= 0) {
          skipped++;
          continue;
        }

        const customer = await CustomerDB.findOrCreateCustomer({
          companyId,
          name: inv.customerName || inv.customerEmail,
          email: inv.customerEmail,
        });

        await InvoiceDB.createManualInvoice({
          companyId,
          customerId: customer.id,
          amount: inv.amount,
          currency: inv.currency || 'USD',
          dueDate: new Date(inv.dueDate),
          issuedDate: inv.issuedDate ? new Date(inv.issuedDate) : new Date(),
          source: 'manual',
        });

        created++;
      } catch {
        skipped++;
      }
    }

    logInfo(handler, `CSV upload complete in ${Date.now() - startTime}ms`, { companyId, created, skipped, total: invoices.length });
    res.status(200).json({ data: { count: created, skipped, total: invoices.length } });
  } catch (error: any) {
    logError(handler, `CSV upload failed after ${Date.now() - startTime}ms`, error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/invoices/upload-csv
 * Upload invoices from CSV data (JSON array)
 */
export const uploadCSV = async (req: Request, res: Response): Promise<void> => {
  const handler = 'uploadCSV';
  const companyId = (req as any).companyId;
  const startTime = Date.now();

  try {
    const { invoices } = req.body; // Array of { customerEmail, customerName, amount, dueDate, currency }

    if (!Array.isArray(invoices) || invoices.length === 0) {
      sendErrorResponse(res, 400, 'invoices array is required');
      return;
    }

    if (invoices.length > 500) {
      sendErrorResponse(res, 400, 'Maximum 500 invoices per upload');
      return;
    }

    let created = 0;
    let skipped = 0;

    for (const inv of invoices) {
      try {
        if (!inv.customerEmail || !inv.amount || !inv.dueDate) {
          skipped++;
          continue;
        }

        const customer = await CustomerDB.findOrCreateCustomer({
          companyId,
          name: inv.customerName || inv.customerEmail,
          email: inv.customerEmail,
        });

        await InvoiceDB.upsertInvoice({
          companyId,
          customerId: customer.id,
          amount: Number(inv.amount),
          currency: (inv.currency || 'USD').toUpperCase(),
          dueDate: new Date(inv.dueDate),
          issuedDate: new Date(inv.issuedDate || new Date()),
          source: 'manual',
          sourceId: `csv-${Date.now()}-${created}`,
        });

        created++;
      } catch {
        skipped++;
      }
    }

    logInfo(handler, `CSV upload complete in ${Date.now() - startTime}ms`, { companyId, created, skipped });
    res.status(200).json({ message: 'Upload complete', created, skipped });
  } catch (error: any) {
    logError(handler, `CSV upload failed after ${Date.now() - startTime}ms`, error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

// ── Dunning Control ──────────────────────────────────────────────────────────

export const pauseInvoiceDunning = async (req: Request, res: Response): Promise<void> => {
  const handler = 'pauseInvoiceDunning';
  try {
    const companyId = (req as any).companyId;
    const id = req.params.id as string;
    const days = parseInt(req.body?.days);
    if (!days || days < 1 || days > 180) {
      sendErrorResponse(res, 400, 'days must be between 1 and 180');
      return;
    }
    const invoice = await InvoiceDB.pauseInvoiceDunning(id, companyId, days);
    if (!invoice) { sendErrorResponse(res, 404, 'Invoice not found'); return; }
    logInfo(handler, 'Dunning paused', { invoiceId: id, days });
    res.json({ data: invoice });
  } catch (err) {
    logError(handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};

export const resumeInvoiceDunning = async (req: Request, res: Response): Promise<void> => {
  const handler = 'resumeInvoiceDunning';
  try {
    const companyId = (req as any).companyId;
    const id = req.params.id as string;
    const invoice = await InvoiceDB.resumeInvoiceDunning(id, companyId);
    if (!invoice) { sendErrorResponse(res, 404, 'Invoice not found'); return; }
    logInfo(handler, 'Dunning resumed', { invoiceId: id });
    res.json({ data: invoice });
  } catch (err) {
    logError(handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};

export const stopInvoiceDunning = async (req: Request, res: Response): Promise<void> => {
  const handler = 'stopInvoiceDunning';
  try {
    const companyId = (req as any).companyId;
    const id = req.params.id as string;
    const invoice = await InvoiceDB.stopInvoiceDunning(id, companyId);
    if (!invoice) { sendErrorResponse(res, 404, 'Invoice not found'); return; }
    logInfo(handler, 'Dunning stopped', { invoiceId: id });
    res.json({ data: invoice });
  } catch (err) {
    logError(handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};

export const getDunningStatus = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getDunningStatus';
  try {
    const companyId = (req as any).companyId;
    const id = req.params.id as string;

    const invoice = await InvoiceDB.findInvoiceById(id, companyId);
    if (!invoice) { sendErrorResponse(res, 404, 'Invoice not found'); return; }

    const emailLogs = await listEmailLogs(companyId, id);
    const emailTypesSent = new Set(
      emailLogs.filter(l => l.status !== 'failed').map((l: any) => l.email_type as string)
    );

    // Find next un-sent dunning step
    const dueDate = new Date(invoice.due_date).getTime();
    const daysOverdue = Math.floor((Date.now() - dueDate) / (24 * 60 * 60 * 1000));
    let nextEmailType: string | null = null;
    let nextScheduledDate: string | null = null;

    for (const step of DUNNING_DECISION_TREE) {
      if (!emailTypesSent.has(step.emailType)) {
        nextEmailType = step.emailType;
        nextScheduledDate = new Date(dueDate + step.dayOffset * 24 * 60 * 60 * 1000).toISOString();
        break;
      }
    }

    res.json({
      data: {
        nextEmailType,
        nextScheduledDate,
        isPaused: !!(invoice.dunning_paused_until && new Date(invoice.dunning_paused_until) > new Date()),
        pausedUntil: invoice.dunning_paused_until ?? null,
        isStopped: invoice.dunning_stopped ?? false,
        daysOverdue,
        history: emailLogs,
      },
    });
  } catch (err) {
    logError(handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};