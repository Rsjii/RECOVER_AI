import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { formatCurrency } from '../../lib/utils';
import type { CustomerRisk } from '../../types';

interface TopCustomersTableProps {
  customers: CustomerRisk[];
  onCustomerClick?: (customerId: string) => void;
}

export const TopCustomersTable: React.FC<TopCustomersTableProps> = ({ customers, onCustomerClick }) => {
  if (customers.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top At-Risk Customers</h3>
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">No at-risk customers found</p>
      </Card>
    );
  }

  return (
    <Card padding="sm">
      <div className="px-3 pt-3 pb-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top At-Risk Customers</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/[0.03]">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Customer</th>
              <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Owed</th>
              <th className="px-4 py-2 text-center font-medium text-gray-600 dark:text-gray-300">Risk</th>
              <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Overdue</th>
              <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Invoices</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.customerId}
                className="border-t border-gray-100 dark:border-white/[0.05] hover:bg-gray-50 dark:hover:bg-white/[0.03] cursor-pointer transition-colors"
                onClick={() => onCustomerClick?.(c.customerId)}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 dark:text-white">{c.customerName}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{c.customerEmail}</div>
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                  {formatCurrency(c.totalOwed)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center"><Badge value={c.maxRiskScore} /></div>
                </td>
                <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                  {c.oldestDueDays > 0 ? `${c.oldestDueDays}d` : 'Current'}
                </td>
                <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{c.unpaidInvoices}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
