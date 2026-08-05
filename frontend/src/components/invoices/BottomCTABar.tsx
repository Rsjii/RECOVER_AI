import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle, HandshakeIcon, Trash2, MoreVertical } from 'lucide-react';
import type { Invoice } from '../../types';

interface Props {
  invoice?: Invoice;
  dunningStatus?: { isPaused?: boolean; isStopped?: boolean };
  onMarkPaid?: () => void;
  onMarkArranged?: () => void;
  onWriteOff?: () => void;
  loading?: boolean;
}

const ActionButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}> = ({ icon, label, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm bg-slate-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {icon}
    <span>{label}</span>
  </button>
);

const MenuItemButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'secondary' | 'danger';
}> = ({ icon, label, onClick, disabled, variant = 'secondary' }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
      variant === 'danger'
        ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
        : 'text-gray-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-800'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    {icon}
    {label}
  </button>
);

export const BottomCTABar: React.FC<Props> = ({
  dunningStatus,
  onMarkPaid,
  onMarkArranged,
  onWriteOff,
  loading = false,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Determine if we should show the bar
  const isPaused = dunningStatus?.isPaused;
  const isStopped = dunningStatus?.isStopped;
  const shouldShow = !isPaused && !isStopped;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  // Don't show bar when paused or stopped
  if (!shouldShow) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-950 border-t border-gray-200 dark:border-slate-800 shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center gap-3">
          {/* Secondary Status Actions */}
          <div className="flex-1 grid grid-cols-2 gap-2">
            <ActionButton
              icon={<CheckCircle size={18} />}
              label="Mark Paid"
              onClick={onMarkPaid}
              disabled={loading}
            />
            <ActionButton
              icon={<HandshakeIcon size={18} />}
              label="Arrange"
              onClick={onMarkArranged}
              disabled={loading}
            />
          </div>

          {/* More Actions Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg font-semibold text-sm bg-slate-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="More actions"
            >
              <MoreVertical size={18} />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute bottom-full right-0 mb-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg shadow-lg z-50 min-w-[200px]">
                <MenuItemButton
                  icon={<Trash2 size={16} />}
                  label="Write Off Invoice"
                  variant="danger"
                  onClick={() => {
                    onWriteOff?.();
                    setShowMenu(false);
                  }}
                  disabled={loading}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
