import React from 'react';
import { Button } from '../ui/Button';

interface FilterBarProps {
  status: string;
  onStatusChange: (status: string) => void;
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

export const FilterBar: React.FC<FilterBarProps> = ({
  status, onStatusChange, search, onSearchChange, onRefresh, loading,
}) => (
  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
    <div className="flex gap-3 items-center flex-wrap">
      <div className="relative">
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="appearance-none px-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
          className="pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none w-64" />
        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
    </div>
    <Button variant="secondary" size="sm" onClick={onRefresh} loading={loading}>↻ Refresh</Button>
  </div>
);