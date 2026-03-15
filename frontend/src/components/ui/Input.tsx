import React from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, error, hint, icon, className, id, ...props }) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>}
        <input
          id={inputId}
          className={cn(
            'w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-sm',
            error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600',
            icon ? 'pl-10' : '',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
      </div>
      {error && <p id={`${inputId}-error`} className="mt-1 text-xs text-red-500" role="alert">{error}</p>}
      {hint && !error && <p id={`${inputId}-hint`} className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
};

