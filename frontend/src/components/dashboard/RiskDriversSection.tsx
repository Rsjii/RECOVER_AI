import React from 'react';
import { CollapsibleSection } from './CollapsibleSection';
import RiskDriversChart from './RiskDriversChart';

interface RiskDrivers {
  failedPayment: number;
  expiringCard: number;
  inactivity: number;
  hardDecline: number;
  total: number;
}

interface RiskDriversSectionProps {
  drivers: RiskDrivers | undefined;
  loading?: boolean;
}

export const RiskDriversSection: React.FC<RiskDriversSectionProps> = ({ drivers, loading = false }) => {
  if (!drivers || drivers.total === 0) {
    return null;
  }

  const items = [
    { label: 'Failed Payments', value: drivers.failedPayment, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: '💳' },
    { label: 'Expiring Cards', value: drivers.expiringCard, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30', icon: '⏰' },
    { label: 'Inactivity', value: drivers.inactivity, color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', icon: '😴' },
    { label: 'Hard Declines', value: drivers.hardDecline, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30', icon: '❌' },
  ];

  const sorted = items.sort((a, b) => b.value - a.value);

  return (
    <CollapsibleSection
      title="Risk Signals"
      subtitle={`${drivers.total} signal${drivers.total !== 1 ? 's' : ''} detected across at-risk customers`}
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
    >
      <div className="space-y-4">
        {/* Chart */}
        <RiskDriversChart drivers={drivers} loading={loading} />

        {/* Signal Breakdown */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Signal Breakdown</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sorted.map((item) => (
              <div key={item.label} className={`${item.bgColor} rounded-lg p-3 border border-transparent`}>
                <div className="text-xl font-bold mb-1">{item.icon}</div>
                <p className={`text-xs font-semibold ${item.color}`}>{item.value.toLocaleString()}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-200">What are Risk Signals?</p>
          <p className="text-sm text-blue-800 dark:text-blue-300 mt-2">
            Risk signals indicate why customers are at risk of non-payment. Failed payments and hard declines require immediate intervention. Expiring cards and inactivity are early warning signs.
          </p>
        </div>
      </div>
    </CollapsibleSection>
  );
};

export default RiskDriversSection;
