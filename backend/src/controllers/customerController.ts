import { Request, Response } from 'express';
import * as CustomerDB from '../db/customers';
import * as InvoiceDB from '../db/invoices';
import { pool } from '../config/database';
import { logError, logInfo } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';

const LOG_MODULE = 'customerController';

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
 * POST /api/customers/unsubscribe (no auth — customers click link from email)
 * Body: { token } where token = base64(email:companyId)
 */
export const unsubscribeCustomer = async (req: Request, res: Response): Promise<void> => {
  const handler = 'unsubscribeCustomer';
  try {
    const { token } = req.body as { token?: string };
    if (!token) {
      sendErrorResponse(res, 400, 'Missing unsubscribe token');
      return;
    }

    let email: string, companyId: string;
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf8');
      [email, companyId] = decoded.split(':');
    } catch {
      sendErrorResponse(res, 400, 'Invalid unsubscribe token');
      return;
    }

    if (!email || !companyId) {
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
