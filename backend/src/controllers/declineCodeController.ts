import { Request, Response } from 'express';
import { logInfo, logError } from '../utils/logger';
import { getDeclineCodeAnalytics, getInvoiceDeclineAnalysis } from '../services/declineCodeService';

const LOG_MODULE = 'declineCodeController';

/**
 * GET /api/decline-codes/analytics
 * Returns per-code occurrence + success-rate stats for the authenticated company.
 */
export const getAnalytics = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getAnalytics';
  const companyId = (req as any).companyId;
  try {
    const stats = await getDeclineCodeAnalytics(companyId);
    logInfo(LOG_MODULE, handler, 'Fetched analytics', { companyId, count: stats.length });
    res.status(200).json({ data: stats });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    res.status(500).json({ error: 'Failed to fetch decline analytics', code: 'DECLINE_ANALYTICS_ERROR' });
  }
};

/**
 * GET /api/decline-codes/invoices/:id
 * Returns the decline code + classification for the last failure on a specific invoice.
 */
export const getInvoiceAnalysis = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getInvoiceAnalysis';
  const companyId = (req as any).companyId;
  const id = req.params.id as string;
  try {
    const result = await getInvoiceDeclineAnalysis(id, companyId);
    if (result === null) {
      res.status(404).json({ error: 'Invoice not found', code: 'INVOICE_NOT_FOUND' });
      return;
    }
    logInfo(LOG_MODULE, handler, 'Fetched invoice decline analysis', { companyId, invoiceId: id });
    res.status(200).json({ data: result });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    res.status(500).json({ error: 'Failed to get invoice decline analysis', code: 'DECLINE_ANALYSIS_ERROR' });
  }
};
