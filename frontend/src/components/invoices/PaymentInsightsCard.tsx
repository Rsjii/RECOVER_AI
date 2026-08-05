import React from 'react';
import { Card } from '../ui/Card';
import { formatDate, formatCurrency } from '../../lib/utils';

interface CustomerInsights {
  reliability_pct?: number;
  avg_days_to_pay?: number;
  dso_trend?: number;
  avg_emails_before_payment?: number;
}

interface Payment {
  id: string;
  amount: string | number;
  paid_at: string;
  payment_method: string;
}

interface Props {
  insights: CustomerInsights;
  payments: Payment[];
}

export const PaymentInsightsCard: React.FC<Props> = ({ insights, payments }) => {
  const getTrendArrow = (trend: number | undefined) => {
    if (!trend) return '→';
    if (trend > 0) return '↗️';
    if (trend < 0) return '↘️';
    return '→';
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">💰 Payment History & Insights</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-3 bg-blue-50 dark:bg-blue-900 rounded-lg">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase">Reliability</p>
          <p className="text-xl font-bold text-blue-900 dark:text-blue-100 mt-1">
            {insights.reliability_pct ? `${Math.round(insights.reliability_pct)}%` : 'N/A'}
          </p>
        </div>

        <div className="p-3 bg-green-50 dark:bg-green-900 rounded-lg">
          <p className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase">Avg Days to Pay</p>
          <p className="text-xl font-bold text-green-900 dark:text-green-100 mt-1">
            {insights.avg_days_to_pay ? Math.round(insights.avg_days_to_pay) : 'N/A'}
          </p>
        </div>

        <div className="p-3 bg-purple-50 dark:bg-purple-900 rounded-lg">
          <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase">Avg Emails Needed</p>
          <p className="text-xl font-bold text-purple-900 dark:text-purple-100 mt-1">
            {insights.avg_emails_before_payment ? Math.round(insights.avg_emails_before_payment * 10) / 10 : 'N/A'}
          </p>
        </div>

        <div className="p-3 bg-orange-50 dark:bg-orange-900 rounded-lg">
          <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 uppercase">DSO Trend</p>
          <p className="text-xl font-bold text-orange-900 dark:text-orange-100 mt-1">
            {getTrendArrow(insights.dso_trend)} {insights.dso_trend ? Math.abs(insights.dso_trend) : 'N/A'}
          </p>
        </div>
      </div>

      {payments && payments.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Recent Payments</p>
          <div className="space-y-2">
            {payments.slice(0, 5).map((payment, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatDate(payment.paid_at)}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{payment.payment_method || 'Unknown method'}</p>
                </div>
                <p className="font-semibold text-green-700 dark:text-green-400">{formatCurrency(Number(payment.amount), 'USD')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
