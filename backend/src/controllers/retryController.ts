import { Request, Response } from 'express';
import { logInfo, logError } from '../utils/logger';
import { pool } from '../config/database';
import { addRetryJob } from '../queue/retryQueue';
import { findInvoiceById } from '../db/invoices';
import { getOptimalRetryTime } from '../services/paymentBehaviorService';

const LOG_MODULE = 'retryController';

/**
 * GET /api/retry-analytics/:customerId
 * Returns optimal retry time + last 5 retry outcomes for a customer.
 */
export const getRetryAnalytics = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getRetryAnalytics';
  const companyId = (req as any).companyId;
  const customerId = req.params.customerId as string;
  try {
    const [retries, optimalTime] = await Promise.all([
      pool.query(
        `SELECT pr.id, pr.invoice_id, pr.attempt_number, pr.retry_at,
                pr.ab_variant, pr.result, pr.result_at, pr.decline_code
         FROM payment_retries pr
         WHERE pr.company_id = $1
           AND pr.invoice_id IN (SELECT id FROM invoices WHERE customer_id = $2)
         ORDER BY pr.created_at DESC
         LIMIT 10`,
        [companyId, customerId]
      ),
      getOptimalRetryTime(companyId, customerId),
    ]);

    logInfo(LOG_MODULE, handler, 'Retry analytics fetched', { companyId, customerId });
    res.status(200).json({
      data: {
        retries: retries.rows,
        optimal_retry_time: optimalTime.toISOString(),
      },
    });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    res.status(500).json({ error: 'Failed to fetch retry analytics', code: 'RETRY_ANALYTICS_ERROR' });
  }
};

/**
 * POST /api/retry-analytics/retry-now/:invoiceId
 * Manually trigger an immediate payment retry for an invoice.
 */
export const retryNow = async (req: Request, res: Response): Promise<void> => {
  const handler = 'retryNow';
  const companyId = (req as any).companyId;
  const invoiceId = req.params.invoiceId as string;
  try {
    const invoice = await findInvoiceById(invoiceId, companyId);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found', code: 'INVOICE_NOT_FOUND' });
      return;
    }
    if (invoice.status === 'paid') {
      res.status(400).json({ error: 'Invoice already paid', code: 'INVOICE_ALREADY_PAID' });
      return;
    }

    const jobId = await addRetryJob({
      invoiceId,
      companyId,
      customerId: invoice.customer_id,
      attempt: 1,
      variant: 'optimized',
    });

    logInfo(LOG_MODULE, handler, 'Manual retry queued', { companyId, invoiceId, jobId });
    res.status(200).json({ data: { jobId, message: 'Retry queued' } });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    res.status(500).json({ error: 'Failed to queue retry', code: 'RETRY_QUEUE_ERROR' });
  }
};

/**
 * GET /api/retry-analytics/ab-performance
 * Returns A/B test performance: success rate by variant (optimized vs generic).
 */
export const getAbPerformance = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getAbPerformance';
  const companyId = (req as any).companyId;
  try {
    const result = await pool.query(
      `SELECT ab_variant,
              COUNT(*) AS total,
              COUNT(*) FILTER (WHERE result = 'success') AS successes,
              ROUND(
                COUNT(*) FILTER (WHERE result = 'success')::DECIMAL / NULLIF(COUNT(*), 0) * 100,
                1
              ) AS success_rate_pct
       FROM payment_retries
       WHERE company_id = $1 AND result != 'pending'
       GROUP BY ab_variant`,
      [companyId]
    );

    logInfo(LOG_MODULE, handler, 'A/B performance fetched', { companyId });
    res.status(200).json({ data: result.rows });
  } catch (err) {
    logError(LOG_MODULE, handler, 'Failed', err);
    res.status(500).json({ error: 'Failed to fetch A/B performance', code: 'AB_PERFORMANCE_ERROR' });
  }
};
