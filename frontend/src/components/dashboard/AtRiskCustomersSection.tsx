import React, { useState } from 'react';
import { CollapsibleSection } from './CollapsibleSection';

interface RiskSignal {
  type: string;
  description: string;
}

interface AtRiskInvoice {
  invoiceId: string;
  amount: number;
  daysUntilDue: number;
  currency: string;
}

interface AtRiskCustomer {
  customerId: string;
  name: string;
  email: string;
  score: number;
  signals: RiskSignal[];
  invoices: AtRiskInvoice[];
  totalAmount: number;
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

const signalBadge = (signalType: string) => {
  const icons: Record<string, string> = {
    'payment_failure_history': '💳',
    'card_expiring': '⏰',
    'inactivity': '😴',
    'hard_decline': '❌',
    'amount_spike': '📈',
    'invoice_aging': '⏳',
    'multiple_hard_declines': '❌❌',
  };
  const icon = icons[signalType] || '📌';
  const label = signalType.replace(/_/g, ' ').toLowerCase();
  return `${icon} ${label}`;
};

export const AtRiskCustomersSection: React.FC<AtRiskCustomersSectionProps> = ({ customers }) => {
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? customers : customers.slice(0, 5);

  if (!customers || customers.length === 0) {
    return null;
  }

  const totalAtRisk = customers.reduce((sum, c) => sum + c.totalAmount, 0);

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
        {displayed.map((customer) => {
          const isExpanded = expandedCustomer === customer.customerId;
          const oldestInvoice = customer.invoices.reduce((max, inv) =>
            inv.daysUntilDue < max.daysUntilDue ? inv : max
          );

          return (
            <div
              key={customer.customerId}
              className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg overflow-hidden"
            >
              {/* Header - clickable */}
              <button
                onClick={() => setExpandedCustomer(isExpanded ? null : customer.customerId)}
                className="w-full p-4 hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{customer.name}</h4>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${riskBadgeColor(customer.score)}`}>
                        Risk: {customer.score}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      ${customer.totalAmount.toLocaleString()} total ({customer.invoices.length} invoice{customer.invoices.length !== 1 ? 's' : ''}) · {Math.abs(oldestInvoice.daysUntilDue)}d overdue
                    </p>
                  </div>
                  <div className="text-gray-400 dark:text-gray-500 ml-2">
                    {isExpanded ? '▼' : '▶'}
                  </div>
                </div>

                {/* Signals preview */}
                {customer.signals.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {customer.signals.slice(0, 3).map((signal) => (
                      <span key={signal.type} className="text-xs bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">
                        {signalBadge(signal.type)}
                      </span>
                    ))}
                    {customer.signals.length > 3 && (
                      <span className="text-xs text-gray-600 dark:text-gray-400">+{customer.signals.length - 3}</span>
                    )}
                  </div>
                )}
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-white/[0.05] px-4 py-3 bg-white dark:bg-white/[0.01] space-y-3">
                  {/* All signals */}
                  {customer.signals.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Risk Signals:</p>
                      <div className="flex flex-wrap gap-2">
                        {customer.signals.map((signal) => (
                          <div key={signal.type} className="text-xs bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                            <div>{signalBadge(signal.type)}</div>
                            <div className="text-gray-600 dark:text-gray-400 text-xs mt-0.5">{signal.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Invoice list */}
                  <div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Invoices ({customer.invoices.length}):</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {customer.invoices.map((invoice) => (
                        <div key={invoice.invoiceId} className="text-xs bg-gray-50 dark:bg-white/[0.02] rounded p-2 flex justify-between items-center">
                          <div>
                            <p className="font-mono text-gray-600 dark:text-gray-400">{invoice.invoiceId}</p>
                            <p className="text-gray-500 dark:text-gray-500">{Math.abs(invoice.daysUntilDue)} days overdue</p>
                          </div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {invoice.currency} {invoice.amount.toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action button */}
                  <div className="pt-2 border-t border-gray-200 dark:border-white/[0.05]">
                    <button className="w-full text-xs px-3 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors font-medium">
                      View & Manage Customer →
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

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
