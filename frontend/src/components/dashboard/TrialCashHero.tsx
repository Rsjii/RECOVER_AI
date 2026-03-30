import React from 'react';

interface TrialCashHeroProps {
  trialData: any;
}

const TrialCashHero: React.FC<TrialCashHeroProps> = ({ trialData }) => {
  return (
    <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">💰 Cash Position Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-600 dark:text-blue-300 font-medium">Available Cash</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            ${(trialData.available_cash / 1000).toFixed(0)}K
          </p>
        </div>
        <div className={`rounded-lg p-4 border ${
          trialData.runway_days <= 60
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
        }`}>
          <p className={`text-sm font-medium ${
            trialData.runway_days <= 60
              ? 'text-red-600 dark:text-red-400'
              : 'text-green-600 dark:text-green-400'
          }`}>Runway</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{trialData.runway_days}d</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">Pending Invoices</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            ${(trialData.overdue_ar / 1000).toFixed(0)}K
          </p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
          <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">Collection Health</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {Math.max(0, 100 - trialData.avg_days_late)}%
          </p>
        </div>
      </div>
    </div>
  );
};

export default TrialCashHero;
