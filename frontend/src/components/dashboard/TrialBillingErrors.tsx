import React from 'react';

interface TrialBillingErrorsProps {
  trialData: any;
}

const TrialBillingErrors: React.FC<TrialBillingErrorsProps> = ({ trialData }) => {
  if (!trialData.billing_errors?.total_value || trialData.billing_errors.total_value === 0) {
    return null;
  }

  return (
    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 mb-4">
        ⚠️ Billing Issues Found: ${(trialData.billing_errors.total_value / 1000).toFixed(0)}K
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border-l-4 border-orange-500 pl-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Duplicates</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{trialData.billing_errors.duplicates.count}</p>
        </div>
        <div className="border-l-4 border-yellow-500 pl-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Spikes</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{trialData.billing_errors.spikes.count}</p>
        </div>
        <div className="border-l-4 border-red-500 pl-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Failed Payments</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{trialData.billing_errors.failed_clusters.count}</p>
        </div>
        <div className="border-l-4 border-blue-500 pl-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Billing Gaps</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{trialData.billing_errors.gaps.count}</p>
        </div>
      </div>
    </div>
  );
};

export default TrialBillingErrors;
