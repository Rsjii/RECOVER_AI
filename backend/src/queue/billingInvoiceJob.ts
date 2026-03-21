import cron from 'node-cron';
import { pool } from '../config/database';
import * as BillingDB from '../db/billing';
import { logError, logInfo } from '../utils/logger';

const LOG_MODULE = 'billingInvoiceJob';

interface FeeTier { up_to: number | null; pct: number; }

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

export async function generateMonthlyInvoicesForCompany(companyId: string): Promise<void> {
  const method = 'generateMonthlyInvoicesForCompany';

  const subscription = await BillingDB.getCurrentSubscription(companyId);
  if (!subscription || subscription.status !== 'active') {
    logInfo(LOG_MODULE, method, 'Skipping — no active subscription', { companyId });
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

  logInfo(LOG_MODULE, method, 'Monthly invoice generated', {
    companyId,
    total,
    recoveredAmount,
  });
}

async function generateMonthlyInvoices(): Promise<void> {
  const method = 'generateMonthlyInvoices';

  const { rows } = await pool.query<{ company_id: string }>(
    `SELECT DISTINCT company_id FROM subscriptions WHERE status = 'active'`
  );

  logInfo(LOG_MODULE, method, `Generating invoices for ${rows.length} active companies`);

  for (const row of rows) {
    try {
      await generateMonthlyInvoicesForCompany(row.company_id);
    } catch (err) {
      logError(LOG_MODULE, method, 'Failed to generate invoice for company', err, {
        companyId: row.company_id,
      });
    }
  }
}

export function startBillingInvoiceJob(): void {
  // Run on the 1st of each month at 02:00 UTC
  cron.schedule('0 2 1 * *', () => {
    generateMonthlyInvoices().catch((err) =>
      logError(LOG_MODULE, 'cronRun', 'Monthly billing invoice run failed', err)
    );
  });

  logInfo(LOG_MODULE, 'startBillingInvoiceJob', 'Billing invoice job started (runs 1st of month at 02:00 UTC)');
}

export function stopBillingInvoiceJob(): void {
  // node-cron tasks stop automatically on process exit
}
