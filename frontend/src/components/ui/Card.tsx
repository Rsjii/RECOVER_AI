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
        'bg-white rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700',
        paddings[padding],
        hoverable && 'transition-all duration-200 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600',
        clickable && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
};
