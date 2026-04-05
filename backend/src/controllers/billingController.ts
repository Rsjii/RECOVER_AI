import { Request, Response } from 'express';
import * as BillingDB from '../db/billing';
import { pool } from '../config/database';
import { logError, logInfo } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';
import lemonSqueezyService from '../services/lemonSqueezyService';
import * as RazorpayService from '../services/razorpayService';

const LOG_MODULE = 'billingController';

interface FeeTier { up_to: number | null; pct: number; }

/**
 * Calculate tiered success fee.
 * Tiers example: [{up_to:50000,pct:5},{up_to:150000,pct:3},{up_to:null,pct:2}]
 * Falls back to flat feePct if no tiers defined.
 */
function calculateTieredFee(recoveredUsd: number, tiers: FeeTier[] | null, flatPct: number): {
  feeUsd: number;
  breakdown: { label: string; amountUsd: number }[];
} {
  if (!tiers || tiers.length === 0) {
    const feeUsd = Number(((recoveredUsd * flatPct) / 100).toFixed(2));
    return { feeUsd, breakdown: [{ label: `${flatPct}% of $${recoveredUsd.toFixed(0)}`, amountUsd: feeUsd }] };
  }

  let remaining = recoveredUsd;
  let totalFee = 0;
  let prevThreshold = 0;
  const breakdown: { label: string; amountUsd: number }[] = [];

  for (const tier of tiers) {
    if (remaining <= 0) break;
    const tierMax = tier.up_to !== null ? tier.up_to - prevThreshold : Infinity;
    const chunk = Math.min(remaining, tierMax);
    const tierFee = Number(((chunk * tier.pct) / 100).toFixed(2));
    if (chunk > 0) {
      breakdown.push({ label: `${tier.pct}% of $${chunk.toFixed(0)}`, amountUsd: tierFee });
    }
    totalFee += tierFee;
    remaining -= chunk;
    prevThreshold = tier.up_to ?? 0;
  }

  return { feeUsd: Number(totalFee.toFixed(2)), breakdown };
}

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
    // Check if company is in trial mode
    const companyRes = await pool.query(
      `SELECT trial_status, trial_starts_at, trial_ends_at, account_type FROM companies WHERE id = $1`,
      [companyId]
    );

    const company = companyRes.rows[0];

    // If in trial, return trial information instead of subscription
    if (company?.trial_status === 'active' && company?.trial_ends_at) {
      const trialEndDate = new Date(company.trial_ends_at);
      const now = new Date();
      const daysRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      res.status(200).json({
        data: {
          status: 'trialing',
          plan_code: 'trial-21-day',
          plan_name: '21-Day Trial',
          next_billing_date: company.trial_ends_at,
          trial_ends_at: company.trial_ends_at,
          days_remaining: Math.max(0, daysRemaining),
          is_trial: true,
        },
        recoveryFee: null,
      });
      return;
    }

    const subscription = await BillingDB.getCurrentSubscription(companyId);

    // Augment with real-time recovery fee for current billing period
    let recoveryFee: { baseFeeUsd: number; recoveredUsd: number; feePct: number; recoveryFeeUsd: number; totalUsd: number; breakdown: { label: string; amountUsd: number }[] } | null = null;
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
      const flatPct = Number(plan?.success_fee_percent || 5);
      const tiers = (plan as any)?.success_fee_tiers ?? null;
      const { feeUsd: recoveryFeeUsd, breakdown } = calculateTieredFee(recoveredUsd, tiers, flatPct);
      recoveryFee = {
        baseFeeUsd,
        recoveredUsd,
        feePct: flatPct,
        recoveryFeeUsd,
        breakdown,
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
    const flatPct = Number(plan?.success_fee_percent || 5);
    const tiers = (plan as any)?.success_fee_tiers ?? null;
    const { feeUsd: successFeeAmount, breakdown } = calculateTieredFee(recoveredAmount, tiers, flatPct);
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
        { key: 'success_fee', amountUsd: successFeeAmount, note: breakdown.map(b => b.label).join(' + '), baseRecoveredUsd: recoveredAmount },
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
  const { plan, billingInterval } = req.body as { plan: 'phase_0' | 'growth' | 'enterprise'; billingInterval?: 'monthly' | 'annual' };

  try {
    logInfo(LOG_MODULE, 'createLemonSqueezyCheckout', 'Creating checkout', { companyId, plan, billingInterval });

    if (!['phase_0', 'growth', 'enterprise'].includes(plan)) {
      sendErrorResponse(res, 400, 'Invalid plan');
      return;
    }

    if (billingInterval && !['monthly', 'annual'].includes(billingInterval)) {
      sendErrorResponse(res, 400, 'Invalid billingInterval (must be monthly or annual)');
      return;
    }

    const result = await lemonSqueezyService.createCheckout({
      planId: plan,
      billingInterval: billingInterval || 'monthly',
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

// ============================================================
// RAZORPAY ENDPOINTS
// ============================================================

/**
 * POST /api/billing/razorpay/generate-invoices
 * Admin: generate monthly invoices for all active companies and create Razorpay payment links.
 */
export const generateRazorpayInvoices = async (req: Request, res: Response): Promise<void> => {
  const fn = 'generateRazorpayInvoices';
  try {
    const now = new Date();
    const { year, month } = req.body as { year?: number; month?: number };

    // Default to previous calendar month
    const targetYear = year ?? (now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear());
    const targetMonth = month ?? (now.getUTCMonth() === 0 ? 12 : now.getUTCMonth()); // 1-indexed

    const periodStart = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
    const periodEnd = new Date(Date.UTC(targetYear, targetMonth, 0)); // last day

    logInfo(LOG_MODULE, fn, 'Generating invoices', {
      periodStart: periodStart.toISOString().slice(0, 10),
      periodEnd: periodEnd.toISOString().slice(0, 10),
    });

    const results = await RazorpayService.generateAllMonthlyInvoices(periodStart, periodEnd);

    res.status(200).json({
      data: results,
      summary: {
        total: results.length,
        generated: results.filter((r) => r.status === 'generated').length,
        errors: results.filter((r) => r.status === 'error').length,
        period: `${periodStart.toISOString().slice(0, 7)}`,
      },
    });
  } catch (error) {
    logError(LOG_MODULE, fn, 'Failed to generate invoices', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/billing/razorpay/generate-invoice/:companyId
 * Admin: generate invoice for a single company (manual / custom quote).
 */
export const generateRazorpayInvoiceForCompany = async (req: Request, res: Response): Promise<void> => {
  const fn = 'generateRazorpayInvoiceForCompany';
  try {
    const targetCompanyId = req.params.companyId as string;
    const { baseFeeUsd, recoveryPercentage, year, month, currency } = req.body as {
      baseFeeUsd?: number;
      recoveryPercentage?: number;
      year?: number;
      month?: number;
      currency?: string;
    };

    if (!baseFeeUsd) {
      sendErrorResponse(res, 400, 'baseFeeUsd is required');
      return;
    }

    const companyRes = await pool.query(
      'SELECT id, name, email, billing_tier, recovery_percentage FROM companies WHERE id = $1',
      [targetCompanyId]
    );
    if (!companyRes.rows[0]) {
      sendErrorResponse(res, 404, 'Company not found');
      return;
    }
    const company = companyRes.rows[0];

    const now = new Date();
    const targetYear = year ?? now.getUTCFullYear();
    const targetMonth = month ?? (now.getUTCMonth() + 1);
    const periodStart = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
    const periodEnd = new Date(Date.UTC(targetYear, targetMonth, 0));

    // Calculate recovery for the period
    const recoveredRes = await pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS total
       FROM payments
       WHERE company_id = $1 AND status = 'succeeded' AND paid_at >= $2 AND paid_at < $3`,
      [targetCompanyId, periodStart, periodEnd]
    );
    const recoveredAmountUsd = Number(recoveredRes.rows[0]?.total || 0);
    const finalRecoveryPct = recoveryPercentage ?? Number(company.recovery_percentage || 1.2);

    logInfo(LOG_MODULE, fn, 'Generating single-company invoice', {
      companyId: targetCompanyId,
      baseFeeUsd,
      recoveredAmountUsd,
      finalRecoveryPct,
    });

    const invoice = await RazorpayService.generateMonthlyInvoice({
      companyId: targetCompanyId,
      customerName: company.name,
      customerEmail: company.email,
      baseFeeUsd,
      recoveredAmountUsd,
      recoveryPercentage: finalRecoveryPct,
      periodStart,
      periodEnd,
      currency,
    });

    res.status(200).json({ data: invoice });
  } catch (error) {
    logError(LOG_MODULE, fn, 'Failed to generate company invoice', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/billing/razorpay/webhook
 * Handle Razorpay webhook events (payment_link.paid, etc.)
 */
export const handleRazorpayWebhook = async (req: Request, res: Response): Promise<void> => {
  const fn = 'handleRazorpayWebhook';
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    const isValid = RazorpayService.validateWebhookSignature(rawBody, signature);
    if (!isValid) {
      logError(LOG_MODULE, fn, 'Invalid webhook signature');
      sendErrorResponse(res, 400, 'Invalid webhook signature');
      return;
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    await RazorpayService.handleWebhookEvent(event);

    logInfo(LOG_MODULE, fn, 'Webhook processed', { event: event.event });
    res.status(200).json({ received: true });
  } catch (error) {
    logError(LOG_MODULE, fn, 'Webhook processing failed', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * PUT /api/billing/razorpay/company/:companyId/tier
 * Admin: set custom billing tier + recovery % for a company.
 */
export const setCompanyBillingTier = async (req: Request, res: Response): Promise<void> => {
  const fn = 'setCompanyBillingTier';
  try {
    const targetCompanyId = req.params.companyId as string;
    const { billingTier, recoveryPercentage } = req.body as {
      billingTier: number;
      recoveryPercentage: number;
    };

    if (!billingTier || billingTier < 1 || billingTier > 4) {
      sendErrorResponse(res, 400, 'billingTier must be 1–4');
      return;
    }
    if (recoveryPercentage == null || recoveryPercentage < 0 || recoveryPercentage > 10) {
      sendErrorResponse(res, 400, 'recoveryPercentage must be between 0 and 10');
      return;
    }

    await pool.query(
      `UPDATE companies SET billing_tier = $1, recovery_percentage = $2, updated_at = NOW() WHERE id = $3`,
      [billingTier, recoveryPercentage, targetCompanyId]
    );

    logInfo(LOG_MODULE, fn, 'Company billing tier updated', {
      companyId: targetCompanyId,
      billingTier,
      recoveryPercentage,
    });

    res.status(200).json({ data: { companyId: targetCompanyId, billingTier, recoveryPercentage } });
  } catch (error) {
    logError(LOG_MODULE, fn, 'Failed to set billing tier', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/billing/checkout
 * Initiate checkout for pilot conversion (upgrade to paid plan)
 */
export const startPilotConversion = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  const fn = 'startPilotConversion';

  try {
    // Get company details
    const company = await pool.query(
      `SELECT id, company_name, account_type FROM companies WHERE id = $1`,
      [companyId]
    );

    if (!company.rows[0]) {
      sendErrorResponse(res, 404, 'Company not found');
      return;
    }

    const comp = company.rows[0];

    // Verify company is in pilot mode
    if (comp.account_type !== 'pilot') {
      sendErrorResponse(res, 400, 'Only pilot accounts can convert to paid');
      return;
    }

    // Create Razorpay payment link for pilot conversion
    // Tier 1 pricing: $2,500 base fee
    const amountInPaise = 2500 * 100; // Razorpay uses paise (1/100th of rupee equivalent)
    const description = `RecoverAI Pilot Conversion - ${comp.company_name}`;

    // For now, return a simple checkout URL
    // In production, this would create a Razorpay payment link
    const checkoutUrl = `https://checkout.razorpay.com/?key=${process.env.RAZORPAY_KEY_ID}`;

    logInfo(LOG_MODULE, fn, 'Pilot conversion initiated', {
      companyId,
      company: comp.company_name,
    });

    res.status(200).json({
      data: {
        checkoutUrl,
        amount: 2500,
        currency: 'USD',
        description,
      },
    });
  } catch (error) {
    logError(LOG_MODULE, fn, 'Failed to start pilot conversion', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};


