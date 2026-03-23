import { Request, Response } from 'express';
import { getBillingAnomalies } from '../db/dashboard';
import { runBillingOptimization } from '../services/billingOptimizationService';
import { pool } from '../config/database';
import { logInfo, logError } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';

const LOG_MODULE = 'billingOptimizationController';

/**
 * GET /api/billing-optimization
 * List billing anomalies for the company. Optional ?status=pending|confirmed|dismissed filter.
 */
export const listAnomalies = async (req: Request, res: Response): Promise<void> => {
  const handler = 'listAnomalies';
  const companyId = (req as any).companyId;
  const statusFilter = req.query.status as string | undefined;
  try {
    const anomalies = await getBillingAnomalies(companyId, statusFilter);
    logInfo(LOG_MODULE, handler, 'Anomalies fetched', { companyId, count: anomalies.length });
    res.status(200).json({ data: anomalies });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to list anomalies', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * PATCH /api/billing-optimization/:id
 * Update anomaly status to 'confirmed' or 'dismissed'.
 * Sets reviewed_at and reviewed_by_user_id.
 */
export const updateAnomalyStatus = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updateAnomalyStatus';
  const companyId = (req as any).companyId;
  const userId = (req as any).userId;
  const { id } = req.params;
  const { status } = req.body as { status: string };

  if (!['confirmed', 'dismissed'].includes(status)) {
    res.status(400).json({ error: 'status must be confirmed or dismissed', code: 'INVALID_STATUS' });
    return;
  }

  try {
    const { rows } = await pool.query<{ id: string; status: string; estimated_impact_usd: string }>(
      `UPDATE billing_anomalies
       SET status = $1, reviewed_at = NOW(), reviewed_by_user_id = $2, updated_at = NOW()
       WHERE id = $3 AND company_id = $4
       RETURNING id, status, estimated_impact_usd`,
      [status, userId ?? null, id, companyId]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Anomaly not found', code: 'NOT_FOUND' });
      return;
    }

    logInfo(LOG_MODULE, handler, 'Anomaly status updated', {
      companyId, id, status, impact: rows[0].estimated_impact_usd,
    });
    res.status(200).json({ data: rows[0] });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to update anomaly status', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/billing-optimization/trigger
 * Manually trigger a billing optimization scan for the current company.
 */
export const triggerScan = async (req: Request, res: Response): Promise<void> => {
  const handler = 'triggerScan';
  const companyId = (req as any).companyId;
  try {
    logInfo(LOG_MODULE, handler, 'Manual scan triggered', { companyId });
    const result = await runBillingOptimization(companyId);
    res.status(200).json({ data: result });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to run billing optimization scan', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};
