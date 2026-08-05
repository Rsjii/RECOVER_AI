import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Invoice {
  id: string;
  amount: string;
  currency: string;
  due_date: string;
  status: string;
  dunning_stage?: string | number;
  [key: string]: any;
}

interface AllInvoicesSectionProps {
  invoices: Invoice[];
  customerId?: string;
}

const formatCurrency = (amount: string, currency: string): string => {
  const numAmount = parseFloat(amount);
  const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  return `${symbol}${numAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

const getDaysOverdue = (dueDate: string): number => {
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = now.getTime() - due.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

const getStatusBadge = (status: string): { label: string; color: string } => {
  const lower = status.toLowerCase();
  if (lower === 'paid') return { label: '✅ Paid', color: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' };
  if (lower === 'partial') return { label: '⚠️ Partial', color: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' };
  return { label: '⏳ Unpaid', color: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' };
};

export const AllInvoicesSection: React.FC<AllInvoicesSectionProps> = ({ invoices, customerId }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  if (invoices.length === 0) {
    return null;
  }

  // Show only first 20 invoices
  const displayedInvoices = invoices.slice(0, 20);
  const hasMore = invoices.length > 20;

  return (
    <div className="px-6 py-6 border-t border-gray-200 dark:border-gray-700">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">All Invoices</h3>
          <span className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
            {invoices.length}
          </span>
        </div>
        <span
          className={`text-gray-600 dark:text-gray-400 text-lg transition-transform inline-block ${isOpen ? 'rotate-180' : ''}`}
        >
          ▼
        </span>
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="mt-4">
          <div className="space-y-2 mb-4">
            {displayedInvoices.map((invoice) => {
            const daysOverdue = getDaysOverdue(invoice.due_date);
            const { label: statusLabel, color: statusColor } = getStatusBadge(invoice.status);

            return (
              <div
                key={invoice.id}
                onClick={() => navigate(`/invoices/${invoice.id}`)}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer transition"
              >
                <div className="flex items-center justify-between gap-4 mb-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {invoice.id}
                  </span>
                  <span className={`text-xs font-medium px-2 py-1 rounded ${statusColor}`}>
                    {statusLabel}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-4 text-xs text-gray-600 dark:text-gray-400">
                  <div>
                    <p className="text-gray-500 dark:text-gray-500 text-xs">Amount</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-500 text-xs">Due Date</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {new Date(invoice.due_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-500 text-xs">Days Overdue</p>
                    <p className={`font-semibold ${daysOverdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                      {daysOverdue > 0 ? `${daysOverdue}d` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-500 text-xs">Status</p>
                    <p className="font-semibold text-gray-900 dark:text-white capitalize">
                      {invoice.status}
                    </p>
                  </div>
                </div>
              </div>
            );
            })}
          </div>

          {hasMore && (
            <button
              onClick={() => navigate(`/invoices?customerId=${customerId}`)}
              className="w-full py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
            >
              View All Invoices ({invoices.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
};