// EngineeringOS Phase 1.5 — Team Overview
import { useQuery } from '@tanstack/react-query';
import axios from '../config/axios';
import {
  GitPullRequest, Clock, CheckCircle,
  AlertCircle, Users, AlertTriangle, Link2, TrendingUp, TrendingDown,
} from 'lucide-react';

interface TeamMember {
  github_login: string;
  github_id: string;
  avatar_url: string | null;
  role: string;
  jira_display_name: string | null;
  jira_account_id: string | null;
  is_confirmed: boolean;
  active_prs: number;
  tickets_in_progress: number;
  last_commit_at: string | null;
  sprint_status: 'on_track' | 'at_risk' | null;
}

const SPRINT_BADGE = {
  on_track: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  at_risk:  'text-red-400 bg-red-500/10 border-red-500/20',
};

const ROLE_BADGE: Record<string, string> = {
  admin:     'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  reviewer:  'text-sky-400 bg-sky-500/10 border-sky-500/20',
  developer: 'text-slate-400 bg-slate-800 border-slate-700',
};

function relativeTime(dateStr: string | null): { label: string; isSilent: boolean } {
  if (!dateStr) return { label: 'Never', isSilent: true };
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const days   = Math.floor(diffMs / 86400000);
  const hours  = Math.floor(diffMs / 3600000);
  const mins   = Math.floor(diffMs / 60000);
  let label: string;
  if (days > 30)      label = `${Math.floor(days / 30)}mo ago`;
  else if (days > 0)  label = `${days}d ago`;
  else if (hours > 0) label = `${hours}h ago`;
  else if (mins > 1)  label = `${mins}m ago`;
  else                label = 'Just now';
  return { label, isSilent: days >= 3 };
}

function Avatar({ login, url, size = 32 }: { login: string; url: string | null; size?: number }) {
  const fallback = `https://github.com/${login}.png?size=${size * 2}`;
  return (
    <img
      src={url || fallback}
      onError={e => { (e.currentTarget as HTMLImageElement).src = fallback; }}
      className="rounded-full ring-1 ring-slate-700 shrink-0"
      style={{ width: size, height: size }}
      alt={login}
    />
  );
}

interface EngineerVelocity {
  github_login: string;
  commits_this_week: number;
  commits_prev_week: number;
  change_pct: number | null;
}

