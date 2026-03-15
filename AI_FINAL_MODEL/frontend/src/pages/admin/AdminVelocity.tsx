// PHASE2_DISABLED — AdminVelocity. Re-enable with PHASE2_ENABLED=true.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from '../../config/axios';
import { Clock, Users, GitPullRequest, TrendingDown, AlertTriangle } from 'lucide-react';

function StatCard({ label, value, sub, color = 'text-white' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-5">
      <p className="text-slate-500 text-xs mb-2">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-slate-600 text-xs mt-1">{sub}</p>}
    </div>
  );
}

function HoursLabel({ hours }: { hours: number | null }) {
  if (hours === null || isNaN(hours)) return <span className="text-slate-600">—</span>;
  if (hours < 1)  return <span className="text-green-400 font-semibold">{Math.round(hours * 60)}m</span>;
  if (hours < 24) return <span className={`font-semibold ${hours > 8 ? 'text-orange-400' : 'text-yellow-400'}`}>{hours}h</span>;
  const days = (hours / 24).toFixed(1);
  return <span className="text-red-400 font-semibold">{days}d</span>;
}

function SpeedBar({ hours, maxHours }: { hours: number | null; maxHours: number }) {
  if (!hours || !maxHours) return <div className="h-1.5 bg-slate-800 rounded-full w-full" />;
  const pct = Math.min((hours / maxHours) * 100, 100);
  const color = hours > 24 ? 'bg-red-500' : hours > 8 ? 'bg-orange-400' : hours > 2 ? 'bg-yellow-400' : 'bg-green-400';
  return (
    <div className="h-1.5 bg-slate-800 rounded-full w-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

const PERIODS = [
  { label: '30d', value: 30 },
  { label: '60d', value: 60 },
  { label: '90d', value: 90 },
];

export default function AdminVelocity() {
  const [days, setDays] = useState(90);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['velocity', days],
    queryFn: () => axios.get('/api/admin/velocity', { params: { days } }).then(r => r.data),
    staleTime: 5 * 60_000,
  });

  const summary     = data?.summary     ?? {};
  const perRepo     = data?.per_repo    ?? [];
  const perReviewer = data?.per_reviewer ?? [];

  const avgReview  = Number(summary.avg_hours_to_review  ?? 0) || null;
  const avgMerge   = Number(summary.avg_hours_to_merge   ?? 0) || null;
  const totalPRs   = Number(summary.total_prs            ?? 0);
  const prsWithReview = Number(summary.prs_with_review   ?? 0);
  const reviewRate = totalPRs > 0 ? Math.round((prsWithReview / totalPRs) * 100) : 0;

  const maxRepoHours  = Math.max(...perRepo.map((r: any)     => Number(r.avg_hours_to_review || 0)), 1);
  const maxReviewHours = Math.max(...perReviewer.map((r: any) => Number(r.avg_hours_to_review || 0)), 1);

  const noVelocityData = !isLoading && !isError && prsWithReview === 0;

  return (
    <div className="max-w-5xl fade-in space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Clock size={20} className="text-blue-400" />
            Review Velocity
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            How fast are PRs reviewed and merged — and who are the bottlenecks.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-[#0d1424] border border-slate-800 rounded-lg p-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setDays(p.value)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                days === p.value
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Avg Time to First Review"
          value={avgReview ? (avgReview < 1 ? `${Math.round(avgReview * 60)}m` : avgReview < 24 ? `${avgReview}h` : `${(avgReview / 24).toFixed(1)}d`) : '—'}
          sub={`last ${days} days`}
          color={avgReview ? (avgReview > 24 ? 'text-red-400' : avgReview > 8 ? 'text-orange-400' : 'text-green-400') : 'text-slate-500'}
        />
        <StatCard
          label="Avg Time to Merge"
          value={avgMerge ? (avgMerge < 1 ? `${Math.round(avgMerge * 60)}m` : avgMerge < 24 ? `${avgMerge}h` : `${(avgMerge / 24).toFixed(1)}d`) : '—'}
          sub="open → merged"
          color={avgMerge ? (avgMerge > 72 ? 'text-red-400' : avgMerge > 24 ? 'text-orange-400' : 'text-green-400') : 'text-slate-500'}
        />
        <StatCard
          label="PRs Analyzed"
          value={totalPRs.toLocaleString()}
          sub={`${days}-day window`}
        />
        <StatCard
          label="Review Capture Rate"
          value={`${reviewRate}%`}
          sub="PRs with review timestamps"
          color={reviewRate < 50 ? 'text-yellow-400' : 'text-green-400'}
        />
      </div>

      {noVelocityData ? (
        <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-10 text-center space-y-3">
          <Clock size={32} className="text-slate-700 mx-auto" />
          <p className="text-slate-400 font-medium">No review timing data yet</p>
          <p className="text-slate-600 text-sm max-w-md mx-auto">
            Velocity data is captured as new PRs are reviewed and merged going forward.
            Open a PR in a connected repo and have it reviewed to start seeing data.
          </p>
          {totalPRs > 0 && (
            <p className="text-slate-700 text-xs">
              {totalPRs} PRs analyzed — but none have review timestamps captured yet.
              Review timestamps are captured from GitHub webhook events.
            </p>
          )}
        </div>
      ) : isLoading ? (
        <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-10 text-center text-slate-600">Loading…</div>
      ) : isError ? (
        <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-10 text-center text-red-400">Failed to load velocity data.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Per Repo */}
          <div className="bg-[#0d1424] border border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-800/80">
              <GitPullRequest size={14} className="text-indigo-400" />
              <h2 className="text-white font-semibold text-sm">By Repository</h2>
              <span className="text-slate-600 text-xs ml-auto">avg hours to first review</span>
            </div>
            <div className="divide-y divide-slate-800/50">
              {perRepo.map((r: any, i: number) => {
                const hrs  = Number(r.avg_hours_to_review) || null;
                const mrs  = Number(r.avg_hours_to_merge)  || null;
                const name = r.repo_name?.split('/')[1] ?? r.repo_name;
                return (
                  <div key={i} className="px-5 py-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-slate-200 text-sm font-medium truncate">{name}</p>
                        <p className="text-slate-600 text-[10px]">{r.total_prs ?? 0} PRs · {r.prs_reviewed ?? 0} reviewed</p>
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className="text-slate-600 text-[10px]">review</span>
                          <HoursLabel hours={hrs} />
                        </div>
                        {mrs && (
                          <div className="flex items-center gap-1.5 justify-end">
                            <span className="text-slate-700 text-[10px]">merge</span>
                            <span className="text-slate-500 text-xs">{mrs < 24 ? `${mrs}h` : `${(mrs / 24).toFixed(1)}d`}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <SpeedBar hours={hrs} maxHours={maxRepoHours} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per Reviewer */}
          <div className="bg-[#0d1424] border border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-800/80">
              <Users size={14} className="text-green-400" />
              <h2 className="text-white font-semibold text-sm">By Reviewer</h2>
              <span className="text-slate-600 text-xs ml-auto">fastest → slowest</span>
            </div>

            {perReviewer.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-600 text-sm">
                No reviewer data yet. Timestamps captured as PRs are reviewed.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/50">
                {perReviewer.map((r: any, i: number) => {
                  const hrs = Number(r.avg_hours_to_review) || null;
                  const isBottleneck = hrs !== null && hrs > 24;
                  return (
                    <div key={i} className="px-5 py-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={`https://github.com/${r.first_reviewer_login}.png?size=24`}
                            className="w-6 h-6 rounded-full ring-1 ring-slate-700 shrink-0"
                            alt=""
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-slate-200 text-sm font-medium truncate">{r.first_reviewer_login}</p>
                              {isBottleneck && (
                                <AlertTriangle size={11} className="text-orange-400 shrink-0" />
                              )}
                            </div>
                            <p className="text-slate-600 text-[10px]">{r.prs_reviewed} PRs reviewed</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <HoursLabel hours={hrs} />
                          <p className="text-slate-700 text-[10px]">avg to review</p>
                        </div>
                      </div>
                      <SpeedBar hours={hrs} maxHours={maxReviewHours} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottleneck callout */}
            {perReviewer.some((r: any) => Number(r.avg_hours_to_review) > 24) && (
              <div className="mx-4 mb-4 mt-1 flex items-start gap-2 p-3 bg-orange-500/5 border border-orange-500/15 rounded-lg">
                <TrendingDown size={13} className="text-orange-400 shrink-0 mt-0.5" />
                <p className="text-orange-300/80 text-xs">
                  Reviewers with &gt;24h avg response are bottlenecks. Consider distributing review load.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
