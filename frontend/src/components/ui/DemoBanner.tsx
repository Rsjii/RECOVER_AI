import React from 'react';
import { useDemo } from '../../hooks/useDemo';

export const DemoBanner: React.FC = () => {
  const { isDemo } = useDemo();

  if (!isDemo) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800 px-4 py-3 flex items-center gap-3">
      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M17.778 8.222c-4.296-4.296-11.26-4.296-15.556 0A11.911 11.911 0 001 10c0 6.627 5.373 12 12 12s12-5.373 12-12c0-2.996-1.089-5.744-2.89-7.89m-5.308 3.39a2 2 0 11-2.828 2.829 2 2 0 012.83-2.83m2.37-5.261a9 9 0 10-11.065 1.832m7.348 9.972h-2v2h2v-2zm0-8h-2v6h2V7z" clipRule="evenodd" />
      </svg>
      <div className="flex-1">
        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
          Demo Mode — View Only
        </p>
        <p className="text-xs text-blue-700 dark:text-blue-300">
          This is a demo account. You can explore the product, but cannot make changes.
        </p>
      </div>
    </div>
  );
};
