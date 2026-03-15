import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { LayoutDashboard, Users, Settings, LogOut, Zap, BarChart2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import axios from '../../config/axios';

function NavItem({ to, icon, label, end, badge }: {
  to: string; icon: React.ReactNode; label: string; end?: boolean; badge?: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 border',
        isActive
          ? 'bg-indigo-600/15 text-indigo-300 border-indigo-500/25'
          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border-transparent'
      )}
    >
      <span className="shrink-0 w-4 h-4 flex items-center justify-center">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge}
    </NavLink>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`w-1.5 h-1.5 rounded-full shrink-0 ${ok ? 'bg-emerald-400' : 'bg-slate-600'}`}
      title={ok ? 'Connected' : 'Not connected'}
    />
  );
}

export default function Sidebar() {
  const { user, org, logout } = useAuth();

  // Lightweight status checks for badges — non-blocking
  const { data: onboardingStatus } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: () => axios.get('/api/onboarding/status').then(r => r.data),
    staleTime: 30_000,
    retry: false,
  });

  const { data: todayBrief } = useQuery({
    queryKey: ['brief-today-count'],
    queryFn: () => axios.get('/api/briefs/today').then(r => r.data).catch(() => null),
    staleTime: 60_000,
    retry: false,
  });

  const hasHighAlert = todayBrief?.severity_high > 0;
  const isOnboardingDone = onboardingStatus?.completed;

  return (
    <aside className="w-60 bg-[#070c14] border-r border-slate-800/60 flex flex-col shrink-0 h-screen">
      {/* Logo / Org */}
      <div className="p-4 border-b border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shrink-0 shadow-sm">
            <Zap size={14} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-semibold text-sm leading-none truncate">
              {org?.github_org_name || 'EngineeringOS'}
            </h1>
            <p className="text-slate-600 text-[10px] mt-0.5">AI Chief of Staff</p>
          </div>
          {!isOnboardingDone && (
            <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Setup incomplete" />
          )}
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <NavItem
          to="/dashboard"
          icon={<LayoutDashboard size={15} />}
          label="Daily Brief"
          end
          badge={hasHighAlert ? (
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="High-severity alerts today" />
          ) : undefined}
        />
        <NavItem to="/team"     icon={<Users size={15} />}    label="Team" />
        <NavItem to="/reports"  icon={<BarChart2 size={15} />} label="Reports" />
        <NavItem to="/settings" icon={<Settings size={15} />} label="Settings"
          badge={
            <div className="flex items-center gap-1">
              <StatusDot ok={!!onboardingStatus?.step_jira} />
            </div>
          }
        />
      </nav>

      {/* Integration health strip */}
      {isOnboardingDone && (
        <div className="px-3 pb-2">
          <div className="rounded-lg bg-slate-900/60 border border-slate-800/60 px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              <div className="flex items-center gap-1">
                <StatusDot ok={!!onboardingStatus?.step_github} />
                <span>GitHub</span>
              </div>
              <div className="flex items-center gap-1">
                <StatusDot ok={!!onboardingStatus?.step_jira} />
                <span>Jira</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User */}
      <div className="p-3 border-t border-slate-800/60">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group cursor-default">
          <img
            src={`https://github.com/${user?.github_username}.png?size=28`}
            className="w-7 h-7 rounded-full ring-1 ring-slate-700 shrink-0"
            alt=""
          />
          <div className="flex-1 min-w-0">
            <p className="text-slate-300 text-xs font-semibold truncate">{user?.github_username}</p>
            <p className="text-slate-600 text-[10px] truncate capitalize">{user?.role || 'developer'}</p>
          </div>
          <button
            onClick={logout}
            className="p-1 text-slate-600 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-all rounded"
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
