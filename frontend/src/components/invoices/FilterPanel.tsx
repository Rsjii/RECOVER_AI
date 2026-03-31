import React, { useState } from 'react';
import { Button } from '../ui/Button';

interface FilterPanelProps {
  status: string;
  onStatusChange: (status: string) => void;
  agingBucket: string;
  onAgingBucketChange: (bucket: string) => void;
  dunningStage: string;
  onDunningStageChange: (stage: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
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

const dunningStages = [
  { value: '', label: 'All Stages' },
  { value: '0', label: 'Not Started' },
  { value: '1', label: 'Stage 1' },
  { value: '2', label: 'Stage 2' },
  { value: '3', label: 'Stage 3' },
  { value: '4', label: 'Stage 4' },
  { value: '5', label: 'Stage 5' },
];

const sortOptions = [
  { value: '', label: 'Default' },
  { value: 'amount_asc', label: 'Amount (Low to High)' },
  { value: 'amount_desc', label: 'Amount (High to Low)' },
  { value: 'due_date_asc', label: 'Due Date (Earliest)' },
  { value: 'due_date_desc', label: 'Due Date (Latest)' },
  { value: 'days_overdue_asc', label: 'Days Overdue (Least)' },
  { value: 'days_overdue_desc', label: 'Days Overdue (Most)' },
];

export const FilterPanel: React.FC<FilterPanelProps> = ({
  status, onStatusChange, agingBucket, onAgingBucketChange, dunningStage, onDunningStageChange, sortBy, onSortChange, search, onSearchChange, onRefresh, loading,
}) => {
  const [expandedFilter, setExpandedFilter] = useState<'status' | 'age' | 'dunning' | 'sort' | null>(null);

  const activeFiltersCount = [status, agingBucket, dunningStage, sortBy].filter(f => f).length;
  const hasActiveSearch = search.trim().length > 0;

  const resetFilters = () => {
    onStatusChange('');
    onAgingBucketChange('');
    onDunningStageChange('');
    onSortChange('');
    onSearchChange('');
  };

  const toggleFilter = (filter: 'status' | 'age' | 'dunning' | 'sort') => {
    setExpandedFilter(expandedFilter === filter ? null : filter);
  };

  const FilterButton = ({ type, label }: { type: 'status' | 'age' | 'dunning' | 'sort'; label: string }) => {
    const isActive = type === 'status' ? !!status : type === 'age' ? !!agingBucket : type === 'dunning' ? !!dunningStage : !!sortBy;
    const isExpanded = expandedFilter === type;

    return (
      <button
        onClick={() => toggleFilter(type)}
        className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all text-sm font-medium ${
          isExpanded
            ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-900/20'
            : isActive
              ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
              : 'border-gray-300 dark:border-white/[0.08] text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-white/[0.12]'
        }`}
      >
        <span className="flex items-center gap-2">
          {label}
          {isActive && !isExpanded && (
            <span className="inline-flex items-center justify-center w-4 h-4 bg-indigo-600 text-white rounded-full text-xs font-bold">✓</span>
          )}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {/* Header: Filters + Sort + Search */}
      <div className="flex flex-col gap-3 lg:gap-2 lg:flex-row lg:items-center">
        <div className="flex gap-2 flex-wrap lg:flex-nowrap">
          <FilterButton type="status" label="Status" />
          <FilterButton type="age" label="Age" />
          <FilterButton type="dunning" label="Dunning" />
          <FilterButton type="sort" label="Sort" />

          {activeFiltersCount > 0 && (
            <button
              onClick={resetFilters}
              className="px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 rounded-lg border border-gray-300 dark:border-white/[0.08] hover:border-gray-400 dark:hover:border-white/[0.12] transition-colors"
            >
              Reset ({activeFiltersCount})
            </button>
          )}
        </div>

        {/* Search Box - Right Side */}
        <div className="flex gap-2 flex-1 lg:flex-none lg:ml-auto">
          <div className="relative flex-1 lg:w-64">
            <input
              type="text"
              placeholder="Search customer..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
            />
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <Button variant="secondary" size="sm" onClick={onRefresh} loading={loading} className="whitespace-nowrap">
            ↻ Refresh
          </Button>
        </div>
      </div>

      {/* Expanded Filter Panels */}
      {expandedFilter === 'status' && (
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.08] rounded-lg p-4 animate-in fade-in duration-200">
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">Select Status</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {statusOptions.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  onStatusChange(o.value);
                  setExpandedFilter(null);
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  status === o.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/[0.1]'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {expandedFilter === 'age' && (
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.08] rounded-lg p-4 animate-in fade-in duration-200">
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">Select Age</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {agingBuckets.map((b) => (
              <button
                key={b.value}
                onClick={() => {
                  onAgingBucketChange(b.value);
                  setExpandedFilter(null);
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  agingBucket === b.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/[0.1]'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {expandedFilter === 'dunning' && (
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.08] rounded-lg p-4 animate-in fade-in duration-200">
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">Select Dunning Stage</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {dunningStages.map((s) => (
              <button
                key={s.value}
                onClick={() => {
                  onDunningStageChange(s.value);
                  setExpandedFilter(null);
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dunningStage === s.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/[0.1]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {expandedFilter === 'sort' && (
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.08] rounded-lg p-4 animate-in fade-in duration-200">
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">Sort By</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {sortOptions.map((s) => (
              <button
                key={s.value}
                onClick={() => {
                  onSortChange(s.value);
                  setExpandedFilter(null);
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sortBy === s.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/[0.1]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Filter Tags */}
      {(activeFiltersCount > 0 || hasActiveSearch) && (
        <div className="flex flex-wrap gap-2 items-center pt-2">
          {status && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium">
              {statusOptions.find(o => o.value === status)?.label}
              <button onClick={() => onStatusChange('')} className="hover:opacity-70">×</button>
            </span>
          )}
          {agingBucket && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium">
              {agingBuckets.find(b => b.value === agingBucket)?.label}
              <button onClick={() => onAgingBucketChange('')} className="hover:opacity-70">×</button>
            </span>
          )}
          {dunningStage && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium">
              {dunningStages.find(s => s.value === dunningStage)?.label}
              <button onClick={() => onDunningStageChange('')} className="hover:opacity-70">×</button>
            </span>
          )}
          {sortBy && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium">
              {sortOptions.find(s => s.value === sortBy)?.label}
              <button onClick={() => onSortChange('')} className="hover:opacity-70">×</button>
            </span>
          )}
          {hasActiveSearch && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium">
              Search: "{search}"
              <button onClick={() => onSearchChange('')} className="hover:opacity-70">×</button>
            </span>
          )}
        </div>
      )}
    </div>
  );
};
