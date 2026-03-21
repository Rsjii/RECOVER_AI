import React, { useState } from 'react';
import { BENCHMARKS } from '../../constants/benchmarks';
import { DashboardDetailModal } from './DashboardDetailModal';

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
  loading?: boolean;
}

export const KPIBanner: React.FC<KPIBannerProps> = ({ data, aging, loading = false }) => {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  const metrics = [
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
  ];

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-5 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-4">Executive Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 lg:gap-4">
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
          title="Days Sales Outstanding Breakdown"
          subtitle="What's making up your {data?.dso ?? 0}d collection time"
        >
          <div className="space-y-6">
            {/* Current DSO with Target */}
            <div>
              <div className="flex items-baseline gap-4 mb-4">
                <div className="text-5xl font-bold text-gray-900 dark:text-white">{data?.dso ?? 0}d</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  vs Target: <span className="font-bold">{BENCHMARKS.dso.target}d</span>
                </div>
              </div>
              <div className="h-3 bg-gray-200 dark:bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all ${data && data.dso <= BENCHMARKS.dso.target ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min((data?.dso ?? 0) / 60, 1) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {data && data.dso <= BENCHMARKS.dso.target ? '✅ On target' : `⚠️ ${data?.dso! - BENCHMARKS.dso.target}d above target`}
              </p>
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
          subtitle="Revenue recovered vs. outstanding balance"
        >
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Current CEI</p>
              <div className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
                {(data?.collectionEfficiencyIndex ?? 0).toFixed(2)}x
              </div>
              <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className={`h-4 rounded-full transition-all ${data && data.collectionEfficiencyIndex >= BENCHMARKS.cei.target ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min((data?.collectionEfficiencyIndex ?? 0) / 2, 1) * 100}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {data && data.collectionEfficiencyIndex >= BENCHMARKS.cei.target ? '✅ On target' : `⚠️ Target: ${BENCHMARKS.cei.target}x`}
              </p>
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
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Current Recovery Rate</p>
              <div className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
                {data?.recoveryRate ?? 0}%
              </div>
              <div className="h-4 bg-gray-200 dark:bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className={`h-4 rounded-full transition-all ${data && data.recoveryRate >= BENCHMARKS.recoveryRate.target ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${data?.recoveryRate ?? 0}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Target: {BENCHMARKS.recoveryRate.target}%</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
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

      {selectedMetric === 'overdue' && (
        <DashboardDetailModal
          isOpen={true}
          onClose={() => setSelectedMetric(null)}
          title="Overdue Invoices"
          subtitle="Invoices requiring immediate action"
        >
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Total Overdue</p>
              <div className="text-5xl font-bold text-rose-600 mb-4">
                {data?.overdueCount ?? 0}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Out of {data?.totalInvoices ?? 0} total invoices ({data && data.totalInvoices > 0 ? (((data.overdueCount / data.totalInvoices) * 100).toFixed(1)) : 0}%)
              </p>
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
