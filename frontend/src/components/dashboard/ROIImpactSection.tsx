import React from 'react';
import type { WorkingCapitalFreed, DSOReduction } from '../../types/invoice';

interface ROIImpactSectionProps {
  dsoReduction?: DSOReduction | null;
  workingCapital?: WorkingCapitalFreed | null;
  hoursSaved?: { hoursSaved: number; emailsSent: number; /* paymentPlansOffered: number; */ period: string } | null; // 🔴 DISABLED
  recoveryRate?: number;
  totalRecovered?: number;
  loading?: boolean;
}

// function TrendArrow({ trend }: { trend: 'improving' | 'stable' | 'worsening' | 'up' | 'down' | 'neutral' }) {
//   if (trend === 'improving' || trend === 'up') {
//     return <span className="text-emerald-500 dark:text-emerald-400 text-xs font-bold">↑</span>;
//   }
//   if (trend === 'worsening' || trend === 'down') {
//     return <span className="text-red-500 dark:text-red-400 text-xs font-bold">↓</span>;
//   }
//   return <span className="text-gray-400 text-xs font-bold">→</span>;
// }

export const ROIImpactSection: React.FC<ROIImpactSectionProps> = ({
  dsoReduction,
  workingCapital,
  hoursSaved,
  recoveryRate,
  totalRecovered,
  loading = false,
}) => {
  const hasDSO = dsoReduction && (dsoReduction.currentDSO > 0 || dsoReduction.historicalDSO > 0);
  const hasRecovered = (workingCapital?.recoveredAR ?? 0) > 0 || (totalRecovered ?? 0) > 0;
  const recoveredAmount = workingCapital?.recoveredAR ?? totalRecovered ?? 0;
  const hasSaved = (hoursSaved?.hoursSaved ?? 0) > 0 || (hoursSaved?.emailsSent ?? 0) > 0;
  const emailCount = hoursSaved?.emailsSent ?? 0;
  const savedHours = hoursSaved?.hoursSaved ?? 0;

  const fmtCurrency = (v: number) =>
    v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000 ? `$${Math.round(v / 1_000)}k`
    : `$${Math.round(v)}`;

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4 animate-pulse">
            <div className="h-3 bg-gray-100 dark:bg-white/[0.05] rounded w-20 mb-3" />
            <div className="h-7 bg-gray-100 dark:bg-white/[0.05] rounded w-16 mb-2" />
            <div className="h-3 bg-gray-100 dark:bg-white/[0.05] rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    // Card 1: DSO
    {
      label: 'Days Sales Outstanding',
      value: hasDSO ? `${dsoReduction!.currentDSO}d` : '—',
      subValue: hasDSO && dsoReduction!.historicalDSO > 0
        ? `was ${dsoReduction!.historicalDSO}d`
        : 'Agent calculating baseline',
      badge: hasDSO && dsoReduction!.reductionDays !== 0
        ? {
            text: dsoReduction!.reductionDays > 0
              ? `↓${dsoReduction!.reductionDays}d faster`
              : `↑${Math.abs(dsoReduction!.reductionDays)}d slower`,
            color: dsoReduction!.reductionDays > 0
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
          }
        : null,
      valueColor: 'text-blue-600 dark:text-blue-400',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    // Card 2: Recovered
    {
      label: 'Recovered This Month',
      value: hasRecovered ? fmtCurrency(recoveredAmount) : '$0',
      subValue: hasRecovered
        ? `${(workingCapital?.period ?? hoursSaved?.period ?? 'this period')}`
        : 'Agent monitoring invoices',
      badge: hasRecovered && workingCapital?.previousTotal !== undefined && workingCapital.previousTotal > 0
        ? {
            text: recoveredAmount >= workingCapital.previousTotal
              ? `+${Math.round(((recoveredAmount - workingCapital.previousTotal) / workingCapital.previousTotal) * 100)}% vs last`
              : `-${Math.round(((workingCapital.previousTotal - recoveredAmount) / workingCapital.previousTotal) * 100)}% vs last`,
            color: recoveredAmount >= workingCapital.previousTotal
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
          }
        : null,
      valueColor: hasRecovered ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-600',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .672-3 1.5S10.343 11 12 11s3-.672 3-1.5S13.657 8 12 8zM12 14c-1.657 0-3 .672-3 1.5S10.343 17 12 17s3-.672 3-1.5S13.657 14 12 14z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a10 10 0 100 20A10 10 0 0012 2z" />
        </svg>
      ),
    },
    // Card 3: Hours Saved
    {
      label: 'Hours Saved',
      value: hasSaved ? `${savedHours}h` : emailCount > 0 ? `${emailCount} tasks` : '—',
      subValue: hasSaved
        ? `${emailCount} emails automated`
        : emailCount > 0
          ? 'Agent automating outreach'
          : 'Agent ready to automate',
      badge: emailCount > 0
        ? {
            text: `${emailCount} email${emailCount !== 1 ? 's' : ''} sent`,
            color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300',
          }
        : null,
      valueColor: hasSaved ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-600',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    // Card 4: Recovery Rate
    {
      label: 'Recovery Rate',
      value: (recoveryRate ?? 0) > 0 ? `${recoveryRate}%` : 'Active',
      subValue: (recoveryRate ?? 0) > 0
        ? `of overdue invoices paid`
        : 'Agent collecting payments',
      badge: (recoveryRate ?? 0) >= 50
        ? { text: 'On track', color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' }
        : (recoveryRate ?? 0) > 0
          ? { text: 'Building', color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300' }
          : { text: 'Monitoring', color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' },
      valueColor: (recoveryRate ?? 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6 0h6m-6 0V9a2 2 0 012-2h2a2 2 0 012 2v10m6 0v-4a2 2 0 00-2-2h-2a2 2 0 00-2 2v4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card, i) => (
        <div
          key={i}
          className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4 flex flex-col gap-2"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-tight">
              {card.label}
            </p>
            <span className="text-gray-400 dark:text-gray-600">
              {card.icon}
            </span>
          </div>

          <p className={`text-2xl font-bold leading-none ${card.valueColor}`}>
            {card.value}
          </p>

          <p className="text-[11px] text-gray-500 dark:text-gray-500 leading-tight">
            {card.subValue}
          </p>

          {card.badge && (
            <span className={`self-start text-[10px] font-semibold px-2 py-0.5 rounded-full ${card.badge.color}`}>
              {card.badge.text}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

export default ROIImpactSection;
