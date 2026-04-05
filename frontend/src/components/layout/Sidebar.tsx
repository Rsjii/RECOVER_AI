import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';

// Hide scrollbar but keep scrolling functional
const scrollbarHideStyle = `
  .sidebar-nav {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .sidebar-nav::-webkit-scrollbar {
    display: none;
  }
`;

interface SidebarSection {
  title: string;
  items: Array<{ path: string; label: string; icon: React.ReactNode }>;
}

const getSidebarSections = (isAdmin: boolean): SidebarSection[] => [
  {
    title: 'WORKSPACE',
    items: [
      {
        path: '/dashboard',
        label: 'Dashboard',
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" /></svg>,
      },
      {
        path: '/invoices',
        label: 'Invoices',
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
      },
      {
        path: '/customers',
        label: 'Customers',
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
      },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      // Activity and Reports: Show to all users
      {
        path: '/activity',
        label: 'Activity',
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
      },
      {
        path: '/reports',
        label: 'Reports',
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6 0h6m-6 0V9a2 2 0 012-2h2a2 2 0 012 2v10m6 0v-4a2 2 0 00-2-2h-2a2 2 0 00-2 2v4" /></svg>,
      },
    ],
  },
  // BUSINESS section — hide from demo users (they don't need billing)
  ...(!(localStorage.getItem('isDemo') === 'true')
    ? [{
        title: 'BUSINESS',
        items: [
          {
            path: '/billing',
            label: 'Billing',
            icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .672-3 1.5S10.343 11 12 11s3-.672 3-1.5S13.657 8 12 8z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11.5c0 2.485-3.134 4.5-7 4.5s-7-2.015-7-4.5m14 0V8.5C19 6.015 15.866 4 12 4S5 6.015 5 8.5v7c0 2.485 3.134 4.5 7 4.5s7-2.015 7-4.5v-4z" /></svg>,
          },
        ],
      }]
    : []),
  // ADMIN section — hide Settings from demo users
  {
    title: 'ADMIN',
    items: [
      // Settings — hide from demo users (read-only demo, no settings needed)
      ...(!(localStorage.getItem('isDemo') === 'true')
        ? [{
            path: '/settings',
            label: 'Settings',
            icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
          }]
        : []),
      ...(isAdmin
        ? [
            {
              path: '/admin',
              label: 'Admin',
              icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" /></svg>,
            },
          ]
        : []),
    ],
  },
];

