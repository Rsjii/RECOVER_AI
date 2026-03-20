import React from 'react';
import { Card } from '../ui/Card';

interface AtRiskCustomer {
  customerId: string;
  customerName: string;
  score: number;
  signals: string[];
  invoiceAmount: number;
  daysUntilDue: number;
}

interface AtRiskWidgetProps {
  atRiskCustomers: AtRiskCustomer[];
  loading: boolean;
}

export const AtRiskWidget: React.FC<AtRiskWidgetProps> = ({ atRiskCustomers, loading }) => {
  if (loading) {
    return (
      <Card className="animate-pulse">
        <div className="h-36 bg-gray-200 dark:bg-white/[0.03] rounded" />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Payment Risk Alerts
        </h3>
        {atRiskCustomers.length > 0 && (
          <span className="text-xs font-medium bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">
            {atRiskCustomers.length} at risk
          </span>
        )}
      </div>

      {atRiskCustomers.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-emerald-600 dark:text-emerald-400 font-medium text-sm">No at-risk customers detected</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">All payment signals look healthy</p>
        </div>
      ) : (
        <div className="space-y-3">
          {atRiskCustomers.slice(0, 5).map((c) => (
            <div key={c.customerId} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-white/[0.04] last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.customerName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {c.signals.join(' · ')}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    ${c.invoiceAmount.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {c.daysUntilDue > 0 ? `${c.daysUntilDue}d until due` : `${Math.abs(c.daysUntilDue)}d overdue`}
                  </p>
                </div>
                <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold ${
                  c.score >= 80 ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300' :
                  c.score >= 50 ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300' :
                  'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300'
                }`}>
                  {c.score}
                </span>
              </div>
            </div>
          ))}
          {atRiskCustomers.length > 5 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center pt-1">
              +{atRiskCustomers.length - 5} more at-risk customers
            </p>
          )}
        </div>
      )}
    </Card>
  );
};
