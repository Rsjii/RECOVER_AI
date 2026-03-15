// PHASE2_DISABLED — AdminCodeQuality. Re-enable with PHASE2_ENABLED=true.
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import axios from '../../config/axios';
import {
  BarChart2, AlertTriangle, TrendingUp, FileCode,
  RefreshCw, Zap, ChevronDown,
} from 'lucide-react';

// ── Pure SVG trend chart ──────────────────────────────────────────────────────
function QualityTrendChart({
  data,
}: {
  data: Array<{ month: string; avg_complexity: number; total_loc: number }>;
}) {
  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-700 text-sm">
        Not enough data yet — check back after next month's snapshot.
      </div>
    );
  }

  const W = 600; const H = 160; const PAD = { t: 16, r: 24, b: 32, l: 44 };
  const gW = W - PAD.l - PAD.r;
  const gH = H - PAD.t - PAD.b;

  const complexities = data.map(d => d.avg_complexity);
  const maxC = Math.max(...complexities, 1);
  const minC = Math.min(...complexities);
  const range = maxC - minC || 1;

  const pts = data.map((d, i) => ({
    x: PAD.l + (i / (data.length - 1)) * gW,
    y: PAD.t + gH - ((d.avg_complexity - minC) / range) * gH,
    d,
  }));

  const pathD = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  const areaD = [
    `M${pts[0].x.toFixed(1)},${(PAD.t + gH).toFixed(1)}`,
    ...pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `L${pts[pts.length - 1].x.toFixed(1)},${(PAD.t + gH).toFixed(1)}Z`,
  ].join(' ');

  const yTicks = 4;
  const isRising = complexities[complexities.length - 1] > complexities[0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
      <defs>
        <linearGradient id="cqGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isRising ? '#f97316' : '#6366f1'} stopOpacity="0.25" />
          <stop offset="100%" stopColor={isRising ? '#f97316' : '#6366f1'} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Y grid + labels */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const y = PAD.t + (i / yTicks) * gH;
        const val = (maxC - (i / yTicks) * range).toFixed(1);
        return (
          <g key={i}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#1e293b" strokeWidth={1} />
            <text x={PAD.l - 6} y={y + 4} textAnchor="end" fontSize={9} fill="#475569">{val}</text>
          </g>
        );
      })}

      {/* Area + line */}
      <path d={areaD} fill="url(#cqGrad)" />
      <path d={pathD} fill="none" stroke={isRising ? '#f97316' : '#6366f1'} strokeWidth={2} strokeLinejoin="round" />

      {/* Dots */}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill={isRising ? '#f97316' : '#6366f1'} />
      ))}

      {/* X labels */}
      {pts.map((p, i) => (
        <text key={i} x={p.x} y={H - 6} textAnchor="middle" fontSize={9} fill="#475569">
          {p.d.month?.slice(0, 7) || ''}
        </text>
      ))}
    </svg>
  );
}

// ── Language tag ──────────────────────────────────────────────────────────────
function LangBadge({ lang }: { lang?: string }) {
  if (!lang) return null;
  return (
    <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded font-mono">
      {lang}
    </span>
  );
}

