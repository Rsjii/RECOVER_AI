import React from 'react';
import type { BadgeProps } from '../../types';
import { getRiskLevel } from '../../lib/utils';
import { cn } from '../../lib/utils';
import { RISK_LEVELS } from '../../lib/constants';

export const Badge: React.FC<BadgeProps> = ({ value, max = 100, className, variant = 'default' }) => {
  const level = getRiskLevel(value);
  const riskInfo = RISK_LEVELS[level];
  const percentage = max > 0 ? (value / max) * 100 : 0;

  if (variant === 'compact') {
    return (
      <span
        className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold', className)}
        style={{ backgroundColor: `${riskInfo.color}20`, color: riskInfo.color }}
      >
        {value} ({riskInfo.label})
      </span>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative w-10 h-10">
        <svg className="w-10 h-10 transform -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="16" fill="none" stroke="#e5e7eb" strokeWidth="2" />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke={riskInfo.color}
            strokeWidth="2"
            strokeDasharray={`${(percentage / 100) * 100.5} 100.5`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{value}</span>
        </div>
      </div>
      <div>
        <div className="text-sm font-semibold" style={{ color: riskInfo.color }}>
          {riskInfo.label}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {value} / {max}
        </div>
      </div>
    </div>
  );
};
