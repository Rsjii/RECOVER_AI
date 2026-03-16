import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';

const navItems = [
  {
    path: '/', label: 'Dashboard',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" /></svg>
  },
  {
    path: '/invoices', label: 'Invoices',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
  },
  {
    path: '/customers', label: 'Customers',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
  },
  {
    path: '/activity', label: 'Activity',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
  },
  {
    path: '/reports', label: 'Reports',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6 0h6m-6 0V9a2 2 0 012-2h2a2 2 0 012 2v10m6 0v-4a2 2 0 00-2-2h-2a2 2 0 00-2 2v4" /></svg>
  },
  {
    path: '/settings', label: 'Settings',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
  },
  {
    path: '/billing', label: 'Billing',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .672-3 1.5S10.343 11 12 11s3-.672 3-1.5S13.657 8 12 8z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11.5c0 2.485-3.134 4.5-7 4.5s-7-2.015-7-4.5m14 0V8.5C19 6.015 15.866 4 12 4S5 6.015 5 8.5v7c0 2.485 3.134 4.5 7 4.5s7-2.015 7-4.5v-4z" /></svg>
  },
  {
    path: '/team', label: 'Team',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20h10M12 12a4 4 0 100-8 4 4 0 000 8z" /></svg>
  },
  {
    path: '/policy', label: 'Policy',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.012-3.428A9 9 0 1112 3a9 9 0 019.012 3.572z" /></svg>
  },
  {
    path: '/compliance', label: 'Compliance',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m-7 5l-4-4V5a2 2 0 012-2h8l4 4v10a2 2 0 01-2 2H8a2 2 0 01-2-2z" /></svg>
  },
  {
    path: '/admin', label: 'Admin',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" /></svg>
  },
];

interface TrialInfo {
  status: string;
  daysRemaining: number | null;
  trialEndsAt: string | null;
}

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const [trial, setTrial] = useState<TrialInfo | null>(null);

  useEffect(() => {
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
      .catch(() => {
        // Silently fail — sidebar still works without billing data
      });
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

  const { title, sub } = trialLabel();
  const isBadStatus = trial?.status === 'past_due' || trial?.status === 'canceled';

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col min-h-screen">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">R</span>
          </div>
          <span className="text-lg font-bold text-gray-900 dark:text-white">RecoverAI</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-blue-600 dark:bg-blue-400" />}
              <span className={cn(isActive ? 'text-blue-600 dark:text-blue-400' : '')}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Trial / Subscription Status */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <Link to="/billing">
          <div className={cn(
            'rounded-lg p-3 cursor-pointer hover:opacity-90 transition-opacity',
            isBadStatus
              ? 'bg-red-50 dark:bg-red-900/20'
              : 'bg-blue-50 dark:bg-blue-900/20'
          )}>
            <p className={cn(
              'text-xs font-medium',
              isBadStatus ? 'text-red-700 dark:text-red-300' : 'text-blue-700 dark:text-blue-300'
            )}>{title}</p>
            <p className={cn(
              'text-xs mt-0.5',
              isBadStatus ? 'text-red-600/70 dark:text-red-400/70' : 'text-blue-600/70 dark:text-blue-400/70'
            )}>{sub}</p>
          </div>
        </Link>
      </div>
    </aside>
  );
};
