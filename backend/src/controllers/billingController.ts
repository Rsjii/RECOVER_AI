import { Request, Response } from 'express';
import * as BillingDB from '../db/billing';
import { pool } from '../config/database';
import { logError, logInfo } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';
import lemonSqueezyService from '../services/lemonSqueezyService';

const LOG_MODULE = 'billingController';

export const listPlans = async (_req: Request, res: Response): Promise<void> => {
  try {
    await BillingDB.ensureDefaultPlans();
    const plans = await BillingDB.listActivePlans();
    res.status(200).json({ data: plans });
  } catch (error) {
    logError(LOG_MODULE, 'listPlans', 'Failed to list plans', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const getCurrentSubscription = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  try {
    const subscription = await BillingDB.getCurrentSubscription(companyId);

    // Augment with real-time recovery fee for current billing period
    let recoveryFee: { baseFeeUsd: number; recoveredUsd: number; feePct: number; recoveryFeeUsd: number; totalUsd: number } | null = null;
    if (subscription) {
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

      const [paymentsRes, plansRes] = await Promise.all([
        pool.query<{ total: string }>(
          `SELECT COALESCE(SUM(amount), 0)::text AS total FROM payments
           WHERE company_id = $1 AND status = 'succeeded' AND paid_at >= $2 AND paid_at < $3`,
          [companyId, monthStart, monthEnd]
        ),
        BillingDB.listActivePlans(),
      ]);

      const recoveredUsd = Number(paymentsRes.rows[0]?.total || 0);
      const plan = plansRes.find((p) => p.code === subscription.plan_code);
      const baseFeeUsd = Number(plan?.base_price_usd || 0);
      const feePct = Number(plan?.success_fee_percent || 1);
      const recoveryFeeUsd = Number(((recoveredUsd * feePct) / 100).toFixed(2));
      recoveryFee = {
        baseFeeUsd,
        recoveredUsd,
        feePct,
        recoveryFeeUsd,
        totalUsd: Number((baseFeeUsd + recoveryFeeUsd).toFixed(2)),
      };
    }

    res.status(200).json({ data: subscription, recoveryFee });
  } catch (error) {
    logError(LOG_MODULE, 'getCurrentSubscription', 'Failed to fetch subscription', error, { companyId });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const updateSubscription = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  const { planCode, status } = req.body as { planCode?: string; status?: 'trialing' | 'active' | 'past_due' | 'canceled' };

  if (!planCode) {
    sendErrorResponse(res, 400, 'planCode is required');
    return;
  }

  const nextStatus = status || 'active';
  try {
    await BillingDB.upsertCompanySubscription({
      companyId,
      planCode,
      status: nextStatus,
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    logInfo(LOG_MODULE, 'updateSubscription', 'Subscription updated', { companyId, planCode, nextStatus });
    const subscription = await BillingDB.getCurrentSubscription(companyId);
    res.status(200).json({ data: subscription });
  } catch (error) {
    logError(LOG_MODULE, 'updateSubscription', 'Failed to update subscription', error, { companyId, planCode });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const listBillingInvoices = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  try {
    const invoices = await BillingDB.listBillingInvoices(companyId, 50);
    res.status(200).json({ data: invoices });
  } catch (error) {
    logError(LOG_MODULE, 'listBillingInvoices', 'Failed to list billing invoices', error, { companyId });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const createMonthlyBillingInvoice = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  try {
    const subscription = await BillingDB.getCurrentSubscription(companyId);
    if (!subscription) {
      sendErrorResponse(res, 400, 'No active subscription found');
      return;
    }

    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const usage = await BillingDB.getUsageRollups(companyId, periodStart);
    const recoveredMetric = usage.find((u) => u.metric_key === 'recovered_amount_usd');
    const recoveredAmount = Number(recoveredMetric?.quantity || 0);

    const plans = await BillingDB.listActivePlans();
    const plan = plans.find((p) => p.code === subscription.plan_code);
    const baseAmount = Number(plan?.base_price_usd || 0);
    const successFeePct = Number(plan?.success_fee_percent || 1);
    const successFeeAmount = Number(((recoveredAmount * successFeePct) / 100).toFixed(2));
    const total = Number((baseAmount + successFeeAmount).toFixed(2));

    await BillingDB.createBillingInvoice({
      companyId,
      subscriptionId: subscription.id,
      periodStart,
      periodEnd,
      baseAmountUsd: baseAmount,
      successFeeAmountUsd: successFeeAmount,
      totalAmountUsd: total,
      status: 'open',
      lineItems: [
        { key: 'base_plan_fee', amountUsd: baseAmount, note: `Base fee for ${subscription.plan_name}` },
        { key: 'success_fee', amountUsd: successFeeAmount, note: `${successFeePct}% of recovered amount`, baseRecoveredUsd: recoveredAmount },
      ],
    });

    const invoices = await BillingDB.listBillingInvoices(companyId, 1);
    res.status(201).json({ data: invoices[0] });
  } catch (error) {
    logError(LOG_MODULE, 'createMonthlyBillingInvoice', 'Failed to generate monthly billing invoice', error, { companyId });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const getUsage = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  try {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const usage = await BillingDB.getUsageRollups(companyId, monthStart);
    res.status(200).json({ data: usage, periodMonth: monthStart.toISOString().slice(0, 10) });
  } catch (error) {
    logError(LOG_MODULE, 'getUsage', 'Failed to fetch usage', error, { companyId });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const recordUsage = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  const { metricKey, quantity, source, metadata } = req.body as {
    metricKey?: string;
    quantity?: number;
    source?: string;
    metadata?: Record<string, unknown>;
  };

  if (!metricKey || typeof quantity !== 'number') {
    sendErrorResponse(res, 400, 'metricKey and numeric quantity are required');
    return;
  }

  try {
    await BillingDB.recordUsageEvent({
      companyId,
      metricKey,
      quantity,
      source,
      metadata,
    });
    res.status(201).json({ message: 'Usage event recorded' });
  } catch (error) {
    logError(LOG_MODULE, 'recordUsage', 'Failed to record usage', error, { companyId, metricKey, quantity });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const getEntitlements = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  try {
    const entitlements = await BillingDB.getEntitlements(companyId);
    res.status(200).json({ data: entitlements });
  } catch (error) {
    logError(LOG_MODULE, 'getEntitlements', 'Failed to fetch entitlements', error, { companyId });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const syncRecoveredAmountToUsage = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  try {
    const totals = await pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS total
       FROM payments
       WHERE company_id = $1 AND status = 'succeeded'`,
      [companyId]
    );
    const recovered = Number(totals.rows[0]?.total || 0);
    await BillingDB.recordUsageEvent({
      companyId,
      metricKey: 'recovered_amount_usd',
      quantity: recovered,
      source: 'sync_job',
      metadata: { note: 'Synced from dashboard stats' },
    });
    res.status(200).json({ message: 'Recovered amount synced to usage rollups' });
  } catch (error) {
    logError(LOG_MODULE, 'syncRecoveredAmountToUsage', 'Failed to sync recovered amount', error, { companyId });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const reconcileBillingState = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  try {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const [paymentsSum, usageRecovered] = await Promise.all([
      pool.query<{ total: string }>(
        `SELECT COALESCE(SUM(amount), 0)::text AS total
         FROM payments
         WHERE company_id = $1
           AND status = 'succeeded'
           AND paid_at >= $2
           AND paid_at < $3`,
        [companyId, monthStart, monthEnd]
      ),
      pool.query<{ total: string }>(
        `SELECT COALESCE(SUM(quantity), 0)::text AS total
         FROM monthly_usage_rollups
         WHERE company_id = $1
           AND period_month = $2
           AND metric_key = 'recovered_amount_usd'`,
        [companyId, monthStart]
      ),
    ]);

    const paymentsTotal = Number(paymentsSum.rows[0]?.total || 0);
    const usageTotal = Number(usageRecovered.rows[0]?.total || 0);
    const delta = Number((paymentsTotal - usageTotal).toFixed(2));

    if (Math.abs(delta) > 0.01) {
      await BillingDB.recordUsageEvent({
        companyId,
        metricKey: 'recovered_amount_usd',
        quantity: delta,
        source: 'reconciliation',
        metadata: { monthStart: monthStart.toISOString() },
      });
    }

    res.status(200).json({
      data: {
        periodMonth: monthStart.toISOString().slice(0, 10),
        paymentsTotal,
        usageTotalBefore: usageTotal,
        deltaApplied: Math.abs(delta) > 0.01 ? delta : 0,
        status: Math.abs(delta) > 0.01 ? 'corrected' : 'already_consistent',
      },
    });
  } catch (error) {
    logError(LOG_MODULE, 'reconcileBillingState', 'Failed to reconcile billing state', error, { companyId });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

// ============ LemonSqueezy Integration ============

export const createLemonSqueezyCheckout = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  const { plan } = req.body as { plan: 'starter' | 'growth' | 'enterprise' };

  try {
    logInfo(LOG_MODULE, 'createLemonSqueezyCheckout', 'Creating checkout', { companyId, plan });

    if (!['starter', 'growth', 'enterprise'].includes(plan)) {
      sendErrorResponse(res, 400, 'Invalid plan');
      return;
    }

    const result = await lemonSqueezyService.createCheckout({
      planId: plan,
      customerEmail: (req as any).email || 'unknown@example.com',
      customerName: (req as any).name || 'User',
      companyId,
    });

    if (!result.success) {
      sendErrorResponse(res, 400, result.error || 'Failed to create checkout');
      return;
    }

    res.status(200).json({
      success: true,
      checkoutUrl: result.checkoutUrl,
    });
  } catch (error) {
    logError(LOG_MODULE, 'createLemonSqueezyCheckout', 'Failed to create checkout', error, { companyId });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const handleLemonSqueezyWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['x-signature'] as string;
    const body = JSON.stringify(req.body);

    logInfo(LOG_MODULE, 'handleLemonSqueezyWebhook', 'Received webhook');

    // Verify signature
    const isValid = lemonSqueezyService.verifyWebhookSignature(body, signature);

    if (!isValid) {
      logError(LOG_MODULE, 'handleLemonSqueezyWebhook', 'Invalid signature');
      sendErrorResponse(res, 401, 'Invalid signature');
      return;
    }

    // Handle webhook event
    await lemonSqueezyService.handleWebhook(req.body);

    logInfo(LOG_MODULE, 'handleLemonSqueezyWebhook', 'Webhook processed successfully');
    res.status(200).json({ success: true });
  } catch (error) {
    logError(LOG_MODULE, 'handleLemonSqueezyWebhook', 'Webhook processing failed', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};


