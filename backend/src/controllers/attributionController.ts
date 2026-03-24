import { Request, Response } from 'express';
import { pool } from '../config/database';
import { logInfo } from '../utils/logger';

const MODULE = 'AttributionController';

/**
 * GET /api/attribution/by-stage?month=2026-03
 * Recovery breakdown by dunning stage
 */
export const getRecoveryByStage = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getRecoveryByStage';
  const companyId = (req as any).companyId;
  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7); // YYYY-MM

  try {
    const monthStart = new Date(`${month}-01`);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);

    const result = await pool.query(
      `SELECT
        COALESCE(i.dunning_stage, 'unknown') as stage,
        COUNT(DISTINCT p.invoice_id) as invoices_count,
        COUNT(p.id) as payment_count,
        SUM(p.amount) as total_recovered
       FROM payments p
       JOIN invoices i ON p.invoice_id = i.id
       WHERE i.company_id = $1
         AND p.paid_at >= $2
         AND p.paid_at < $3
         AND p.status = 'succeeded'
       GROUP BY i.dunning_stage
       ORDER BY total_recovered DESC`,
      [companyId, monthStart.toISOString(), monthEnd.toISOString()]
    );

    const stages = result.rows;
    const total = stages.reduce((sum, s) => sum + parseFloat(s.total_recovered || '0'), 0);

    const breakdown = stages.map(s => ({
      stage: s.stage || 'Unknown',
      invoices_count: parseInt(s.invoices_count, 10),
      payment_count: parseInt(s.payment_count, 10),
      amount_recovered: parseFloat(s.total_recovered || '0'),
      percentage: total > 0 ? Math.round((parseFloat(s.total_recovered || '0') / total) * 100) : 0
    }));

    logInfo(MODULE, handler, 'Recovery by stage fetched', { companyId, month, stages: breakdown.length });

    res.json({
      data: {
        month,
        breakdown,
        total_recovered: total,
        total_invoices: stages.reduce((sum, s) => sum + parseInt(s.invoices_count, 10), 0)
      }
    });
  } catch (error) {
    console.error('Error fetching recovery by stage:', error);
    res.status(500).json({ error: 'Failed to fetch recovery by stage', code: 'INTERNAL_ERROR' });
  }
};

/**
 * GET /api/attribution/by-action?month=2026-03
 * Recovery breakdown by action type (email, voice, payment plan, etc)
 */
export const getRecoveryByAction = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getRecoveryByAction';
  const companyId = (req as any).companyId;
  const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);

  try {
    const monthStart = new Date(`${month}-01`);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);

    const result = await pool.query(
      `SELECT
        CASE
          WHEN v.id IS NOT NULL THEN 'voice_call'
          WHEN pp.id IS NOT NULL THEN 'payment_plan'
          ELSE 'email_dunning'
        END as action,
        COUNT(DISTINCT p.invoice_id) as invoices_count,
        COUNT(p.id) as payment_count,
        SUM(p.amount) as total_recovered
       FROM payments p
       JOIN invoices i ON p.invoice_id = i.id
       LEFT JOIN voice_calls v ON i.id = v.invoice_id AND v.completed_at >= $2 AND v.completed_at < $3
       LEFT JOIN payment_plans pp ON i.id = pp.invoice_id AND pp.completed_at >= $2 AND pp.completed_at < $3
       WHERE i.company_id = $1
         AND p.paid_at >= $2
         AND p.paid_at < $3
         AND p.status = 'succeeded'
       GROUP BY action
       ORDER BY total_recovered DESC`,
      [companyId, monthStart.toISOString(), monthEnd.toISOString()]
    );

    const actions = result.rows;
    const total = actions.reduce((sum, a) => sum + parseFloat(a.total_recovered || '0'), 0);

    const breakdown = actions.map(a => ({
      action: a.action,
      invoices_count: parseInt(a.invoices_count, 10),
      payment_count: parseInt(a.payment_count, 10),
      amount_recovered: parseFloat(a.total_recovered || '0'),
      percentage: total > 0 ? Math.round((parseFloat(a.total_recovered || '0') / total) * 100) : 0
    }));

    logInfo(MODULE, handler, 'Recovery by action fetched', { companyId, month, actions: breakdown.length });

    res.json({
      data: {
        month,
        breakdown,
        total_recovered: total,
        total_invoices: actions.reduce((sum, a) => sum + parseInt(a.invoices_count, 10), 0)
      }
    });
  } catch (error) {
    console.error('Error fetching recovery by action:', error);
    res.status(500).json({ error: 'Failed to fetch recovery by action', code: 'INTERNAL_ERROR' });
  }
};

