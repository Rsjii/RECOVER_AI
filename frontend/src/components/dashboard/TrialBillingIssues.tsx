import React from 'react';

interface TrialBillingIssuesProps {
  billingErrors: {
    duplicates?: { count: number; estimated_value: number };
    spikes?: { count: number; estimated_value: number };
    total_at_risk: number;
  };
}

const TrialBillingIssues: React.FC<TrialBillingIssuesProps> = ({ billingErrors }) => {
  if (!billingErrors || billingErrors.total_at_risk === 0) {
    return null;
  }

  return (
    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800 p-6">
      <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-200 mb-4">
        ⚠️ BILLING ISSUES DETECTED: ${Math.round(billingErrors.total_at_risk / 1000)}K at Risk
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border-l-4 border-orange-500">
          <div className="text-sm text-gray-600 dark:text-gray-400">Duplicates</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {billingErrors.duplicates?.count || 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            ${Math.round((billingErrors.duplicates?.estimated_value || 0) / 1000)}K
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border-l-4 border-yellow-500">
          <div className="text-sm text-gray-600 dark:text-gray-400">Spikes</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {billingErrors.spikes?.count || 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            ${Math.round((billingErrors.spikes?.estimated_value || 0) / 1000)}K
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border-l-4 border-red-500">
          <div className="text-sm text-gray-600 dark:text-gray-400">Failed Payments</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">0</div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">$0K</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border-l-4 border-blue-500">
          <div className="text-sm text-gray-600 dark:text-gray-400">Gaps</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">0</div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">$0K</div>
        </div>
      </div>
      <p className="text-sm text-orange-800 dark:text-orange-300 mt-4">
        💡 Fix these first to improve runway
      </p>
    </div>
  );
};

export default TrialBillingIssues;
