import { Request, Response } from 'express';
import { pool } from '../config/database';
import { logInfo, logError } from '../utils/logger';

const MODULE = 'ActivityController';

export const getActivityLogsHandler = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId;
    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const params = [companyId];

    // Query emails from email_logs (with customer info from invoices)
    const emailLogsQuery = `
      SELECT
        el.id,
        'email' as type,
        c.id as customer_id,
        c.company_name as customer_name,
        el.recipient_email as recipient,
        el.subject as message_preview,
        el.email_type as channel_type,
        el.status,
        el.sent_at,
        el.opened_at as delivery_timestamp,
        NULL as failure_reason
      FROM email_logs el
      LEFT JOIN invoices inv ON el.invoice_id = inv.id
      LEFT JOIN customers c ON inv.customer_id = c.id
      WHERE el.company_id = $1
      ORDER BY el.sent_at DESC
    `;

    // Query SMS from sms_logs
    const smsLogsQuery = `
      SELECT
        sl.id,
        'sms' as type,
        sl.customer_id,
        c.company_name as customer_name,
        sl.phone as recipient,
        sl.content as message_preview,
        'sms' as channel_type,
        sl.status,
        sl.sent_at,
        sl.delivered_at as delivery_timestamp,
        sl.failure_reason
      FROM sms_logs sl
      LEFT JOIN customers c ON sl.customer_id = c.id
      WHERE sl.company_id = $1
      ORDER BY sl.sent_at DESC
    `;

    // Execute both queries in parallel
    const [emailResult, smsResult] = await Promise.all([
      pool.query(emailLogsQuery, params),
      pool.query(smsLogsQuery, params)
    ]);

    // Combine and sort by sent_at DESC
    const combined = [
      ...emailResult.rows,
      ...smsResult.rows
    ].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());

    logInfo(MODULE, 'getActivityLogs', `Retrieved ${combined.length} activity logs`, {
      company_id: companyId,
      emails: emailResult.rows.length,
      sms: smsResult.rows.length,
      total: combined.length
    });

    res.json({
      data: combined,
      count: combined.length
    });
  } catch (error) {
    logError(MODULE, 'getActivityLogs', 'Failed to retrieve activity logs', error);
    res.status(500).json({ error: 'Failed to retrieve activity logs' });
  }
};

export const getPausedInvoices = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId;
    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `SELECT
        i.id,
        i.customer_id,
        c.company_name as customer_name,
        i.amount as invoice_amount,
        i.dunning_paused_until as paused_until,
        'paused' as state,
        NOW() as sent_at
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id
       WHERE i.company_id = $1
         AND i.dunning_paused_until IS NOT NULL
         AND i.dunning_paused_until > NOW()
       ORDER BY i.dunning_paused_until ASC`,
      [companyId]
    );

    logInfo(MODULE, 'getPausedInvoices', `Retrieved ${result.rows.length} paused invoices`, {
      companyId,
    });

    res.json({
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logError(MODULE, 'getPausedInvoices', 'Failed to retrieve paused invoices', error);
    res.status(500).json({ error: 'Failed to retrieve paused invoices' });
  }
};

export const getStoppedInvoices = async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).companyId;
    if (!companyId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `SELECT
        i.id,
        i.customer_id,
        c.company_name as customer_name,
        i.amount as invoice_amount,
        'stopped' as state,
        NOW() as sent_at
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id
       WHERE i.company_id = $1 AND i.dunning_stopped = true
       ORDER BY i.updated_at DESC`,
      [companyId]
    );

    logInfo(MODULE, 'getStoppedInvoices', `Retrieved ${result.rows.length} stopped invoices`, {
      companyId,
    });

    res.json({
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logError(MODULE, 'getStoppedInvoices', 'Failed to retrieve stopped invoices', error);
    res.status(500).json({ error: 'Failed to retrieve stopped invoices' });
  }
};
