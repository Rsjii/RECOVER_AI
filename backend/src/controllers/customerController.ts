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

    logInfo(LOG_MODULE, handler, 'Customer fetched', { customerId: id });

    res.status(200).json({
      data: {
        customer,
        invoices,
        totalInvoices,
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

    if (customerIds.length > 500) {
      sendErrorResponse(res, 400, 'Maximum 500 customers per delete operation');
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
