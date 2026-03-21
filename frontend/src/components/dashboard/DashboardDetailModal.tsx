import React from 'react';

interface DashboardDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  fullHeight?: boolean;
}

export const DashboardDetailModal: React.FC<DashboardDetailModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  fullHeight = false,
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-4 lg:inset-20 z-50 bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-2xl flex flex-col shadow-xl animate-in fade-in duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-white/[0.05] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.05] rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-y-auto ${fullHeight ? 'p-6' : 'p-6 max-h-[calc(100vh-200px)]'}`}>
          {children}
        </div>
      </div>
    </>
  );
};

export default DashboardDetailModal;
