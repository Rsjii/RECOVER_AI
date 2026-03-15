import React, { useState } from 'react';
import type { TableProps } from '../../types';
import { cn } from '../../lib/utils';
import { Button } from './Button';

export const Table = <T extends Record<string, any>>({
  data, columns, onRowClick, loading = false, pagination,
}: TableProps<T>): React.ReactElement => {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: keyof T) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sortedData = React.useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir]);

  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <tr>
              {columns.map((col) => (
                <th key={String(col.key)} className="px-6 py-3 font-semibold text-gray-900 dark:text-white">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, rowIdx) => (
              <tr key={rowIdx} className="border-b border-gray-200 dark:border-gray-700">
                {columns.map((col) => (
                  <td key={String(col.key)} className="px-6 py-4">
                    <div className="h-4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return <div className="flex justify-center py-12 text-gray-500 dark:text-gray-400"><p>No data available</p></div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
        <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <tr>
            {columns.map((col) => (
              <th key={String(col.key)} className="px-6 py-3 font-semibold text-gray-900 dark:text-white" style={{ width: col.width }}>
                {col.sortable ? (
                  <button onClick={() => handleSort(col.key)} className="flex items-center gap-2 hover:text-gray-600">
                    {col.label} {sortKey === col.key && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                ) : col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, idx) => (
            <tr key={idx} onClick={() => onRowClick?.(row)}
              className={cn('border-b border-gray-200 dark:border-gray-700', onRowClick && 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer')}>
              {columns.map((col) => (
                <td key={String(col.key)} className="px-6 py-4">
                  {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {pagination && (
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Page {pagination.page} of {pagination.pages} (Total: {pagination.total})
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={pagination.page === 1} onClick={() => pagination.onPageChange(pagination.page - 1)}>Previous</Button>
            <Button size="sm" variant="secondary" disabled={pagination.page === pagination.pages} onClick={() => pagination.onPageChange(pagination.page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
};
