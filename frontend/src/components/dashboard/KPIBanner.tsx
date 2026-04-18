/**
 * KPI BANNER — PHASE 1 (Email Detection & Sending Only)
 *
 * CURRENT METRICS (Phase 1):
 * 1. Eligible Invoices - invoices detected in aging buckets
 * 2. Total AR at Risk - total amount across eligible invoices
 * 3. Recovery Rate - % of invoices recovered (shows PENDING until emails sent)
 * 4. Hours Saved - automation savings from email campaigns (emails × 5 min)
 *
 * ════════════════════════════════════════════════════════════════
 * METRICS TO ADD IN FUTURE PHASES (Code Commented Below):
 * ════════════════════════════════════════════════════════════════
 *
 * 1. DAYS SALES OUTSTANDING (DSO) — PHASE 3+
 *    What: (Total AR / Daily Revenue) × 30
 *    Why Not Phase 1: Requires revenue data integration (Stripe charges, not just invoices)
 *    How to Add:
 *      - Need daily revenue endpoint from accounting system
 *      - Calculate DSO = (totalAr / dailyRevenue) × 30
 *      - Format: `${Math.round(dso)}d`
 *      - Color: emerald if ≤40d, amber if ≤60d, red if >60d
 *      - Add modal showing: Current DSO, Aging breakdown, DSO formula, Action plan
 *      - Requires: BENCHMARKS.dso.target (currently 40d)
 *
 * 2. COLLECTION EFFICIENCY INDEX (CEI) — PHASE 2+
 *    What: Collections / (Beginning AR + New Billings)
 *    Why Not Phase 1: Requires payment infrastructure (Phase 2 = payment plans)
 *    How to Add:
 *      - Get collections amount from payment_plans table
 *      - Get beginning AR from previous period snapshot
 *      - Get new billings from invoice creation timestamp
 *      - Calculate CEI = collections / (beginningAr + newBillings)
 *      - Format: `${value.toFixed(2)}x`
 *      - Color: emerald if ≥0.85x, amber otherwise
 *      - Add modal showing: Current CEI, Target CEI, Revenue breakdown
 *      - Requires: BENCHMARKS.cei.target (currently 0.85x)
 *
 * 3. WORKING CAPITAL FREED — PHASE 2+
 *    What: Cash freed up in last 30 days from recovered invoices
 *    Why Not Phase 1: Requires actual payment receipts (Phase 1 has 0 payments)
 *    How to Add:
 *      - Query: SUM(payment_amount) from payments WHERE created_at >= NOW() - 30d
 *      - Compare to previous 30d for trend (↗↘)
 *      - Calculate delta: currentPeriod - previousPeriod
 *      - Format: fmtCurrency(workingCapital.total)
 *      - Color: always emerald (positive metric)
 *      - Add modal showing: Total freed, Trend, Impact on cash position
 *      - Requires: payment_plans, payments tables with actual data
 *
 * 4. DSO REDUCTION — PHASE 3+
 *    What: Change in DSO vs previous period (dsoReductionDays)
 *    Why Not Phase 1: Requires 30+ day historical baseline (too new for Phase 1)
 *    How to Add:
 *      - Calculate currentDso (Phase 3 feature)
 *      - Query prior 30d DSO from historical snapshots
 *      - Calculate delta: currentDso - priorDso
 *      - Format: `${delta > 0 ? '+' : ''}${delta}d`
 *      - Color: emerald if >0 (improving), red if <0 (worsening), amber if =0
 *      - Add modal showing: Current vs Prior DSO, Trend analysis, Action plan
 *      - Requires: Historical DSO tracking in dashboard_snapshots table
 *
 * ════════════════════════════════════════════════════════════════
 */

import React, { useState } from 'react';
import { DashboardDetailModal } from './DashboardDetailModal';
import type { WorkingCapitalFreed, DSOReduction } from '../../types/invoice';

