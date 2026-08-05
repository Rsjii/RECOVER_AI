import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import type { Invoice } from '../../types';

interface Props {
  invoice: Invoice;
  detail: any;
  riskScore: number | null;
}

export const InvoiceHeaderSticky: React.FC<Props> = ({ invoice, riskScore }) => {
  const navigate = useNavigate();
  const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / (24 * 60 * 60 * 1000)));

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'paid':
        return 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800';
      case 'arranged':
        return 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
      default:
        return 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 75) return 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800';
    if (score >= 50) return 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
    return 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800';
  };

  return (
    <div className="sticky top-0 z-40 bg-white dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/invoices')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{invoice.customer_name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(Number(invoice.amount), String(invoice.currency))}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">•</span>
                <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                  <Clock size={14} />
                  <span>{daysOverdue}d overdue</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {daysOverdue >= 90 && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800`}>
                <AlertCircle size={16} />
                Critical
              </div>
            )}
            {riskScore && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${getRiskColor(riskScore)}`}>
                <TrendingUp size={16} />
                Risk: {riskScore}
              </div>
            )}
            <span className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${getStatusColor(invoice.status)}`}>
              {invoice.status === 'paid' && <CheckCircle size={16} />}
              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