interface TrialInfo {
  status: string;
  daysRemaining: number | null;
  trialEndsAt: string | null;
}

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { addToast } = useNotification();
  const [trial, setTrial] = useState<TrialInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebarCollapsed', String(next));
  };

  useEffect(() => {
    api.get('/api/admin/metrics')
      .then(() => setIsAdmin(true))
      .catch((err: any) => {
        const status = err?.response?.status ?? err?.status;
        if (status === 403) setIsAdmin(false);
      });

    api.get<{ data: any }>('/api/billing/subscription')
      .then((res: any) => {
        const sub = res.data || res;
        if (sub?.trial_ends_at) {
          const trialEnd = new Date(sub.trial_ends_at).getTime();
          const now = Date.now();
          const daysRemaining = Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)));
          setTrial({ status: sub.status, daysRemaining, trialEndsAt: sub.trial_ends_at });
        } else if (sub?.status) {
          setTrial({ status: sub.status, daysRemaining: null, trialEndsAt: null });
        }
      })
      .catch(() => {});
  }, []);

  const trialLabel = () => {
    if (!trial) return { title: 'RecoverAI', sub: 'Loading plan...' };
    if (trial.status === 'active') return { title: 'Active Plan', sub: 'Subscription active' };
    if (trial.status === 'trialing') {
      const days = trial.daysRemaining ?? 0;
      return { title: 'Free Trial', sub: days > 0 ? `${days} day${days !== 1 ? 's' : ''} remaining` : 'Trial ended' };
    }
    if (trial.status === 'past_due') return { title: 'Payment Due', sub: 'Update billing info' };
    if (trial.status === 'canceled') return { title: 'Canceled', sub: 'Reactivate your plan' };
    return { title: 'Free Plan', sub: 'Upgrade for full access' };
  };

  const handleThemeToggle = () => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
      addToast({ type: 'info', message: 'Switched to light mode' });
    } else {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
      addToast({ type: 'info', message: 'Switched to dark mode' });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err: any) {
      addToast({ type: 'error', message: 'Logout failed. Please try again.' });
    }
  };

  const handleHelpClick = () => {
    navigate('/support');
  };

  const isDemo = localStorage.getItem('isDemo') === 'true';
  const { title, sub } = trialLabel();
  const isBadStatus = trial?.status === 'past_due' || trial?.status === 'canceled';
  const showEmailBanner = user && !user.emailVerified;
  const sections = getSidebarSections(isAdmin);

  const isActiveItem = (path: string) => {
    return path === '/dashboard'
      ? location.pathname === '/dashboard'
      : location.pathname.startsWith(path);
  };

  return (
    <>
      <style>{scrollbarHideStyle}</style>
      <aside className={cn(
        'bg-white dark:bg-[#111113] border-r border-gray-200 dark:border-white/[0.06] flex flex-col h-full transition-all duration-200',
        collapsed ? 'w-16' : 'w-64'
      )}>
      {/* Brand */}
      <div className="px-3 py-5 border-b border-gray-200 dark:border-white/[0.06] shrink-0 flex items-center justify-between">
        <Link to="/dashboard" className={cn('flex items-center gap-2.5 hover:opacity-80 transition-opacity', collapsed && 'justify-center w-full')}>
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">R</span>
          </div>
          {!collapsed && <span className="text-lg font-bold text-gray-900 dark:text-white">RecoverAI</span>}
        </Link>
        {!collapsed && (
          <button onClick={toggleCollapsed} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors" title="Collapse sidebar">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Email Verification Banner */}
      {showEmailBanner && (
        <button
          onClick={() => navigate('/verify-email', { state: { from: location.pathname } })}
          className="mx-3 mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-2.5 w-[calc(100%-1.5rem)] text-left hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors shrink-0"
        >
          <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <p className="text-xs font-medium text-yellow-800 dark:text-yellow-300 mb-1">Verify your email</p>
            <p className="text-xs text-yellow-700 dark:text-yellow-400">Click here to verify →</p>
          </div>
        </button>
      )}

      {/* Navigation */}
      <nav className="sidebar-nav flex-1 overflow-y-auto">
        {collapsed && (
          <div className="px-2 py-3 flex justify-center">
            <button onClick={toggleCollapsed} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors" title="Expand sidebar">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
        {sections.map((section, idx) => (
          <div key={section.title} className={cn(idx > 0 && 'mt-4')}>
            {/* Section Header — hidden when collapsed */}
            {!collapsed && (
              <div className="px-6 py-2 mt-2">
                <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  {section.title}
                </h3>
              </div>
            )}

            {/* Section Items */}
            <div className={cn('space-y-1', collapsed ? 'px-2' : 'px-3')}>
              {section.items.map((item) => {
                const isActive = isActiveItem(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={collapsed ? item.label : undefined}
                    data-tour={
                      item.path === '/invoices' ? 'sidebar-invoices' :
                      item.path === '/customers' ? 'sidebar-customers' :
                      item.path === '/settings' ? 'sidebar-settings' : undefined
                    }
                    className={cn(
                      'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                      collapsed && 'justify-center px-2',
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.05] hover:text-gray-900 dark:hover:text-white'
                    )}
                  >
                    {/* Active Indicator (Left Border) */}
                    {isActive && !collapsed && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-blue-600 dark:bg-blue-400 rounded-r" />
                    )}

                    {/* Icon */}
                    <span
                      className={cn(
                        'flex-shrink-0 transition-colors duration-200',
                        isActive
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-gray-500 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300'
                      )}
                    >
                      {item.icon}
                    </span>

                    {/* Label — hidden when collapsed */}
                    {!collapsed && <span className="flex-1">{item.label}</span>}
                  </Link>
                );
              })}
            </div>

            {/* Section Divider */}
            {idx < sections.length - 1 && (
              <div className="mt-4 border-b border-gray-200 dark:border-white/[0.06]" />
            )}
          </div>
        ))}
      </nav>

      {/* Trial / Subscription Status — Only show for trial users, hidden for paid/active users */}
      {!isDemo && !collapsed && trial?.status !== 'active' && (
      <div className="p-4 border-t border-gray-200 dark:border-white/[0.06] shrink-0">
        <Link to="/billing">
          <div
            className={cn(
              'rounded-lg p-3 cursor-pointer hover:opacity-90 transition-opacity border',
              isBadStatus
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30'
                : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/30'
            )}
          >
            <p
              className={cn(
                'text-xs font-semibold',
                isBadStatus ? 'text-red-700 dark:text-red-300' : 'text-blue-700 dark:text-blue-300'
              )}
            >
              {title}
            </p>
            <p
              className={cn(
                'text-xs mt-0.5',
                isBadStatus ? 'text-red-600/70 dark:text-red-400/70' : 'text-blue-600/70 dark:text-blue-400/70'
              )}
            >
              {sub}
            </p>
          </div>
        </Link>
      </div>
      )}

      {/* Footer Actions */}
      <div className={cn(
        'border-t border-gray-200 dark:border-white/[0.06] shrink-0 relative flex',
        collapsed ? 'p-2 flex-col gap-1 items-center justify-center' : 'p-4 items-center justify-between'
      )}>
        {/* Help Button */}
        <button
          onClick={handleHelpClick}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors rounded-lg"
          title="Help & Documentation"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.546-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={handleThemeToggle}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors rounded-lg"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        {/* Profile Button with Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors rounded-lg"
            title="Account"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 12a3 3 0 11-6 0 3 3 0 016 0m6 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <div className={cn(
              'absolute bottom-full mb-2 bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-lg shadow-lg z-50',
              collapsed ? 'left-0 w-40' : 'right-0 w-48'
            )}>
              <div className="px-4 py-3 border-b border-gray-200 dark:border-white/[0.06]">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.email?.split('@')[0] || 'User'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email || 'email@example.com'}</p>
              </div>
              {/* Settings button — hide from demo users */}
              {!(isDemo) && (
                <button
                  onClick={() => {
                    navigate('/settings?tab=profile');
                    setShowProfileMenu(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  </svg>
                  Settings
                </button>
              )}
              <button
                onClick={() => {
                  handleLogout();
                  setShowProfileMenu(false);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
    </>
  );
};
