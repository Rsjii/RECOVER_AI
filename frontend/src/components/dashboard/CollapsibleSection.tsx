import React, { useState } from 'react';
import { cn } from '../../lib/utils';

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  subtitle,
  defaultOpen = false,
  children,
  icon,
  badge,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn('bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {icon && <span className="text-gray-600 dark:text-gray-400 shrink-0">{icon}</span>}
          <div className="text-left min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          {badge && <div className="shrink-0 ml-auto">{badge}</div>}
        </div>

        {/* Chevron */}
        <div className={cn('shrink-0 ml-4 text-gray-400 dark:text-gray-500 transition-transform duration-200', isOpen && 'rotate-180')}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </button>

      {/* Content */}
      {isOpen && (
        <div className="border-t border-gray-100 dark:border-white/[0.05] px-6 py-4 animate-in fade-in duration-200">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;