/**
 * GET /api/attribution/timeline?days=30
 * Daily recovery breakdown
 */
export const getRecoveryTimeline = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getRecoveryTimeline';
  const companyId = (req as any).companyId;
  const daysBack = parseInt(req.query.days as string) || 30;

  try {
    const dateThreshold = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const result = await pool.query(
      `SELECT
        DATE(p.paid_at) as payment_date,
        COUNT(DISTINCT p.invoice_id) as invoices_count,
        COUNT(p.id) as payment_count,
        SUM(p.amount) as daily_recovered
       FROM payments p
       JOIN invoices i ON p.invoice_id = i.id
       WHERE i.company_id = $1
         AND p.paid_at >= $2
         AND p.status = 'succeeded'
       GROUP BY DATE(p.paid_at)
       ORDER BY payment_date ASC`,
      [companyId, dateThreshold.toISOString()]
    );

    const timeline = result.rows.map(row => ({
      date: row.payment_date,
      invoices_count: parseInt(row.invoices_count, 10),
      payment_count: parseInt(row.payment_count, 10),
      amount_recovered: parseFloat(row.daily_recovered || '0')
    }));

    logInfo(MODULE, handler, 'Recovery timeline fetched', { companyId, daysBack, days: timeline.length });

    res.json({
      data: {
        days: daysBack,
        timeline,
        total_recovered: timeline.reduce((sum, t) => sum + t.amount_recovered, 0)
      }
    });
  } catch (error) {
    console.error('Error fetching recovery timeline:', error);
    res.status(500).json({ error: 'Failed to fetch recovery timeline', code: 'INTERNAL_ERROR' });
  }
};

/**
 * GET /api/attribution/roi?days=30
 * ROI calculation: recovered vs cost of service
 */
export const getROI = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getROI';
  const companyId = (req as any).companyId;
  const daysBack = parseInt(req.query.days as string) || 30;

  try {
    const dateThreshold = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    // Get recovered amount
    const recoveredResult = await pool.query(
      `SELECT SUM(p.amount) as total_recovered
       FROM payments p
       JOIN invoices i ON p.invoice_id = i.id
       WHERE i.company_id = $1
         AND p.paid_at >= $2
         AND p.status = 'succeeded'`,
      [companyId, dateThreshold.toISOString()]
    );

    const recovered = parseFloat(recoveredResult.rows[0]?.total_recovered || '0');

    // Get subscription cost (base fee for the period)
    const subscriptionResult = await pool.query(
      `SELECT billing_tier, base_fee_usd FROM companies WHERE id = $1`,
      [companyId]
    );

    const baseFee = parseFloat(subscriptionResult.rows[0]?.base_fee_usd || '0') || 2500; // Default $2.5K
    const periodCost = (baseFee / 30) * daysBack; // Daily rate

    // Calculate recovery percentage charged
    const recoveryPercentage = 0.01; // 1% default
    const recoveryFee = recovered * recoveryPercentage;
    const totalCost = periodCost + recoveryFee;

    // ROI = (Recovered - Cost) / Cost * 100
    const roi = totalCost > 0 ? Math.round(((recovered - totalCost) / totalCost) * 100) : 0;

    logInfo(MODULE, handler, 'ROI calculated', { companyId, recovered, totalCost, roi });

    res.json({
      data: {
        days: daysBack,
        recovered_amount: recovered,
        period_cost: Math.round(periodCost * 100) / 100,
        recovery_fee: Math.round(recoveryFee * 100) / 100,
        total_cost: Math.round(totalCost * 100) / 100,
        net_benefit: Math.round((recovered - totalCost) * 100) / 100,
        roi_percent: roi
      }
    });
  } catch (error) {
    console.error('Error calculating ROI:', error);
    res.status(500).json({ error: 'Failed to calculate ROI', code: 'INTERNAL_ERROR' });
  }
};
