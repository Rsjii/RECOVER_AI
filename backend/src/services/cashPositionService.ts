import { pool } from '../config/database';
import { logInfo, logError } from '../utils/logger';

const MODULE = 'CashPositionService';

export interface CashPosition {
  currentBalance: number;        // manually entered cash balance
  balance30: number;             // projected cash in 30 days
  balance60: number;             // projected cash in 60 days
  balance90: number;             // projected cash in 90 days
  pendingInvoices30: number;     // AR expected to be collected in 30 days
  pendingInvoices60: number;     // AR expected in 60 days
  pendingInvoices90: number;     // AR expected in 90 days
  invoiceCount: number;          // total open invoices included
  asOfDate: string;              // ISO date string
}

/**
 * Calculate 30/60/90 day cash position projections.
 * Formula: current_balance + (invoices_due × payment_probability_per_customer)
 * Payment probability defaults to 0.65 if no history available.
 */
export async function getCashPosition(companyId: string): Promise<CashPosition> {
  try {
    // Get current cash balance from companies table
    const companyResult = await pool.query(
      `SELECT COALESCE(cash_balance_usd, 0) AS cash_balance FROM companies WHERE id = $1`,
      [companyId]
    );
    const currentBalance = parseFloat(companyResult.rows[0]?.cash_balance || '0');

    // Get payment probability per customer (paid / total in last 12 months)
    const probabilityResult = await pool.query(
      `SELECT
         customer_id,
         COUNT(*)::FLOAT AS total,
         COUNT(CASE WHEN status = 'paid' THEN 1 END)::FLOAT AS paid
       FROM invoices
       WHERE company_id = $1
         AND created_at > NOW() - INTERVAL '12 months'
       GROUP BY customer_id`,
      [companyId]
    );

    const probabilityMap: Record<string, number> = {};
    for (const row of probabilityResult.rows) {
      probabilityMap[row.customer_id] = row.total > 0 ? row.paid / row.total : 0.65;
    }

    // Get all open invoices with due dates
    const invoicesResult = await pool.query(
      `SELECT
         i.id,
         i.customer_id,
         i.amount,
         i.due_date,
         CEIL(EXTRACT(EPOCH FROM (i.due_date - NOW())) / 86400)::INT AS days_until_due
       FROM invoices i
       WHERE i.company_id = $1
         AND i.status = 'unpaid'
         AND i.dunning_stopped = FALSE
         AND i.due_date > NOW()
       ORDER BY i.due_date ASC`,
      [companyId]
    );

    let pending30 = 0;
    let pending60 = 0;
    let pending90 = 0;

    for (const inv of invoicesResult.rows) {
      const prob = probabilityMap[inv.customer_id] ?? 0.65;
      const expectedAmount = parseFloat(inv.amount) * prob;
      const days = inv.days_until_due;

      if (days <= 30) {
        pending30 += expectedAmount;
        pending60 += expectedAmount;
        pending90 += expectedAmount;
      } else if (days <= 60) {
        pending60 += expectedAmount;
        pending90 += expectedAmount;
      } else if (days <= 90) {
        pending90 += expectedAmount;
      }
    }

    const result: CashPosition = {
      currentBalance,
      balance30: Math.round((currentBalance + pending30) * 100) / 100,
      balance60: Math.round((currentBalance + pending60) * 100) / 100,
      balance90: Math.round((currentBalance + pending90) * 100) / 100,
      pendingInvoices30: Math.round(pending30 * 100) / 100,
      pendingInvoices60: Math.round(pending60 * 100) / 100,
      pendingInvoices90: Math.round(pending90 * 100) / 100,
      invoiceCount: invoicesResult.rows.length,
      asOfDate: new Date().toISOString(),
    };

    logInfo(MODULE, 'getCashPosition', 'Cash position calculated', {
      companyId,
      balance30: result.balance30,
      balance90: result.balance90,
    });

    return result;
  } catch (err: unknown) {
    logError(MODULE, 'getCashPosition', err instanceof Error ? err.message : String(err));
    return {
      currentBalance: 0,
      balance30: 0,
      balance60: 0,
      balance90: 0,
      pendingInvoices30: 0,
      pendingInvoices60: 0,
      pendingInvoices90: 0,
      invoiceCount: 0,
      asOfDate: new Date().toISOString(),
    };
  }
}

