// EngineeringOS Phase 1.5 — Daily Brief Dashboard
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../config/axios';
import {
  AlertTriangle, CheckCircle, Eye, Clock, RefreshCw,
  ChevronDown, ChevronUp, TrendingUp, Zap, Calendar,
  ArrowRight, Activity, TrendingDown,
} from 'lucide-react';

interface BriefItem {
  id: string;
  pattern_type: 'stale_pr' | 'silent_engineer' | 'sprint_slip' | 'no_reviewer';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  action_suggestion: string;
  is_acknowledged: boolean;
  is_dismissed: boolean;
  snoozed_until: string | null;
}

interface Brief {
  id: string;
  brief_date: string;
  content_raw: string;
  pattern_count: number;
  severity_high: number;
  severity_medium: number;
  sent_at: string | null;
  items: BriefItem[];
}

const SEVERITY_CONFIG = {
  HIGH:   { color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',       dot: 'bg-red-500',    label: 'High' },
  MEDIUM: { color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20',   dot: 'bg-amber-500',  label: 'Medium' },
  LOW:    { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-500', label: 'Low' },
};

const PATTERN_META: Record<string, { label: string; icon: string }> = {
  stale_pr:        { label: 'Stale PR',        icon: '⏳' },
  silent_engineer: { label: 'Silent Engineer',  icon: '🔇' },
  sprint_slip:     { label: 'Sprint Risk',      icon: '🏃' },
  no_reviewer:     { label: 'No Reviewer',      icon: '👁️' },
};

interface SprintHealth {
  sprint_id: string;
  sprint_name: string;
  project_key: string;
  score: number;
  bucket: 'HEALTHY' | 'AT_RISK' | 'CRITICAL';
  days_remaining: number;
  completion_pct: number;
  total_tickets: number;
  completed_tickets: number;
}

interface VelocityData {
  team: {
    prs_merged_this_week: number;
    prs_merged_change_pct: number | null;
    avg_merge_hours: number | null;
    velocity_points_current: number;
    velocity_change_pct: number | null;
  };
}

const BUCKET_STYLE = {
  HEALTHY:  { border: 'border-emerald-500/30', bg: 'bg-emerald-500/8',  text: 'text-emerald-400', bar: 'bg-emerald-500', label: '✓ Healthy' },
  AT_RISK:  { border: 'border-amber-500/30',   bg: 'bg-amber-500/8',    text: 'text-amber-400',   bar: 'bg-amber-500',   label: '⚠ At Risk' },
  CRITICAL: { border: 'border-red-500/30',     bg: 'bg-red-500/8',      text: 'text-red-400',     bar: 'bg-red-500',     label: '✕ Critical' },
};

function SprintCard({ sprint }: { sprint: SprintHealth }) {
  const s = BUCKET_STYLE[sprint.bucket];
  return (
    <div className={`rounded-xl border ${s.border} ${s.bg} p-4 space-y-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-slate-200 text-sm font-semibold truncate">{sprint.sprint_name}</p>
          <p className="text-slate-500 text-xs">{sprint.project_key}</p>
        </div>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border shrink-0 ${s.border} ${s.text}`}>
          {s.label}
        </span>
      </div>
      {/* Score bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-500">Health Score</span>
          <span className={`font-bold ${s.text}`}>{sprint.score}/100</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full ${s.bar} rounded-full transition-all`} style={{ width: `${sprint.score}%` }} />
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{sprint.completed_tickets}/{sprint.total_tickets} tickets done</span>
        <span>{sprint.days_remaining}d left</span>
      </div>
    </div>
  );
}

function SprintHealthSection() {
  const { data: sprints = [], isLoading } = useQuery<SprintHealth[]>({
    queryKey: ['sprint-health'],
    queryFn: () => axios.get('/api/analytics/sprints/health').then(r => r.data),
    refetchInterval: 120_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 flex items-center gap-1.5">
          <Activity size={10} /> Sprint Health
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map(i => <div key={i} className="h-28 bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (sprints.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 flex items-center gap-1.5">
        <Activity size={10} /> Active Sprints
      </p>
      <div className={`grid gap-3 ${sprints.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {sprints.map(s => <SprintCard key={s.sprint_id} sprint={s} />)}
      </div>
    </div>
  );
}

function WeekStatsBar() {
  const { data: velocity } = useQuery<VelocityData>({
    queryKey: ['velocity'],
    queryFn: () => axios.get('/api/analytics/velocity').then(r => r.data),
    staleTime: 300_000,
  });

  const prs     = velocity?.team.prs_merged_this_week ?? 0;
  const prsPct  = velocity?.team.prs_merged_change_pct;
  const hours   = velocity?.team.avg_merge_hours;
  const velPct  = velocity?.team.velocity_change_pct;

  const trendIcon = (pct: number | null | undefined) => {
    if (pct == null) return null;
    return pct >= 0
      ? <TrendingUp size={11} className="text-emerald-400" />
      : <TrendingDown size={11} className="text-red-400" />;
  };
  const trendText = (pct: number | null | undefined) => {
    if (pct == null) return null;
    return <span className={`text-xs font-semibold ${pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{pct > 0 ? '+' : ''}{pct}%</span>;
  };

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity size={14} className="text-indigo-400" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">PRs Merged</p>
        </div>
        <div className="flex items-end gap-1.5">
          <p className="text-2xl font-bold text-white">{prs}</p>
          {trendIcon(prsPct)}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {trendText(prsPct)}
          <p className="text-slate-600 text-xs">this week</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock size={14} className="text-slate-500" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Avg Merge</p>
        </div>
        <p className="text-2xl font-bold text-white">{hours != null ? `${hours}h` : '—'}</p>
        <p className="text-slate-600 text-xs mt-0.5">review → merge time</p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap size={14} className="text-indigo-400" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Velocity</p>
        </div>
        <div className="flex items-end gap-1.5">
          <p className="text-2xl font-bold text-white">{velocity?.team.velocity_points_current ?? '—'}</p>
          {trendIcon(velPct)}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {trendText(velPct)}
          <p className="text-slate-600 text-xs">vs 3-sprint avg</p>
        </div>
      </div>
    </div>
  );
}

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-800 rounded ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonPulse className="h-6 w-32" />
          <SkeletonPulse className="h-4 w-56" />
        </div>
        <SkeletonPulse className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => <SkeletonPulse key={i} className="h-20 rounded-xl" />)}
      </div>
      <SkeletonPulse className="h-40 rounded-xl" />
      <SkeletonPulse className="h-28 rounded-xl" />
    </div>
  );
}

function BriefItemCard({ item }: { item: BriefItem }) {
  const qc = useQueryClient();
  const cfg = SEVERITY_CONFIG[item.severity];
  const meta = PATTERN_META[item.pattern_type] ?? { label: item.pattern_type, icon: '•' };

  const mutate = useMutation({
    mutationFn: (action: string) => axios.post(`/api/briefs/items/${item.id}/${action}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brief-today'] });
      qc.invalidateQueries({ queryKey: ['brief-history'] });
    },
  });

  if (item.is_dismissed) return null;
  if (item.snoozed_until && new Date(item.snoozed_until) > new Date()) return null;

  return (
    <div className={`rounded-lg border p-4 transition-opacity ${cfg.bg} ${item.is_acknowledged ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base leading-none">{meta.icon}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-800/70 border border-slate-700/60 rounded px-1.5 py-0.5">
              {meta.label}
            </span>
            <div className={`flex items-center gap-1 ${cfg.color}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              <span className="text-[10px] font-bold uppercase tracking-wide">{cfg.label}</span>
            </div>
            {item.is_acknowledged && (
              <span className="text-[10px] text-slate-500 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5">Acknowledged</span>
            )}
          </div>
          <p className="text-slate-100 text-sm font-semibold leading-snug">{item.title}</p>
          <p className="text-slate-400 text-xs leading-relaxed">{item.description}</p>
          <p className="text-slate-500 text-xs italic">→ {item.action_suggestion}</p>
        </div>

        {!item.is_acknowledged && (
          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              onClick={() => mutate.mutate('acknowledge')}
              disabled={mutate.isPending}
              title="Acknowledge"
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors disabled:opacity-50"
            >
              <CheckCircle size={11} /> Ack
            </button>
            <button
              onClick={() => mutate.mutate('snooze')}
              disabled={mutate.isPending}
              title="Snooze until tomorrow 8am"
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors disabled:opacity-50"
            >
              <Clock size={11} /> Snooze
            </button>
            <button
              onClick={() => mutate.mutate('dismiss')}
              disabled={mutate.isPending}
              title="Dismiss permanently"
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-slate-800/50 hover:bg-slate-800 text-slate-500 hover:text-slate-400 border border-slate-800 transition-colors disabled:opacity-50"
            >
              <Eye size={11} /> Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function BriefCard({ brief, isExpanded, onToggle, isToday = false }: {
  brief: Brief; isExpanded: boolean; onToggle: () => void; isToday?: boolean;
}) {
  const activeItems = (brief.items ?? []).filter(
    i => !i.is_dismissed && (!i.snoozed_until || new Date(i.snoozed_until) <= new Date())
  );
  const highCount   = activeItems.filter(i => i.severity === 'HIGH').length;
  const mediumCount = activeItems.filter(i => i.severity === 'MEDIUM').length;

  const statusKey = highCount > 0 ? 'danger' : activeItems.length > 0 ? 'warn' : 'healthy';
  const statusMap = {
    danger:  { border: 'border-red-500/30',    header: 'bg-red-500/10',    text: 'text-red-400',    label: 'NEEDS ATTENTION' },
    warn:    { border: 'border-amber-500/30',  header: 'bg-amber-500/10',  text: 'text-amber-400',  label: 'WATCH' },
    healthy: { border: 'border-emerald-500/30', header: 'bg-emerald-500/10', text: 'text-emerald-400', label: '✓ HEALTHY' },
  };
  const s = statusMap[statusKey];

  const dateLabel = new Date(brief.brief_date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  });

  return (
    <div className={`rounded-xl border ${s.border} overflow-hidden transition-shadow hover:shadow-lg hover:shadow-black/20`}>
      <button
        onClick={onToggle}
        className={`w-full text-left p-4 flex items-center justify-between transition-colors ${s.header} hover:brightness-110`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${s.text}`}>{s.label}</span>
              {isToday && (
                <span className="text-[10px] bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded px-1.5 py-0.5 font-semibold">Today</span>
              )}
              {highCount > 0 && (
                <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 rounded px-1.5 py-0.5 font-semibold">
                  {highCount} HIGH
                </span>
              )}
              {mediumCount > 0 && highCount === 0 && (
                <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5 font-semibold">
                  {mediumCount} MEDIUM
                </span>
              )}
            </div>
            <p className="text-slate-300 text-sm font-medium mt-0.5">{dateLabel}</p>
            {brief.pattern_count > 0 && (
              <p className="text-slate-500 text-xs mt-0.5">
                {brief.pattern_count} pattern{brief.pattern_count !== 1 ? 's' : ''} detected
              </p>
            )}
          </div>
        </div>
        {isExpanded
          ? <ChevronUp size={15} className="text-slate-500 shrink-0" />
          : <ChevronDown size={15} className="text-slate-500 shrink-0" />
        }
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-4 border-t border-white/5 space-y-3 bg-[#0d1117]/80">
          {brief.content_raw && (
            <div className="bg-slate-900/60 rounded-lg p-3.5 border border-slate-800/60">
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{brief.content_raw}</p>
            </div>
          )}
          {activeItems.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Action Items</p>
              {activeItems.map(item => <BriefItemCard key={item.id} item={item} />)}
            </div>
          ) : (
            <div className="text-center py-6">
              <CheckCircle size={24} className="text-emerald-500 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">All items resolved</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatsBar({ briefs }: { briefs: Brief[] }) {
  const last7 = briefs.slice(0, 7);
  const totalPatterns = last7.reduce((s, b) => s + (b.pattern_count ?? 0), 0);
  const highSeverity  = last7.reduce((s, b) => s + (b.severity_high ?? 0), 0);
  const healthyDays   = last7.filter(b => (b.severity_high ?? 0) === 0 && (b.pattern_count ?? 0) === 0).length;

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={14} className="text-slate-500" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">7-Day Patterns</p>
        </div>
        <p className="text-2xl font-bold text-white">{totalPatterns}</p>
        <p className="text-slate-600 text-xs mt-0.5">patterns detected</p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={14} className="text-red-500/70" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">High Severity</p>
        </div>
        <p className={`text-2xl font-bold ${highSeverity > 0 ? 'text-red-400' : 'text-white'}`}>{highSeverity}</p>
        <p className="text-slate-600 text-xs mt-0.5">issues needing action</p>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle size={14} className="text-emerald-500/70" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Healthy Days</p>
        </div>
        <p className={`text-2xl font-bold ${healthyDays >= 5 ? 'text-emerald-400' : 'text-white'}`}>{healthyDays}</p>
        <p className="text-slate-600 text-xs mt-0.5">of last 7 days</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [expandedId, setExpandedId] = useState<string | null>('today');
  const qc = useQueryClient();

  const { data: todayBrief, isLoading: todayLoading } = useQuery<Brief>({
    queryKey: ['brief-today'],
    queryFn: () => axios.get('/api/briefs/today').then(r => r.data),
    retry: false,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery<Brief[]>({
    queryKey: ['brief-history'],
    queryFn: () => axios.get('/api/briefs/history?limit=7').then(r => r.data),
    retry: false,
  });

  const previewMutation = useMutation({
    mutationFn: () => axios.post('/api/briefs/preview'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brief-today'] });
      qc.invalidateQueries({ queryKey: ['brief-history'] });
    },
  });

  if (todayLoading || historyLoading) return <LoadingSkeleton />;

  const pastBriefs = history.filter(b => b.id !== todayBrief?.id);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap size={18} className="text-indigo-400" />
            <h1 className="text-white text-xl font-bold">Daily Brief</h1>
          </div>
          <p className="text-slate-500 text-sm">
            AI-generated engineering intelligence · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => previewMutation.mutate()}
          disabled={previewMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-400 border border-indigo-500/25 text-sm font-semibold transition-colors disabled:opacity-50 shrink-0"
        >
          <RefreshCw size={13} className={previewMutation.isPending ? 'animate-spin' : ''} />
          {previewMutation.isPending ? 'Generating…' : 'Generate Now'}
        </button>
      </div>

      {/* Sprint health cards */}
      <SprintHealthSection />

      {/* This-week velocity stats */}
      <WeekStatsBar />

      {/* 7-day pattern stats */}
      {history.length > 0 && <StatsBar briefs={history} />}

      {/* Today's brief */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2 flex items-center gap-1.5">
          <Calendar size={10} /> Today
        </p>

        {todayBrief ? (
          <BriefCard
            brief={todayBrief}
            isExpanded={expandedId === 'today'}
            onToggle={() => setExpandedId(expandedId === 'today' ? null : 'today')}
            isToday
          />
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
              <Clock size={20} className="text-slate-500" />
            </div>
            <p className="text-slate-300 font-semibold mb-1">No brief yet today</p>
            <p className="text-slate-600 text-sm mb-4">
              Briefs are generated automatically at your configured delivery time.
            </p>
            <button
              onClick={() => previewMutation.mutate()}
              disabled={previewMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {previewMutation.isPending
                ? <><RefreshCw size={13} className="animate-spin" /> Generating…</>
                : <><Zap size={13} /> Generate from last 7 days</>
              }
            </button>
          </div>
        )}
      </div>

      {/* Past briefs */}
      {pastBriefs.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2 flex items-center gap-1.5">
            <TrendingUp size={10} /> Past 7 Days
          </p>
          <div className="space-y-2.5">
            {pastBriefs.map(brief => (
              <BriefCard
                key={brief.id}
                brief={brief}
                isExpanded={expandedId === brief.id}
                onToggle={() => setExpandedId(expandedId === brief.id ? null : brief.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty history state */}
      {!todayBrief && pastBriefs.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-800 p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
            <Zap size={24} className="text-indigo-400" />
          </div>
          <p className="text-slate-300 font-semibold text-base mb-1">No briefs yet</p>
          <p className="text-slate-600 text-sm mb-5 max-w-sm mx-auto">
            Complete the onboarding flow to connect GitHub and Jira, then generate your first brief.
          </p>
          <a
            href="/onboarding"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
          >
            Start Onboarding <ArrowRight size={13} />
          </a>
        </div>
      )}
    </div>
  );
}
