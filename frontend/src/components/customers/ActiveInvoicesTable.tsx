import React from 'react';
import { useNavigate } from 'react-router-dom';

interface Invoice {
  id: string;
  amount: string;
  currency: string;
  due_date: string;
  status: string;
  // Additional fields that may be in the response
  [key: string]: any;
}

interface ActiveInvoicesTableProps {
  invoices: Invoice[];
  customerId?: string;
}

const getDaysOverdue = (dueDate: string): number => {
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = now.getTime() - due.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

const formatCurrency = (amount: string, currency: string): string => {
  const numAmount = parseFloat(amount);
  const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  return `${symbol}${numAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

const getDunningStage = (invoice: Invoice): string => {
  // Try to infer from invoice status or use a placeholder
  if (invoice.dunning_stage) {
    const stage = invoice.dunning_stage;
    if (typeof stage === 'number') return `📧 Stage ${stage}`;
    return `📧 ${stage}`;
  }
  return '⏳ Waiting';
};

const getRowColor = (daysOverdue: number): string => {
  if (daysOverdue >= 60) return 'border-l-4 border-l-red-500 dark:border-l-red-400 bg-red-50 dark:bg-red-950';
  if (daysOverdue >= 30) return 'border-l-4 border-l-amber-500 dark:border-l-amber-400 bg-amber-50 dark:bg-amber-950';
  return 'border-l-4 border-l-blue-500 dark:border-l-blue-400 bg-blue-50 dark:bg-blue-950';
};

export const ActiveInvoicesTable: React.FC<ActiveInvoicesTableProps> = ({ invoices }) => {
  const navigate = useNavigate();

  if (invoices.length === 0) {
    return (
      <div className="px-6 py-8 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-600 dark:text-gray-400">No unpaid invoices</p>
      </div>
    );
  }

  // Show only first 5 active invoices
  const displayedInvoices = invoices.slice(0, 5);

  return (
    <div className="px-6 py-6 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Active Invoices</h3>
        <p className="text-xs text-gray-600 dark:text-gray-400">{invoices.length} unpaid</p>
      </div>

      <div className="space-y-2">
        {displayedInvoices.map((invoice) => {
          const daysOverdue = getDaysOverdue(invoice.due_date);
          return (
            <div
              key={invoice.id}
              onClick={() => navigate(`/invoices/${invoice.id}`)}
              className={`rounded-lg p-4 cursor-pointer hover:shadow-md transition ${getRowColor(daysOverdue)}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {invoice.id}
                    </span>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {getDunningStage(invoice)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs text-gray-600 dark:text-gray-400">
                    <div>
                      <p className="text-gray-500 dark:text-gray-500">Amount</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-500">Due Date</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {new Date(invoice.due_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-500">Days Overdue</p>
                      <p
                        className={`font-semibold ${
                          daysOverdue >= 60
                            ? 'text-red-600 dark:text-red-400'
                            : daysOverdue >= 30
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {daysOverdue}d
                      </p>
                    </div>
                  </div>
                </div>
                <span className="text-gray-400 flex-shrink-0">→</span>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