/**
 * Update the company's manually entered cash balance.
 */
export async function updateCashBalance(companyId: string, balanceUsd: number): Promise<void> {
  await pool.query(
    `UPDATE companies SET cash_balance_usd = $1, updated_at = NOW() WHERE id = $2`,
    [balanceUsd, companyId]
  );
  logInfo(MODULE, 'updateCashBalance', 'Cash balance updated', { companyId, balanceUsd });
}

// ─── What-If Scenarios ─────────────────────────────────────────────

export interface WhatIfScenario {
  type: 'remove_customer' | 'accelerate_dunning' | 'custom';
  removeCustomerId?: string;
  accelerateDunningByDays?: number;
  customReductionPct?: number;
}

export interface WhatIfResult {
  baselineBalance30: number;
  baselineBalance60: number;
  baselineBalance90: number;
  scenarioBalance30: number;
  scenarioBalance60: number;
  scenarioBalance90: number;
  impactAmount: number;
  impactDescription: string;
  customerName?: string;
}

/**
 * Calculate a what-if scenario against the current cash position.
 * - remove_customer: removes a specific customer's expected payments
 * - accelerate_dunning: applies 1.15x multiplier to payment probabilities
 * - custom: reduces all expected inflows by a given percentage
 */
export async function calculateWhatIf(
  companyId: string,
  scenario: WhatIfScenario
): Promise<WhatIfResult> {
  try {
    const baseline = await getCashPosition(companyId);

    let scenarioBalance30 = baseline.balance30;
    let scenarioBalance60 = baseline.balance60;
    let scenarioBalance90 = baseline.balance90;
    let impactAmount = 0;
    let impactDescription = '';
    let customerName: string | undefined;

    if (scenario.type === 'remove_customer' && scenario.removeCustomerId) {
      // Calculate how much this customer contributes to expected cash
      const custResult = await pool.query(
        `SELECT
           c.name AS customer_name,
           COALESCE(SUM(CASE WHEN CEIL(EXTRACT(EPOCH FROM (i.due_date - NOW())) / 86400) <= 30 THEN i.amount ELSE 0 END), 0) AS due_30,
           COALESCE(SUM(CASE WHEN CEIL(EXTRACT(EPOCH FROM (i.due_date - NOW())) / 86400) <= 60 THEN i.amount ELSE 0 END), 0) AS due_60,
           COALESCE(SUM(CASE WHEN CEIL(EXTRACT(EPOCH FROM (i.due_date - NOW())) / 86400) <= 90 THEN i.amount ELSE 0 END), 0) AS due_90
         FROM invoices i
         JOIN customers c ON c.id = i.customer_id
         WHERE i.company_id = $1
           AND i.customer_id = $2
           AND i.status = 'unpaid'
           AND i.dunning_stopped = FALSE
           AND i.due_date > NOW()
         GROUP BY c.name`,
        [companyId, scenario.removeCustomerId]
      );

      if (custResult.rows.length > 0) {
        const row = custResult.rows[0];
        customerName = row.customer_name;

        // Get probability for this customer
        const probResult = await pool.query(
          `SELECT COUNT(*)::FLOAT AS total, COUNT(CASE WHEN status = 'paid' THEN 1 END)::FLOAT AS paid
           FROM invoices WHERE company_id = $1 AND customer_id = $2 AND created_at > NOW() - INTERVAL '12 months'`,
          [companyId, scenario.removeCustomerId]
        );
        const prob = probResult.rows[0]?.total > 0 ? probResult.rows[0].paid / probResult.rows[0].total : 0.65;

        const loss30 = parseFloat(row.due_30) * prob;
        const loss60 = parseFloat(row.due_60) * prob;
        const loss90 = parseFloat(row.due_90) * prob;

        scenarioBalance30 = Math.round((baseline.balance30 - loss30) * 100) / 100;
        scenarioBalance60 = Math.round((baseline.balance60 - loss60) * 100) / 100;
        scenarioBalance90 = Math.round((baseline.balance90 - loss90) * 100) / 100;
        impactAmount = Math.round(loss90 * 100) / 100;
        impactDescription = `Losing ${customerName} would reduce 90-day cash by $${impactAmount.toLocaleString()}`;
      } else {
        impactDescription = 'Customer has no unpaid invoices';
      }
    } else if (scenario.type === 'accelerate_dunning') {
      // Accelerating dunning improves payment probability by ~15%
      const multiplier = 1.15;
      const improvement30 = baseline.pendingInvoices30 * (multiplier - 1);
      const improvement60 = baseline.pendingInvoices60 * (multiplier - 1);
      const improvement90 = baseline.pendingInvoices90 * (multiplier - 1);

      scenarioBalance30 = Math.round((baseline.balance30 + improvement30) * 100) / 100;
      scenarioBalance60 = Math.round((baseline.balance60 + improvement60) * 100) / 100;
      scenarioBalance90 = Math.round((baseline.balance90 + improvement90) * 100) / 100;
      impactAmount = Math.round(improvement90 * 100) / 100;
      impactDescription = `Accelerating dunning could free up $${impactAmount.toLocaleString()} in 90 days`;
    } else if (scenario.type === 'custom' && scenario.customReductionPct != null) {
      // Reduce all expected inflows by a percentage
      const factor = scenario.customReductionPct / 100;
      const reduction30 = baseline.pendingInvoices30 * factor;
      const reduction60 = baseline.pendingInvoices60 * factor;
      const reduction90 = baseline.pendingInvoices90 * factor;

      scenarioBalance30 = Math.round((baseline.balance30 - reduction30) * 100) / 100;
      scenarioBalance60 = Math.round((baseline.balance60 - reduction60) * 100) / 100;
      scenarioBalance90 = Math.round((baseline.balance90 - reduction90) * 100) / 100;
      impactAmount = Math.round(reduction90 * 100) / 100;
      impactDescription = `A ${scenario.customReductionPct}% revenue drop would reduce 90-day cash by $${impactAmount.toLocaleString()}`;
    }

    logInfo(MODULE, 'calculateWhatIf', 'What-if calculated', { companyId, type: scenario.type, impactAmount });

    return {
      baselineBalance30: baseline.balance30,
      baselineBalance60: baseline.balance60,
      baselineBalance90: baseline.balance90,
      scenarioBalance30,
      scenarioBalance60,
      scenarioBalance90,
      impactAmount,
      impactDescription,
      customerName,
    };
  } catch (err: unknown) {
    logError(MODULE, 'calculateWhatIf', err instanceof Error ? err.message : String(err));
    throw err;
  }
}

