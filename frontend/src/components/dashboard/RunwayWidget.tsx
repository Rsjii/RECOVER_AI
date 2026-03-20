import React from 'react';
import { Card } from '../ui/Card';

export interface RunwayData {
  currentBalance: number;
  monthlyBurnRate: number;
  runwayDays: number;
  runwayStatus: 'critical' | 'warning' | 'healthy';
  avgMonthlyCreated: number;
  avgMonthlyRecovered: number;
  asOfDate: string;
}

interface RunwayWidgetProps {
  runway: RunwayData | null;
  loading: boolean;
}

const fmt = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toLocaleString()}`;

export const RunwayWidget: React.FC<RunwayWidgetProps> = ({ runway, loading }) => {
  if (loading) {
    return (
      <Card className="animate-pulse">
        <div className="h-32 bg-gray-200 dark:bg-white/[0.03] rounded" />
      </Card>
    );
  }

  if (!runway) return null;

  const statusColors = {
    critical: { bg: 'bg-red-500/10 dark:bg-red-500/20', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/20 dark:border-red-500/30', label: 'Critical' },
    warning: { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20 dark:border-amber-500/30', label: 'Caution' },
    healthy: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20 dark:border-emerald-500/30', label: 'Healthy' },
  };

  const s = statusColors[runway.runwayStatus];
  const displayDays = runway.runwayDays > 9000 ? '∞' : runway.runwayDays.toString();

  // Burn rate bar proportions
  const total = Math.max(runway.avgMonthlyCreated, runway.avgMonthlyRecovered, 1);
  const recoveredPct = Math.round((runway.avgMonthlyRecovered / total) * 100);
  const burnPct = 100 - recoveredPct;

  return (
    <Card className={`relative overflow-hidden border ${s.border}`}>
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        {/* Runway number */}
        <div className={`flex-shrink-0 flex items-center gap-4 ${s.bg} rounded-xl px-6 py-4`}>
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">Cash Runway</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-5xl font-bold tabular-nums ${s.text}`}>{displayDays}</span>
              <span className={`text-lg ${s.text}`}>days</span>
            </div>
            <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
              {s.label}
            </span>
          </div>
        </div>

        {/* Burn rate breakdown */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Monthly Cash Flow (6-month avg)</p>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Invoices Created</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{fmt(runway.avgMonthlyCreated)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Cash Recovered</p>
              <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{fmt(runway.avgMonthlyRecovered)}</p>
            </div>
          </div>
          {/* Visual bar */}
          <div className="w-full h-3 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden flex">
            <div className="bg-emerald-500 h-full rounded-l-full transition-all" style={{ width: `${recoveredPct}%` }} />
            <div className="bg-red-400 dark:bg-red-500/60 h-full rounded-r-full transition-all" style={{ width: `${burnPct}%` }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-emerald-600 dark:text-emerald-400">Recovered {recoveredPct}%</span>
            <span className="text-xs text-red-500 dark:text-red-400">Unrecovered {burnPct}%</span>
          </div>
        </div>

        {/* Current balance */}
        <div className="flex-shrink-0 text-right hidden lg:block">
          <p className="text-xs text-gray-500 dark:text-gray-400">Current Balance</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">${runway.currentBalance.toLocaleString()}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Burn: {fmt(runway.monthlyBurnRate)}/mo
          </p>
        </div>
      </div>
    </Card>
  );
};
