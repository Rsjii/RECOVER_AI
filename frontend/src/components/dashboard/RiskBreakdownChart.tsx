import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card } from '../ui/Card';
import type { InvoicePipeline } from '../../types';

interface RiskBreakdownChartProps {
  pipeline: InvoicePipeline;
}

export const RiskBreakdownChart: React.FC<RiskBreakdownChartProps> = ({ pipeline }) => {
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

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Status Breakdown</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={95}
              paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
              {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
            <Tooltip formatter={(value: number | undefined) => [value ?? 0, 'Invoices']}
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};