// ─── Cash Runway ────────────────────────────────────────────────────

export interface RunwayResult {
  currentBalance: number;
  monthlyBurnRate: number;
  runwayDays: number;
  runwayStatus: 'critical' | 'warning' | 'healthy';
  avgMonthlyCreated: number;
  avgMonthlyRecovered: number;
  asOfDate: string;
}

/**
 * Calculate cash runway in days.
 * Burn proxy = avg monthly invoices created - avg monthly recovered (last 6 months).
 */
export async function calculateRunway(companyId: string): Promise<RunwayResult> {
  try {
    // Get current cash balance
    const companyResult = await pool.query(
      `SELECT COALESCE(cash_balance_usd, 0) AS cash_balance FROM companies WHERE id = $1`,
      [companyId]
    );
    const currentBalance = parseFloat(companyResult.rows[0]?.cash_balance || '0');

    // Get monthly invoice created vs recovered over last 6 months
    const monthlyResult = await pool.query(
      `SELECT
         DATE_TRUNC('month', created_at) AS month,
         COALESCE(SUM(amount), 0) AS created_amount,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS recovered_amount
       FROM invoices
       WHERE company_id = $1
         AND created_at > NOW() - INTERVAL '6 months'
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY month`,
      [companyId]
    );

    let avgMonthlyCreated = 0;
    let avgMonthlyRecovered = 0;

    if (monthlyResult.rows.length > 0) {
      const totalCreated = monthlyResult.rows.reduce((sum: number, r: any) => sum + parseFloat(r.created_amount), 0);
      const totalRecovered = monthlyResult.rows.reduce((sum: number, r: any) => sum + parseFloat(r.recovered_amount), 0);
      const monthCount = monthlyResult.rows.length;
      avgMonthlyCreated = totalCreated / monthCount;
      avgMonthlyRecovered = totalRecovered / monthCount;
    }

    // Burn rate = net cash outflow per month (created - recovered = unrecovered portion)
    const monthlyBurnRate = Math.max(avgMonthlyCreated - avgMonthlyRecovered, 0);
    const dailyBurn = monthlyBurnRate / 30;

    // Runway in days
    const runwayDays = dailyBurn > 0 ? Math.round(currentBalance / dailyBurn) : 9999;

    let runwayStatus: 'critical' | 'warning' | 'healthy';
    if (runwayDays < 60) runwayStatus = 'critical';
    else if (runwayDays < 120) runwayStatus = 'warning';
    else runwayStatus = 'healthy';

    logInfo(MODULE, 'calculateRunway', 'Runway calculated', {
      companyId, runwayDays, monthlyBurnRate: Math.round(monthlyBurnRate),
    });

    return {
      currentBalance,
      monthlyBurnRate: Math.round(monthlyBurnRate * 100) / 100,
      runwayDays,
      runwayStatus,
      avgMonthlyCreated: Math.round(avgMonthlyCreated * 100) / 100,
      avgMonthlyRecovered: Math.round(avgMonthlyRecovered * 100) / 100,
      asOfDate: new Date().toISOString(),
    };
  } catch (err: unknown) {
    logError(MODULE, 'calculateRunway', err instanceof Error ? err.message : String(err));
    return {
      currentBalance: 0,
      monthlyBurnRate: 0,
      runwayDays: 0,
      runwayStatus: 'critical',
      avgMonthlyCreated: 0,
      avgMonthlyRecovered: 0,
      asOfDate: new Date().toISOString(),
    };
  }
}

