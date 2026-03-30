import React from 'react';
import { Button } from '../ui/Button';

interface FilterBarTrialProps {
  status: string;
  onStatusChange: (status: string) => void;
  agingBucket: string;
  onAgingBucketChange: (bucket: string) => void;
  search: string;
  onSearchChange: (search: string) => void;
  onRefresh: () => void;
  loading?: boolean;
}

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
  { value: 'arranged', label: 'Arranged' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'uncollectable', label: 'Uncollectable' },
];

const agingBuckets = [
  { value: '', label: 'All Ages' },
  { value: '0-30', label: '0–30 Days' },
  { value: '31-60', label: '31–60 Days' },
  { value: '61-90', label: '61–90 Days' },
  { value: '90+', label: '90+ Days' },
];

const pillClass = (active: boolean) =>
  `px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
    active
      ? 'bg-indigo-600 text-white'
      : 'bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/[0.1]'
  }`;

export const FilterBarTrial: React.FC<FilterBarTrialProps> = ({
  status, onStatusChange, agingBucket, onAgingBucketChange, search, onSearchChange, onRefresh, loading,
}) => (
  <div className="flex flex-col gap-3">
    {/* Aging bucket pills */}
    <div className="flex gap-2 flex-wrap">
      {agingBuckets.map((b) => (
        <button key={b.value} onClick={() => onAgingBucketChange(b.value)} className={pillClass(agingBucket === b.value)}>
          {b.label}
        </button>
      ))}
    </div>

    {/* Status + Search + Refresh (NO DUNNING) */}
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative">
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="appearance-none px-3 pr-10 py-2 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <svg className="pointer-events-none w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        <div className="relative">
          <input type="text" placeholder="Search customer..." value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none w-64" />
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <Button variant="secondary" size="sm" onClick={onRefresh} disabled={loading}>
        <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Refresh
      </Button>
    </div>
  </div>
);
