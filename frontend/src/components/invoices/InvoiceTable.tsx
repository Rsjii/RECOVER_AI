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
}

export const InvoiceTable: React.FC<InvoiceTableProps> = ({
  invoices, loading, pagination, onRowClick,
}) => {
  const columns: TableColumn<Invoice>[] = [
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
        const pausedDate = isPaused ? new Date(row.dunning_paused_until!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
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

  return (
    <Table<Invoice> data={invoices} columns={columns}
      onRowClick={onRowClick} loading={loading} pagination={pagination} />
  );
};