import React from 'react';
import { Card } from '../ui/Card';
import { cn } from '../../lib/utils';

interface StatsCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  color?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({ label, value, subtitle, icon, trend, color }) => (
  <Card>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className={cn('text-2xl font-bold mt-1', color || 'text-gray-900 dark:text-white')}>{value}</p>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
        {trend && (
          <div className={cn('flex items-center gap-1 mt-2 text-sm font-medium',
            trend.isPositive ? 'text-green-600' : 'text-red-600')}>
            <span>{trend.isPositive ? '↑' : '↓'}</span>
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
      <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">{icon}</div>
    </div>
  </Card>
);
