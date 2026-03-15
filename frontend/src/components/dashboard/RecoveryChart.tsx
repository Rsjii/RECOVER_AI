import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card } from '../ui/Card';
import type { InvoicePipeline } from '../../types';

interface RecoveryChartProps {
  pipeline: InvoicePipeline;
}

export const RecoveryChart: React.FC<RecoveryChartProps> = ({ pipeline }) => {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

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

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Invoice Pipeline</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
            <Tooltip
              formatter={(value: number | undefined) => [value ?? 0, 'Invoices']}
              contentStyle={{
                backgroundColor: isDark ? '#1f2937' : '#ffffff',
                border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                borderRadius: '8px',
                color: isDark ? '#f3f4f6' : '#111827',
              }}
              labelStyle={{ color: isDark ? '#d1d5db' : '#374151' }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};