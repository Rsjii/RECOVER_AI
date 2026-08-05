import { Request, Response } from 'express';
import { queueSMSNow } from '../queue/smsQueue';
import { findInvoiceById } from '../db/invoices';
import { findCustomerById } from '../db/customers';
import { findCompanyById } from '../db/companies';
import { normalizePhone } from '../services/smsService';
import { logError, logInfo } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';

const LOG_MODULE = 'smsController';

/**
 * Send an SMS immediately (manual trigger from invoice detail)
 * POST /api/sms/send-now
 */
export const sendSMSNow = async (req: Request, res: Response): Promise<void> => {
  const handler = 'sendSMSNow';
  const companyId = (req as any).companyId;

  try {
    const { invoiceId } = req.body;

    if (!invoiceId) {
      sendErrorResponse(res, 400, 'invoiceId is required');
      return;
    }

    const invoice = await findInvoiceById(invoiceId, companyId);
    if (!invoice) {
      sendErrorResponse(res, 404, 'Invoice not found');
      return;
    }

    // Check if dunning is paused
    if (invoice.dunning_paused_until && new Date(invoice.dunning_paused_until) > new Date()) {
      sendErrorResponse(res, 400, `Dunning paused until ${invoice.dunning_paused_until}`);
      return;
    }

    // Check if dunning is stopped
    if (invoice.dunning_stopped) {
      sendErrorResponse(res, 400, 'Dunning stopped permanently for this invoice');
      return;
    }

    const customer = await findCustomerById(invoice.customer_id, companyId);
    if (!customer) {
      sendErrorResponse(res, 404, 'Customer not found');
      return;
    }

    // Validate phone
    if (!customer.phone) {
      sendErrorResponse(res, 400, 'Customer has no phone number on file');
      return;
    }

    const normalizedPhone = normalizePhone(customer.phone);
    if (!normalizedPhone) {
      sendErrorResponse(res, 400, 'Invalid phone number format');
      return;
    }

    // Get company info for message content
    const company = await findCompanyById(companyId);

    const dueDate = new Date(invoice.due_date).getTime();
    const daysOverdue = Math.max(0, Math.floor((Date.now() - dueDate) / (24 * 60 * 60 * 1000)));

    // Queue SMS
    await queueSMSNow({
      companyId,
      customerId: invoice.customer_id,
      invoiceId,
      phoneNumber: normalizedPhone,
      customerName: invoice.customer_name || customer.company_name || 'Valued Customer',
      companyName: company?.name || 'Our Company',
      invoiceAmount: Number(invoice.amount),
      daysOverdue,
    });

    logInfo(LOG_MODULE, handler, 'SMS queued for immediate send', {
      invoiceId,
      phoneNumber: normalizedPhone,
      companyId,
    });

    res.status(200).json({
      message: 'SMS queued for delivery',
      data: { invoiceId },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to queue SMS', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};
