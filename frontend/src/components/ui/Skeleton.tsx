import React from 'react';
import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, variant = 'rect', width, height }) => {
  return (
    <div
      className={cn(
        'animate-pulse bg-gray-200 dark:bg-gray-700',
        variant === 'circle' ? 'rounded-full' : 'rounded-lg',
        variant === 'text' ? 'h-4 rounded' : '',
        className
      )}
      style={{ width, height }}
    />
  );
};

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-5 w-48" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <Skeleton className="h-5 w-32 mb-4" />
        <Skeleton className="h-72 w-full" />
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
        <Skeleton className="h-5 w-32 mb-4" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex gap-4">
      {[120, 80, 100, 60, 80].map((w, i) => <Skeleton key={i} className="h-4" width={w} />)}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="px-4 py-3.5 border-b border-gray-100 dark:border-gray-700/50 flex gap-4 items-center">
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-12 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    ))}
  </div>
);

