import React from 'react';
import type { CardProps } from '../../types';
import { cn } from '../../lib/utils';

export const Card: React.FC<CardProps> = ({
  className,
  children,
  padding = 'md',
  hoverable = false,
  clickable = false,
}) => {
  const paddings = { sm: 'p-3', md: 'p-6', lg: 'p-8' };

  return (
    <div
      className={cn(
        'bg-white dark:bg-slate-950 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800',
        'transition-all duration-200',
        paddings[padding],
        hoverable && 'hover:shadow-md hover:border-gray-300 dark:hover:border-slate-700',
        clickable && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
};
