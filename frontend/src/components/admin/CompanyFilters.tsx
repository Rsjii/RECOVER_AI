import React, { useState } from 'react';
import { Button } from '../ui/Button';

interface CompanyFiltersProps {
  search: string;
  accountType: string;
  onSearchChange: (search: string) => void;
  onAccountTypeChange: (type: string) => void;
  onRefresh: () => void;
  loading: boolean;
  onBillingTierChange?: (tier: string) => void;
  onTrialStatusChange?: (status: string) => void;
  onMinUsersChange?: (min: string) => void;
  onMinARChange?: (min: string) => void;
  onStripeChange?: (status: string) => void;
  onHasInvoicesChange?: (status: string) => void;
  onActiveUsersChange?: (status: string) => void;
  onRecoveryRateChange?: (rate: string) => void;
}

export const CompanyFilters: React.FC<CompanyFiltersProps> = ({
  search,
  accountType,
  onSearchChange,
  onAccountTypeChange,
  onRefresh,
  loading,
  onBillingTierChange,
  onTrialStatusChange,
  onMinUsersChange,
  onMinARChange,
  onStripeChange,
  onHasInvoicesChange,
  onActiveUsersChange,
  onRecoveryRateChange,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="space-y-3">
      {/* Main filters row 1 */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search companies by name..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 min-w-64 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
        />

        <select
          value={accountType}
          onChange={(e) => onAccountTypeChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
        >
          <option value="">Account Type: All</option>
          <option value="pilot">Pilot</option>
          <option value="paid">Paid</option>
          <option value="free">Free</option>
        </select>

        <Button variant="secondary" size="sm" onClick={onRefresh} loading={loading}>
          🔄 Refresh
        </Button>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="px-3 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50 rounded-lg"
        >
          {showAdvanced ? '▼' : '▶'} More Filters
        </button>
      </div>

      {/* Advanced filters */}
      {showAdvanced && (
        <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 space-y-4">
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Filter by
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* Billing Tier */}
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1.5 font-medium">Billing Tier</label>
              <select
                onChange={(e) => onBillingTierChange?.(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              >
                <option value="">All</option>
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            {/* Trial Status */}
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1.5 font-medium">Trial Status</label>
              <select
                onChange={(e) => onTrialStatusChange?.(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="none">None</option>
              </select>
            </div>

            {/* Min Users */}
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1.5 font-medium">Min Users</label>
              <input
                type="number"
                placeholder="0"
                onChange={(e) => onMinUsersChange?.(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
              />
            </div>

            {/* Min AR Amount */}
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1.5 font-medium">Min AR ($)</label>
              <input
                type="number"
                placeholder="0"
                onChange={(e) => onMinARChange?.(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
              />
            </div>

            {/* Has Stripe */}
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1.5 font-medium">Stripe</label>
              <select
                onChange={(e) => onStripeChange?.(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              >
                <option value="">All</option>
                <option value="yes">Connected</option>
                <option value="no">Not Connected</option>
              </select>
            </div>

            {/* Has Invoices */}
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1.5 font-medium">Has Invoices</label>
              <select
                onChange={(e) => onHasInvoicesChange?.(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              >
                <option value="">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            {/* More Filters Placeholder */}
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1.5 font-medium">Active Users</label>
              <select
                onChange={(e) => onActiveUsersChange?.(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              >
                <option value="">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            {/* More Filters Placeholder 2 */}
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1.5 font-medium">Recovery Rate</label>
              <select
                onChange={(e) => onRecoveryRateChange?.(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              >
                <option value="">All</option>
                <option value="high">&gt; 50%</option>
                <option value="med">20-50%</option>
                <option value="low">&lt; 20%</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={() => setShowAdvanced(false)}
              className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700"
            >
              Apply
            </button>
            <button
              onClick={() => {
                onSearchChange('');
                onAccountTypeChange('');
                setShowAdvanced(false);
              }}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 border border-gray-300 dark:border-gray-700 rounded"
            >
              Reset All
            </button>
          </div>
        </div>
      )}
    </div>
  );
};