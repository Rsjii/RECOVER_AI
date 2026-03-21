import React, { useState } from 'react';
import { CollapsibleSection } from './CollapsibleSection';

interface AtRiskCustomer {
  customerId: string;
  customerName: string;
  score: number;
  signals: string[];
  invoiceAmount: number;
  daysUntilDue: number;
}

interface AtRiskCustomersSectionProps {
  customers: AtRiskCustomer[];
  loading?: boolean;
}

const riskBadgeColor = (score: number) => {
  if (score >= 80) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (score >= 50) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
  return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
};

const signalBadge = (signal: string) => {
  const icons: Record<string, string> = {
    'failed_payment': '💳',
    'expiring_card': '🔄',
    'inactivity': '😴',
    'hard_decline': '❌',
  };
  const icon = icons[signal] || '📌';
  return `${icon} ${signal.replace(/_/g, ' ')}`;
};

export const AtRiskCustomersSection: React.FC<AtRiskCustomersSectionProps> = ({ customers }) => {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? customers : customers.slice(0, 5);

  if (!customers || customers.length === 0) {
    return null;
  }

  const totalAtRisk = customers.reduce((sum, c) => sum + c.invoiceAmount, 0);

  return (
    <CollapsibleSection
      title="At-Risk Customers"
      subtitle={`${customers.length} customer${customers.length !== 1 ? 's' : ''}, $${totalAtRisk.toLocaleString()} at risk`}
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0 4v2M6.343 3.665c.886-.887 2.318-.887 3.203 0l9.759 9.758c.887.887.887 2.318 0 3.203l-9.759 9.759c-.887.887-2.318.887-3.203 0L3.14 16.808c-.887-.887-.887-2.318 0-3.203L6.343 3.665z" />
        </svg>
      }
    >
      <div className="space-y-3">
        {displayed.map((customer) => (
          <div
            key={customer.customerId}
            className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{customer.customerName}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  ${customer.invoiceAmount.toLocaleString()} · {customer.daysUntilDue}d overdue
                </p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${riskBadgeColor(customer.score)}`}>
                Risk: {customer.score}
              </span>
            </div>

            {customer.signals.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {customer.signals.map((signal) => (
                  <span key={signal} className="text-xs bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                    {signalBadge(signal)}
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button className="text-xs px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                Send Email
              </button>
              <button className="text-xs px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors">
                Offer Plan
              </button>
              <button className="text-xs px-3 py-1.5 bg-gray-200 dark:bg-white/[0.08] text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-white/[0.12] transition-colors">
                Profile →
              </button>
            </div>
          </div>
        ))}

        {customers.length > 5 && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full text-xs py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded transition-colors"
          >
            +{customers.length - 5} more customers
          </button>
        )}

        {showAll && customers.length > 5 && (
          <button
            onClick={() => setShowAll(false)}
            className="w-full text-xs py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.04] rounded transition-colors"
          >
            Show less
          </button>
        )}
      </div>
    </CollapsibleSection>
  );
};

export default AtRiskCustomersSection;
