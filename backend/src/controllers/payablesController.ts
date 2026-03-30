import { Request, Response } from 'express';
import * as PayablesModel from '../models/payables';
import { logError, logInfo } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';

const LOG_MODULE = 'payablesController';

/**
 * List all payables for the authenticated company
 */
export const listPayables = async (req: Request, res: Response): Promise<void> => {
  const handler = 'listPayables';
  const companyId = (req as any).companyId;

  try {
    const payables = await PayablesModel.listPayables(companyId);

    logInfo(LOG_MODULE, handler, 'Payables fetched', {
      company_id: companyId,
      count: payables.length,
    });

    res.status(200).json({
      data: payables,
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to list payables', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * Get payables summary grouped by time buckets
 */
export const getPayablesSummary = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getPayablesSummary';
  const companyId = (req as any).companyId;

  try {
    const summary = await PayablesModel.getPayablesSummary(companyId);

    logInfo(LOG_MODULE, handler, 'Payables summary fetched', {
      company_id: companyId,
      this_week: summary.this_week,
      next_week: summary.next_week,
      in_30_days: summary.in_30_days,
    });

    res.status(200).json({
      data: summary,
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get payables summary', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * Create a new payable
 */
export const createPayable = async (req: Request, res: Response): Promise<void> => {
  const handler = 'createPayable';
  const companyId = (req as any).companyId;

  try {
    const { vendor_name, amount, due_date, category = 'other', notes } = req.body as {
      vendor_name: string;
      amount: number;
      due_date: string;
      category?: string;
      notes?: string;
    };

    // Validate required fields
    if (!vendor_name || !amount || !due_date) {
      sendErrorResponse(res, 400, 'Missing required fields: vendor_name, amount, due_date');
      return;
    }

    const payable = await PayablesModel.createPayable(
      companyId,
      vendor_name,
      amount,
      due_date,
      category,
      notes
    );

    logInfo(LOG_MODULE, handler, 'Payable created', {
      company_id: companyId,
      payable_id: payable.id,
      vendor_name,
      amount,
    });

    res.status(201).json({
      data: payable,
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to create payable', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * Update an existing payable
 */
export const updatePayable = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updatePayable';
  const companyId = (req as any).companyId;

  try {
    const payableId = req.params.id as string;
    const updates = req.body as Record<string, unknown>;

    if (!payableId) {
      sendErrorResponse(res, 400, 'Payable ID is required');
      return;
    }

    const payable = await PayablesModel.updatePayable(
      payableId,
      companyId,
      updates as Parameters<typeof PayablesModel.updatePayable>[2]
    );

    logInfo(LOG_MODULE, handler, 'Payable updated', {
      company_id: companyId,
      payable_id: payableId,
    });

    res.status(200).json({
      data: payable,
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to update payable', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * Delete a payable
 */
export const deletePayable = async (req: Request, res: Response): Promise<void> => {
  const handler = 'deletePayable';
  const companyId = (req as any).companyId;

  try {
    const payableId = req.params.id as string;

    if (!payableId) {
      sendErrorResponse(res, 400, 'Payable ID is required');
      return;
    }

    await PayablesModel.deletePayable(payableId, companyId);

    logInfo(LOG_MODULE, handler, 'Payable deleted', {
      company_id: companyId,
      payable_id: payableId,
    });

    res.status(200).json({
      data: { message: 'Payable deleted successfully' },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to delete payable', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};
