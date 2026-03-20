import React, { useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { getInitials } from '../../lib/utils';
import { ThemeToggle } from '../ui/ThemeToggle';

interface HeaderProps {
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const { user, company, logout } = useAuth();
  const { addToast } = useNotification();
  const [showMenu, setShowMenu] = React.useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleLogout = async () => {
    try {
      await logout();
      addToast({ type: 'success', message: 'Logged out successfully' });
      navigate('/login', { replace: true });
    } catch {
      addToast({ type: 'error', message: 'Logout failed' });
    }
  };

  return (
    <header className="bg-white dark:bg-[#111113] border-b border-gray-200 dark:border-white/[0.06]">
      <div className="px-6 h-16 flex items-center justify-between">
        {/* Left: Company name */}
        <div className="flex items-center gap-3">
          {onMenuClick && (
            <button onClick={onMenuClick}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded-lg lg:hidden">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {company?.name || 'My Company'}
          </h2>
        </div>

        {/* Right: Theme toggle + User */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          {/* User Menu */}
          <div className="relative" ref={menuRef}>
            <button onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2 p-1.5 hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors">
              <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
                {getInitials(user?.email?.split('@')[0] || 'U')}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[120px]">{user?.email?.split('@')[0]}</p>
              </div>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${showMenu ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#18181b] rounded-xl shadow-lg border border-gray-200 dark:border-white/[0.08] z-50 py-1 animate-in fade-in duration-150">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.email}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{company?.name}</p>
                </div>
                <Link to="/settings" onClick={() => setShowMenu(false)}
                  className="block px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.06]">
                  Settings
                </Link>
                <button onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};