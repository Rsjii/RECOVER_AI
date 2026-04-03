import { Request, Response } from 'express';
import * as CustomerDB from '../db/customers';
import * as InvoiceDB from '../db/invoices';
import { pool } from '../config/database';
import { logError, logInfo } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';

const LOG_MODULE = 'customerController';

/**
 * POST /api/customers
 * Create a new customer
 */
export const createCustomer = async (req: Request, res: Response): Promise<void> => {
  const handler = 'createCustomer';
  const companyId = (req as any).companyId;
  const startTime = Date.now();

  try {
    const { name, email, phone, phone_opt_in } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      phone_opt_in?: boolean;
    };

    // Validate required fields
    const errors = [];
    if (!name || typeof name !== 'string' || name.trim().length === 0) errors.push('name');
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('email (valid email required)');

    if (errors.length > 0) {
      sendErrorResponse(res, 400, `Missing or invalid: ${errors.join(', ')}`);
      return;
    }

    // Create customer (name and email are guaranteed to exist after validation)
    const customer = await CustomerDB.findOrCreateCustomer({
      companyId,
      name: (name as string).trim(),
      email: (email as string).trim().toLowerCase(),
    });

    // Update phone if provided
    if (phone) {
      await CustomerDB.updateCustomerPhone(customer.id, companyId, phone.trim(), phone_opt_in ?? false);
    }

    logInfo(LOG_MODULE, handler, `Customer created in ${Date.now() - startTime}ms`, { customerId: customer.id });

    res.status(201).json({
      data: customer,
      message: 'Customer created successfully',
    });
  } catch (error: any) {
    logError(LOG_MODULE, handler, `Failed after ${Date.now() - startTime}ms`, error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const listCustomers = async (req: Request, res: Response): Promise<void> => {
  const handler = 'listCustomers';
  const companyId = (req as any).companyId;

  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const offset = (page - 1) * limit;
    const riskTier = req.query.riskTier as string | undefined;

    const { data, total } = await CustomerDB.listCustomers(companyId, limit, offset, riskTier);

    res.status(200).json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to list customers', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const getAllCustomerIds = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getAllCustomerIds';
  const companyId = (req as any).companyId;

  try {
    const riskTier = req.query.riskTier as string | undefined;

    let query = 'SELECT id FROM customers WHERE company_id = $1';
    const params: any[] = [companyId];

    if (riskTier) {
      if (riskTier === 'none') {
        query += ' AND (max_risk_score IS NULL OR max_risk_score = 0)';
      } else if (riskTier === 'low') {
        query += ' AND max_risk_score > 0 AND max_risk_score <= 30';
      } else if (riskTier === 'medium') {
        query += ' AND max_risk_score > 30 AND max_risk_score <= 60';
      } else if (riskTier === 'high') {
        query += ' AND max_risk_score > 60';
      }
    }

    const result = await pool.query(query, params);
    const customerIds = result.rows.map((r: any) => r.id);

    logInfo(LOG_MODULE, handler, `Fetched ${customerIds.length} customer IDs`, { companyId, riskTier });

    res.status(200).json({
      customerIds,
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to fetch all customer IDs', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const getCustomer = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getCustomer';
  const companyId = (req as any).companyId;

  try {
    const id = req.params.id as string;

    const customer = await CustomerDB.findCustomerById(id, companyId);
    if (!customer) {
      sendErrorResponse(res, 404, 'Customer not found');
      return;
    }

    // Get their invoices
    const { data: invoices, total: totalInvoices } = await InvoiceDB.listInvoices(
      companyId,
      { customerId: id as string },
      100,
      0
    );

    // Use stored payment_history + risk_score from database (already calculated daily)
    const stats = {
      totalInvoices: (customer.payment_history?.total_invoices || 0),
      onTimeRate: (customer.payment_history?.on_time_rate || 0),
      avgDaysLate: (customer.payment_history?.avg_days_late || 0),
      riskScore: customer.customer_risk_score || 0,
    };

    logInfo(LOG_MODULE, handler, 'Customer fetched', { customerId: id, stats });

    res.status(200).json({
      data: {
        customer,
        invoices,
        stats,
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get customer', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const updateCustomer = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updateCustomer';
  const companyId = (req as any).companyId;

  try {
    const customerId = req.params.id as string;
    const { email, phone, phone_opt_in } = req.body as { email?: string; phone?: string | null; phone_opt_in?: boolean };

    const updatingEmail = email !== undefined;
    const updatingPhone = phone !== undefined || phone_opt_in !== undefined;

    if (!updatingEmail && !updatingPhone) {
      sendErrorResponse(res, 400, 'At least one field (email, phone, phone_opt_in) is required');
      return;
    }

    let customer;

    if (updatingEmail) {
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        sendErrorResponse(res, 400, 'Invalid email format');
        return;
      }
      customer = await CustomerDB.updateCustomer(customerId, companyId, { email });
    }

    if (updatingPhone) {
      const phoneValue = phone === null ? '' : (phone || '');
      await CustomerDB.updateCustomerPhone(customerId, companyId, phoneValue, phone_opt_in ?? false);
      if (!customer) {
        const found = await CustomerDB.findCustomerById(customerId, companyId);
        if (!found) { sendErrorResponse(res, 404, 'Customer not found'); return; }
        customer = found;
      }
    }

    logInfo(LOG_MODULE, handler, 'Customer updated', { customerId });

    res.status(200).json({
      message: 'Customer updated successfully',
      data: customer,
    });
  } catch (error: any) {
    logError(LOG_MODULE, handler, 'Failed to update customer', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/customers/bulk-delete
 * Delete multiple customers by ID
 * Body: { customerIds: string[] }
 */
export const batchDeleteCustomers = async (req: Request, res: Response): Promise<void> => {
  const handler = 'batchDeleteCustomers';
  const companyId = (req as any).companyId;
  const startTime = Date.now();

  try {
    const { customerIds } = req.body as { customerIds?: string[] };

    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      sendErrorResponse(res, 400, 'customerIds array is required and must not be empty');
      return;
    }

    if (customerIds.length > 1000) {
      sendErrorResponse(res, 400, 'Maximum 1000 customers per delete operation');
      return;
    }

    // Delete customers in one query
    const result = await pool.query(
      `DELETE FROM customers WHERE company_id = $1 AND id = ANY($2)`,
      [companyId, customerIds]
    );

    const deleted = result.rowCount || 0;

    logInfo(LOG_MODULE, handler, `Batch delete completed in ${Date.now() - startTime}ms`, {
      companyId,
      requested: customerIds.length,
      deleted,
    });

    res.status(200).json({
      data: {
        deleted,
        requested: customerIds.length,
        message: `Successfully deleted ${deleted} customer${deleted !== 1 ? 's' : ''}`,
      },
    });
  } catch (error: any) {
    logError(LOG_MODULE, handler, `Batch delete failed after ${Date.now() - startTime}ms`, error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/customers/import-csv
 * Import customers from raw CSV text with intelligent column mapping
 * Body: Raw CSV text (sent as text/plain)
 */
export const importCustomersCSV = async (req: Request, res: Response): Promise<void> => {
  const handler = 'importCustomersCSV';
  const companyId = (req as any).companyId;
  const startTime = Date.now();

  try {
    // Handle file as raw text
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

    // Parse CSV with intelligent column detection
    const lines = csvText.trim().split('\n').filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      sendErrorResponse(res, 400, 'CSV must contain header and at least one row');
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

    // Find columns (name & email required)
    const nameIdx = findColumn(['name', 'customername', 'company', 'business', 'org']);
    const emailIdx = findColumn(['email', 'mail', 'contact', 'address', 'emailaddress']);
    const phoneIdx = findColumn(['phone', 'telephone', 'mobile', 'cell', 'number']);
    const optInIdx = findColumn(['optin', 'opt_in', 'phoneoptin', 'sms', 'opted']);

    logInfo(LOG_MODULE, handler, 'CSV column detection', {
      headers: rawHeader,
      detectedColumns: { nameIdx, emailIdx, phoneIdx, optInIdx },
    });

    // STEP 1: Parse & normalize all customers IN MEMORY
    const normalized: Array<{ name: string; email: string; phone?: string; phone_opt_in: boolean }> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.every(v => !v)) continue; // Skip empty rows

      // Extract values with fallbacks
      let name = nameIdx >= 0 ? values[nameIdx] : '';
      let email = emailIdx >= 0 ? values[emailIdx] : '';
      const phone = phoneIdx >= 0 ? values[phoneIdx] : '';
      const optIn = optInIdx >= 0 ? values[optInIdx] : '';

      // AUTO-INFER MISSING NAME
      if (!name && email) {
        name = email.split('@')[0];
      }
      if (!name) {
        const uniqueId = values.find(v => v && !v.includes(' ') && v.length > 2);
        name = uniqueId || `Customer ${i}`;
      }

      // AUTO-INFER MISSING EMAIL
      if (!email) {
        const emailValue = values.find(v => v.includes('@'));
        email = emailValue || `cust${Math.random().toString(36).substring(7)}@local.invalid`;
      }

      // Validate email
      if (!email.includes('@')) {
        continue;
      }

      normalized.push({
        name: name.trim(),
        email: email.toLowerCase(),
        phone: phone || undefined,
        phone_opt_in: optIn.toLowerCase() === 'true' || optIn === '1',
      });
    }

    // Check limits
    if (normalized.length === 0) {
      sendErrorResponse(res, 400, 'No valid customers could be extracted from CSV');
      return;
    }

    if (normalized.length > 500) {
      sendErrorResponse(res, 400, `Too many customers (${normalized.length}). Maximum 500 per upload`);
      return;
    }

    // STEP 2: Bulk find-or-create customers (1 SQL call for existing lookup)
    const uniqueEmails = [...new Set(normalized.map(c => c.email))];
    const customerMap = new Map<string, string>();
    let skipped = 0;

    // Get existing customers
    if (uniqueEmails.length > 0) {
      const existing = await pool.query(
        `SELECT id, email FROM customers WHERE company_id = $1 AND email = ANY($2)`,
        [companyId, uniqueEmails]
      );
      existing.rows.forEach((row: any) => {
        customerMap.set(row.email, row.id);
      });
    }

    // Create missing customers in BULK (1 SQL call)
    const missing = uniqueEmails.filter(e => !customerMap.has(e));
    let created = 0;

    if (missing.length > 0) {
      // Build parameters for bulk insert
      const vals = missing.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(',');
      const params = [companyId, ...missing.flatMap(e => [e.split('@')[0], e])];

      const newCustomers = await pool.query(
        `INSERT INTO customers (company_id, name, email) VALUES ${vals} RETURNING id, email`,
        params
      );
      newCustomers.rows.forEach((row: any) => {
        customerMap.set(row.email, row.id);
      });
      created = newCustomers.rows.length;
    } else {
      skipped = normalized.length;
    }

    // STEP 3: Update phones IN BULK (1 SQL call per unique phone value)
    const phonesToUpdate = normalized.filter(c => c.phone && customerMap.has(c.email));
    if (phonesToUpdate.length > 0) {
      for (const cust of phonesToUpdate) {
        const custId = customerMap.get(cust.email);
        if (custId) {
          await CustomerDB.updateCustomerPhone(custId, companyId, cust.phone!, cust.phone_opt_in);
        }
      }
    }

    logInfo(LOG_MODULE, handler, `CSV import completed in ${Date.now() - startTime}ms`, {
      companyId,
      total: normalized.length,
      created,
      existing: uniqueEmails.length - created,
    });

    res.status(200).json({
      data: {
        created,
        existing: uniqueEmails.length - created,
        total: normalized.length,
        message: `Successfully imported ${created} customer${created !== 1 ? 's' : ''}${uniqueEmails.length - created > 0 ? `, ${uniqueEmails.length - created} already existed` : ''}`,
      },
    });
  } catch (error: any) {
    logError(LOG_MODULE, handler, `CSV import failed after ${Date.now() - startTime}ms`, error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/customers/unsubscribe (no auth — customers click link from email)
 * Body: { token, email, companyId } where token = HMAC-SHA256(email:companyId)
 */
export const unsubscribeCustomer = async (req: Request, res: Response): Promise<void> => {
  const handler = 'unsubscribeCustomer';
  try {
    const { token, email, companyId } = req.body as { token?: string; email?: string; companyId?: string };
    if (!token || !email || !companyId) {
      sendErrorResponse(res, 400, 'Missing token, email, or companyId');
      return;
    }

    // Verify HMAC token
    const crypto = require('crypto');
    const { config } = require('../config/env');
    const unsubData = `${email}:${companyId}`;
    const hmac = crypto.createHmac('sha256', config.jwtSecret || 'fallback-secret');
    hmac.update(unsubData);
    const expectedToken = hmac.digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))) {
      sendErrorResponse(res, 400, 'Invalid unsubscribe token');
      return;
    }

    await pool.query(
      `UPDATE customers SET do_not_email = true WHERE email = $1 AND company_id = $2`,
      [email, companyId]
    );

    logInfo(LOG_MODULE, handler, 'Customer unsubscribed', { email, companyId });
    res.status(200).json({ message: 'You have been unsubscribed from future emails.' });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Unsubscribe failed', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};
