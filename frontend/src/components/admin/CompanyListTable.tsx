import React from 'react';
import { format, parseISO } from 'date-fns';
import type { AdminCompanyRow } from '../../hooks/useAdminCompanies';
import { Card } from '../ui/Card';

interface CompanyListTableProps {
  companies: AdminCompanyRow[];
  onSelectCompany: (company: AdminCompanyRow) => void;
  loading: boolean;
}

export const CompanyListTable: React.FC<CompanyListTableProps> = ({
  companies,
  onSelectCompany,
  loading,
}) => {
  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading companies...</div>;
  }

  if (companies.length === 0) {
    return <div className="text-center py-8 text-gray-500">No companies found</div>;
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {companies.map((company) => (
        <div
          key={company.id}
          className="cursor-pointer hover:opacity-80 transition"
          onClick={() => onSelectCompany(company)}
        >
          <Card className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900 dark:text-white">{company.name}</h3>
              <div className="flex gap-2 mt-1">
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded font-mono">
                  {company.account_type}
                </span>
                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded">
                  {company.billing_tier}
                </span>
                {company.trial_status && (
                  <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs rounded">
                    {company.trial_status}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono text-gray-600 dark:text-gray-400">
                {format(parseISO(company.created_at), 'MMM dd, yyyy')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {company.user_count} users
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-gray-50 dark:bg-white/5 p-2 rounded">
              <p className="text-gray-500 dark:text-gray-400">Customers</p>
              <p className="font-bold text-gray-900 dark:text-white">{company.customer_count}</p>
            </div>
            <div className="bg-gray-50 dark:bg-white/5 p-2 rounded">
              <p className="text-gray-500 dark:text-gray-400">Invoices</p>
              <p className="font-bold text-gray-900 dark:text-white">{company.invoice_count}</p>
            </div>
            <div className="bg-gray-50 dark:bg-white/5 p-2 rounded">
              <p className="text-gray-500 dark:text-gray-400">Total AR</p>
              <p className="font-bold text-gray-900 dark:text-white">${(company.total_ar / 100).toFixed(0)}k</p>
            </div>
            <div className="bg-gray-50 dark:bg-white/5 p-2 rounded">
              <p className="text-gray-500 dark:text-gray-400">Emails</p>
              <p className="font-bold text-gray-900 dark:text-white">{company.email_count}</p>
            </div>
          </div>

          {company.has_stripe && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
              ✓ Stripe connected
            </p>
          )}
          </Card>
        </div>
      ))}
    </div>
  );
};
