import React, { useState } from 'react';

interface PaymentRecord {
  date: string;
  amount: number;
  daysLate: number;
}

interface PaymentActivitySectionProps {
  paymentTimeline: PaymentRecord[];
  avgDaysToPay: number;
}

const formatCurrency = (amount: number): string => {
  return `€${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const getTrendLabel = (recent: PaymentRecord[], historical: PaymentRecord[]): string => {
  if (recent.length === 0) return 'No recent payments';

  const recentAvg = recent.reduce((sum, p) => sum + p.daysLate, 0) / recent.length;
  const historicalAvg = historical.length > 0 ? historical.reduce((sum, p) => sum + p.daysLate, 0) / historical.length : recentAvg;

  const diff = Math.round(recentAvg - historicalAvg);
  if (diff > 5) return `Getting slower (+${diff} days)`;
  if (diff < -5) return `Improving (${diff} days)`;
  return 'Consistent';
};

export const PaymentActivitySection: React.FC<PaymentActivitySectionProps> = ({
  paymentTimeline,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (paymentTimeline.length === 0) {
    return (
      <div className="px-6 py-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Payment Activity</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">No payments in the last 6 months</p>
      </div>
    );
  }

  const recentPayments = paymentTimeline.slice(0, 3);
  const olderPayments = paymentTimeline.slice(3);
  const totalPayments = paymentTimeline.length;
  const totalAmount = paymentTimeline.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="px-6 py-6 border-t border-gray-200 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Payment Activity (Last 6 Months)</h3>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6 md:grid-cols-4">
        {recentPayments.length > 0 && (
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
            <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">Most Recent</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
              {formatCurrency(recentPayments[0].amount)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{formatDate(recentPayments[0].date)}</p>
          </div>
        )}
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
          <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">Trend</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
            {getTrendLabel(recentPayments, olderPayments)}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
          <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">Total</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{totalPayments} payments</p>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
          <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide">Total Amount</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{formatCurrency(totalAmount)}</p>
        </div>
      </div>

      {/* Expandable Table */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            Payment History
          </p>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition"
          >
            {expanded ? <span>▲</span> : <span>▼</span>}
          </button>
        </div>

        {expanded && (
          <table className="w-full text-sm">
            <thead className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Date</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Amount</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Days Late</th>
              </tr>
            </thead>
            <tbody>
              {paymentTimeline.map((payment, idx) => (
                <tr
                  key={idx}
                  className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{formatDate(payment.date)}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(payment.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        payment.daysLate >= 30
                          ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                          : payment.daysLate >= 15
                            ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
                            : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      }`}
                    >
                      {payment.daysLate}d
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
