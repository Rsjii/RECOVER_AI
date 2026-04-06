import React, { useEffect, useRef } from 'react';

interface PopoverProps {
  isOpen: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

export const Popover: React.FC<PopoverProps> = ({
  isOpen,
  onClose,
  trigger,
  children,
  align = 'left',
}) => {
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        popoverRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      onClose();
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <div className="relative inline-block w-full">
      {/* Trigger */}
      <div ref={triggerRef} className="w-full">
        {trigger}
      </div>

      {/* Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          className={`absolute top-full mt-1 z-50 bg-white dark:bg-[#18181b] border border-gray-200 dark:border-white/[0.08] rounded-lg shadow-lg ${
            align === 'right'
              ? 'right-0'
              : align === 'center'
                ? 'left-1/2 -translate-x-1/2'
                : 'left-0'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
};
