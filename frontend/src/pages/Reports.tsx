import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { formatCurrency } from '../lib/utils';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { useTheme } from '../hooks/useTheme';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface TimelinePoint {
  period: string;
  recovered_amount: number;
  amount_created: number;
  recovered_count: number;
  total_count: number;
  emails_sent?: number;
  emails_opened?: number;
}

interface DashboardStats {
  totalOwed: number;
  totalRecovered: number;
  recoveryRate: number;
  avgDaysToCollect: number;
  overdueCount: number;
}

const Reports: React.FC = () => {
  useEffect(() => { document.title = 'Reports — RecoverAI'; }, []);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(6);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, timelineRes] = await Promise.all([
        api.get<{ data: DashboardStats }>(API_ENDPOINTS.dashboard.stats),
        api.get<{ data: TimelinePoint[] }>(
          `${API_ENDPOINTS.dashboard.timeline}?months=${months}&period=monthly`
        ),
      ]);
      setStats(statsRes.data as unknown as DashboardStats);
      setTimeline((timelineRes as unknown as { data: TimelinePoint[] }).data || []);
    } catch {
      // errors handled silently — page still shows with empty state
    } finally {
      setLoading(false);
    }
  }, [months]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExportCSV = () => {
    if (!timeline.length) return;

    const headers = ['Period', 'Amount Recovered', 'Amount Created', 'Invoices Recovered', 'Total Invoices'];
    const rows = timeline.map(row => [
      formatPeriod(row.period),
      row.recovered_amount.toFixed(2),
      row.amount_created.toFixed(2),
      row.recovered_count,
      row.total_count,
    ]);

    const csvContent = [headers, ...rows]
      .map(r => r.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recoverai-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatPeriod = (period: string) => {
    try { return format(parseISO(period), 'MMM yyyy'); } catch { return period; }
  };

  const chartData = timeline.map(row => ({
    ...row,
    label: formatPeriod(row.period),
  }));

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" text="Loading reports..." />
      </div>
    );
  }

  const agentEfficiency = stats
    ? Math.round(
        (stats.totalRecovered / Math.max(stats.totalOwed + stats.totalRecovered, 1)) * 100
      )
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
        <div className="flex items-center gap-3">
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="text-sm border border-gray-300 dark:border-white/[0.1] rounded-lg px-3 py-2 bg-white dark:bg-[#18181b] text-gray-700 dark:text-gray-300"
          >
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
          </select>
          <button
            onClick={handleExportCSV}
            disabled={!timeline.length}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#18181b] border border-gray-300 dark:border-white/[0.1] rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400">Recovery Rate</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{stats?.recoveryRate || 0}%</p>
          <p className="text-xs text-gray-500 mt-1">of total invoices</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Recovered</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">
            {formatCurrency(stats?.totalRecovered || 0)}
          </p>
          <p className="text-xs text-gray-500 mt-1">all time</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400">Avg Days to Collect</p>
          <p className="text-3xl font-bold text-purple-600 mt-1">{stats?.avgDaysToCollect || 0}</p>
          <p className="text-xs text-gray-500 mt-1">days sales outstanding (DSO)</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400">Agent Efficiency</p>
          <p className="text-3xl font-bold text-indigo-600 mt-1">{agentEfficiency}%</p>
          <p className="text-xs text-gray-500 mt-1">invoices resolved automatically</p>
        </Card>
      </div>

      {/* Recovery Timeline Chart */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recovery Timeline</h3>
        {chartData.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-gray-400 dark:text-gray-500">
            <p>No data available for the selected period. Data populates as invoices are created and recovered.</p>
          </div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: isDark ? '#64748b' : '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: isDark ? '#64748b' : '#9ca3af' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  formatter={(v: number | undefined, name: string | undefined) => [
                    formatCurrency((v as number) ?? 0),
                    name === 'recovered_amount' ? 'Recovered' : 'Created',
                  ]}
                  labelFormatter={(label) => `Period: ${label}`}
                  contentStyle={{ backgroundColor: isDark ? '#18181b' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`, borderRadius: 8, color: isDark ? '#f1f5f9' : '#111827', boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.1)' }}
                  labelStyle={{ color: isDark ? '#94a3b8' : '#374151', fontWeight: 600 }}
                />
                <Legend formatter={(value) => <span style={{ color: isDark ? '#94a3b8' : '#6b7280', fontSize: 12 }}>{value === 'recovered_amount' ? 'Recovered' : 'Created'}</span>} />
                <Area type="monotone" dataKey="amount_created" stroke="#3b82f6" fill={isDark ? 'rgba(59,130,246,0.1)' : '#dbeafe'} strokeWidth={2} />
                <Area type="monotone" dataKey="recovered_amount" stroke="#10b981" fill={isDark ? 'rgba(16,185,129,0.1)' : '#d1fae5'} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Invoice Volume Chart */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Invoice Volume</h3>
        {chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-400 dark:text-gray-500">
            <p>No data yet for this period.</p>
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: isDark ? '#64748b' : '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: isDark ? '#64748b' : '#9ca3af' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  formatter={(v: number | undefined, name: string | undefined) => [(v as number) ?? 0, name === 'recovered_count' ? 'Recovered' : 'Total']}
                  contentStyle={{ backgroundColor: isDark ? '#18181b' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}`, borderRadius: 8, color: isDark ? '#f1f5f9' : '#111827', boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.1)' }}
                  labelStyle={{ color: isDark ? '#94a3b8' : '#374151', fontWeight: 600 }}
                />
                <Legend formatter={(value) => <span style={{ color: isDark ? '#94a3b8' : '#6b7280', fontSize: 12 }}>{value === 'recovered_count' ? 'Invoices Recovered' : 'Total Invoices'}</span>} />
                <Line
                  type="monotone"
                  dataKey="total_count"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  dot={{ fill: '#94a3b8', r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="recovered_count"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Summary Table */}
      {chartData.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Period Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-white/[0.06]">
                  <th className="pb-3 font-medium">Period</th>
                  <th className="pb-3 font-medium text-right">Invoices</th>
                  <th className="pb-3 font-medium text-right">Recovered</th>
                  <th className="pb-3 font-medium text-right">Amount Created</th>
                  <th className="pb-3 font-medium text-right">Amount Recovered</th>
                  <th className="pb-3 font-medium text-right">Rate</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((row, idx) => {
                  const rate = row.total_count > 0
                    ? Math.round((row.recovered_count / row.total_count) * 100)
                    : 0;
                  return (
                    <tr
                      key={idx}
                      className="border-b border-gray-100 dark:border-white/[0.05] hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="py-3 text-gray-900 dark:text-white font-medium">{row.label}</td>
                      <td className="py-3 text-right text-gray-600 dark:text-gray-400">{row.total_count}</td>
                      <td className="py-3 text-right text-gray-600 dark:text-gray-400">{row.recovered_count}</td>
                      <td className="py-3 text-right text-gray-600 dark:text-gray-400">
                        {formatCurrency(row.amount_created)}
                      </td>
                      <td className="py-3 text-right text-green-600 font-medium">
                        {formatCurrency(row.recovered_amount)}
                      </td>
                      <td className="py-3 text-right">
                        <span className={`font-medium ${rate >= 50 ? 'text-green-600' : rate >= 25 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Reports;
