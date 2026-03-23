import React from 'react';
import { Table } from '../ui/Table';
import { Badge } from '../ui/Badge';
import { formatCurrency, formatDate, calculateDaysOverdue } from '../../lib/utils';
import { STATUS_COLORS } from '../../lib/constants';
import type { Invoice, TableColumn } from '../../types';

interface InvoiceTableProps {
  invoices: Invoice[];
  loading: boolean;
  pagination?: {
    page: number; pages: number; limit: number; total: number;
    onPageChange: (page: number) => void;
  };
  onRowClick: (invoice: Invoice) => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

function dunningBadge(stage: number | undefined) {
  const s = stage ?? 0;
  if (s === 0) return { label: 'Not Started', cls: 'bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400' };
  if (s <= 2) return { label: `Stage ${s}`, cls: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' };
  if (s <= 3) return { label: `Stage ${s}`, cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' };
  return { label: `Stage ${s}`, cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' };
}

export const InvoiceTable: React.FC<InvoiceTableProps> = ({
  invoices, loading, pagination, onRowClick, selectedIds = new Set(), onSelectionChange,
}) => {
  const allSelected = invoices.length > 0 && invoices.every(inv => selectedIds.has(inv.id));
  const someSelected = !allSelected && invoices.some(inv => selectedIds.has(inv.id));

  const toggleAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSelectionChange) return;
    const next = new Set(selectedIds);
    if (allSelected) { invoices.forEach(inv => next.delete(inv.id)); }
    else { invoices.forEach(inv => next.add(inv.id)); }
    onSelectionChange(next);
  };

  const toggleOne = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!onSelectionChange) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectionChange(next);
  };

  const CheckboxHeader = (
    <input
      type="checkbox"
      className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
      checked={allSelected}
      ref={(el) => { if (el) el.indeterminate = someSelected; }}
      onChange={() => {}}
      onClick={toggleAll}
    />
  );

  const columns: TableColumn<Invoice>[] = [
    {
      key: 'id',
      label: CheckboxHeader,
      width: '44px',
      render: (_, row) => (
        <input
          type="checkbox"
          className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer"
          checked={selectedIds.has(row.id)}
          onChange={() => {}}
          onClick={(e) => toggleOne(e, row.id)}
        />
      ),
    },
    {
      key: 'source_id',
      label: 'Invoice #',
      render: (_, row) => (
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
          {row.source_id ?? row.id.slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (_, row) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">{row.customer_name || 'Unknown'}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{row.customer_email}</div>
        </div>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      render: (val, row) => (
        <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(Number(val), row.currency)}</span>
      ),
    },
    {
      key: 'due_date',
      label: 'Due Date',
      sortable: true,
      render: (val, row) => {
        const days = calculateDaysOverdue(row.due_date);
        return (
          <div>
            <div className="text-gray-600 dark:text-gray-300">{formatDate(val)}</div>
            {days > 0 && <div className="text-xs text-red-500 font-medium">{days}d overdue</div>}
          </div>
        );
      },
    },
    {
      key: 'dunning_stage',
      label: 'Dunning',
      render: (_, row) => {
        const { label, cls } = dunningBadge(row.dunning_stage);
        return (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>
        );
      },
    },
    {
      key: 'next_action',
      label: 'Next Action',
      render: (_, row) => (
        <span className="text-xs text-blue-600 dark:text-blue-400 leading-tight">
          {row.next_action ?? '—'}
        </span>
      ),
    },
    {
      key: 'risk_score',
      label: 'Risk',
      sortable: true,
      render: (val) => <Badge value={Number(val) || 0} variant="compact" />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (val, row) => {
        const color = STATUS_COLORS[val as keyof typeof STATUS_COLORS] || '#6b7280';
        const isPaused = row.dunning_paused_until && new Date(row.dunning_paused_until) > new Date();
        const pausedDate = isPaused
          ? new Date(row.dunning_paused_until!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : null;
        return (
          <div className="flex flex-wrap gap-1 items-center">
            <span className="px-2.5 py-1 rounded-full text-xs font-medium capitalize"
              style={{ backgroundColor: `${color}20`, color }}>{val}</span>
            {row.dunning_stopped && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Stopped</span>
            )}
            {!row.dunning_stopped && isPaused && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Paused {pausedDate}</span>
            )}
          </div>
        );
      },
    },
  ];

  const rowClassName = (inv: Invoice) => {
    const stage = inv.dunning_stage ?? 0;
    const score = Number(inv.risk_score) || 0;
    if (stage >= 4) return 'bg-rose-50/50 dark:bg-rose-900/10 border-l-2 border-l-rose-500';
    if (score > 60) return 'border-l-2 border-l-rose-500';
    if (score > 30) return 'border-l-2 border-l-amber-500';
    return '';
  };

  // Mobile card view
  const MobileCards = () => (
    <div className="md:hidden space-y-3">
      {loading
        ? Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 bg-white dark:bg-[#111113] rounded-lg border border-gray-200 dark:border-white/[0.06] animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-white/[0.08] rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-100 dark:bg-white/[0.05] rounded w-1/2" />
            </div>
          ))
        : invoices.map(inv => {
            const days = calculateDaysOverdue(inv.due_date);
            const color = STATUS_COLORS[inv.status as keyof typeof STATUS_COLORS] || '#6b7280';
            const { label: dunLabel, cls: dunCls } = dunningBadge(inv.dunning_stage);
            return (
              <div key={inv.id} onClick={() => onRowClick(inv)}
                className="p-4 bg-white dark:bg-[#111113] rounded-lg border border-gray-200 dark:border-white/[0.06] cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{inv.customer_name || 'Unknown'}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{inv.source_id ?? inv.id.slice(0, 8)}</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium capitalize"
                    style={{ backgroundColor: `${color}20`, color }}>{inv.status}</span>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(inv.amount, inv.currency)}</span>
                  {days > 0
                    ? <span className="text-xs font-medium text-red-500">{days}d overdue</span>
                    : <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(inv.due_date)}</span>}
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${dunCls}`}>{dunLabel}</span>
                  <span className="text-xs text-blue-600 dark:text-blue-400">{inv.next_action ?? '—'}</span>
                </div>
              </div>
            );
          })}
    </div>
  );

  return (
    <>
      <MobileCards />
      <div className="hidden md:block">
        <Table<Invoice>
          data={invoices}
          columns={columns}
          onRowClick={onRowClick}
          loading={loading}
          pagination={pagination}
          rowClassName={rowClassName}
        />
      </div>
    </>
  );
};
