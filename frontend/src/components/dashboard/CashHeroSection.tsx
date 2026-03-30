import React from 'react';

interface CashHeroSectionProps {
  cashBalance?: number;
  runwayDays?: number;
  pendingBills?: number;
  collectionHealth?: number;
  lastUpdated?: string;
}

export const CashHeroSection: React.FC<CashHeroSectionProps> = ({
  cashBalance = 0,
  runwayDays = 0,
  pendingBills = 0,
  collectionHealth = 0,
  lastUpdated = 'a few moments ago',
}) => {
  const getRunwayColor = (days: number) => {
    if (days < 30) return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    if (days < 60) return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
    return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  };

  const getRunwayBadge = (days: number) => {
    if (days < 30) return '🚨 CRITICAL';
    if (days < 60) return '⚠️ WARNING';
    return '✅ HEALTHY';
  };

  return (
    <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">💰 Cash Position Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Available Cash */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-600 dark:text-blue-300 font-medium">Available Cash</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            ${(cashBalance / 1000).toFixed(0)}K
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">↑ from yesterday</p>
        </div>

        {/* Runway */}
        <div className={`rounded-lg p-4 border ${getRunwayColor(runwayDays)}`}>
          <p className="text-sm font-medium">Runway</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {runwayDays} weeks
          </p>
          <p className="text-xs mt-1 font-semibold">{getRunwayBadge(runwayDays)}</p>
        </div>

        {/* Pending Bills */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <p className="text-sm text-amber-600 dark:text-amber-300 font-medium">Bills Due</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            ${(pendingBills / 1000).toFixed(0)}K
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">this week</p>
        </div>

        {/* Collection Health */}
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <p className="text-sm text-purple-600 dark:text-purple-300 font-medium">Collection Health</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {collectionHealth}%
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">DSO: 35 days</p>
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Updated {lastUpdated}
      </p>
    </div>
  );
};