interface VelocityData {
  engineers: EngineerVelocity[];
}

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6, 7].map(i => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-slate-800 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export default function Team() {
  const { data: members = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ['eos-team'],
    queryFn: () => axios.get('/api/eos/team/overview').then(r => r.data),
    refetchInterval: 60_000,
  });

  const { data: velocityData } = useQuery<VelocityData>({
    queryKey: ['velocity'],
    queryFn: () => axios.get('/api/analytics/velocity').then(r => r.data),
    staleTime: 300_000,
  });
  const velocityMap: Record<string, EngineerVelocity> = {};
  for (const v of velocityData?.engineers ?? []) {
    velocityMap[v.github_login] = v;
  }

  const silentCount   = members.filter(m => relativeTime(m.last_commit_at).isSilent && m.tickets_in_progress > 0).length;
  const atRiskCount   = members.filter(m => m.sprint_status === 'at_risk').length;
  const unmappedCount = members.filter(m => !m.jira_account_id).length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users size={18} className="text-indigo-400" />
            <h1 className="text-white text-xl font-bold">Team Overview</h1>
          </div>
          <p className="text-slate-500 text-sm">Real-time view of your team across GitHub and Jira</p>
        </div>
      </div>

      {/* Alert strip */}
      {(silentCount > 0 || atRiskCount > 0 || unmappedCount > 0) && (
        <div className="flex flex-wrap gap-2">
          {silentCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <AlertTriangle size={12} />
              {silentCount} engineer{silentCount > 1 ? 's' : ''} silent 3+ days with open tickets
            </div>
          )}
          {atRiskCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
              <AlertCircle size={12} />
              {atRiskCount} sprint{atRiskCount > 1 ? 's' : ''} at risk
            </div>
          )}
          {unmappedCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400">
              <Link2 size={12} />
              {unmappedCount} member{unmappedCount > 1 ? 's' : ''} not mapped to Jira
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-900/50 border-b border-slate-800">
              <tr>
                {['Member', 'Jira', 'Active PRs', 'In Progress', 'Last Commit', 'Commits/wk', 'Sprint'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {[1, 2, 3].map(i => <SkeletonRow key={i} />)}
            </tbody>
          </table>
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Users size={24} className="text-slate-500" />
          </div>
          <p className="text-slate-300 font-semibold mb-1">No team data yet</p>
          <p className="text-slate-600 text-sm max-w-sm mx-auto">
            Complete the onboarding flow and run the historical index to populate team activity.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-900/60 border-b border-slate-800">
              <tr>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Member</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Jira</th>
                <th className="text-center px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Active PRs</th>
                <th className="text-center px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">In Progress</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Last Commit</th>
                <th className="text-center px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Commits/wk</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Sprint</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {members.map(member => {
                const { label: commitLabel, isSilent } = relativeTime(member.last_commit_at);
                const isSilentWithTickets = isSilent && member.tickets_in_progress > 0;
                const roleCls = ROLE_BADGE[member.role] ?? ROLE_BADGE['developer'];
                const vel = velocityMap[member.github_login];

                return (
                  <tr
                    key={member.github_login}
                    className={`transition-colors ${isSilentWithTickets ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-white/[0.02]'}`}
                  >
                    {/* Member */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar login={member.github_login} url={member.avatar_url} size={32} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-slate-200 text-sm font-semibold">{member.github_login}</p>
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${roleCls}`}>
                              {member.role}
                            </span>
                          </div>
                          <a
                            href={`https://github.com/${member.github_login}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-600 text-xs hover:text-indigo-400 transition-colors"
                          >
                            @{member.github_login}
                          </a>
                        </div>
                      </div>
                    </td>

                    {/* Jira */}
                    <td className="px-4 py-3">
                      {member.jira_display_name ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-300 text-sm truncate max-w-[120px]">{member.jira_display_name}</span>
                          {member.is_confirmed
                            ? <CheckCircle size={11} className="text-emerald-400 shrink-0" />
                            : <span className="text-[9px] text-amber-500 border border-amber-500/30 rounded px-1 shrink-0">auto</span>
                          }
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs italic">Not mapped</span>
                      )}
                    </td>

                    {/* Active PRs */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <GitPullRequest size={12} className={member.active_prs > 0 ? 'text-indigo-400' : 'text-slate-600'} />
                        <span className={`text-sm font-bold tabular-nums ${member.active_prs > 0 ? 'text-slate-100' : 'text-slate-600'}`}>
                          {member.active_prs}
                        </span>
                      </div>
                    </td>

                    {/* Tickets In Progress */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className={`text-sm font-bold tabular-nums ${member.tickets_in_progress > 0 ? 'text-slate-100' : 'text-slate-600'}`}>
                          {member.tickets_in_progress}
                        </span>
                      </div>
                    </td>

                    {/* Last Commit */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className={isSilentWithTickets ? 'text-amber-500' : 'text-slate-600'} />
                        <span className={`text-sm ${isSilentWithTickets ? 'text-amber-400 font-semibold' : 'text-slate-400'}`}>
                          {commitLabel}
                        </span>
                        {isSilentWithTickets && (
                          <AlertTriangle size={11} className="text-amber-500" />
                        )}
                      </div>
                    </td>

                    {/* Commits/week */}
                    <td className="px-4 py-3 text-center">
                      {vel ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-sm font-bold tabular-nums text-slate-100">{vel.commits_this_week}</span>
                          {vel.change_pct !== null && (
                            <div className="flex items-center gap-0.5">
                              {vel.change_pct >= 0
                                ? <TrendingUp size={9} className="text-emerald-400" />
                                : <TrendingDown size={9} className="text-red-400" />
                              }
                              <span className={`text-[10px] font-semibold ${vel.change_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {vel.change_pct > 0 ? '+' : ''}{vel.change_pct}%
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-700 text-xs">—</span>
                      )}
                    </td>

                    {/* Sprint Status */}
                    <td className="px-4 py-3">
                      {member.sprint_status ? (
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${SPRINT_BADGE[member.sprint_status]}`}>
                          {member.sprint_status === 'at_risk' ? '⚠ At Risk' : '✓ On Track'}
                        </span>
                      ) : (
                        <span className="text-slate-700 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
