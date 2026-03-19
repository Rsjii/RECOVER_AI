import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card } from '../ui/Card';
import { useTheme } from '../../hooks/useTheme';
import type { InvoicePipeline } from '../../types';

interface RiskBreakdownChartProps {
  pipeline: InvoicePipeline;
}

export const RiskBreakdownChart: React.FC<RiskBreakdownChartProps> = ({ pipeline }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const data = [
    { name: 'Unpaid', value: pipeline.unpaid, color: '#ef4444' },
    { name: 'Arranged', value: pipeline.arranged, color: '#3b82f6' },
    { name: 'Disputed', value: pipeline.disputed, color: '#f59e0b' },
    { name: 'Paid', value: pipeline.paid, color: '#10b981' },
    { name: 'Uncollectable', value: pipeline.uncollectable, color: '#6b7280' },
  ].filter(d => d.value > 0);

  if (data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Status Breakdown</h3>
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">No invoice data yet</p>
      </Card>
    );
  }

  const tooltipBg = isDark ? '#18181b' : '#ffffff';
  const tooltipBorder = isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb';
  const tooltipText = isDark ? '#f1f5f9' : '#111827';
  const legendColor = isDark ? '#94a3b8' : '#6b7280';

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Status Breakdown</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={95}
              paddingAngle={2}
              dataKey="value"
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={{ stroke: isDark ? '#475569' : '#9ca3af' }}
            >
              {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
            <Tooltip
              formatter={(value: number | undefined) => [value ?? 0, 'Invoices']}
              contentStyle={{
                backgroundColor: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: '8px',
                color: tooltipText,
                boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.1)',
              }}
            />
            <Legend
              formatter={(value) => (
                <span style={{ color: legendColor, fontSize: 12 }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
