import React from 'react';
import { Card } from '../ui/Card';

interface LeakageSource {
  category: 'failed_payments' | 'payment_delays' | 'customer_churn';
  label: string;
  amountUsd: number;
  percentage: number;
  detail: string;
}

export interface CashLeakageData {
  totalLeakageUsd: number;
  sources: LeakageSource[];
  period: string;
  asOfDate: string;
}

interface CashLeakageWidgetProps {
  leakage: CashLeakageData | null;
  loading: boolean;
}

const categoryColors: Record<string, { bar: string; icon: string }> = {
  failed_payments: { bar: 'bg-red-500', icon: '💳' },
  payment_delays: { bar: 'bg-amber-500', icon: '⏱️' },
  customer_churn: { bar: 'bg-purple-500', icon: '📉' },
};

const fmtUsd = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toLocaleString()}`;

export const CashLeakageWidget: React.FC<CashLeakageWidgetProps> = ({ leakage, loading }) => {
  if (loading) {
    return (
      <Card className="animate-pulse">
        <div className="h-40 bg-gray-200 dark:bg-white/[0.03] rounded" />
      </Card>
    );
  }

  if (!leakage) return null;

  const hasLeakage = leakage.totalLeakageUsd > 0;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Cash Leakage Analysis</h3>
        <span className="text-xs text-gray-400 dark:text-gray-500">{leakage.period}</span>
      </div>

      {!hasLeakage ? (
        <div className="text-center py-6">
          <p className="text-emerald-600 dark:text-emerald-400 font-medium text-sm">No significant cash leakage detected</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">All payments flowing as expected</p>
        </div>
      ) : (
        <>
          {/* Total leakage header */}
          <div className="mb-4 bg-red-50 dark:bg-red-500/10 rounded-lg px-4 py-3">
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">Total Leakage</p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">{fmtUsd(leakage.totalLeakageUsd)}</p>
          </div>

          {/* Stacked bar */}
          <div className="w-full h-4 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden flex mb-4">
            {leakage.sources
              .filter((s) => s.percentage > 0)
              .map((source, i) => (
                <div
                  key={source.category}
                  className={`${categoryColors[source.category]?.bar || 'bg-gray-400'} h-full transition-all ${i === 0 ? 'rounded-l-full' : ''}`}
                  style={{ width: `${source.percentage}%` }}
                />
              ))}
          </div>

          {/* Source breakdown */}
          <div className="space-y-3">
            {leakage.sources.map((source) => (
              <div key={source.category} className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">{categoryColors[source.category]?.icon || '📊'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{source.label}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{fmtUsd(source.amountUsd)}</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{source.detail}</p>
                </div>
                <span className="text-xs font-medium text-gray-400 dark:text-gray-500 flex-shrink-0">{source.percentage}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
};