const fmtCurrency = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${Math.round(v / 1_000)}k` : `$${v}`;

interface KPIBannerProps {
  data?: {
    dso: number;
    collectionEfficiencyIndex: number;
    recoveryRate: number;
    overdueCount: number;
    totalInvoices: number;
    totalOwed: number;
    totalRecovered: number;
  };
  aging?: {
    buckets: Array<{ label: string; days: string; amount: number; invoiceCount: number; pctOfTotal: number }>;
    totalAr: number;
  } | null;
  emailAnalytics?: any;
  plansSummary?: any;
  workingCapital?: WorkingCapitalFreed | null;
  dsoReduction?: DSOReduction | null;
  hoursSaved?: { hoursSaved: number; emailsSent: number; /* paymentPlansOffered: number; */ period: string } | null; // 🔴 DISABLED
  loading?: boolean;
}

export const KPIBanner: React.FC<KPIBannerProps> = ({
  data,
  aging,
  emailAnalytics,
  loading = false
}) => {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  const hoursSavedValue = Math.round((emailAnalytics?.sent ?? 0) * 5 / 60);

  // PHASE 1: Only 4 meaningful metrics (Email detection + sending + recovery status)
  const metrics: Array<{
    id: string;
    label: string;
    value: number | string;
    format: (v: number | string) => string;
    description?: string;
    color: string;
  }> = [
    {
      id: 'eligible-invoices',
      label: 'Eligible Invoices',
      value: data?.totalInvoices ?? 0,
      format: (v: number | string) => `${v}`,
      description: 'Invoices in aging buckets (0-90+ days overdue)',
      color: 'text-blue-600 dark:text-blue-400',
    },
    {
      id: 'total-ar-risk',
      label: 'Total AR at Risk',
      value: data?.totalOwed ?? 0,
      format: (v: number | string) => fmtCurrency(v as number),
      description: 'Total amount across all eligible invoices',
      color: 'text-amber-600 dark:text-amber-400',
    },
    {
      id: 'recovery',
      label: 'Recovery Rate',
      value: (emailAnalytics?.sent ?? 0) > 0 ? (data?.recoveryRate ?? 0) : 'PENDING',
      format: (v: number | string) => (v === 'PENDING' ? 'Pending' : `${v}%`),
      description: (emailAnalytics?.sent ?? 0) > 0
        ? '% of invoices recovered via payments'
        : 'Waiting for emails to be sent...',
      color: (emailAnalytics?.sent ?? 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400',
    },
    {
      id: 'hours-saved',
      label: 'Hours Saved',
      value: hoursSavedValue,
      format: (v: number | string) => `${v}h`,
      description: `${emailAnalytics?.sent ?? 0} emails sent (≈5 min each)`,
      color: 'text-indigo-600 dark:text-indigo-400',
    },
  ];

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-5 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-white/[0.04] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-3 md:p-4 lg:p-5">
        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-4">Executive Summary — Phase 1</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3 lg:gap-4">
          {metrics.map((metric) => (
            <button
              key={metric.id}
              onClick={() => setSelectedMetric(metric.id)}
              className="text-left p-2 md:p-3 lg:p-4 rounded-lg bg-gray-50 dark:bg-white/[0.02] hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors border border-transparent hover:border-gray-200 dark:hover:border-white/[0.06]"
              data-tour={metric.id === 'hours-saved' ? 'hours-saved' : undefined}
            >
              <p className="text-[9px] md:text-[10px] lg:text-[11px] text-gray-600 dark:text-gray-400 uppercase tracking-wide font-medium truncate">{metric.label}</p>
              <p className={`text-base md:text-xl lg:text-2xl font-bold mt-2 ${metric.color}`}>{metric.format(metric.value)}</p>
              <p className="text-[8px] md:text-[9px] text-gray-500 dark:text-gray-500 mt-1 line-clamp-2">{metric.description}</p>
              <p className="text-[8px] md:text-[9px] text-blue-600 dark:text-blue-400 mt-1.5">Click →</p>
            </button>
          ))}
        </div>

        {/* PHASE 1: No Phase 2+ display in frontend
            Metrics to be added in future phases (see code comments below)
        */}
      </div>

      {/* Detail Modals - Phase 1 Only */}
      {selectedMetric === 'eligible-invoices' && (
        <DashboardDetailModal
          isOpen={true}
          onClose={() => setSelectedMetric(null)}
          title="Eligible Invoices"
          subtitle="Invoices ready for dunning campaigns"
        >
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-300 uppercase tracking-wide mb-3">Breakdown by Aging</p>
              {aging?.buckets && aging.buckets.length > 0 ? (
                <div className="space-y-3">
                  {aging.buckets.map((bucket, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{bucket.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{bucket.invoiceCount} invoices</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">${bucket.amount.toLocaleString()}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{bucket.pctOfTotal.toFixed(0)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">No aging data available</p>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-white/[0.02] rounded-lg p-4 border border-gray-200 dark:border-white/[0.05]">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Next Steps</p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>✅ Invoices detected and categorized by age</li>
                <li>⏳ Ready for email campaigns</li>
                <li>⏳ Track engagement in Recovery Funnel below</li>
              </ul>
            </div>
          </div>
        </DashboardDetailModal>
      )}

      {selectedMetric === 'total-ar-risk' && (
        <DashboardDetailModal
          isOpen={true}
          onClose={() => setSelectedMetric(null)}
          title="Total AR at Risk"
          subtitle="Combined value across all eligible invoices"
        >
          <div className="space-y-6">
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-5 border border-amber-200 dark:border-amber-800">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-300 uppercase tracking-wide mb-2">Total at Risk</p>
              <p className="text-4xl font-bold text-amber-900 dark:text-amber-100">${(data?.totalOwed ?? 0).toLocaleString()}</p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-3">
                Across {data?.totalInvoices ?? 0} invoices in your aging buckets
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-white/[0.02] rounded-lg p-4 border border-gray-200 dark:border-white/[0.05]">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">💡 Strategy</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Higher amounts in older buckets (90+d) should be priority. Focus dunning efforts on those first.
              </p>
            </div>
          </div>
        </DashboardDetailModal>
      )}

      {selectedMetric === 'recovery' && (
        <DashboardDetailModal
          isOpen={true}
          onClose={() => setSelectedMetric(null)}
          title="Recovery Rate"
          subtitle="Phase 1: Monitoring stage"
        >
          <div className="space-y-6">
            {(emailAnalytics?.sent ?? 0) > 0 ? (
              <>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-5 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-300 uppercase tracking-wide mb-2">Current Recovery</p>
                  <p className="text-4xl font-bold text-emerald-900 dark:text-emerald-100">{data?.recoveryRate ?? 0}%</p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-2">
                    ${data?.totalRecovered ?? 0} recovered from ${data?.totalOwed ?? 0} at risk
                  </p>
                </div>
              </>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-900/20 rounded-xl p-5 border border-gray-200 dark:border-gray-800">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">Status: PENDING</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">No emails sent yet</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Recovery rate will start updating once dunning emails are sent and payments are received.
                </p>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">📊 How it Works</p>
              <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                <li>1. Eligible invoices are detected automatically</li>
                <li>2. Dunning emails are queued and sent</li>
                <li>3. Payments are tracked in real-time</li>
                <li>4. Recovery rate updates as money comes in</li>
              </ol>
            </div>
          </div>
        </DashboardDetailModal>
      )}

      {selectedMetric === 'hours-saved' && (
        <DashboardDetailModal
          isOpen={true}
          onClose={() => setSelectedMetric(null)}
          title="Hours Saved"
          subtitle="Automation value from email campaigns"
        >
          <div className="space-y-6">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-5 border border-indigo-200 dark:border-indigo-800">
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 uppercase tracking-wide mb-2">Hours Saved</p>
              <p className="text-4xl font-bold text-indigo-900 dark:text-indigo-100">{hoursSavedValue}h</p>
              <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-2">
                Calculation: {emailAnalytics?.sent ?? 0} emails × 5 min per email = {hoursSavedValue} hours
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-white/[0.02] rounded-lg p-4 border border-gray-200 dark:border-white/[0.05]">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">What This Means</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Instead of manually writing and sending dunning emails (5 minutes each), RecoverAI handles it automatically.
                {hoursSavedValue > 0 && ` You've saved ${hoursSavedValue} hours of manual work.`}
              </p>
            </div>

            {/* ❌ DISABLED: PHASE 2 feature
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">📝 PHASE 2+ Addition</p>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                When payment plans are enabled (Phase 2), we'll add 30 min per plan offer to this calculation.
              </p>
            </div>
            */}
          </div>
        </DashboardDetailModal>
      )}
    </>
  );
};

export default KPIBanner;