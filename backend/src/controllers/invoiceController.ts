import { Request, Response } from 'express';
import * as InvoiceDB from '../db/invoices';
import * as CustomerDB from '../db/customers';
import * as PaymentDB from '../db/payments';
import { listEmailLogs } from '../db/emailLogs';
import { findPaymentPlanByInvoice } from '../db/paymentPlans';
import { logError as baseLogError, logInfo as baseLogInfo } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';
import { DUNNING_DECISION_TREE } from '../queue/agentLoop';
import { pool } from '../config/database';

const LOG_MODULE = 'invoiceController';

function logInfo(handler: string, msg: string, data?: Record<string, unknown>): void {
  baseLogInfo(LOG_MODULE, handler, msg, data);
}

function logError(handler: string, msg: string, error?: unknown): void {
  baseLogError(LOG_MODULE, handler, msg, error);
}

const DUNNING_EMAIL_TYPES = ['dunning_1', 'dunning_2', 'dunning_3', 'dunning_4', 'dunning_5'];

function computeDunningFields(emailTypesSent: string[], daysOverdue: number): { dunning_stage: number; next_action: string } {
  const sentSet = new Set(emailTypesSent);
  const dunning_stage = DUNNING_EMAIL_TYPES.filter(t => sentSet.has(t)).length;

  const nextTreeStep = DUNNING_DECISION_TREE.find(s => !sentSet.has(s.emailType));
  let next_action: string;
  if (!nextTreeStep) {
    next_action = 'All stages complete';
  } else if (daysOverdue < nextTreeStep.dayOffset) {
    const daysUntil = nextTreeStep.dayOffset - daysOverdue;
    next_action = `Stage ${dunning_stage + 1} email in ${daysUntil}d`;
  } else {
    next_action = `Send Stage ${dunning_stage + 1} now`;
  }

  return { dunning_stage, next_action };
}

export const listInvoices = async (req: Request, res: Response) => {
  const handler = 'listInvoices';
  const startTime = Date.now();

  try {
    const companyId = (req as any).companyId;
    const { status, customerId, agingBucket, dunningStage, sort, page = '1', limit = '50' } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    logInfo(handler, 'Request received', { companyId, status, customerId, agingBucket, dunningStage, sort, page: pageNum, limit: limitNum });

    let { data, total } = await InvoiceDB.listInvoices(companyId, { status, customerId, agingBucket, sort }, limitNum, offset);

    // Smart fetching: only load email logs if user explicitly filters by dunningStage
    // Otherwise, compute dunning_stage based on invoice age (fast, no DB call)
    let emailTypesByInvoiceId: Record<string, string[]> = {};

    if (dunningStage !== undefined) {
      // User filtered by dunning stage - need email logs to compute accurate stage
      const invoiceIds = data.map(d => d.id);
      if (invoiceIds.length > 0) {
        const emailLogsResult = await pool.query(
          `SELECT DISTINCT invoice_id, email_type FROM email_logs
           WHERE invoice_id = ANY($1) AND company_id = $2 AND status != 'failed'`,
          [invoiceIds, companyId]
        );
        for (const row of emailLogsResult.rows) {
          if (!emailTypesByInvoiceId[row.invoice_id]) {
            emailTypesByInvoiceId[row.invoice_id] = [];
          }
          emailTypesByInvoiceId[row.invoice_id].push(row.email_type);
        }
      }
    }

    // Compute dunning_stage + next_action
    const enriched = data.map(row => {
      const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(row.due_date).getTime()) / 86400000));
      const emailTypesSent = emailTypesByInvoiceId[row.id] ?? [];
      const { dunning_stage, next_action } = computeDunningFields(emailTypesSent, daysOverdue);
      return { ...row, dunning_stage, next_action };
    });

    // App-layer dunningStage filter (0 = Not Started, 1-5 = Stage N)
    const filtered = dunningStage !== undefined
      ? enriched.filter(r => r.dunning_stage === parseInt(dunningStage))
      : enriched;

    logInfo(handler, `Completed in ${Date.now() - startTime}ms`, { total, returned: filtered.length });

    return res.status(200).json({
      data: filtered,
      total: dunningStage !== undefined ? filtered.length : total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((dunningStage !== undefined ? filtered.length : total) / limitNum),
    });
  } catch (err: any) {
    logError(handler, `Failed after ${Date.now() - startTime}ms`, err);
    const { statusCode, message } = parseError(err);
    return sendErrorResponse(res, statusCode, message);
  }
};

