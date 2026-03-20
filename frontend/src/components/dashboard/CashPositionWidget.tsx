import React from 'react';
import { Card } from '../ui/Card';

export interface CashPositionData {
  currentBalance: number;
  balance30: number;
  balance60: number;
  balance90: number;
  pendingInvoices30: number;
  pendingInvoices60: number;
  pendingInvoices90: number;
  invoiceCount: number;
  asOfDate: string;
}

interface CashPositionWidgetProps {
  cashPosition: CashPositionData | null;
  cashBalanceInput: string;
  onBalanceChange: (value: string) => void;
  onBalanceSubmit: () => void;
  loading: boolean;
}

const fmtUsd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const CashPositionWidget: React.FC<CashPositionWidgetProps> = ({
  cashPosition,
  cashBalanceInput,
  onBalanceChange,
  onBalanceSubmit,
  loading,
}) => {
  if (loading) {
    return (
      <Card className="animate-pulse">
        <div className="h-48 bg-gray-200 dark:bg-white/[0.03] rounded" />
      </Card>
    );
  }

  if (!cashPosition) return null;

  const periods = [
    { label: '30 Days', balance: cashPosition.balance30, pending: cashPosition.pendingInvoices30 },
    { label: '60 Days', balance: cashPosition.balance60, pending: cashPosition.pendingInvoices60 },
    { label: '90 Days', balance: cashPosition.balance90, pending: cashPosition.pendingInvoices90 },
  ];

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Cash Position Forecast</h3>
        <span className="text-xs text-gray-400 dark:text-gray-500">{cashPosition.invoiceCount} open invoices</span>
      </div>

      {/* Editable current balance */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <label className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">Current balance:</label>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
          <input
            type="text"
            value={cashBalanceInput}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9.]/g, '');
              // Prevent multiple dots
              const parts = raw.split('.');
              const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : raw;
              onBalanceChange(sanitized);
            }}
            onBlur={onBalanceSubmit}
            onKeyDown={(e) => e.key === 'Enter' && onBalanceSubmit()}
            className="w-36 pl-5 pr-2 py-1 text-sm border border-gray-200 dark:border-white/[0.1] rounded bg-gray-50 dark:bg-white/[0.03] text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        {cashPosition.asOfDate && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Updated {new Date(cashPosition.asOfDate).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* 30/60/90 day projections */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {periods.map((p) => (
          <div key={p.label} className="bg-gray-50 dark:bg-white/[0.03] rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{p.label}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{fmtUsd(p.balance)}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">+{fmtUsd(p.pending)} expected</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
        Based on AR aging x payment history. Excludes operating expenses.
      </p>
    </Card>
  );
};