// ─── Cash Leakage Analysis ──────────────────────────────────────────

export interface LeakageSource {
  category: 'failed_payments' | 'payment_delays' | 'customer_churn';
  label: string;
  amountUsd: number;
  percentage: number;
  detail: string;
}

export interface CashLeakageResult {
  totalLeakageUsd: number;
  sources: LeakageSource[];
  period: string;
  asOfDate: string;
}

/**
 * Analyze where cash is being lost:
 * 1. Failed payments (last 90 days)
 * 2. Payment delays (DSO cost impact)
 * 3. Customer churn (unpaid >90 days with no activity)
 */
export async function getCashLeakage(companyId: string): Promise<CashLeakageResult> {
  try {
    // 1. Failed payments — sum of failed payment attempts in last 90 days
    const failedResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS failed_total
       FROM payments
       WHERE company_id = $1
         AND status = 'failed'
         AND created_at > NOW() - INTERVAL '90 days'`,
      [companyId]
    );
    const failedAmount = parseFloat(failedResult.rows[0]?.failed_total || '0');

    // 2. Payment delays — avg days late × cost of capital approximation
    const delayResult = await pool.query(
      `SELECT
         COALESCE(AVG(EXTRACT(EPOCH FROM (p.created_at - i.due_date)) / 86400), 0) AS avg_days_late,
         COALESCE(SUM(i.amount), 0) AS total_owed
       FROM invoices i
       JOIN payments p ON p.invoice_id = i.id AND p.status = 'succeeded'
       WHERE i.company_id = $1
         AND p.created_at > i.due_date
         AND i.created_at > NOW() - INTERVAL '90 days'`,
      [companyId]
    );
    const avgDaysLate = Math.max(parseFloat(delayResult.rows[0]?.avg_days_late || '0'), 0);
    const totalOwedLate = parseFloat(delayResult.rows[0]?.total_owed || '0');
    // Cost of capital: 5% annual rate applied to late amounts
    const delayAmount = Math.round(totalOwedLate * 0.05 / 365 * avgDaysLate * 100) / 100;

    // 3. Customer churn — customers with unpaid invoices >90 days old and no payment in 90 days
    const churnResult = await pool.query(
      `SELECT COALESCE(SUM(i.amount), 0) AS churn_total
       FROM invoices i
       WHERE i.company_id = $1
         AND i.status = 'unpaid'
         AND i.due_date < NOW() - INTERVAL '90 days'
         AND NOT EXISTS (
           SELECT 1 FROM payments p
           WHERE p.invoice_id = i.id
             AND p.status = 'succeeded'
             AND p.created_at > NOW() - INTERVAL '90 days'
         )`,
      [companyId]
    );
    const churnAmount = parseFloat(churnResult.rows[0]?.churn_total || '0');

    const totalLeakage = failedAmount + delayAmount + churnAmount;

    const sources: LeakageSource[] = [
      {
        category: 'failed_payments',
        label: 'Failed Payments',
        amountUsd: Math.round(failedAmount * 100) / 100,
        percentage: totalLeakage > 0 ? Math.round((failedAmount / totalLeakage) * 100) : 0,
        detail: 'Revenue lost to declined cards and failed transactions (90 days)',
      },
      {
        category: 'payment_delays',
        label: 'Payment Delays',
        amountUsd: Math.round(delayAmount * 100) / 100,
        percentage: totalLeakage > 0 ? Math.round((delayAmount / totalLeakage) * 100) : 0,
        detail: `Avg ${Math.round(avgDaysLate)} days late — cost of capital at 5% annual rate`,
      },
      {
        category: 'customer_churn',
        label: 'Customer Churn',
        amountUsd: Math.round(churnAmount * 100) / 100,
        percentage: totalLeakage > 0 ? Math.round((churnAmount / totalLeakage) * 100) : 0,
        detail: 'Invoices >90 days overdue with no recent payment activity',
      },
    ];

    logInfo(MODULE, 'getCashLeakage', 'Cash leakage analyzed', {
      companyId, totalLeakage: Math.round(totalLeakage), sources: sources.length,
    });

    return {
      totalLeakageUsd: Math.round(totalLeakage * 100) / 100,
      sources,
      period: 'Last 90 days',
      asOfDate: new Date().toISOString(),
    };
  } catch (err: unknown) {
    logError(MODULE, 'getCashLeakage', err instanceof Error ? err.message : String(err));
    return {
      totalLeakageUsd: 0,
      sources: [],
      period: 'Last 90 days',
      asOfDate: new Date().toISOString(),
    };
  }
}

// ─── Enhanced Cash Forecast (90-day day-by-day) ──────────────────────────────

export interface ForecastDay {
  date: string;
  projectedBalance: number;
  confidenceBand: { low: number; high: number };
}

export interface EnhancedCashForecast {
  forecastDays: ForecastDay[];
  trend: 'improving' | 'stable' | 'declining';
  historicalAvgCollectionRate: number;
  trendSlope: number;
  asOfDate: string;
}

/**
 * Generate a 90-day day-by-day cash balance forecast using linear regression
 * on the company's historical collection rate from recovery_timeline.
 * Falls back to flat 65% rate if fewer than 7 days of history exist.
 */
export async function getEnhancedCashForecast(companyId: string): Promise<EnhancedCashForecast> {
  try {
    // 1. Fetch last 60 days of daily recovery timeline
    const timelineResult = await pool.query<{
      period_date: string;
      amount_created: string;
      amount_recovered: string;
    }>(
      `SELECT period_date, amount_created, amount_recovered
       FROM recovery_timeline
       WHERE company_id = $1
         AND period_type = 'daily'
         AND period_date >= NOW() - INTERVAL '60 days'
       ORDER BY period_date ASC`,
      [companyId]
    );

    const rows = timelineResult.rows;

    // 2. Current balance
    const balanceResult = await pool.query<{ cash_balance: string }>(
      `SELECT COALESCE(cash_balance_usd, 0) AS cash_balance FROM companies WHERE id = $1`,
      [companyId]
    );
    const currentBalance = parseFloat(balanceResult.rows[0]?.cash_balance ?? '0');

    // 3. Pending invoices per day for next 90 days
    const pendingResult = await pool.query<{ due_day: string; expected: string }>(
      `SELECT due_date::date AS due_day, SUM(amount) AS expected
       FROM invoices
       WHERE company_id = $1
         AND status = 'unpaid'
         AND due_date BETWEEN NOW() AND NOW() + INTERVAL '90 days'
       GROUP BY due_date::date
       ORDER BY due_day`,
      [companyId]
    );

    const pendingByDay: Record<string, number> = {};
    for (const r of pendingResult.rows) {
      pendingByDay[r.due_day] = parseFloat(r.expected);
    }

    // 4. Compute collection rates and linear regression
    let baseRate = 0.65;
    let slope = 0;
    let trend: EnhancedCashForecast['trend'] = 'stable';

    if (rows.length >= 7) {
      const rates: number[] = rows.map((r) => {
        const created = parseFloat(r.amount_created);
        const recovered = parseFloat(r.amount_recovered);
        return created > 0 ? Math.min(recovered / created, 1) : 0.65;
      });

      const n = rates.length;
      const xMean = (n - 1) / 2;
      const yMean = rates.reduce((s, v) => s + v, 0) / n;

      let numerator = 0;
      let denominator = 0;
      for (let i = 0; i < n; i++) {
        numerator += (i - xMean) * (rates[i] - yMean);
        denominator += (i - xMean) ** 2;
      }

      slope = denominator !== 0 ? numerator / denominator : 0;
      baseRate = yMean;

      if (slope > 0.002) trend = 'improving';
      else if (slope < -0.002) trend = 'declining';
      else trend = 'stable';
    }

    // 5. Fetch monthly burn rate from company settings (set by user in dashboard)
    const burnResult = await pool.query<{ burn: string }>(
      `SELECT COALESCE(monthly_burn_rate_usd, 0) AS burn FROM companies WHERE id = $1`,
      [companyId]
    );
    const dailyBurn = Number(burnResult.rows[0]?.burn ?? 0) / 30;

    // 6. Build day-by-day forecast
    const forecastDays: ForecastDay[] = [];
    let runningBalance = currentBalance;

    for (let dayIndex = 1; dayIndex <= 90; dayIndex++) {
      const date = new Date();
      date.setDate(date.getDate() + dayIndex);
      const dateStr = date.toISOString().slice(0, 10);

      const pendingToday = pendingByDay[dateStr] ?? 0;
      const predictedRate = Math.min(Math.max(baseRate + slope * dayIndex, 0.3), 0.95);
      const inflow = pendingToday * predictedRate;

      runningBalance = Math.max(runningBalance + inflow - dailyBurn, 0);

      forecastDays.push({
        date: dateStr,
        projectedBalance: Math.round(runningBalance * 100) / 100,
        confidenceBand: {
          low: Math.round(runningBalance * 0.85 * 100) / 100,
          high: Math.round(runningBalance * 1.15 * 100) / 100,
        },
      });
    }

    logInfo(MODULE, 'getEnhancedCashForecast', 'Forecast generated', {
      companyId,
      trend,
      baseRate: baseRate.toFixed(3),
      slope: slope.toFixed(5),
      days: forecastDays.length,
    });

    return {
      forecastDays,
      trend,
      historicalAvgCollectionRate: Math.round(baseRate * 1000) / 1000,
      trendSlope: Math.round(slope * 100000) / 100000,
      asOfDate: new Date().toISOString(),
    };
  } catch (err: unknown) {
    logError(MODULE, 'getEnhancedCashForecast', err instanceof Error ? err.message : String(err));
    return {
      forecastDays: [],
      trend: 'stable',
      historicalAvgCollectionRate: 0.65,
      trendSlope: 0,
      asOfDate: new Date().toISOString(),
    };
  }
}
