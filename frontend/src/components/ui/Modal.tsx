import React, { useEffect } from 'react';
import type { ModalProps } from '../../types';
import { cn } from '../../lib/utils';

// Update ModalProps in types/ui.ts to allow 'xl'
// size?: 'sm' | 'md' | 'lg' | 'xl';

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md', footer }) => {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        'relative bg-white dark:bg-[#1c1c1f] shadow-2xl w-full overflow-y-auto border border-transparent dark:border-white/[0.08]',
        'rounded-t-2xl sm:rounded-xl h-[92vh] sm:h-auto sm:max-h-[90vh]',
        sizes[size as keyof typeof sizes] || sizes.md
      )}>
        <div className="sticky top-0 bg-white dark:bg-[#1c1c1f] flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/[0.08] z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
        {footer && (
          <div className="sticky bottom-0 bg-white dark:bg-[#1c1c1f] flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-white/[0.08]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};