import React from 'react';
import { Spinner } from '../ui/Spinner';
import { Button } from '../ui/Button';
import type { Customer } from '../../types';

interface CustomerTableProps {
  customers: Customer[];
  loading: boolean;
  pagination?: { page: number; pages: number; total: number; onPageChange: (p: number) => void };
  onRowClick: (customer: Customer) => void;
}

export const CustomerTable: React.FC<CustomerTableProps> = ({ customers, loading, pagination, onRowClick }) => {
  if (loading) return <div className="flex justify-center py-12"><Spinner text="Loading..." /></div>;
  if (customers.length === 0) return <div className="text-center py-12 text-gray-500 dark:text-gray-400">No customers found</div>;

  return (
    <div className="overflow-x-auto bg-white dark:bg-[#111113] rounded-lg border border-gray-200 dark:border-white/[0.06]">
      <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
        <thead className="bg-gray-50 dark:bg-white/[0.03] border-b border-gray-200 dark:border-white/[0.08]">
          <tr>
            <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white">Customer</th>
            <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white">Company</th>
            <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white">On-Time Rate</th>
            <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white">Invoices</th>
            <th className="px-6 py-3 font-semibold text-gray-900 dark:text-white">Avg Days Late</th>
          </tr>
        </thead>
        <tbody>
          {customers.map(c => (
            <tr key={c.id} onClick={() => onRowClick(c)}
              className="border-b border-gray-200 dark:border-white/[0.06] hover:bg-gray-50 dark:hover:bg-white/[0.06] cursor-pointer">
              <td className="px-6 py-4">
                <div className="font-medium text-gray-900 dark:text-white">{c.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{c.email}</div>
              </td>
              <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{c.company_name || '—'}</td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${
                      c.payment_history.on_time_rate >= 80 ? 'bg-green-500' :
                      c.payment_history.on_time_rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${c.payment_history.on_time_rate}%` }} />
                  </div>
                  <span className="text-sm">{c.payment_history.on_time_rate}%</span>
                </div>
              </td>
              <td className="px-6 py-4">{c.payment_history.total_invoices}</td>
              <td className="px-6 py-4">{c.payment_history.avg_days_late}d</td>
            </tr>
          ))}
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
  );
};