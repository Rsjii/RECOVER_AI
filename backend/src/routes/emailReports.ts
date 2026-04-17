/**
 * Email Reports API
 * Endpoints for viewing email history and reports
 * - Admin: sees all emails sent on their behalf
 * - Customer: sees emails sent about their invoices
 */

import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { logInfo, logError } from '../utils/logger';

const router = Router();
const LOG_MODULE = 'emailReportsController';

/**
 * GET /api/email-reports/sent
 * Admin view: all emails sent to customers
 */
router.get('/sent', authMiddleware, async (req: Request, res: Response) => {
  const method = 'GET /sent';
  const companyId = req.user?.companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logInfo(LOG_MODULE, method, 'Fetching email report', { companyId });

    const result = await pool.query(
      `SELECT
        el.id,
        el.invoice_id,
        el.recipient_email,
        el.subject,
        el.email_type,
        el.status,
        el.sent_at,
        el.opened_at,
        i.source_id,
        c.company_name as customer_name,
        c.email as customer_email,
        i.amount,
        i.currency,
        i.due_date,
        i.status as invoice_status
      FROM email_logs el
      LEFT JOIN invoices i ON el.invoice_id = i.id
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE el.company_id = $1
      ORDER BY el.sent_at DESC
      LIMIT 500`,
      [companyId]
    );

    res.json({
      data: result.rows,
      total: result.rows.length,
    });
  } catch (err: any) {
    logError(LOG_MODULE, method, 'Failed to fetch email report', err);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

/**
 * GET /api/email-reports/customer/:customerId
 * Customer's view: emails sent about their invoices
 */
router.get('/customer/:customerId', authMiddleware, async (req: Request, res: Response) => {
  const method = 'GET /customer/:customerId';
  const { customerId } = req.params;
  const companyId = req.user?.companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logInfo(LOG_MODULE, method, 'Fetching customer email history', { customerId, companyId });

    const result = await pool.query(
      `SELECT
        el.id,
        el.invoice_id,
        el.recipient_email,
        el.subject,
        el.body as email_body,
        el.email_type,
        el.status,
        el.sent_at,
        el.opened_at,
        i.source_id,
        i.amount,
        i.currency,
        i.due_date,
        i.status as invoice_status
      FROM email_logs el
      LEFT JOIN invoices i ON el.invoice_id = i.id
      WHERE i.customer_id = $1
        AND el.company_id = $2
      ORDER BY el.sent_at DESC`,
      [customerId, companyId]
    );

    res.json({
      data: result.rows,
      total: result.rows.length,
    });
  } catch (err: any) {
    logError(LOG_MODULE, method, 'Failed to fetch customer email history', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

/**
 * GET /api/email-reports/summary
 * Dashboard summary: emails sent today, this week, etc.
 */
router.get('/summary', authMiddleware, async (req: Request, res: Response) => {
  const method = 'GET /summary';
  const companyId = req.user?.companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logInfo(LOG_MODULE, method, 'Fetching email summary', { companyId });

    const summaryResult = await pool.query(
      `SELECT
        DATE(sent_at) as date,
        email_type,
        status,
        COUNT(*) as count,
        SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened_count
      FROM email_logs
      WHERE company_id = $1
        AND sent_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(sent_at), email_type, status
      ORDER BY DATE(sent_at) DESC`,
      [companyId]
    );

    const todayResult = await pool.query(
      `SELECT
        email_type,
        COUNT(*) as count
      FROM email_logs
      WHERE company_id = $1
        AND DATE(sent_at) = CURRENT_DATE
      GROUP BY email_type`,
      [companyId]
    );

    const statusResult = await pool.query(
      `SELECT
        status,
        COUNT(*) as count
      FROM email_logs
      WHERE company_id = $1
      GROUP BY status`,
      [companyId]
    );

    res.json({
      summary_by_date: summaryResult.rows,
      today: todayResult.rows,
      status_distribution: statusResult.rows,
    });
  } catch (err: any) {
    logError(LOG_MODULE, method, 'Failed to fetch summary', err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

/**
 * GET /api/email-reports/engagement
 * Email engagement metrics: open rates, click rates
 */
router.get('/engagement', authMiddleware, async (req: Request, res: Response) => {
  const method = 'GET /engagement';
  const companyId = req.user?.companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logInfo(LOG_MODULE, method, 'Fetching engagement metrics', { companyId });

    const result = await pool.query(
      `SELECT
        email_type,
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
        ROUND(100.0 * SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) /
          NULLIF(SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END), 0), 2) as open_rate_percent
      FROM email_logs
      WHERE company_id = $1
        AND sent_at >= NOW() - INTERVAL '90 days'
      GROUP BY email_type
      ORDER BY total_sent DESC`,
      [companyId]
    );

    res.json({
      engagement_by_type: result.rows,
      overall_stats: {
        total_sent: result.rows.reduce((sum: number, row: any) => sum + row.total_sent, 0),
        total_delivered: result.rows.reduce((sum: number, row: any) => sum + row.delivered, 0),
        total_opened: result.rows.reduce((sum: number, row: any) => sum + row.opened, 0),
      }
    });
  } catch (err: any) {
    logError(LOG_MODULE, method, 'Failed to fetch engagement metrics', err);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

export default router;
