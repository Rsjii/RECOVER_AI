import { Request, Response } from 'express';
import { pool } from '../config/database';
import { logError, logInfo } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';

const LOG_MODULE = 'reportsController';

/**
 * GET /api/reports/campaign-analytics?period=30
 * Email type breakdown: sent, opened, clicked, open rate, CTR — for reporting
 */
export const getCampaignAnalytics = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getCampaignAnalytics';
  const companyId = (req as any).companyId;
  const periodDays = Math.min(parseInt(req.query.period as string) || 30, 365);

  try {
    const totalResult = await pool.query(
      `SELECT
         COUNT(*) AS sent,
         COUNT(opened_at) AS opened,
         COUNT(clicked_at) AS clicked,
         COUNT(CASE WHEN status = 'bounced' THEN 1 END) AS bounced,
         COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed,
         ROUND(COUNT(opened_at)::numeric / NULLIF(COUNT(*),0) * 100, 1) AS open_rate,
         ROUND(COUNT(clicked_at)::numeric / NULLIF(COUNT(*),0) * 100, 1) AS ctr,
         ROUND(COUNT(clicked_at)::numeric / NULLIF(COUNT(opened_at),0) * 100, 1) AS ctor
       FROM email_logs
       WHERE company_id = $1 AND sent_at > NOW() - ($2 || ' days')::INTERVAL`,
      [companyId, periodDays]
    );

    const byTypeResult = await pool.query(
      `SELECT
         email_type,
         COUNT(*) AS sent,
         COUNT(opened_at) AS opened,
         COUNT(clicked_at) AS clicked,
         ROUND(COUNT(opened_at)::numeric / NULLIF(COUNT(*),0) * 100, 1) AS open_rate,
         ROUND(COUNT(clicked_at)::numeric / NULLIF(COUNT(*),0) * 100, 1) AS ctr,
         MIN(sent_at) AS first_sent,
         MAX(sent_at) AS last_sent
       FROM email_logs
       WHERE company_id = $1 AND sent_at > NOW() - ($2 || ' days')::INTERVAL
       GROUP BY email_type
       ORDER BY sent DESC`,
      [companyId, periodDays]
    );

    const t = totalResult.rows[0];
    logInfo(LOG_MODULE, handler, 'Campaign analytics fetched', { companyId, periodDays });
    res.status(200).json({
      data: {
        period: `Last ${periodDays} days`,
        totals: {
          sent: parseInt(t.sent || '0'),
          opened: parseInt(t.opened || '0'),
          clicked: parseInt(t.clicked || '0'),
          bounced: parseInt(t.bounced || '0'),
          failed: parseInt(t.failed || '0'),
          openRate: parseFloat(t.open_rate || '0'),
          ctr: parseFloat(t.ctr || '0'),
          ctor: parseFloat(t.ctor || '0'),
          openRateBenchmark: 28,
          ctrBenchmark: 2.5,
        },
        byEmailType: byTypeResult.rows.map(row => ({
          type: row.email_type,
          sent: parseInt(row.sent || '0'),
          opened: parseInt(row.opened || '0'),
          clicked: parseInt(row.clicked || '0'),
          openRate: parseFloat(row.open_rate || '0'),
          ctr: parseFloat(row.ctr || '0'),
        })),
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get campaign analytics', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/reports/aging-detail
 * Full aging bucket breakdown with invoice-level data
 */
export const getAgingDetail = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getAgingDetail';
  const companyId = (req as any).companyId;

  try {
    const result = await pool.query(
      `SELECT
         CASE
           WHEN due_date >= NOW() - INTERVAL '30 days' THEN 'Current (0–30d)'
           WHEN due_date >= NOW() - INTERVAL '60 days' THEN '31–60 Days'
           WHEN due_date >= NOW() - INTERVAL '90 days' THEN '61–90 Days'
           ELSE '90+ Days'
         END AS bucket,
         CASE
           WHEN due_date >= NOW() - INTERVAL '30 days' THEN 0
           WHEN due_date >= NOW() - INTERVAL '60 days' THEN 1
           WHEN due_date >= NOW() - INTERVAL '90 days' THEN 2
           ELSE 3
         END AS bucket_order,
         COUNT(*) AS invoice_count,
         COALESCE(SUM(amount), 0) AS total_amount,
         ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - due_date)) / 86400)) AS avg_days_overdue
       FROM invoices
       WHERE company_id = $1 AND status IN ('unpaid', 'arranged')
       GROUP BY bucket, bucket_order
       ORDER BY bucket_order`,
      [companyId]
    );

    const totalAr = result.rows.reduce((sum, r) => sum + parseFloat(r.total_amount), 0);

    const buckets = result.rows.map(r => ({
      bucket: r.bucket,
      invoiceCount: parseInt(r.invoice_count),
      totalAmount: parseFloat(r.total_amount),
      pctOfTotal: totalAr > 0 ? parseFloat(((parseFloat(r.total_amount) / totalAr) * 100).toFixed(1)) : 0,
      avgDaysOverdue: parseInt(r.avg_days_overdue || '0'),
    }));

    logInfo(LOG_MODULE, handler, 'Aging detail fetched', { companyId, totalAr });
    res.status(200).json({ data: { buckets, totalAr } });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get aging detail', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/reports/payment-plans-detail
 * All payment plans with full detail for reporting
 */
export const getPaymentPlansDetail = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getPaymentPlansDetail';
  const companyId = (req as any).companyId;

  try {
    const plansResult = await pool.query(
      `SELECT
         pp.id,
         pp.status,
         pp.total_amount,
         pp.installments,
         pp.created_at,
         pp.updated_at,
         c.name AS customer_name,
         c.email AS customer_email,
         i.amount AS invoice_amount,
         i.due_date AS invoice_due_date
       FROM payment_plans pp
       JOIN invoices i ON i.id = pp.invoice_id
       JOIN customers c ON c.id = i.customer_id
       WHERE i.company_id = $1
       ORDER BY pp.created_at DESC`,
      [companyId]
    );

    const offersResult = await pool.query(
      `SELECT COUNT(*) AS offers FROM email_logs WHERE company_id = $1 AND email_type = 'payment_plan_offer'`,
      [companyId]
    );

    const totalOffered = parseInt(offersResult.rows[0]?.offers || '0');
    const plans = plansResult.rows;
    const active = plans.filter(p => p.status === 'active').length;
    const completed = plans.filter(p => p.status === 'completed').length;
    const defaulted = plans.filter(p => p.status === 'defaulted').length;
    const totalValue = plans.reduce((s, p) => s + parseFloat(p.total_amount || '0'), 0);
    const activeValue = plans.filter(p => p.status === 'active').reduce((s, p) => s + parseFloat(p.total_amount || '0'), 0);

    const plansDetail = plans.map(p => {
      const installments: Array<{ paid: boolean; amount: number; due_date: string }> = Array.isArray(p.installments) ? p.installments : [];
      const paidCount = installments.filter(i => i.paid).length;
      const nextDue = installments.find(i => !i.paid)?.due_date ?? null;
      return {
        planId: p.id,
        customerName: p.customer_name,
        customerEmail: p.customer_email,
        totalAmount: parseFloat(p.total_amount || '0'),
        status: p.status,
        installmentsTotal: installments.length,
        installmentsPaid: paidCount,
        pctComplete: installments.length > 0 ? Math.round((paidCount / installments.length) * 100) : 0,
        nextDueDate: nextDue,
        createdAt: p.created_at,
      };
    });

    logInfo(LOG_MODULE, handler, 'Payment plans detail fetched', { companyId, total: plans.length });
    res.status(200).json({
      data: {
        summary: {
          activePlans: active,
          completedPlans: completed,
          defaultedPlans: defaulted,
          totalOffered,
          acceptanceRate: totalOffered > 0 ? Math.round((plans.length / totalOffered) * 100) : plans.length > 0 ? 100 : 0,
          completionRate: (active + completed) > 0 ? Math.round((completed / (active + completed)) * 100) : 0,
          totalValue,
          activeValue,
        },
        plans: plansDetail,
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get payment plans detail', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/reports/kpi-trends?months=6
 * Monthly time-series for DSO, recovery rate, and email metrics
 */
export const getKpiTrends = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getKpiTrends';
  const companyId = (req as any).companyId;
  const months = Math.min(parseInt(req.query.months as string) || 6, 12);

  try {
    // Monthly recovery rate
    const recoveryResult = await pool.query(
      `SELECT
         DATE_TRUNC('month', created_at) AS month,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS recovered,
         COALESCE(SUM(amount), 0) AS total,
         COUNT(CASE WHEN status = 'paid' THEN 1 END) AS recovered_count,
         COUNT(*) AS total_count
       FROM invoices
       WHERE company_id = $1
         AND created_at >= NOW() - ($2 || ' months')::INTERVAL
       GROUP BY month
       ORDER BY month`,
      [companyId, months]
    );

    // Monthly email analytics
    const emailResult = await pool.query(
      `SELECT
         DATE_TRUNC('month', sent_at) AS month,
         COUNT(*) AS sent,
         COUNT(opened_at) AS opened,
         ROUND(COUNT(opened_at)::numeric / NULLIF(COUNT(*),0) * 100, 1) AS open_rate,
         ROUND(COUNT(clicked_at)::numeric / NULLIF(COUNT(*),0) * 100, 1) AS ctr
       FROM email_logs
       WHERE company_id = $1
         AND sent_at >= NOW() - ($2 || ' months')::INTERVAL
       GROUP BY month
       ORDER BY month`,
      [companyId, months]
    );

    // Build merged monthly timeline
    const emailByMonth = new Map(emailResult.rows.map(r => [r.month.toISOString().slice(0, 7), r]));

    const trends = recoveryResult.rows.map(r => {
      const monthKey = r.month.toISOString().slice(0, 7);
      const emailRow = emailByMonth.get(monthKey);
      const total = parseFloat(r.total);
      const recovered = parseFloat(r.recovered);
      return {
        month: monthKey,
        recoveryRate: total > 0 ? parseFloat(((recovered / total) * 100).toFixed(1)) : 0,
        recovered,
        total,
        recoveredCount: parseInt(r.recovered_count),
        totalCount: parseInt(r.total_count),
        emailsSent: parseInt(emailRow?.sent || '0'),
        openRate: parseFloat(emailRow?.open_rate || '0'),
        ctr: parseFloat(emailRow?.ctr || '0'),
      };
    });

    logInfo(LOG_MODULE, handler, 'KPI trends fetched', { companyId, months, points: trends.length });
    res.status(200).json({ data: { trends, months } });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get KPI trends', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};
