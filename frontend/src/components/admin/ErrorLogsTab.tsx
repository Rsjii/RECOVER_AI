import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Spinner } from '../ui/Spinner';
import { format, parseISO } from 'date-fns';

interface ErrorLog {
  id: string;
  module: string;
  handler: string;
  message: string;
  error_name: string;
  error_message: string;
  stack_trace: string;
  user_id: string;
  url: string;
  timestamp: string;
}

interface ErrorStats {
  total_errors: number;
  unique_modules: number;
  unique_error_types: number;
  first_error: string | null;
  last_error: string | null;
}

interface ErrorTrend {
  module: string;
  error_count: number;
  unique_errors: number;
  last_error: string;
}

export const ErrorLogsTab: React.FC = () => {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [trends, setTrends] = useState<ErrorTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ module: '', search: '', hoursAgo: 24 });
  const [pagination, setPagination] = useState({ limit: 50, offset: 0, total: 0 });
  const [expandedError, setExpandedError] = useState<string | null>(null);

  useEffect(() => {
    fetchErrors();
    fetchStats();
  }, [filter, pagination.offset]);

  const fetchErrors = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(pagination.limit),
        offset: String(pagination.offset),
        hoursAgo: String(filter.hoursAgo),
      });

      if (filter.module) params.set('module', filter.module);
      if (filter.search) params.set('search', filter.search);

      const res = await api.get<any>(`/api/logs/errors?${params}`);
      setErrors(res.data.logs || []);
      setPagination(prev => ({
        ...prev,
        total: res.data.pagination?.total || 0,
      }));
    } catch (err: any) {
      console.error('Failed to fetch error logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams({
        hoursAgo: String(filter.hoursAgo),
      });

      const res = await api.get<any>(`/api/logs/errors/stats?${params}`);
      setStats(res.data.stats);
      setTrends(res.data.trends || []);
    } catch (err: any) {
      console.error('Failed to fetch error stats:', err);
    }
  };

  const handlePrevious = () => {
    if (pagination.offset > 0) {
      setPagination(prev => ({
        ...prev,
        offset: Math.max(0, prev.offset - prev.limit),
      }));
    }
  };

  const handleNext = () => {
    if ((pagination.offset + pagination.limit) < pagination.total) {
      setPagination(prev => ({
        ...prev,
        offset: prev.offset + prev.limit,
      }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Errors</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_errors}</p>
            <p className="text-xs text-gray-400 mt-2">Last {filter.hoursAgo} hours</p>
          </Card>

          <Card className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Unique Modules</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.unique_modules}</p>
            <p className="text-xs text-gray-400 mt-2">Affected areas</p>
          </Card>

          <Card className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Error Types</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.unique_error_types}</p>
            <p className="text-xs text-gray-400 mt-2">Different errors</p>
          </Card>

          <Card className="p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Last Error</p>
            <p className="text-sm font-mono text-gray-900 dark:text-white">
              {stats.last_error ? format(parseISO(stats.last_error), 'HH:mm:ss') : '—'}
            </p>
            <p className="text-xs text-gray-400 mt-2">Most recent</p>
          </Card>
        </div>
      )}

      {/* Error Trends by Module */}
      {trends.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Top Error Modules</h3>
          <div className="space-y-3">
            {trends.map((trend) => (
              <div key={trend.module} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{trend.module}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{trend.unique_errors} error types</p>
                </div>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">{trend.error_count}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-6">
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={filter.hoursAgo}
            onChange={(e) => {
              setFilter({ ...filter, hoursAgo: parseInt(e.target.value) });
              setPagination({ ...pagination, offset: 0 });
            }}
            className="px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-white"
          >
            <option value={1}>Last 1 hour</option>
            <option value={6}>Last 6 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={168}>Last 7 days</option>
          </select>

          <select
            value={filter.module}
            onChange={(e) => {
              setFilter({ ...filter, module: e.target.value });
              setPagination({ ...pagination, offset: 0 });
            }}
            className="px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-white"
          >
            <option value="">All Modules</option>
            {Array.from(new Set(errors.map(e => e.module))).map(module => (
              <option key={module} value={module}>{module}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search error message..."
            value={filter.search}
            onChange={(e) => {
              setFilter({ ...filter, search: e.target.value });
              setPagination({ ...pagination, offset: 0 });
            }}
            className="flex-1 min-w-64 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-500"
          />

          <Button variant="secondary" size="sm" onClick={fetchErrors} loading={loading}>
            Refresh
          </Button>
        </div>
      </Card>

      {/* Error List */}
      <Card className="p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Error Logs ({pagination.total})
        </h3>

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : errors.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">No errors found</p>
        ) : (
          <>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {errors.map((error) => (
                <div
                  key={error.id}
                  className="border border-gray-200 dark:border-white/10 rounded-lg p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition"
                  onClick={() => setExpandedError(expandedError === error.id ? null : error.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs font-mono">
                          {error.error_name}
                        </span>
                        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                          {error.module}:{error.handler}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{error.message}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {format(parseISO(error.timestamp), 'MMM dd, HH:mm:ss')}
                      </p>
                    </div>
                    <span className="text-gray-400 dark:text-gray-600">
                      {expandedError === error.id ? '▼' : '▶'}
                    </span>
                  </div>

                  {expandedError === error.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10 space-y-3">
                      {error.error_message && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Error Message</p>
                          <p className="text-sm font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-white/5 p-2 rounded mt-1">
                            {error.error_message}
                          </p>
                        </div>
                      )}

                      {error.stack_trace && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Stack Trace</p>
                          <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-white/5 p-2 rounded mt-1 overflow-x-auto">
                            {error.stack_trace.substring(0, 500)}
                          </pre>
                        </div>
                      )}

                      {error.url && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">URL</p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 truncate">{error.url}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-white/10">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={handlePrevious} disabled={pagination.offset === 0}>
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleNext}
                  disabled={(pagination.offset + pagination.limit) >= pagination.total}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
