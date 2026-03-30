import { Request, Response } from 'express';
import * as ForecastModel from '../models/forecastAssumptions';
import { logError, logInfo } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';

const LOG_MODULE = 'forecastAssumptionsController';

/**
 * Get forecast assumptions for the company
 */
export const getAssumptions = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getAssumptions';
  const companyId = (req as any).companyId;

  try {
    const assumptions = await ForecastModel.getOrCreateAssumptions(companyId);

    logInfo(LOG_MODULE, handler, 'Assumptions fetched', {
      company_id: companyId,
      assumptions_id: assumptions.id,
    });

    res.status(200).json({
      data: [assumptions],
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get assumptions', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * Create or update forecast assumptions
 */
export const createOrUpdateAssumptions = async (req: Request, res: Response): Promise<void> => {
  const handler = 'createOrUpdateAssumptions';
  const companyId = (req as any).companyId;

  try {
    const {
      growth_rate_pct = 0,
      payroll_amount_monthly,
      other_expenses_monthly,
      notes,
    } = req.body as {
      growth_rate_pct?: number;
      payroll_amount_monthly?: number | null;
      other_expenses_monthly?: number | null;
      notes?: string | null;
    };

    // Get or create
    const existing = await ForecastModel.getOrCreateAssumptions(companyId);

    // Update
    const assumptions = await ForecastModel.updateAssumptions(
      existing.id,
      companyId,
      {
        growth_rate_pct,
        payroll_amount_monthly: payroll_amount_monthly ?? undefined,
        other_expenses_monthly: other_expenses_monthly ?? undefined,
        notes: notes ?? undefined,
      }
    );

    logInfo(LOG_MODULE, handler, 'Assumptions created/updated', {
      company_id: companyId,
      assumptions_id: assumptions.id,
      growth_rate_pct,
    });

    res.status(200).json({
      data: assumptions,
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to create/update assumptions', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * Update specific forecast assumptions by ID
 */
export const updateAssumptions = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updateAssumptions';
  const companyId = (req as any).companyId;

  try {
    const assumptionsId = req.params.id as string;
    const updates = req.body as Record<string, unknown>;

    if (!assumptionsId) {
      sendErrorResponse(res, 400, 'Assumptions ID is required');
      return;
    }

    const assumptions = await ForecastModel.updateAssumptions(
      assumptionsId,
      companyId,
      updates as Parameters<typeof ForecastModel.updateAssumptions>[2]
    );

    logInfo(LOG_MODULE, handler, 'Assumptions updated', {
      company_id: companyId,
      assumptions_id: assumptionsId,
    });

    res.status(200).json({
      data: assumptions,
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to update assumptions', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};
