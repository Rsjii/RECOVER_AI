import React from 'react';
import type { ButtonProps } from '../../types';
import { cn } from '../../lib/utils';

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary', size = 'md', disabled = false,
  loading = false, className, onClick, children, type = 'button',
}) => {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-blue-700 focus:ring-brand-500 disabled:bg-blue-400 hover:shadow-lg hover:glow-brand',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500 dark:bg-[#111113] dark:text-gray-100 dark:hover:bg-white/[0.06]',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-400',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500 dark:text-gray-300 dark:hover:bg-white/[0.06]',
    outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-400 dark:border-white/[0.08] dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/[0.06]',
  };
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-base', lg: 'px-6 py-3 text-lg' };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(base, variants[variant], sizes[size], (disabled || loading) && 'cursor-not-allowed opacity-50', className)}
    >
      {loading && (
        <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
};