export const exportInvoicesCSV = async (req: Request, res: Response) => {
  const handler = 'exportInvoicesCSV';
  const startTime = Date.now();

  try {
    const companyId = (req as any).companyId;
    const { status, customerId, agingBucket, dunningStage } = req.query as Record<string, string>;

    logInfo(handler, 'Export requested', { companyId, status, customerId, agingBucket, dunningStage });

    const { data } = await InvoiceDB.listInvoices(companyId, { status, customerId, agingBucket }, 9999, 0);

    // Smart fetching for export: only load email logs if dunning stage filter is active
    let emailTypesByInvoiceId: Record<string, string[]> = {};
    if (dunningStage !== undefined && data.length > 0) {
      const invoiceIds = data.map(d => d.id);
      const emailLogsResult = await pool.query(
        `SELECT DISTINCT invoice_id, email_type FROM email_logs
         WHERE invoice_id = ANY($1) AND company_id = $2 AND status != 'failed'`,
        [invoiceIds, companyId]
      );
      for (const row of emailLogsResult.rows) {
        if (!emailTypesByInvoiceId[row.invoice_id]) {
          emailTypesByInvoiceId[row.invoice_id] = [];
        }
        emailTypesByInvoiceId[row.invoice_id].push(row.email_type);
      }
    }

    const enriched = data.map(row => {
      const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(row.due_date).getTime()) / 86400000));
      const emailTypesSent = emailTypesByInvoiceId[row.id] ?? [];
      const { dunning_stage, next_action } = computeDunningFields(emailTypesSent, daysOverdue);
      return { ...row, dunning_stage, next_action };
    });

    const filtered = dunningStage !== undefined
      ? enriched.filter(r => r.dunning_stage === parseInt(dunningStage))
      : enriched;

    const header = ['Invoice #', 'Customer', 'Email', 'Amount', 'Currency', 'Due Date', 'Days Overdue', 'Status', 'Dunning Stage', 'Risk Score', 'Next Action'].join(',');
    const rows = filtered.map(r => {
      // Handle due_date as Date or string
      const dueDateObj = (r.due_date as any) instanceof Date ? r.due_date : new Date(r.due_date);
      const dueDateStr = (dueDateObj as Date).toISOString().split('T')[0];
      const daysOverdue = Math.max(0, Math.floor((Date.now() - (dueDateObj as Date).getTime()) / 86400000));

      return [
        r.source_id ?? r.id.slice(0, 8),
        `"${(r.customer_name ?? '').replace(/"/g, '""')}"`,
        r.customer_email ?? '',
        r.amount,
        r.currency,
        dueDateStr,
        daysOverdue,
        r.status,
        r.dunning_stage,
        r.risk_score ?? 0,
        `"${r.next_action.replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csv = [header, ...rows].join('\n');
    const date = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="invoices-${date}.csv"`);
    logInfo(handler, `Exported ${filtered.length} rows in ${Date.now() - startTime}ms`);
    return res.status(200).send(csv);
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
    const { customerId, customerName, customerEmail, amount, currency = 'USD', dueDate, issuedDate, notes } = req.body;

    // Validate required fields
    const missing = [];
    if (!amount) missing.push('amount');
    if (!dueDate) missing.push('dueDate');
    // Either customerId OR (customerName + customerEmail) must be provided
    if (!customerId && (!customerName || !customerEmail)) {
      missing.push('customerId or (customerName + customerEmail)');
    }

    if (missing.length > 0) {
      return sendErrorResponse(res, 400, `Missing required fields: ${missing.join(', ')}`);
    }

    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return sendErrorResponse(res, 400, 'amount must be a positive number');
    }

    // Determine which customer to use
    let finalCustomerId = customerId;
    if (!customerId) {
      // Find or create customer by email
      const customer = await CustomerDB.findOrCreateCustomer({
        companyId,
        name: customerName.trim(),
        email: customerEmail.trim(),
      });
      finalCustomerId = customer.id;
    } else {
      // Verify customer exists and belongs to this company
      const customer = await CustomerDB.findCustomerById(customerId, companyId);
      if (!customer) return sendErrorResponse(res, 404, 'Customer not found');
    }

    // Default issuedDate to today if not provided
    const finalIssuedDate = issuedDate ? new Date(issuedDate) : new Date();

    const invoice = await InvoiceDB.createManualInvoice({
      companyId,
      customerId: finalCustomerId,
      amount: parseFloat(amount),
      currency: currency.toUpperCase(),
      dueDate: new Date(dueDate),
      issuedDate: finalIssuedDate,
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
 * Queue invoices from CSV file for async processing
 */
export const uploadCSVFile = async (req: Request, res: Response): Promise<void> => {
  const handler = 'uploadCSVFile';
  const companyId = (req as any).companyId;
  const startTime = Date.now();

  try {
    // Import here to avoid circular dependency
    const { randomUUID } = await import('crypto');

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

    // Parse CSV with ULTRA-FLEXIBLE column detection (auto-infer everything)
    const lines = csvText.trim().split('\n').filter(line => line.trim().length > 0);
    if (lines.length < 1) {
      sendErrorResponse(res, 400, 'CSV is empty');
      return;
    }

    // Parse header - normalize column names
    const rawHeader = lines[0].split(',').map(h => h.trim());
    const header = rawHeader.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

    // Intelligent column detection - exact match first, then smart matching
    const findColumn = (patterns: string[]): number => {
      // FIRST: Try exact match (case-insensitive)
      for (const pattern of patterns) {
        const exactIdx = header.findIndex(h => h === pattern);
        if (exactIdx !== -1) return exactIdx;
      }

      // SECOND: Try substring match
      for (const pattern of patterns) {
        const substringIdx = header.findIndex(h => h.includes(pattern));
        if (substringIdx !== -1) return substringIdx;
      }

      // THIRD: Try word-part matching (split by delimiters)
      return header.findIndex(h => {
        const headerWords = h.split(/[_\-\s]+/).filter(w => w.length > 0);
        return patterns.some(pattern => {
          const patternWords = pattern.split(/[_\-\s]+/).filter(w => w.length > 0);
          return patternWords.some(pw =>
            headerWords.some(hw => hw.includes(pw) || pw.includes(hw))
          );
        });
      });
    };

    // Try to find columns (but all are optional now - we'll auto-fill if missing)
    const nameIdx = findColumn(['name', 'customer', 'company', 'business', 'org', 'namecustomer']);
    const emailIdx = findColumn(['email', 'mail', 'contact', 'address', 'emailaddress']);
    const amountIdx = findColumn(['amount', 'total', 'price', 'value', 'cost', 'fee', 'invoice', 'totalopenamount']);
    const currencyIdx = findColumn(['currency', 'curr', 'code', 'iso', 'invoicecurrency']);
    const dueDateIdx = findColumn(['due', 'deadline', 'payment', 'paymentdue', 'dueindate']);
    const issuedDateIdx = findColumn(['issued', 'created', 'date', 'invoicedate', 'postingdate', 'documentcreatedate']);

    logInfo(handler, 'CSV column detection', {
      headers: rawHeader,
      normalizedHeaders: header,
      detectedColumns: { nameIdx, emailIdx, amountIdx, currencyIdx, dueDateIdx, issuedDateIdx },
    });

    const invoices: Array<{ customerName: string; customerEmail: string; amount: number; currency: string; dueDate: string; issuedDate?: string }> = [];

    // Process data rows (parsing only - no DB calls yet)
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.every(v => !v)) continue; // Skip completely empty rows

      // Extract values with fallbacks
      let name = nameIdx >= 0 ? values[nameIdx] : '';
      let email = emailIdx >= 0 ? values[emailIdx] : '';
      let amount = amountIdx >= 0 ? values[amountIdx] : '';
      const currency = currencyIdx >= 0 ? values[currencyIdx] : 'USD';
      let dueDate = dueDateIdx >= 0 ? values[dueDateIdx] : '';
      let issuedDate = issuedDateIdx >= 0 ? values[issuedDateIdx] : '';

      // AUTO-INFER MISSING DATA
      // If no amount found, try first numeric value in row
      if (!amount || parseFloat(amount) === 0) {
        const numValue = values.find(v => /^\d+(\.\d+)?$/.test(v));
        amount = numValue || '';
      }

      // If no email found, try to extract from any field that looks like email
      if (!email) {
        const emailValue = values.find(v => v.includes('@'));
        email = emailValue || '';
      }

      // If no name, use email prefix or generate from customer code
      if (!name && email) {
        name = email.split('@')[0];
      }
      if (!name) {
        // Try to use unique identifier from row (customer code, doc_id, etc)
        const uniqueId = values.find(v => v && !v.includes(' ') && v.length > 2);
        name = uniqueId || `Customer ${i}`;
      }

      // If no email, keep it empty (don't auto-generate)
      // Empty emails are valid - just skip creating customer for those invoices
      if (!email) {
        email = '';
      }

      // If no due date, set to 30 days from now
      if (!dueDate) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        dueDate = futureDate.toISOString().split('T')[0];
      }

      // If no issued date, use today
      if (!issuedDate) {
        issuedDate = new Date().toISOString().split('T')[0];
      }

      invoices.push({
        customerName: name,
        customerEmail: email,
        amount: parseFloat(amount) || 0,
        currency: (currency || 'USD').toUpperCase().substring(0, 3),
        dueDate,
        issuedDate,
      });
    }

    // Check limits AFTER processing (not on raw line count)
    if (invoices.length === 0) {
      sendErrorResponse(res, 400, 'No valid invoices could be extracted from CSV');
      return;
    }

    if (invoices.length > 500) {
      sendErrorResponse(res, 400, `Too many invoices (${invoices.length}). Maximum 500 per upload`);
      return;
    }

    // Process synchronously - Railway has 1 pod, no separate workers available
    const jobId = randomUUID();
    const { processCsvImportJob, getCSVImportStatus, initializeWorkerOnDemand } = await import('../queue/csvImportJob');

    // Lazy-start CSV worker (zero polling when idle, starts only on first CSV upload)
    initializeWorkerOnDemand();

    try {
      // Await the processing to complete before returning
      await processCsvImportJob(companyId, invoices, jobId);

      logInfo(handler, `CSV import completed in ${Date.now() - startTime}ms`, { companyId, jobId, invoiceCount: invoices.length });

      // Return final result immediately
      const result = getCSVImportStatus(jobId);

      res.status(200).json({
        data: {
          jobId,
          status: result?.status || 'done',
          created: result?.created || 0,
          duplicates: result?.duplicates || 0,
          skipped: result?.skipped || 0,
          total: invoices.length,
          message: `Successfully imported ${result?.created || 0} invoices`,
        },
      });
    } catch (processingError: any) {
      logError(handler, `CSV processing failed after ${Date.now() - startTime}ms`, processingError);
      res.status(400).json({
        error: processingError.message,
        jobId,
        total: invoices.length,
      });
    }
  } catch (error: any) {
    logError(handler, `CSV upload failed after ${Date.now() - startTime}ms`, error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/invoices/csv-import-status/:jobId
 * Get the status of a CSV import job
 */
export const getCSVImportStatusHandler = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getCSVImportStatus';
  try {
    const { getCSVImportStatus: getStatus } = await import('../queue/csvImportJob');
    const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;

    const status = getStatus(jobId);
    if (!status) {
      sendErrorResponse(res, 404, 'Job not found or already completed');
      return;
    }

    res.status(200).json({ data: status });
  } catch (error: any) {
    logError(handler, 'Failed to get CSV import status', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * DELETE /api/invoices/:id
 * Delete an invoice
 */
export const deleteInvoice = async (req: Request, res: Response): Promise<void> => {
  const handler = 'deleteInvoice';
  const startTime = Date.now();

  try {
    const companyId = (req as any).companyId;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    // Get invoice to verify it exists and belongs to this company
    const invoice = await InvoiceDB.findInvoiceById(id, companyId);
    if (!invoice) {
      sendErrorResponse(res, 404, 'Invoice not found');
      return;
    }

    // Delete invoice and all related records
    await InvoiceDB.deleteInvoice(id, companyId);

    logInfo(handler, `Invoice deleted in ${Date.now() - startTime}ms`, { invoiceId: id, companyId });

    res.status(200).json({
      data: {
        message: 'Invoice deleted successfully',
        invoiceId: id,
      },
    });
  } catch (error: any) {
    logError(handler, `Failed to delete invoice after ${Date.now() - startTime}ms`, error);
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

export const getAllInvoiceIds = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getAllInvoiceIds';
  try {
    const companyId = (req as any).companyId;
    const { status, customerId, agingBucket, dunningStage, search } = req.query as Record<string, string>;

    logInfo(handler, 'Request received', { companyId, status, customerId, agingBucket, dunningStage, search });

    let ids = await InvoiceDB.getAllInvoiceIds(companyId, { status, customerId, agingBucket, search });

    // Apply app-layer dunningStage filter if provided
    if (dunningStage !== undefined) {
      const allInvoices = await InvoiceDB.listInvoices(companyId, { status, customerId, agingBucket }, 9999, 0);
      const enriched = allInvoices.data.map(row => {
        const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(row.due_date).getTime()) / 86400000));
        const { dunning_stage } = computeDunningFields(row.email_types_sent ?? [], daysOverdue);
        return { ...row, dunning_stage };
      });
      const filtered = enriched.filter(r => r.dunning_stage === parseInt(dunningStage));
      ids = filtered.map(r => r.id);
    }

    logInfo(handler, `Found ${ids.length} invoices`);
    res.status(200).json({ ids });
  } catch (err: any) {
    logError(handler, 'Failed', err);
    const { statusCode, message } = parseError(err);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/invoices/batch-delete
 * Delete multiple invoices in batches (async, non-blocking)
 */
export const batchDeleteInvoices = async (req: Request, res: Response): Promise<void> => {
  const handler = 'batchDeleteInvoices';
  const companyId = (req as any).companyId;
  const { invoiceIds } = req.body;

  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    sendErrorResponse(res, 400, 'invoiceIds array is required');
    return;
  }

  if (invoiceIds.length > 1000) {
    sendErrorResponse(res, 400, 'Maximum 1000 invoices per batch delete');
    return;
  }

  const { randomUUID } = await import('crypto');
  const jobId = randomUUID();

  logInfo(handler, 'Batch delete queued', { companyId, jobId, invoiceCount: invoiceIds.length });

  // Fire and forget (async, non-blocking)
  processBatchDelete(companyId, invoiceIds, jobId).catch(err => {
    logError(handler, 'Batch delete failed', err);
  });

  res.status(202).json({
    data: {
      jobId,
      status: 'processing',
      total: invoiceIds.length,
      message: `Deleting ${invoiceIds.length} invoices... This may take a few moments.`,
    },
  });
};

/**
 * GET /api/invoices/batch-delete-status/:jobId
 * Get status of batch delete operation
 */
const batchDeleteResults = new Map<string, { status: 'processing' | 'done' | 'error'; deleted: number; total: number; error?: string }>();

export const getBatchDeleteStatus = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getBatchDeleteStatus';
  try {
    const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;

    const status = batchDeleteResults.get(jobId);
    if (!status) {
      sendErrorResponse(res, 404, 'Job not found or already completed');
      return;
    }

    res.status(200).json({ data: status });
  } catch (error: any) {
    logError(handler, 'Failed to get batch delete status', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * Async batch delete processor
 */
async function processBatchDelete(companyId: string, invoiceIds: string[], jobId: string): Promise<void> {
  const startTime = Date.now();
  const CONCURRENT_DELETES = 5; // Max 5 concurrent delete operations
  const BATCH_SIZE = 200; // Process 200 IDs per cycle (5 concurrent * 40 each = managed load)

  batchDeleteResults.set(jobId, { status: 'processing', deleted: 0, total: invoiceIds.length });

  try {
    let deleted = 0;

    for (let batchStart = 0; batchStart < invoiceIds.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, invoiceIds.length);
      const batch = invoiceIds.slice(batchStart, batchEnd);

      logInfo('batchDeleteProcessor', `Deleting batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(invoiceIds.length / BATCH_SIZE)}`, { batchStart, batchEnd, batchSize: batch.length });

      // Delete in controlled concurrency (max 5 concurrent)
      for (let i = 0; i < batch.length; i += CONCURRENT_DELETES) {
        const concurrentBatch = batch.slice(i, i + CONCURRENT_DELETES);
        await Promise.allSettled(
          concurrentBatch.map(id => InvoiceDB.deleteInvoice(id, companyId))
        );
        deleted += concurrentBatch.length;
        batchDeleteResults.set(jobId, { status: 'processing', deleted, total: invoiceIds.length });
      }

      // Small delay between major batches
      if (batchEnd < invoiceIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const elapsed = Date.now() - startTime;
    logInfo('batchDeleteProcessor', `Batch delete complete in ${elapsed}ms`, { jobId, deleted, totalElapsed: elapsed });

    batchDeleteResults.set(jobId, { status: 'done', deleted, total: invoiceIds.length });

    // Clean up after 5 minutes
    setTimeout(() => batchDeleteResults.delete(jobId), 5 * 60 * 1000);
  } catch (err: any) {
    logError('batchDeleteProcessor', `Batch delete failed in ${Date.now() - startTime}ms`, err);
    batchDeleteResults.set(jobId, { status: 'error', deleted: 0, total: invoiceIds.length, error: err.message });
  }
}