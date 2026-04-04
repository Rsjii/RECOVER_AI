import React, { useState } from 'react';
import { BENCHMARKS } from '../../constants/benchmarks';
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
  hoursSaved?: { hoursSaved: number; emailsSent: number; paymentPlansOffered: number; period: string } | null;
  loading?: boolean;
}

export const KPIBanner: React.FC<KPIBannerProps> = ({ data, aging, workingCapital, dsoReduction, hoursSaved, loading = false }) => {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  const dsoReductionDays = dsoReduction?.reductionDays ?? 0;
  const wcTotal = workingCapital?.total ?? 0;
  const wcPrev = workingCapital?.previousTotal;
  const wcDelta = wcPrev != null ? wcTotal - wcPrev : null;
  const hoursSavedValue = hoursSaved?.hoursSaved ?? 0;

  const metrics: Array<{
    id: string; label: string; value: number;
    format: (v: number) => string;
    benchmark?: number | string;
    description?: string;
    subtext?: string;
    color: string;
  }> = [
    {
      id: 'dso',
      label: 'Days Sales Outstanding',
      value: data?.dso ?? 0,
      format: (v: number) => `${v}d`,
      benchmark: BENCHMARKS.dso.target,
      description: 'Lower is better. Target: <30 days',
      color: data && data.dso <= BENCHMARKS.dso.target ? 'text-emerald-500' : 'text-amber-500',
    },
    {
      id: 'cei',
      label: 'Collection Efficiency',
      value: data?.collectionEfficiencyIndex ?? 0,
      format: (v: number) => `${v.toFixed(1)}x`,
      benchmark: BENCHMARKS.cei.target,
      description: 'Revenue recovered per dollar outstanding. Higher is better',
      color: data && data.collectionEfficiencyIndex >= BENCHMARKS.cei.target ? 'text-emerald-500' : 'text-amber-500',
    },
    {
      id: 'recovery',
      label: 'Recovery Rate',
      value: data?.recoveryRate ?? 0,
      format: (v: number) => `${v}%`,
      benchmark: BENCHMARKS.recoveryRate.target,
      description: `% of invoices recovered. Target: ${BENCHMARKS.recoveryRate.target}%`,
      color: data && data.recoveryRate >= BENCHMARKS.recoveryRate.target ? 'text-emerald-500' : 'text-amber-500',
    },
    {
      id: 'overdue',
      label: 'Overdue Invoices',
      value: data?.overdueCount ?? 0,
      format: (v: number) => `${v}`,
      description: `${data?.totalInvoices ?? 0} total invoices`,
      color: 'text-gray-900 dark:text-white',
    },
    {
      id: 'working-capital',
      label: 'Working Capital Freed',
      value: workingCapital?.total ?? 0,
      format: fmtCurrency,
      description: 'Last 30 days',
      subtext: wcDelta != null
        ? `vs ${fmtCurrency(wcPrev!)} last period ${wcDelta > 0 ? '↗' : '↘'}`
        : undefined,
      color: 'text-emerald-500',
    },
    {
      id: 'dso-reduction',
      label: 'DSO Reduction',
      value: dsoReductionDays,
      format: (v: number) => `${v > 0 ? '+' : ''}${v}d`,
      description: dsoReduction?.trend ?? 'vs. prior 30d',
      color: dsoReductionDays > 0 ? 'text-emerald-500' : dsoReductionDays < 0 ? 'text-rose-500' : 'text-amber-500',
    },
    {
      id: 'hours-saved',
      label: 'Hours Saved',
      value: hoursSavedValue,
      format: (v: number) => `${v}h`,
      description: `${hoursSaved?.emailsSent ?? 0} emails, ${hoursSaved?.paymentPlansOffered ?? 0} plans`,
      color: 'text-indigo-500',
    },
  ];

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-5 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-white/[0.04] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-3 md:p-4 lg:p-5">
        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-4">Executive Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-2 md:gap-3 lg:gap-4">
          {metrics.map((metric) => (
            <button
              key={metric.id}
              onClick={() => setSelectedMetric(metric.id)}
              className="text-left p-2 md:p-3 lg:p-4 rounded-lg bg-gray-50 dark:bg-white/[0.02] hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors border border-transparent hover:border-gray-200 dark:hover:border-white/[0.06]"
            >
              <p className="text-[9px] md:text-[10px] lg:text-[11px] text-gray-600 dark:text-gray-400 uppercase tracking-wide font-medium truncate">{metric.label}</p>
              <p className={`text-base md:text-xl lg:text-2xl font-bold mt-2 ${metric.color}`}>{metric.format(metric.value)}</p>
              {metric.benchmark && (
                <p className="text-[8px] md:text-[9px] lg:text-[10px] text-gray-500 dark:text-gray-500 mt-1 truncate">Target: {metric.benchmark}</p>
              )}
              {metric.subtext && (
                <p className="text-[8px] md:text-[9px] text-gray-400 dark:text-gray-500 mt-1 truncate">{metric.subtext}</p>
              )}
              <p className="text-[8px] md:text-[9px] text-blue-600 dark:text-blue-400 mt-1.5">Click →</p>
            </button>
          ))}
        </div>
      </div>

      {/* Detail Modals */}
      {selectedMetric === 'dso' && (
        <DashboardDetailModal
          isOpen={true}
          onClose={() => setSelectedMetric(null)}
          title="Days Sales Outstanding"
          subtitle="Collection efficiency metric"
        >
          <div className="space-y-8">
            {/* Current DSO with Target */}
            <div className="bg-gray-50 dark:bg-white/[0.02] rounded-xl p-5 border border-gray-200 dark:border-white/[0.06]">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">Current DSO</p>
              <div className="flex items-baseline justify-between mb-4">
                <div className="text-5xl font-bold text-gray-900 dark:text-white">{data?.dso ?? 0}d</div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Target</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{BENCHMARKS.dso.target}d</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-2 bg-gray-300 dark:bg-white/[0.08] rounded-full overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${data && data.dso <= BENCHMARKS.dso.target ? 'bg-emerald-500' : data && data.dso <= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.min((data?.dso ?? 0) / 60, 1) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
                  {data && data.dso <= BENCHMARKS.dso.target ? '✅ On target' : `⚠️ ${data?.dso! - BENCHMARKS.dso.target}d above target`}
                </p>
              </div>
            </div>

            {/* Breakdown by Aging Bucket - What's causing the DSO */}
            {aging?.buckets && aging.buckets.length > 0 && (
              <div className="bg-gray-50 dark:bg-white/[0.02] rounded-lg p-4 border border-gray-200 dark:border-white/[0.05]">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">What's Making Up Your {data?.dso}d DSO</h3>
                <div className="space-y-3">
                  {aging.buckets.map((bucket: any, idx: number) => (
                    <div key={idx} className="border-b border-gray-200 dark:border-white/[0.05] pb-3 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{bucket.label}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{bucket.invoiceCount} invoices</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900 dark:text-white">${bucket.amount.toLocaleString()}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{bucket.pctOfTotal.toFixed(1)}% of AR</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-white/[0.06] rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            bucket.days === '0-30' ? 'bg-emerald-500' :
                            bucket.days === '31-60' ? 'bg-yellow-500' :
                            bucket.days === '61-90' ? 'bg-orange-500' :
                            'bg-rose-500'
                          }`}
                          style={{ width: `${bucket.pctOfTotal}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* How DSO is Calculated */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">📊 How DSO is Calculated</p>
              <p className="text-sm text-blue-800 dark:text-blue-300 mt-2 font-mono bg-white dark:bg-white/[0.02] p-2 rounded">
                (Total Days × Invoices Outstanding) ÷ Number of Invoices = {data?.dso}d
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-300 mt-2">
                Your {aging?.buckets.find((b: any) => b.pctOfTotal > 30)?.label || 'aging bucket'} has the most impact on DSO. Focus recovery efforts there first.
              </p>
            </div>

            {/* Action Items */}
            <div className={`rounded-lg p-4 border ${
              data!.dso <= BENCHMARKS.dso.target
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            }`}>
              <p className={`text-sm font-medium ${
                data!.dso <= BENCHMARKS.dso.target
                  ? 'text-emerald-900 dark:text-emerald-200'
                  : 'text-amber-900 dark:text-amber-200'
              }`}>
                🎯 Action Plan
              </p>
              <ul className={`text-sm mt-2 space-y-1 ${
                data!.dso <= BENCHMARKS.dso.target
                  ? 'text-emerald-800 dark:text-emerald-300'
                  : 'text-amber-800 dark:text-amber-300'
              }`}>
                <li>• Focus on invoices <strong>{aging?.buckets[aging.buckets.length - 1]?.label}</strong> first</li>
                <li>• Use payment plans for invoices 60+ days overdue</li>
                <li>• Send dunning emails on day 30 and day 60</li>
              </ul>
            </div>
          </div>
        </DashboardDetailModal>
      )}

      {selectedMetric === 'cei' && (
        <DashboardDetailModal
          isOpen={true}
          onClose={() => setSelectedMetric(null)}
          title="Collection Efficiency Index"
          subtitle="Revenue recovered per dollar outstanding"
        >
          <div className="space-y-8">
            <div className="bg-gray-50 dark:bg-white/[0.02] rounded-xl p-5 border border-gray-200 dark:border-white/[0.06]">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">Current CEI</p>
              <div className="flex items-baseline justify-between mb-4">
                <div className="text-5xl font-bold text-gray-900 dark:text-white">
                  {(data?.collectionEfficiencyIndex ?? 0).toFixed(2)}x
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Target</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{BENCHMARKS.cei.target}x</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-2 bg-gray-300 dark:bg-white/[0.08] rounded-full overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${data && data.collectionEfficiencyIndex >= BENCHMARKS.cei.target ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min((data?.collectionEfficiencyIndex ?? 0) / 2, 1) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
                  {data && data.collectionEfficiencyIndex >= BENCHMARKS.cei.target ? '✅ On target' : `⚠️ Target: ${BENCHMARKS.cei.target}x`}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-1 uppercase tracking-wide">Revenue Recovered</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">${(data?.totalRecovered ?? 0).toLocaleString()}</p>
              </div>
              <div className="flex-1">
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium mb-1 uppercase tracking-wide">Outstanding Balance</p>
                <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">${(data?.totalOwed ?? 0).toLocaleString()}</p>
              </div>
            </div>

            {data && (
              <div className="bg-gray-50 dark:bg-white/[0.02] rounded-lg p-4 border border-gray-200 dark:border-white/[0.05]">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">📊 How CEI is Calculated</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-mono bg-white dark:bg-white/[0.02] p-2 rounded mb-3">
                  ${data.totalRecovered.toLocaleString()} ÷ ${data.totalOwed.toLocaleString()} = {(data.collectionEfficiencyIndex).toFixed(2)}x
                </p>
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <p><strong>What this means:</strong></p>
                  {data.collectionEfficiencyIndex >= 1.5 && <p>✅ You're recovering 1.5x+ the amount still outstanding — excellent collection performance</p>}
                  {data.collectionEfficiencyIndex >= 1.0 && data.collectionEfficiencyIndex < 1.5 && <p>✅ You've recovered as much or more than currently outstanding — good momentum</p>}
                  {data.collectionEfficiencyIndex < 1.0 && <p>⚠️ More is still outstanding than recovered — focus on accelerating recovery</p>}
                </div>
              </div>
            )}

            {/* Outstanding by Aging Bucket */}
            {aging?.buckets && aging.buckets.length > 0 && (
              <div className="bg-gray-50 dark:bg-white/[0.02] rounded-lg p-4 border border-gray-200 dark:border-white/[0.05]">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">What's Left to Recover</h4>
                <div className="space-y-2 text-xs">
                  {aging.buckets.filter((b: any) => b.pctOfTotal > 0).map((bucket: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{bucket.label}</span>
                      <span className="font-medium text-gray-900 dark:text-white">${bucket.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">💡 How to Improve CEI</p>
              <ul className="text-sm text-blue-800 dark:text-blue-300 mt-2 space-y-1">
                <li>• Accelerate dunning emails for 30-60 day invoices</li>
                <li>• Offer payment plans for 60+ day invoices</li>
                <li>• Target oldest invoices first (highest recovery ROI)</li>
              </ul>
            </div>
          </div>
        </DashboardDetailModal>
      )}

      {selectedMetric === 'recovery' && (
        <DashboardDetailModal
          isOpen={true}
          onClose={() => setSelectedMetric(null)}
          title="Recovery Rate"
          subtitle="Percentage of invoices successfully recovered"
        >
          <div className="space-y-8">
            <div className="bg-gray-50 dark:bg-white/[0.02] rounded-xl p-5 border border-gray-200 dark:border-white/[0.06]">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">Recovery Rate</p>
              <div className="flex items-baseline justify-between mb-4">
                <div className="text-5xl font-bold text-gray-900 dark:text-white">
                  {data?.recoveryRate ?? 0}%
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Target</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{BENCHMARKS.recoveryRate.target}%</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-2 bg-gray-300 dark:bg-white/[0.08] rounded-full overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${data && data.recoveryRate >= BENCHMARKS.recoveryRate.target ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${data?.recoveryRate ?? 0}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
                  {data && data.recoveryRate >= BENCHMARKS.recoveryRate.target ? '✅ On target' : `⚠️ ${BENCHMARKS.recoveryRate.target - (data?.recoveryRate ?? 0)}% away from target`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Recovered</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{data?.recoveryRate ?? 0}%</p>
              </div>
              <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-4 border border-rose-200 dark:border-rose-800">
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">Outstanding</p>
                <p className="text-2xl font-bold text-rose-700 dark:text-rose-300 mt-1">{100 - (data?.recoveryRate ?? 0)}%</p>
              </div>
            </div>

            {/* Breakdown by Aging Bucket */}
            {aging?.buckets && aging.buckets.length > 0 && (
              <div className="bg-gray-50 dark:bg-white/[0.02] rounded-lg p-4 border border-gray-200 dark:border-white/[0.05]">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Outstanding Invoices by Aging</h3>
                <div className="space-y-3">
                  {aging.buckets.map((bucket: any, idx: number) => (
                    <div key={idx} className="border-b border-gray-200 dark:border-white/[0.05] pb-3 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{bucket.label}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{bucket.invoiceCount} invoices</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900 dark:text-white">${bucket.amount.toLocaleString()}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{bucket.pctOfTotal.toFixed(1)}% of AR</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-white/[0.06] rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            bucket.days === '0-30' ? 'bg-emerald-500' :
                            bucket.days === '31-60' ? 'bg-yellow-500' :
                            bucket.days === '61-90' ? 'bg-orange-500' :
                            'bg-rose-500'
                          }`}
                          style={{ width: `${bucket.pctOfTotal}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">📊 What does this mean?</p>
              <p className="text-sm text-blue-800 dark:text-blue-300 mt-2">
                Recovery rate shows what percentage of your invoices have been successfully paid. The target is {BENCHMARKS.recoveryRate.target}%. Focus on the oldest aging buckets (90+ days) first as they represent the highest risk.
              </p>
            </div>
          </div>
        </DashboardDetailModal>
      )}

      {selectedMetric === 'working-capital' && (
        <DashboardDetailModal
          isOpen={true}
          onClose={() => setSelectedMetric(null)}
          title="Working Capital Freed"
          subtitle="Financial value unlocked in last 30 days"
        >
          <div className="space-y-8">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-5 border border-emerald-200 dark:border-emerald-800">
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-3">Total Freed</p>
              <div className="text-5xl font-bold text-emerald-700 dark:text-emerald-300">
                {fmtCurrency(workingCapital?.total ?? 0)}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wide">AR Recovered</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                  {fmtCurrency(workingCapital?.recoveredAR ?? 0)}
                </p>
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">Invoices paid via dunning agent</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wide">Billing Errors Confirmed</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                  {fmtCurrency(workingCapital?.billingErrorsConfirmed ?? 0)}
                </p>
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">Anomalies you confirmed as real</p>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-white/[0.02] rounded-lg p-4 border border-gray-200 dark:border-white/[0.05]">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">📊 How This is Calculated</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-mono bg-white dark:bg-white/[0.02] p-2 rounded">
                AR Recovered + Billing Errors Confirmed = Working Capital Freed
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                {fmtCurrency(workingCapital?.recoveredAR ?? 0)} + {fmtCurrency(workingCapital?.billingErrorsConfirmed ?? 0)} = {fmtCurrency(workingCapital?.total ?? 0)}
              </p>
            </div>
          </div>
        </DashboardDetailModal>
      )}

      {selectedMetric === 'dso-reduction' && (
        <DashboardDetailModal
          isOpen={true}
          onClose={() => setSelectedMetric(null)}
          title="DSO Reduction"
          subtitle="Collection speed change vs 30 days ago"
        >
          <div className="space-y-8">
            <div className={`rounded-xl p-5 border ${
              dsoReductionDays > 0
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                : dsoReductionDays < 0
                ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            }`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${
                dsoReductionDays > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : dsoReductionDays < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}>Collection Speed Change</p>
              <div className={`text-5xl font-bold ${
                dsoReductionDays > 0
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : dsoReductionDays < 0
                  ? 'text-rose-700 dark:text-rose-300'
                  : 'text-amber-700 dark:text-amber-300'
              }`}>
                {dsoReductionDays > 0 ? '+' : ''}{dsoReductionDays}d
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-white/[0.02] rounded-lg p-4 border border-gray-200 dark:border-white/[0.05]">
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium uppercase tracking-wide">Current DSO</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{dsoReduction?.currentDSO ?? 0}d</p>
              </div>
              <div className="bg-gray-50 dark:bg-white/[0.02] rounded-lg p-4 border border-gray-200 dark:border-white/[0.05]">
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium uppercase tracking-wide">Historical DSO</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{dsoReduction?.historicalDSO ?? 0}d</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">30–60 days ago</p>
              </div>
            </div>
            <div className={`rounded-lg p-4 border ${dsoReductionDays > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'}`}>
              <p className={`text-sm font-medium ${dsoReductionDays > 0 ? 'text-emerald-900 dark:text-emerald-200' : 'text-amber-900 dark:text-amber-200'}`}>
                {dsoReductionDays > 0 ? '✅ Improving — you\'re collecting faster' : dsoReductionDays < 0 ? '⚠️ DSO is increasing — review dunning cadence' : '➡️ Stable — no significant change'}
              </p>
              {dsoReductionDays > 0 && (
                <p className={`text-sm mt-2 text-emerald-800 dark:text-emerald-300`}>
                  Collecting {dsoReductionDays} days faster reduces cash cycle and improves runway.
                </p>
              )}
            </div>
          </div>
        </DashboardDetailModal>
      )}

      {selectedMetric === 'overdue' && (
        <DashboardDetailModal
          isOpen={true}
          onClose={() => setSelectedMetric(null)}
          title="Overdue Invoices"
          subtitle="Invoices requiring immediate action"
        >
          <div className="space-y-8">
            <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-5 border border-rose-200 dark:border-rose-800">
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide mb-3">Total Overdue</p>
              <div className="flex items-baseline justify-between">
                <div className="text-5xl font-bold text-rose-700 dark:text-rose-300">
                  {data?.overdueCount ?? 0}
                </div>
                <div className="text-right">
                  <p className="text-xs text-rose-600/70 dark:text-rose-400/70 mb-1">of {data?.totalInvoices ?? 0}</p>
                  <p className="text-xl font-bold text-rose-600 dark:text-rose-400">
                    {data && data.totalInvoices > 0 ? (((data.overdueCount / data.totalInvoices) * 100).toFixed(0)) : 0}%
                  </p>
                </div>
              </div>
            </div>

            {/* Breakdown by Aging Bucket - Show which ones are overdue */}
            {aging?.buckets && aging.buckets.length > 0 && (
              <div className="bg-gray-50 dark:bg-white/[0.02] rounded-lg p-4 border border-gray-200 dark:border-white/[0.05]">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Overdue Invoices by Age</h3>
                <div className="space-y-3">
                  {aging.buckets.map((bucket: any, idx: number) => {
                    const isOverdue = bucket.days !== '0-30';
                    return (
                      <div key={idx} className={`border-b border-gray-200 dark:border-white/[0.05] pb-3 last:border-0 ${isOverdue ? 'bg-rose-50 dark:bg-rose-950/20 p-2 rounded' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{bucket.label} {isOverdue && '⚠️'}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{bucket.invoiceCount} invoices</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-900 dark:text-white">${bucket.amount.toLocaleString()}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">{bucket.pctOfTotal.toFixed(1)}% of AR</p>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-white/[0.06] rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              bucket.days === '0-30' ? 'bg-emerald-500' :
                              bucket.days === '31-60' ? 'bg-yellow-500' :
                              bucket.days === '61-90' ? 'bg-orange-500' :
                              'bg-rose-500'
                            }`}
                            style={{ width: `${bucket.pctOfTotal}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-4 border border-rose-200 dark:border-rose-800">
              <p className="text-sm font-semibold text-rose-900 dark:text-rose-200">⚠️ Action Required</p>
              <p className="text-sm text-rose-800 dark:text-rose-300 mt-2">
                You have {data?.overdueCount ?? 0} overdue invoice{(data?.overdueCount ?? 0) !== 1 ? 's' : ''} requiring immediate action. Use dunning emails and payment plans to recover these.
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-white/[0.02] rounded-lg p-4 border border-gray-200 dark:border-white/[0.05]">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">🎯 Recovery Priority</h4>
              <ol className="text-sm space-y-2 text-gray-600 dark:text-gray-400">
                <li><strong>1. 90+ days overdue:</strong> Send formal notice + offer payment plan</li>
                <li><strong>2. 60-90 days:</strong> Escalation email + payment plan offer</li>
                <li><strong>3. 30-60 days:</strong> Reminder email + gentle dunning</li>
                <li><strong>4. 0-30 days:</strong> Soft reminder email</li>
              </ol>
            </div>
          </div>
        </DashboardDetailModal>
      )}
    </>
  );
};

export default KPIBanner;
