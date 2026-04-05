import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '../ui/Card';
import { useTheme } from '../../hooks/useTheme';
import type { InvoicePipeline } from '../../types';

interface RecoveryChartProps {
  pipeline: InvoicePipeline;
}

export const RecoveryChart: React.FC<RecoveryChartProps> = ({ pipeline }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const data = [
    { name: 'Unpaid', count: pipeline.unpaid, amount: pipeline.unpaidAmount, fill: '#ef4444' },
    { name: 'Arranged', count: pipeline.arranged, amount: pipeline.arrangedAmount, fill: '#3b82f6' },
    { name: 'Disputed', count: pipeline.disputed, amount: 0, fill: '#f59e0b' },
    { name: 'Paid', count: pipeline.paid, amount: 0, fill: '#10b981' },
    { name: 'Write-off', count: pipeline.uncollectable, amount: 0, fill: '#6b7280' },
  ];

  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Invoice Pipeline</h3>
        <div className="flex items-center justify-center h-72 text-gray-400 dark:text-gray-500">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6 0h6m-6 0V9a2 2 0 012-2h2a2 2 0 012 2v10m6 0v-4a2 2 0 00-2-2h-2a2 2 0 00-2 2v4" /></svg>
            <p className="text-sm">No invoice data yet</p>
          </div>
        </div>
      </Card>
    );
  }

  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb';
  const axisColor = isDark ? '#64748b' : '#9ca3af';
  const tooltipBg = isDark ? '#18181b' : '#ffffff';
  const tooltipBorder = isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb';
  const tooltipText = isDark ? '#f1f5f9' : '#111827';

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Invoice Pipeline</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: axisColor }}
              axisLine={{ stroke: gridColor }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: axisColor }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            {/* @ts-ignore */}
            <Tooltip
              formatter={(value: any) => [value ?? 0, 'Invoices']}
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: '8px',
                color: tooltipText,
                boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.1)',
              }}
              labelStyle={{ color: isDark ? '#94a3b8' : '#374151', fontWeight: 600 }}
              cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
            />
            {/* @ts-ignore */}
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                // @ts-ignore
                <div key={i} style={{ fill: entry.fill }} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
