import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../../config/axios';
import { TrendingUp, AlertTriangle, Clock, Layers, Zap, RefreshCw, Shield, ArrowRight } from 'lucide-react';

const DAY_OPTIONS = [
  { value: 7,  label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

function TrendChart({ trend }: { trend: any[] }) {
  if (!trend?.length) {
    return <p className="text-slate-600 text-sm py-6 text-center">No data for this period</p>;
  }
  const max = Math.max(...trend.map(d =>
    (d.critical || 0) + (d.high || 0) + (d.medium || 0) + (d.low || 0)
  ), 1);
  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1 h-24 min-w-max px-1 pb-1">
        {trend.map((d, i) => {
          const total = (d.critical || 0) + (d.high || 0) + (d.medium || 0) + (d.low || 0);
          const heightPct = total > 0 ? Math.max((total / max) * 100, 4) : 0;
          return (
            <div key={i} className="flex flex-col items-center gap-0.5 group relative">
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#0d1424] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap shadow-lg">
                <p className="font-medium mb-0.5">{new Date(d.period).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</p>
                {d.critical > 0 && <p className="text-red-400">{d.critical} critical</p>}
                {d.high     > 0 && <p className="text-orange-400">{d.high} high</p>}
                {d.medium   > 0 && <p className="text-yellow-400">{d.medium} medium</p>}
                {d.low      > 0 && <p className="text-green-400">{d.low} low</p>}
              </div>
              <div
                className="w-5 rounded-sm overflow-hidden flex flex-col-reverse"
                style={{ height: `${heightPct}%`, minHeight: total > 0 ? '4px' : 0 }}
              >
                {(['low','medium','high','critical'] as const).map(level =>
                  d[level] > 0 ? (
                    <div key={level} style={{
                      height: `${((d[level] || 0) / total) * 100}%`,
                      backgroundColor: { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' }[level],
                    }} />
                  ) : null
                )}
              </div>
            </div>
          );
        })}
      </div>
      {trend.length >= 2 && (
        <div className="flex justify-between px-1 mt-1">
          <span className="text-slate-700 text-[10px]">
            {new Date(trend[0].period).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
          </span>
          <span className="text-slate-700 text-[10px]">
            {new Date(trend[trend.length - 1].period).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      )}
    </div>
  );
}

export default function AdminHealth() {
  const [days, setDays] = useState(30);
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-health', days],
    queryFn: () => axios.get(`/api/admin/health?days=${days}`).then(r => r.data),
    retry: 1,
  });

  const { data: bfData } = useQuery({
    queryKey: ['bus-factor'],
    queryFn: () => axios.get('/api/admin/bus-factor').then(r => r.data),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const { data: usageData } = useQuery({
    queryKey: ['billing-plan'],
    queryFn: () => axios.get('/api/billing/plan').then(r => r.data),
    staleTime: 60_000,
  });

  const cardCls = "bg-[#0d1424] border border-slate-800 rounded-xl p-5";

  const Header = (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-white">Engineering Health</h1>
        <p className="text-slate-500 text-sm mt-1">System performance, risk overview, and knowledge analysis</p>
      </div>
      <div className="flex items-center gap-1 bg-[#0d1424] border border-slate-800 rounded-xl p-1">
        {DAY_OPTIONS.map(o => (
          <button
            key={o.value}
            onClick={() => setDays(o.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              days === o.value ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >{o.label}</button>
        ))}
      </div>
    </div>
  );

  if (isLoading) return (
    <div className="space-y-4 max-w-4xl">
      {Header}
      {[1,2,3].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}
    </div>
  );

  if (isError || !data) return (
    <div className="max-w-4xl space-y-6 fade-in">
      {Header}
      <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-8 text-center">
        <AlertTriangle size={28} className="text-red-400 mx-auto mb-3" />
        <p className="text-slate-200 font-medium mb-1">Failed to load health data</p>
        <p className="text-slate-500 text-sm mb-5">Check that backend is running and try again.</p>
        <button onClick={() => refetch()} className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm">
          <RefreshCw size={13} /> Try Again
        </button>
      </div>
    </div>
  );

  const { stats, trend, per_repo, most_risky_files, most_affected_services, queues } = data;
  const criticalPct = stats.total_prs > 0 ? ((stats.critical_prs / stats.total_prs) * 100).toFixed(1) : '0';
  const highPct     = stats.total_prs > 0 ? ((stats.high_prs / stats.total_prs) * 100).toFixed(1) : '0';
  const monthlyPRs  = usageData?.usage?.prs_analyzed ?? 0;
  const maxPRs      = usageData?.plan?.maxPRsPerMonth;

  const bfSummary = bfData?.summary;

  return (
    <div className="max-w-4xl fade-in space-y-6">
      {Header}

      {/* PR Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'PRs Analyzed',  value: stats.total_prs,                            icon: <TrendingUp size={16} />, color: 'text-blue-400' },
          { label: 'Critical Risk', value: `${stats.critical_prs} (${criticalPct}%)`,  icon: <AlertTriangle size={16} />, color: 'text-red-400' },
          { label: 'High Risk',     value: `${stats.high_prs} (${highPct}%)`,          icon: <AlertTriangle size={16} />, color: 'text-orange-400' },
          { label: 'Avg Analyze',   value: `${stats.avg_analysis_seconds}s`,           icon: <Clock size={16} />, color: 'text-green-400' },
        ].map((s, i) => (
          <div key={i} className={cardCls}>
            <div className={`mb-2 ${s.color}`}>{s.icon}</div>
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-slate-500 text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Knowledge Risk Banner (from bus factor data) */}
      {bfSummary && (
        <div
          className="bg-[#0d1424] border border-slate-800 rounded-xl p-5 cursor-pointer hover:border-slate-700 transition-colors"
          onClick={() => navigate('/admin/bus-factor')}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Shield size={15} className="text-indigo-400" /> Knowledge Risk
            </h2>
            <div className="flex items-center gap-2 text-indigo-400 text-xs hover:text-indigo-300 transition-colors">
              View Full Analysis <ArrowRight size={12} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: 'Avg Bus Factor',
                value: bfSummary.avg_bus_factor || '—',
                color: bfSummary.avg_bus_factor <= 1.5 ? 'text-red-400' : bfSummary.avg_bus_factor <= 2.5 ? 'text-orange-400' : 'text-green-400',
                note:  bfSummary.avg_bus_factor <= 1.5 ? '⚠️ Critical' : bfSummary.avg_bus_factor <= 2.5 ? 'Moderate' : '✅ Healthy',
              },
              {
                label: 'Knowledge Silos',
                value: bfSummary.knowledge_silo_count,
                color: bfSummary.knowledge_silo_count > 5 ? 'text-red-400' : 'text-orange-400',
                note:  'Single-owner files',
              },
              {
                label: 'Orphaned Files',
                value: bfSummary.orphaned_files_count,
                color: 'text-slate-400',
                note:  '6+ months untouched',
              },
              {
                label: 'Knowledge Risk',
                value: `${bfSummary.knowledge_risk_score}/100`,
                color: bfSummary.knowledge_risk_score >= 75 ? 'text-red-400' : bfSummary.knowledge_risk_score >= 50 ? 'text-orange-400' : 'text-green-400',
                note:  bfSummary.knowledge_risk_score >= 75 ? '🔴 Critical' : bfSummary.knowledge_risk_score >= 50 ? '🟠 High' : '🟡 Moderate',
              },
            ].map((s, i) => (
              <div key={i}>
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-slate-500 text-xs mt-0.5">{s.label}</div>
                <div className={`text-xs mt-0.5 ${s.color}`}>{s.note}</div>
              </div>
            ))}
          </div>
          {bfSummary.knowledge_silo_count > 0 && (
            <p className="text-slate-500 text-xs mt-3 pt-3 border-t border-slate-800">
              {bfSummary.knowledge_silo_count} files are known by only 1 person — click to see which files and take action
            </p>
          )}
        </div>
      )}

      {/* Risk trend chart */}
      <div className={cardCls}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Risk Trend</h2>
          <div className="flex items-center gap-3">
            {[
              { label: 'Critical', color: 'bg-red-500' },
              { label: 'High',     color: 'bg-orange-500' },
              { label: 'Medium',   color: 'bg-yellow-500' },
              { label: 'Low',      color: 'bg-green-500' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-sm ${l.color}`} />
                <span className="text-slate-600 text-[10px]">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
        <TrendChart trend={trend} />
      </div>

      {/* Queue health */}
      <div className={cardCls}>
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Zap size={15} /> Queue Health
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { name: 'Indexing Queue', q: queues?.indexing },
            { name: 'Analysis Queue', q: queues?.analysis },
          ].map(({ name, q }) => (
            <div key={name} className="bg-slate-800/50 rounded-lg p-4">
              <p className="text-slate-400 text-sm font-medium mb-3">{name}</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Waiting', value: q?.waiting ?? '—', color: 'text-yellow-400' },
                  { label: 'Active',  value: q?.active  ?? '—', color: 'text-blue-400' },
                  { label: 'Failed',  value: q?.failed  ?? '—', color: (q?.failed ?? 0) > 0 ? 'text-red-400' : 'text-slate-500' },
                ].map(s => (
                  <div key={s.label}>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-slate-600 text-[10px] mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly usage */}
      {maxPRs && (
        <div className={cardCls}>
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Layers size={15} /> Monthly Usage
          </h2>
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">
              <span className="text-white font-semibold">{monthlyPRs}</span>
              {maxPRs !== Infinity
                ? <> / <span className="text-white font-semibold">{maxPRs}</span> PRs this month</>
                : ' PRs this month (unlimited)'}
            </span>
            {maxPRs !== Infinity && (
              <span className="text-slate-500 text-xs">{Math.round((monthlyPRs / maxPRs) * 100)}% used</span>
            )}
          </div>
          {maxPRs !== Infinity && (
            <div className="bg-slate-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${monthlyPRs / maxPRs > 0.9 ? 'bg-red-500' : 'bg-indigo-500'}`}
                style={{ width: `${Math.min((monthlyPRs / maxPRs) * 100, 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Per-repo breakdown */}
      {per_repo?.length > 0 && (
        <div className={cardCls}>
          <h2 className="text-white font-semibold mb-4">Risk by Repository</h2>
          <div className="space-y-3">
            {per_repo.map((r: any) => {
              const total = Number(r.total) || 0;
              if (total === 0) return null;
              return (
                <div key={r.full_name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-300 text-sm truncate flex-1 mr-4">{r.full_name}</span>
                    <span className="text-slate-500 text-xs shrink-0">{total} PRs</span>
                  </div>
                  <div className="flex h-2 bg-slate-800 rounded-full overflow-hidden">
                    {(['critical','high','medium','low'] as const).map(level =>
                      Number(r[level]) > 0 ? (
                        <div key={level} title={`${level}: ${r[level]}`}
                          style={{
                            width: `${(Number(r[level]) / total) * 100}%`,
                            backgroundColor: { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' }[level],
                          }}
                        />
                      ) : null
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Most risky files + affected services */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className={cardCls}>
          <h2 className="text-white font-semibold mb-4">Most Risky Files</h2>
          {most_risky_files?.length === 0
            ? <p className="text-slate-600 text-sm">None in last 6 months</p>
            : (
              <ol className="space-y-2">
                {most_risky_files?.map((f: any, i: number) => (
                  <li key={i} className="flex items-center justify-between">
                    <span className="text-slate-400 text-xs font-mono truncate flex-1 mr-2">{f.file_path}</span>
                    <span className="text-red-400 text-sm font-semibold shrink-0">{f.incident_count}×</span>
                  </li>
                ))}
              </ol>
            )}
        </div>

        <div className={cardCls}>
          <h2 className="text-white font-semibold mb-4">Most Affected Services</h2>
          {most_affected_services?.length === 0
            ? <p className="text-slate-600 text-sm">No critical PRs in this period</p>
            : (
              <ol className="space-y-2">
                {most_affected_services?.map((s: any, i: number) => (
                  <li key={i} className="flex items-center justify-between">
                    <span className="text-slate-400 text-xs font-mono truncate flex-1 mr-2">{s.service}</span>
                    <span className="text-orange-400 text-sm font-semibold shrink-0">{s.count}×</span>
                  </li>
                ))}
              </ol>
            )}
        </div>
      </div>
    </div>
  );
}
