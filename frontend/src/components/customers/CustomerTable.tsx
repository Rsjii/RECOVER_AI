import React, { useState, useMemo } from 'react';
import { Spinner } from '../ui/Spinner';
import { Button } from '../ui/Button';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { Customer } from '../../types';

interface CustomerTableProps {
  customers: Customer[];
  loading: boolean;
  pagination?: { page: number; pages: number; total: number; onPageChange: (p: number) => void };
  onRowClick: (customer: Customer) => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  selectAllPages?: boolean;
  onSelectAllPages?: () => void;
}

type SortKey = 'total_ar_balance' | 'customer_risk_score' | 'last_payment_date' | null;

function getRiskColor(score: number | null | undefined) {
  if (score == null || score === 0) return 'bg-gray-400';
  if (score > 60) return 'bg-rose-500';
  if (score > 30) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getRiskLabel(score: number | null | undefined) {
  if (score == null || score === 0) return '—';
  if (score > 60) return 'High';
  if (score > 30) return 'Med';
  return 'Low';
}

function relativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return formatDate(dateStr);
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <span className={`ml-1 text-xs ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
      {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  );
}

function RiskSignals({ customer }: { customer: Customer }) {
  const badges: { title: string; icon: string }[] = [];
  const now = new Date();
  if (customer.card_expires_at) {
    const expiry = new Date(customer.card_expires_at);
    const daysUntil = Math.floor((expiry.getTime() - now.getTime()) / 86400000);
    if (daysUntil < 30) badges.push({ title: `Card expires ${daysUntil < 0 ? 'expired' : `in ${daysUntil}d`}`, icon: '💳' });
  }
  if (customer.last_activity_at) {
    const daysSince = Math.floor((now.getTime() - new Date(customer.last_activity_at).getTime()) / 86400000);
    if (daysSince > 21) badges.push({ title: `Inactive ${daysSince}d`, icon: '😴' });
  }
  if (customer.last_decline_type === 'hard') badges.push({ title: 'Hard decline', icon: '📉' });
  if (badges.length === 0) return null;
  return (
    <div className="flex gap-1 flex-wrap">
      {badges.map((b) => <span key={b.title} title={b.title} className="text-sm cursor-default">{b.icon}</span>)}
    </div>
  );
}

export const CustomerTable: React.FC<CustomerTableProps> = ({
  customers, loading, pagination, onRowClick, selectedIds = new Set(), onSelectionChange, selectAllPages, onSelectAllPages,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectingAll, setSelectingAll] = useState(false);

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    onSelectionChange?.(newSelected);
  };

  const handleSelectAll = async () => {
    if (selectAllPages) {
      // Second click: deselect all
      onSelectionChange?.(new Set());
      onSelectAllPages?.();
    } else if (selectedIds.size === customers.length && customers.length > 0) {
      // First click on all current page selected: select all pages
      setSelectingAll(true);
      await onSelectAllPages?.();
      setSelectingAll(false);
    } else {
      // First click: select current page
      onSelectionChange?.(new Set(customers.map(c => c.id)));
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return customers;
    return [...customers].sort((a, b) => {
      let av: number, bv: number;
      if (sortKey === 'last_payment_date') {
        av = a.last_payment_date ? new Date(a.last_payment_date).getTime() : 0;
        bv = b.last_payment_date ? new Date(b.last_payment_date).getTime() : 0;
      } else {
        av = Number(a[sortKey] ?? 0);
        bv = Number(b[sortKey] ?? 0);
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [customers, sortKey, sortDir]);

  if (loading) return <div className="flex justify-center py-12"><Spinner text="Loading..." /></div>;
  if (customers.length === 0) return <div className="text-center py-12 text-gray-500 dark:text-gray-400">No customers found</div>;

  return (
    <>
      {/* Mobile card view */}
      <div className="md:hidden flex flex-col">
        <div className="space-y-3 flex-1">
          {sorted.map(c => {
            const ar = Number(c.total_ar_balance ?? 0);
            return (
              <div key={c.id} onClick={() => onRowClick(c)}
                className="p-4 bg-white dark:bg-[#111113] rounded-lg border border-gray-200 dark:border-white/[0.06] cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{c.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{c.email}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${getRiskColor(c.customer_risk_score)}`} />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{getRiskLabel(c.customer_risk_score)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-lg font-bold ${ar > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {formatCurrency(ar)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{relativeDate(c.last_payment_date)}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${c.payment_history.on_time_rate >= 80 ? 'bg-green-500' : c.payment_history.on_time_rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${c.payment_history.on_time_rate}%` }} />
                  </div>
                  <span className="text-xs text-gray-500">{c.payment_history.on_time_rate}% on-time</span>
                  <RiskSignals customer={c} />
                </div>
              </div>
            );
          })}
        </div>
        {pagination && pagination.pages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-3 sm:p-4 border-t border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] mt-3">
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 order-2 sm:order-1">
              <span className="sm:hidden">Page {pagination.page}/{pagination.pages}</span>
              <span className="hidden sm:inline">Page {pagination.page} of {pagination.pages} (Total: {pagination.total})</span>
            </div>
            <div className="flex gap-2 order-1 sm:order-2 w-full sm:w-auto">
              <button
                disabled={pagination.page === 1}
                onClick={() => pagination.onPageChange(pagination.page - 1)}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg bg-white dark:bg-white/[0.03] text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-white/[0.08] hover:bg-gray-50 dark:hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ← Previous
              </button>
              <button
                disabled={pagination.page === pagination.pages}
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg bg-white dark:bg-white/[0.03] text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-white/[0.08] hover:bg-gray-50 dark:hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Desktop table view */}
      <div className="hidden md:block overflow-x-auto bg-white dark:bg-[#111113] rounded-lg border border-gray-200 dark:border-white/[0.06]">
        <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
          <thead className="bg-gray-50 dark:bg-white/[0.03] border-b border-gray-200 dark:border-white/[0.08]">
            <tr>
              <th className="px-6 py-3">
                <input
                  type="checkbox"
                  checked={selectAllPages || (selectedIds.size === customers.length && customers.length > 0)}
                  onChange={handleSelectAll}
                  disabled={selectingAll}
                  className="w-4 h-4 border border-gray-300 dark:border-white/[0.08] rounded bg-white dark:bg-white/[0.03] cursor-pointer disabled:opacity-50"
                  title={selectAllPages ? 'Deselect all customers (click again to deselect all pages)' : 'Select customers on this page (click twice to select all pages)'}
                />
              </th>
              <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white">Customer</th>
              <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white">Company</th>
              <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400"
                onClick={() => handleSort('customer_risk_score')}>
                Risk <SortIcon active={sortKey === 'customer_risk_score'} dir={sortDir} />
              </th>
              <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white">Signals</th>
              <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white">On-Time</th>
              <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400"
                onClick={() => handleSort('total_ar_balance')}>
                AR Balance <SortIcon active={sortKey === 'total_ar_balance'} dir={sortDir} />
              </th>
              <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400"
                onClick={() => handleSort('last_payment_date')}>
                Last Payment <SortIcon active={sortKey === 'last_payment_date'} dir={sortDir} />
              </th>
              <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(c => {
              const ar = Number(c.total_ar_balance ?? 0);
              const isSelected = selectedIds.has(c.id);
              return (
                <tr key={c.id}
                  className={`group border-b border-gray-200 dark:border-white/[0.06] transition-colors ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-white/[0.06]'}`}>
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectOne(c.id)}
                      className="w-4 h-4 border border-gray-300 dark:border-white/[0.08] rounded bg-white dark:bg-white/[0.03] cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4 cursor-pointer" onClick={() => onRowClick(c)}>
                    <div className="font-medium text-gray-900 dark:text-white">{c.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{c.email}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300 cursor-pointer" onClick={() => onRowClick(c)}>{c.company_name || '—'}</td>
                  <td className="px-6 py-4 cursor-pointer" onClick={() => onRowClick(c)}>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${getRiskColor(c.customer_risk_score)}`} />
                      <span className="text-xs font-medium">{getRiskLabel(c.customer_risk_score)}</span>
                      {c.customer_risk_score != null && c.customer_risk_score > 0 && (
                        <span className="text-xs text-gray-400">({Math.round(c.customer_risk_score)})</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 cursor-pointer" onClick={() => onRowClick(c)}><RiskSignals customer={c} /></td>
                  <td className="px-6 py-4 cursor-pointer" onClick={() => onRowClick(c)}>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${c.payment_history.on_time_rate >= 80 ? 'bg-green-500' : c.payment_history.on_time_rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${c.payment_history.on_time_rate}%` }} />
                      </div>
                      <span className="text-sm">{c.payment_history.on_time_rate}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right cursor-pointer" onClick={() => onRowClick(c)}>
                    <span className={`font-semibold ${ar > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {formatCurrency(ar)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs cursor-pointer" onClick={() => onRowClick(c)}>
                    {relativeDate(c.last_payment_date)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        title="View Details"
                        onClick={(e) => { e.stopPropagation(); onRowClick(c); }}
                        className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/[0.1] text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-[#111113]">
            <span className="text-sm text-gray-600 dark:text-gray-400">Page {pagination.page} of {pagination.pages} ({pagination.total} total)</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={pagination.page === 1}
                onClick={() => pagination.onPageChange(pagination.page - 1)}>Previous</Button>
              <Button size="sm" variant="secondary" disabled={pagination.page === pagination.pages}
                onClick={() => pagination.onPageChange(pagination.page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
