/**
 * Email Dashboard API
 * Admin can see ALL emails sent (A-Z detailed view)
 * - Which customer got which email
 * - When it was sent
 * - Status (delivered, opened, failed)
 * - Full email content
 */

import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { logInfo, logError } from '../utils/logger';

const router = Router();
const LOG_MODULE = 'emailDashboardController';

/**
 * GET /api/admin/email-dashboard
 * Complete view of all emails sent by company
 * Includes: customer, invoice, email type, status, timestamp, content
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const method = 'GET /email-dashboard';
  const companyId = req.user?.companyId;
  const { page = 1, limit = 50, status, emailType, customerName } = req.query;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logInfo(LOG_MODULE, method, 'Fetching email dashboard', { companyId, page, limit });

    // Build dynamic query
    let whereClause = 'el.company_id = $1';
    let paramIndex = 2;
    const params: any[] = [companyId];

    if (status) {
      whereClause += ` AND el.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (emailType) {
      whereClause += ` AND el.email_type = $${paramIndex}`;
      params.push(emailType);
      paramIndex++;
    }

    if (customerName) {
      whereClause += ` AND c.name ILIKE $${paramIndex}`;
      params.push(`%${customerName}%`);
      paramIndex++;
    }

    const offset = ((Number(page) || 1) - 1) * (Number(limit) || 50);

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM email_logs el
       LEFT JOIN customers c ON el.company_id = c.company_id
       WHERE ${whereClause}`,
      params
    );

    // Get paginated data
    const result = await pool.query(
      `SELECT
        el.id,
        el.invoice_id,
        el.email_type,
        el.recipient_email,
        el.subject,
        el.body as email_body,
        el.status,
        el.sent_at,
        el.opened_at,
        el.sendgrid_message_id,
        c.name as customer_name,
        c.email as customer_email,
        i.source_id as invoice_number,
        i.amount,
        i.currency,
        i.due_date,
        i.status as invoice_status,
        (NOW() - el.sent_at) as time_since_sent
      FROM email_logs el
      LEFT JOIN invoices i ON el.invoice_id = i.id
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE ${whereClause}
      ORDER BY el.sent_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, Number(limit) || 50, offset]
    );

    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / (Number(limit) || 50));

    res.json({
      data: result.rows.map((row: any) => ({
        ...row,
        amount_formatted: `$${(row.amount / 100).toFixed(2)}`,
      })),
      pagination: {
        page: Number(page) || 1,
        limit: Number(limit) || 50,
        total,
        totalPages,
      },
    });
  } catch (err: any) {
    logError(LOG_MODULE, method, 'Failed to fetch email dashboard', err);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

/**
 * GET /api/admin/email-dashboard/stats
 * Quick stats: total sent, delivered, opened, failed by email type
 */
router.get('/stats', authMiddleware, async (req: Request, res: Response) => {
  const method = 'GET /stats';
  const companyId = req.user?.companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logInfo(LOG_MODULE, method, 'Fetching email stats', { companyId });

    const result = await pool.query(
      `SELECT
        email_type,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
        ROUND(100.0 * SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) /
          NULLIF(SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END), 0), 2) as open_rate_percent
      FROM email_logs
      WHERE company_id = $1
      GROUP BY email_type
      ORDER BY total DESC`,
      [companyId]
    );

    res.json({ stats: result.rows });
  } catch (err: any) {
    logError(LOG_MODULE, method, 'Failed to fetch stats', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/admin/email-dashboard/:emailId
 * Full details of a specific email (for viewing/previewing)
 */
router.get('/:emailId', authMiddleware, async (req: Request, res: Response) => {
  const method = 'GET /:emailId';
  const { emailId } = req.params;
  const companyId = req.user?.companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logInfo(LOG_MODULE, method, 'Fetching email details', { emailId, companyId });

    const result = await pool.query(
      `SELECT
        el.id,
        el.invoice_id,
        el.email_type,
        el.recipient_email,
        el.subject,
        el.body as email_body,
        el.status,
        el.sent_at,
        el.opened_at,
        el.sendgrid_message_id,
        c.name as customer_name,
        c.email as customer_email,
        i.source_id as invoice_number,
        i.amount,
        i.currency,
        i.due_date,
        i.status as invoice_status
      FROM email_logs el
      LEFT JOIN invoices i ON el.invoice_id = i.id
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE el.id = $1 AND el.company_id = $2`,
      [emailId, companyId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json({
      data: result.rows[0],
    });
  } catch (err: any) {
    logError(LOG_MODULE, method, 'Failed to fetch email details', err);
    res.status(500).json({ error: 'Failed to fetch details' });
  }
});

/**
 * GET /api/admin/email-dashboard/by-customer/:customerId
 * All emails sent to a specific customer
 */
router.get('/by-customer/:customerId', authMiddleware, async (req: Request, res: Response) => {
  const method = 'GET /by-customer/:customerId';
  const { customerId } = req.params;
  const companyId = req.user?.companyId;

  if (!companyId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logInfo(LOG_MODULE, method, 'Fetching customer emails', { customerId, companyId });

    const result = await pool.query(
      `SELECT
        el.id,
        el.invoice_id,
        el.email_type,
        el.subject,
        el.status,
        el.sent_at,
        el.opened_at,
        i.source_id as invoice_number,
        i.amount,
        i.due_date
      FROM email_logs el
      LEFT JOIN invoices i ON el.invoice_id = i.id
      WHERE i.customer_id = $1 AND el.company_id = $2
      ORDER BY el.sent_at DESC`,
      [customerId, companyId]
    );

    res.json({
      data: result.rows,
      total: result.rows.length,
    });
  } catch (err: any) {
    logError(LOG_MODULE, method, 'Failed to fetch customer emails', err);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

export default router;