// ── Complexity colour ─────────────────────────────────────────────────────────
function complexityColor(c: number) {
  if (c >= 50) return 'text-red-400';
  if (c >= 20) return 'text-orange-400';
  if (c >= 10) return 'text-yellow-400';
  return 'text-green-400';
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminCodeQuality() {
  const [tab,          setTab]          = useState<'growing' | 'complex' | 'refactor' | 'trend'>('growing');
  const [selectedRepo, setSelectedRepo] = useState<string>('all');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['code-quality', selectedRepo],
    queryFn: () =>
      axios.get(`/api/admin/code-quality${selectedRepo !== 'all' ? `?repo_id=${selectedRepo}` : ''}`)
           .then(r => r.data),
    staleTime: 10 * 60_000,
  });

  const cardCls = 'bg-[#0d1424] border border-slate-800 rounded-xl p-5';
  const tabCls  = (t: string) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      tab === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
    }`;

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="text-2xl font-bold text-white">Code Quality</h1>
      {[1,2,3].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}
    </div>
  );

  // ── Error ─────────────────────────────────────────────────────────────────
  if (isError || !data) return (
    <div className="max-w-5xl space-y-6 fade-in">
      <h1 className="text-2xl font-bold text-white">Code Quality</h1>
      <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-8 text-center">
        <AlertTriangle size={28} className="text-red-400 mx-auto mb-3" />
        <p className="text-slate-200 font-medium mb-2">Failed to load code quality data</p>
        <p className="text-slate-500 text-sm mb-5">Make sure at least one repository is indexed.</p>
        <button onClick={() => refetch()} className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm">
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    </div>
  );

  // ── No data yet ───────────────────────────────────────────────────────────
  if (!data.has_data) return (
    <div className="max-w-5xl space-y-6 fade-in">
      <h1 className="text-2xl font-bold text-white">Code Quality</h1>
      <div className="border border-dashed border-slate-800 rounded-xl p-12 text-center">
        <BarChart2 size={36} className="text-slate-700 mx-auto mb-4" />
        <p className="text-slate-300 font-medium mb-2">No quality data yet</p>
        <p className="text-slate-600 text-sm max-w-sm mx-auto">
          Code quality metrics are computed when you index a repository.
          Add and index a repo to start tracking complexity trends.
        </p>
      </div>
    </div>
  );

  const { summary, top_growing, complex_files, refactor_candidates, history, repos, alerts } = data;

  return (
    <div className="max-w-5xl fade-in space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart2 size={22} className="text-indigo-400" />
            Code Quality
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Complexity trends, growing files, and refactor candidates across your codebase
          </p>
        </div>

        {/* Repo selector */}
        {repos?.length > 1 && (
          <div className="relative shrink-0">
            <select
              value={selectedRepo}
              onChange={e => setSelectedRepo(e.target.value)}
              className="appearance-none bg-[#0d1424] border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2 pr-8 focus:outline-none focus:border-indigo-500/50 cursor-pointer"
            >
              <option value="all">All repositories</option>
              {repos.map((r: any) => (
                <option key={r.id} value={r.id}>{r.full_name}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Alert banner */}
      {alerts?.length > 0 && (
        <div className="bg-orange-500/8 border border-orange-500/20 rounded-xl px-5 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-orange-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              {alerts.map((a: string, i: number) => (
                <p key={i} className="text-orange-300 text-sm">{a}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Avg Complexity',
            value: summary.avg_complexity?.toFixed(1) ?? '—',
            icon:  <Zap size={16} />,
            color: summary.avg_complexity >= 20 ? 'text-orange-400' : summary.avg_complexity >= 10 ? 'text-yellow-400' : 'text-green-400',
            note:  summary.avg_complexity >= 20 ? 'High — review needed' : summary.avg_complexity >= 10 ? 'Moderate' : 'Healthy',
          },
          {
            label: 'Total Files',
            value: summary.total_files?.toLocaleString() ?? '—',
            icon:  <FileCode size={16} />,
            color: 'text-slate-400',
            note:  `${(summary.total_loc || 0).toLocaleString()} lines of code`,
          },
          {
            label: 'Files > 500 LOC',
            value: summary.files_over_500_loc ?? '—',
            icon:  <TrendingUp size={16} />,
            color: summary.files_over_500_loc > 20 ? 'text-red-400' : summary.files_over_500_loc > 5 ? 'text-orange-400' : 'text-slate-400',
            note:  'Consider splitting these',
          },
          {
            label: 'Complexity > 50',
            value: summary.files_over_complexity_50 ?? '—',
            icon:  <AlertTriangle size={16} />,
            color: summary.files_over_complexity_50 > 0 ? 'text-red-400' : 'text-green-400',
            note:  summary.files_over_complexity_50 > 0 ? 'Urgent refactor candidates' : 'None — great!',
          },
        ].map((s, i) => (
          <div key={i} className={cardCls}>
            <div className={`mb-2 ${s.color}`}>{s.icon}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-slate-500 text-xs mt-1">{s.label}</div>
            <div className="text-slate-600 text-xs mt-0.5">{s.note}</div>
          </div>
        ))}
      </div>

      {/* Trend summary */}
      {summary.complexity_trend && (
        <div className={`${cardCls} flex items-center gap-4`}>
          <TrendingUp size={16} className={
            parseFloat(summary.complexity_trend) > 0 ? 'text-orange-400' : 'text-green-400'
          } />
          <p className="text-slate-400 text-sm">
            Average complexity has{' '}
            <span className={parseFloat(summary.complexity_trend) > 0 ? 'text-orange-400 font-semibold' : 'text-green-400 font-semibold'}>
              {parseFloat(summary.complexity_trend) > 0 ? `increased by ${summary.complexity_trend}` : `decreased by ${Math.abs(parseFloat(summary.complexity_trend))}`}
            </span>
            {' '}points over the past 3 months.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[#0d1424] border border-slate-800 rounded-xl p-1 w-fit flex-wrap">
        {[
          { id: 'growing',  label: `Growing Fast (${top_growing?.length || 0})` },
          { id: 'complex',  label: `Most Complex (${complex_files?.length || 0})` },
          { id: 'refactor', label: `Refactor (${refactor_candidates?.length || 0})` },
          { id: 'trend',    label: 'Trend' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} className={tabCls(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Growing Fast ── */}
      {tab === 'growing' && (
        <div className={cardCls}>
          <h2 className="text-white font-semibold mb-1">Fastest Growing Files</h2>
          <p className="text-slate-600 text-xs mb-4">Files that grew the most in LOC over the past 3 months</p>
          {!top_growing?.length ? (
            <p className="text-slate-600 text-sm py-6 text-center">No growth data yet. Check back after the next monthly snapshot.</p>
          ) : (
            <div className="space-y-2">
              {top_growing.map((f: any, i: number) => {
                const growthPct = f.growth_pct ?? 0;
                return (
                  <div key={i} className="flex items-center gap-4 p-3 bg-slate-900/50 rounded-lg border border-slate-800/50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-mono text-blue-400 text-xs truncate">{f.file_path}</p>
                        <LangBadge lang={f.language} />
                      </div>
                      <p className="text-slate-600 text-[10px]">{f.repo_name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-white text-sm font-semibold">{(f.loc_current || 0).toLocaleString()} LOC</p>
                      <p className={`text-xs font-medium ${growthPct > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                        {growthPct > 0 ? '+' : ''}{growthPct.toFixed(0)}% vs 3mo ago
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Most Complex ── */}
      {tab === 'complex' && (
        <div className={cardCls}>
          <h2 className="text-white font-semibold mb-1">Most Complex Files</h2>
          <p className="text-slate-600 text-xs mb-4">Ranked by cyclomatic complexity — higher means more branches/paths to test</p>
          {!complex_files?.length ? (
            <p className="text-slate-600 text-sm py-6 text-center">No complexity data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-600 text-xs uppercase tracking-wide border-b border-slate-800">
                    <th className="text-left pb-2 font-medium">File</th>
                    <th className="text-center pb-2 font-medium w-24">Complexity</th>
                    <th className="text-center pb-2 font-medium w-20">LOC</th>
                    <th className="text-center pb-2 font-medium w-20">Functions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {complex_files.map((f: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-blue-400 text-xs truncate max-w-[260px]">{f.file_path}</p>
                          <LangBadge lang={f.language} />
                        </div>
                        <p className="text-slate-700 text-[10px] mt-0.5">{f.repo_name}</p>
                      </td>
                      <td className="py-2.5 text-center">
                        <span className={`text-sm font-bold ${complexityColor(f.cyclomatic_complexity)}`}>
                          {f.cyclomatic_complexity}
                        </span>
                      </td>
                      <td className="py-2.5 text-center text-slate-400 text-xs">{(f.lines_of_code || 0).toLocaleString()}</td>
                      <td className="py-2.5 text-center text-slate-500 text-xs">{f.function_count ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Refactor Candidates ── */}
      {tab === 'refactor' && (
        <div className={cardCls}>
          <h2 className="text-white font-semibold mb-1">Refactor Candidates</h2>
          <p className="text-slate-600 text-xs mb-4">Files with high complexity AND large size — highest ROI for refactoring effort</p>
          {!refactor_candidates?.length ? (
            <div className="text-center py-8">
              <p className="text-green-400 font-medium">No urgent refactor candidates!</p>
              <p className="text-slate-600 text-sm mt-1">Your codebase complexity is well-managed.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {refactor_candidates.map((f: any, i: number) => {
                const score = f.score ?? 0;
                return (
                  <div key={i} className="p-3 bg-slate-900/50 rounded-lg border border-slate-800/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-mono text-blue-400 text-xs truncate">{f.file_path}</p>
                          <LangBadge lang={f.language} />
                        </div>
                        <p className="text-slate-600 text-[10px]">{f.repo_name}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={`text-lg font-bold ${score >= 75 ? 'text-red-400' : score >= 50 ? 'text-orange-400' : 'text-yellow-400'}`}>
                          {score}
                        </div>
                        <div className="text-slate-700 text-[10px]">refactor score</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span>Complexity: <span className={`font-medium ${complexityColor(f.cyclomatic_complexity)}`}>{f.cyclomatic_complexity}</span></span>
                      <span>LOC: <span className="text-slate-300 font-medium">{(f.lines_of_code || 0).toLocaleString()}</span></span>
                      {f.function_count && <span>Functions: <span className="text-slate-300 font-medium">{f.function_count}</span></span>}
                    </div>
                    {/* Score bar */}
                    <div className="mt-2 bg-slate-800 rounded-full h-1">
                      <div
                        className={`h-1 rounded-full ${score >= 75 ? 'bg-red-500' : score >= 50 ? 'bg-orange-500' : 'bg-yellow-500'}`}
                        style={{ width: `${Math.min(score, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Trend ── */}
      {tab === 'trend' && (
        <div className={cardCls}>
          <h2 className="text-white font-semibold mb-1">Complexity Trend</h2>
          <p className="text-slate-600 text-xs mb-4">Average cyclomatic complexity over the past 6 monthly snapshots</p>
          <QualityTrendChart data={history || []} />
          {history?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-3 gap-4 text-center">
              {[
                { label: 'Earliest', val: history[0] },
                { label: 'Latest',   val: history[history.length - 1] },
              ].map((h, i) => h.val ? (
                <div key={i}>
                  <p className="text-slate-500 text-xs">{h.label}</p>
                  <p className="text-white font-semibold">{h.val.avg_complexity?.toFixed(1)}</p>
                  <p className="text-slate-600 text-[10px]">{h.val.month?.slice(0, 7)}</p>
                </div>
              ) : null)}
              <div>
                <p className="text-slate-500 text-xs">Change</p>
                <p className={`font-semibold ${
                  history[history.length - 1]?.avg_complexity > history[0]?.avg_complexity
                    ? 'text-orange-400' : 'text-green-400'
                }`}>
                  {history.length >= 2
                    ? `${history[history.length - 1].avg_complexity > history[0].avg_complexity ? '+' : ''}${(history[history.length - 1].avg_complexity - history[0].avg_complexity).toFixed(1)}`
                    : '—'}
                </p>
                <p className="text-slate-600 text-[10px]">over period</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
