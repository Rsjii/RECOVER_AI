// EngineeringOS Phase 1.5 — Weekly Engineering Health Reports
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../config/axios';
import {
  BarChart2, ChevronDown, ChevronUp, RefreshCw,
  TrendingUp, TrendingDown, Clock, AlertTriangle, CheckCircle,
  GitPullRequest, Users, Zap, Calendar,
} from 'lucide-react';

interface WeeklyReport {
  id: string;
  week_start: string;
  week_end: string;
  content_raw: string;
  metrics: {
    prs_merged: number;
    prs_merged_change_pct: number | null;
    avg_merge_hours: number | null;
    commits_total: number;
    active_engineers: number;
    patterns_detected: number;
    high_severity_count: number;
    sprint_avg_score: number | null;
    sprints_at_risk: number;
    sprints_critical: number;
    velocity_change_pct: number | null;
  };
  pattern_summary: { type: string; count: number; severity: string }[];
  sent_at: string | null;
  sent_via: string | null;
}

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-800 rounded ${className}`} />;
}

function MetricChip({
  label, value, sub, trend, icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  trend?: number | null;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold uppercase tracking-widest">
        {icon}
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-bold text-white">{value}</span>
        {trend !== null && trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      {sub && <p className="text-slate-600 text-[11px]">{sub}</p>}
    </div>
  );
}

function ReportCard({ report }: { report: WeeklyReport }) {
  const [expanded, setExpanded] = useState(false);
  const m = report.metrics;

  const weekLabel = `${new Date(report.week_start + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(report.week_end + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const healthStatus = (m.sprints_critical > 0 || m.high_severity_count > 0)
    ? { label: 'Needs Attention', color: 'text-red-400', border: 'border-red-500/30', header: 'bg-red-500/8' }
    : m.sprints_at_risk > 0
    ? { label: 'Watch', color: 'text-amber-400', border: 'border-amber-500/30', header: 'bg-amber-500/8' }
    : { label: '✓ Healthy', color: 'text-emerald-400', border: 'border-emerald-500/30', header: 'bg-emerald-500/8' };

  return (
    <div className={`rounded-xl border ${healthStatus.border} overflow-hidden`}>
      <button
        onClick={() => setExpanded(e => !e)}
        className={`w-full text-left p-4 flex items-start justify-between gap-4 transition-colors ${healthStatus.header} hover:brightness-110`}
      >
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${healthStatus.color}`}>{healthStatus.label}</span>
            {report.sent_at && (
              <span className="text-[10px] bg-slate-800 text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">
                Sent via {report.sent_via}
              </span>
            )}
          </div>
          <p className="text-slate-200 font-semibold">{weekLabel}</p>
          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
            <span>{m.prs_merged} PRs merged</span>
            <span>{m.active_engineers} engineers active</span>
            {m.high_severity_count > 0 && (
              <span className="text-red-400 font-semibold">{m.high_severity_count} high alerts</span>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp size={15} className="text-slate-500 shrink-0 mt-1" /> : <ChevronDown size={15} className="text-slate-500 shrink-0 mt-1" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-4 border-t border-white/5 space-y-4 bg-[#0d1117]/80">
          {/* Metrics grid */}
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
            <MetricChip
              label="PRs Merged" value={m.prs_merged}
              trend={m.prs_merged_change_pct} sub="this week"
              icon={<GitPullRequest size={10} />}
            />
            <MetricChip
              label="Avg Merge" value={m.avg_merge_hours != null ? `${m.avg_merge_hours}h` : '—'}
              sub="review → merge"
              icon={<Clock size={10} />}
            />
            <MetricChip
              label="Engineers" value={m.active_engineers}
              sub="commited this week"
              icon={<Users size={10} />}
            />
            <MetricChip
              label="High Alerts" value={m.high_severity_count}
              sub="high severity"
              icon={<AlertTriangle size={10} />}
            />
            {m.sprint_avg_score !== null && (
              <MetricChip
                label="Sprint Health" value={`${m.sprint_avg_score}/100`}
                sub={`${m.sprints_at_risk} at-risk · ${m.sprints_critical} critical`}
                icon={<Zap size={10} />}
              />
            )}
            {m.velocity_change_pct !== null && (
              <MetricChip
                label="Velocity" value="trend"
                trend={m.velocity_change_pct}
                sub="vs 3-sprint avg"
                icon={<TrendingUp size={10} />}
              />
            )}
          </div>

          {/* AI analysis */}
          {report.content_raw && (
            <div className="bg-slate-900/60 rounded-lg p-3.5 border border-slate-800/60">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2">Analysis</p>
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{report.content_raw}</p>
            </div>
          )}

          {/* Pattern breakdown */}
          {report.pattern_summary.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2">Pattern Breakdown</p>
              <div className="flex flex-wrap gap-2">
                {report.pattern_summary.map((p, i) => (
                  <span key={i} className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                    p.severity === 'HIGH' ? 'text-red-400 border-red-500/20 bg-red-500/10' :
                    p.severity === 'MEDIUM' ? 'text-amber-400 border-amber-500/20 bg-amber-500/10' :
                    'text-slate-400 border-slate-700 bg-slate-800'
                  }`}>
                    {p.type.replace(/_/g, ' ')} ×{p.count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Reports() {
  const qc = useQueryClient();

  const { data: reports = [], isLoading } = useQuery<WeeklyReport[]>({
    queryKey: ['weekly-reports'],
    queryFn: () => axios.get('/api/reports/weekly?limit=12').then(r => r.data),
  });

  const preview = useMutation({
    mutationFn: () => axios.post('/api/reports/weekly/preview'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['weekly-reports'] }),
  });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 size={18} className="text-indigo-400" />
            <h1 className="text-white text-xl font-bold">Weekly Reports</h1>
          </div>
          <p className="text-slate-500 text-sm">
            Friday engineering health summaries · generated by AI
          </p>
        </div>
        <button
          onClick={() => preview.mutate()}
          disabled={preview.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-400 border border-indigo-500/25 text-sm font-semibold transition-colors disabled:opacity-50 shrink-0"
        >
          <RefreshCw size={13} className={preview.isPending ? 'animate-spin' : ''} />
          {preview.isPending ? 'Generating…' : 'Preview This Week'}
        </button>
      </div>

      {preview.isSuccess && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 flex items-center gap-2">
          <CheckCircle size={14} className="text-emerald-400 shrink-0" />
          <p className="text-emerald-300 text-sm">Preview generated and saved.</p>
        </div>
      )}

      {/* Report list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <SkeletonPulse key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
            <BarChart2 size={24} className="text-indigo-400" />
          </div>
          <p className="text-slate-300 font-semibold mb-1">No weekly reports yet</p>
          <p className="text-slate-600 text-sm mb-4 max-w-sm mx-auto">
            Reports are auto-generated every Friday at 5 PM in your configured timezone. Click "Preview This Week" to generate one now.
          </p>
          <button
            onClick={() => preview.mutate()}
            disabled={preview.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {preview.isPending
              ? <><RefreshCw size={13} className="animate-spin" /> Generating…</>
              : <><Calendar size={13} /> Generate This Week's Report</>
            }
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => <ReportCard key={r.id} report={r} />)}
        </div>
      )}
    </div>
  );
}
