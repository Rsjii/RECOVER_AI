// PHASE2_DISABLED — Bus factor / knowledge risk analysis. Re-enable with PHASE2_ENABLED=true.
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import axios from '../../config/axios';
import {
  Users, AlertTriangle, Clock, TrendingUp, RefreshCw,
  Shield, Flame, X, GitCommit, Activity,
} from 'lucide-react';

function RiskBadge({ score }: { score: number }) {
  const { label, cls } =
    score >= 75 ? { label: 'CRITICAL', cls: 'text-red-400 bg-red-500/10 border-red-500/20' } :
    score >= 50 ? { label: 'HIGH',     cls: 'text-orange-400 bg-orange-500/10 border-orange-500/20' } :
    score >= 25 ? { label: 'MEDIUM',   cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' } :
                  { label: 'LOW',      cls: 'text-green-400 bg-green-500/10 border-green-500/20' };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${cls}`}>
      {label}
    </span>
  );
}

function BusFactorBadge({ bf }: { bf: number }) {
  const icon = bf === 1 ? '🚨' : bf === 2 ? '⚠️' : bf === 3 ? '🟡' : '✅';
  const cls  = bf === 1 ? 'text-red-400' : bf === 2 ? 'text-orange-400' : bf === 3 ? 'text-yellow-400' : 'text-green-400';
  return <span className={`font-bold ${cls}`}>{icon} {bf}</span>;
}

function ChurnLabel({ score }: { score: number }) {
  if (score > 60) return <span className="text-red-400 text-xs font-medium">HIGH</span>;
  if (score > 30) return <span className="text-orange-400 text-xs font-medium">MED</span>;
  return <span className="text-green-400 text-xs font-medium">LOW</span>;
}

function FileHistoryDrawer({ file, onClose }: { file: any; onClose: () => void }) {
  const allAuthors: Array<{ name: string; email: string; commits: number; pct: number }> =
    file.all_authors || [];

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* backdrop */}
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {/* panel */}
      <div className="w-full max-w-md bg-[#0d1424] border-l border-slate-800 flex flex-col h-full overflow-hidden animate-in slide-in-from-right-4 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{file.file_path}</p>
            <p className="text-slate-500 text-xs mt-0.5">{file.repo_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors ml-3 shrink-0">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Risk stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Bus Factor', value: file.bus_factor, color: file.bus_factor === 1 ? 'text-red-400' : 'text-orange-400' },
              { label: 'Commits', value: file.total_commits || '—', color: 'text-white' },
              { label: 'Age (days)', value: file.file_age_days || '—', color: 'text-slate-300' },
            ].map((s, i) => (
              <div key={i} className="bg-slate-900/60 rounded-lg p-3 border border-slate-800/50 text-center">
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-slate-600 text-[10px] mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Activity */}
          {(file.commits_30d != null || file.commits_90d != null) && (
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800/50">
              <p className="text-slate-400 text-xs font-medium mb-3 flex items-center gap-1.5">
                <Activity size={11} /> Recent Activity
              </p>
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-white font-semibold">{file.commits_30d ?? '—'}</span>
                  <span className="text-slate-500 text-xs ml-1">commits (30d)</span>
                </div>
                <div>
                  <span className="text-white font-semibold">{file.commits_90d ?? '—'}</span>
                  <span className="text-slate-500 text-xs ml-1">commits (90d)</span>
                </div>
              </div>
            </div>
          )}

          {/* All authors */}
          {allAuthors.length > 0 && (
            <div>
              <p className="text-slate-400 text-xs font-medium mb-3 flex items-center gap-1.5">
                <GitCommit size={11} /> All Contributors
              </p>
              <div className="space-y-2.5">
                {allAuthors.map((a, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <img
                          src={`https://github.com/${a.name}.png?size=20`}
                          className="w-5 h-5 rounded-full ring-1 ring-slate-700"
                          onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none'; }}
                          alt=""
                        />
                        <span className="text-slate-300 text-xs">{a.name || a.email}</span>
                        {i === 0 && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 rounded font-medium">
                            PRIMARY
                          </span>
                        )}
                      </div>
                      <span className="text-slate-400 text-xs font-medium">{a.pct}%</span>
                    </div>
                    <div className="bg-slate-800 rounded-full h-1">
                      <div
                        className={`h-1 rounded-full ${i === 0 ? 'bg-indigo-500' : 'bg-slate-600'}`}
                        style={{ width: `${Math.min(a.pct, 100)}%` }}
                      />
                    </div>
                    <p className="text-slate-700 text-[10px] mt-0.5">{a.commits} commits</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {allAuthors.length === 0 && (
            <div className="text-center py-6">
              <GitCommit size={24} className="text-slate-700 mx-auto mb-2" />
              <p className="text-slate-600 text-sm">No author breakdown available.</p>
              <p className="text-slate-700 text-xs mt-1">Re-index the repository to see full git history.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminBusFactor() {
  const [tab, setTab] = useState<'silos' | 'engineers' | 'orphans' | 'at-risk'>('silos');
  const [drawerFile, setDrawerFile] = useState<any>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['bus-factor'],
    queryFn: () => axios.get('/api/admin/bus-factor').then(r => r.data),
    staleTime: 5 * 60_000,
  });

  const card = "bg-[#0d1424] border border-slate-800 rounded-xl p-5";
  const tabCls = (t: string) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      tab === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
    }`;

  if (isLoading) return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="text-2xl font-bold text-white">Knowledge Risk</h1>
      {[1,2,3].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}
    </div>
  );

  if (isError || !data) return (
    <div className="max-w-5xl space-y-6 fade-in">
      <h1 className="text-2xl font-bold text-white">Knowledge Risk</h1>
      <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-8 text-center">
        <AlertTriangle size={28} className="text-red-400 mx-auto mb-3" />
        <p className="text-slate-200 font-medium mb-4">Failed to load knowledge risk data</p>
        <p className="text-slate-500 text-sm mb-5">Index your repositories first to see git history analysis.</p>
        <button onClick={() => refetch()} className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm">
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    </div>
  );

  const { summary, knowledge_silos, engineer_coverage, orphaned_files, at_risk_files } = data;
  const totalFilesOwned = engineer_coverage.reduce((s: number, e: any) => s + Number(e.files_owned), 0) || 1;

  return (
    <div className="max-w-5xl fade-in space-y-6">
      {drawerFile && <FileHistoryDrawer file={drawerFile} onClose={() => setDrawerFile(null)} />}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield size={22} className="text-indigo-400" />
            Knowledge Risk
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Bus factor analysis, knowledge silos, and institutional memory gaps
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Avg Bus Factor',
            value: summary.avg_bus_factor || '—',
            icon:  <Users size={16} />,
            color: summary.avg_bus_factor <= 1.5 ? 'text-red-400' : summary.avg_bus_factor <= 2.5 ? 'text-orange-400' : 'text-green-400',
            note:  summary.avg_bus_factor <= 1.5 ? 'Critical risk' : summary.avg_bus_factor <= 2.5 ? 'Moderate risk' : 'Healthy',
          },
          {
            label: 'Knowledge Silos',
            value: summary.knowledge_silo_count,
            icon:  <AlertTriangle size={16} />,
            color: summary.knowledge_silo_count > 10 ? 'text-red-400' : summary.knowledge_silo_count > 5 ? 'text-orange-400' : 'text-yellow-400',
            note:  'Files known by 1 person',
          },
          {
            label: 'Orphaned Files',
            value: summary.orphaned_files_count,
            icon:  <Clock size={16} />,
            color: 'text-slate-400',
            note:  'Not touched in 6+ months',
          },
          {
            label: 'Knowledge Risk',
            value: `${summary.knowledge_risk_score}/100`,
            icon:  <TrendingUp size={16} />,
            color: summary.knowledge_risk_score >= 75 ? 'text-red-400' : summary.knowledge_risk_score >= 50 ? 'text-orange-400' : 'text-green-400',
            note:  summary.knowledge_risk_score >= 75 ? 'Critical' : summary.knowledge_risk_score >= 50 ? 'High' : 'Moderate',
          },
        ].map((s, i) => (
          <div key={i} className={card}>
            <div className={`mb-2 ${s.color}`}>{s.icon}</div>
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-slate-500 text-xs mt-1">{s.label}</div>
            <div className={`text-xs mt-1 ${s.color}`}>{s.note}</div>
          </div>
        ))}
      </div>

      {/* Alert banner */}
      {summary.knowledge_silo_count > 0 && (
        <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-5 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 font-semibold text-sm">
                {summary.knowledge_silo_count} knowledge silo{summary.knowledge_silo_count > 1 ? 's' : ''} detected
              </p>
              <p className="text-red-400/70 text-xs mt-0.5">
                If a key engineer leaves, these files lose their only domain expert.
                Schedule knowledge transfer sessions to reduce this risk.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Engineer Coverage bar chart */}
      {engineer_coverage.length > 0 && (
        <div className={card}>
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Users size={15} /> Engineer Knowledge Coverage
          </h2>
          <div className="space-y-3">
            {engineer_coverage.slice(0, 8).map((e: any, i: number) => {
              const pct = Math.round((Number(e.files_owned) / totalFilesOwned) * 100);
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <img
                        src={`https://github.com/${e.name}.png?size=24`}
                        className="w-5 h-5 rounded-full ring-1 ring-slate-700"
                        onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none'; }}
                        alt=""
                      />
                      <span className="text-slate-300 text-sm">{e.name || e.email}</span>
                      {Number(e.total_incidents) > 0 && (
                        <span className="text-xs text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">
                          {e.total_incidents} incidents
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-600">{e.files_owned} files</span>
                      {e.sole_owner_files > 0 && (
                        <span className="text-red-400 font-medium">{e.sole_owner_files} sole</span>
                      )}
                      <span className="text-slate-400 font-medium">{pct}%</span>
                    </div>
                  </div>
                  <div className="bg-slate-800 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-indigo-500"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {engineer_coverage.length >= 3 && (() => {
            const top3Pct = engineer_coverage.slice(0, 3).reduce(
              (s: number, e: any) => s + Math.round((Number(e.files_owned) / totalFilesOwned) * 100), 0
            );
            return top3Pct > 60 ? (
              <p className="text-orange-400 text-xs mt-4">
                ⚠️ Top 3 engineers control {top3Pct}% of codebase knowledge
              </p>
            ) : null;
          })()}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[#0d1424] border border-slate-800 rounded-xl p-1 w-fit">
        {[
          { id: 'silos',     label: `Silos (${knowledge_silos.length})`,      icon: <AlertTriangle size={13} /> },
          { id: 'engineers', label: `Engineers (${engineer_coverage.length})`, icon: <Users size={13} /> },
          { id: 'orphans',   label: `Orphaned (${orphaned_files.length})`,     icon: <Clock size={13} /> },
          { id: 'at-risk',   label: `At Risk (${at_risk_files.length})`,       icon: <Flame size={13} /> },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`${tabCls(t.id)} flex items-center gap-1.5`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Silos tab ── */}
      {tab === 'silos' && (
        <div className={card}>
          <h2 className="text-white font-semibold mb-1">Knowledge Silos</h2>
          <p className="text-slate-600 text-xs mb-4">Files where only ONE person has significant commit history — click any row to see all authors</p>
          {knowledge_silos.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-green-400 font-medium">No knowledge silos detected!</p>
              <p className="text-slate-600 text-sm mt-1">Your codebase has good knowledge distribution.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {knowledge_silos.map((f: any, i: number) => (
                <div
                  key={i}
                  onClick={() => setDrawerFile(f)}
                  className="bg-slate-900/50 rounded-lg p-3 border border-slate-800/50 cursor-pointer hover:border-slate-700 hover:bg-slate-900/80 transition-all group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-blue-400 text-sm truncate group-hover:text-blue-300 transition-colors">{f.file_path}</p>
                      <p className="text-slate-600 text-xs mt-0.5">{f.repo_name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <RiskBadge score={f.knowledge_risk_score} />
                      <span className="text-slate-700 text-xs opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs flex-wrap">
                    <span className="text-slate-500">
                      Only: <span className="text-white font-medium">{f.primary_owner_name || f.primary_owner_email}</span>
                      <span className="text-slate-600"> ({f.primary_owner_pct}%)</span>
                    </span>
                    {f.owner_departed && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/25 uppercase tracking-wide">
                        DEPARTED
                      </span>
                    )}
                    {f.incident_count > 0 && (
                      <span className="text-red-400">⚠️ {f.incident_count} incident{f.incident_count > 1 ? 's' : ''}</span>
                    )}
                    {f.revert_count > 0 && (
                      <span className="text-orange-400">↩ {f.revert_count} revert{f.revert_count > 1 ? 's' : ''}</span>
                    )}
                    <ChurnLabel score={f.churn_score} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Engineers tab ── */}
      {tab === 'engineers' && (
        <div className={card}>
          <h2 className="text-white font-semibold mb-4">Engineer Knowledge Map</h2>
          {engineer_coverage.length === 0 ? (
            <p className="text-slate-600 text-sm">No git history data yet. Re-index repositories to see engineer coverage.</p>
          ) : (
            <div className="space-y-4">
              {engineer_coverage.map((e: any, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-800/50">
                  <img
                    src={`https://github.com/${e.name}.png?size=40`}
                    className="w-9 h-9 rounded-full ring-1 ring-slate-700 shrink-0"
                    onError={(ev) => { (ev.target as HTMLImageElement).src = ''; }}
                    alt=""
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm">{e.name || 'Unknown'}</p>
                    <p className="text-slate-600 text-xs truncate">{e.email}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
                      <span><span className="text-white font-medium">{e.files_owned}</span> files owned</span>
                      <span><span className="text-white font-medium">{Math.round(e.avg_ownership_pct)}%</span> avg ownership</span>
                      {Number(e.sole_owner_files) > 0 && (
                        <span className="text-red-400 font-medium">
                          {e.sole_owner_files} sole owner
                        </span>
                      )}
                      {Number(e.total_incidents) > 0 && (
                        <span className="text-orange-400">{e.total_incidents} incidents</span>
                      )}
                    </div>
                  </div>
                  <span className="text-slate-600 text-xs font-mono shrink-0">#{i + 1}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Orphans tab ── */}
      {tab === 'orphans' && (
        <div className={card}>
          <h2 className="text-white font-semibold mb-1">Orphaned Files</h2>
          <p className="text-slate-600 text-xs mb-4">Files not touched in 6+ months — often poorly understood but still depended on</p>
          {orphaned_files.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-green-400 font-medium">No orphaned files!</p>
              <p className="text-slate-600 text-sm mt-1">All files have been recently touched.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orphaned_files.map((f: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-800/50">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-blue-400 text-sm truncate">{f.file_path}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Clock size={10} /> {f.file_age_days}d ago</span>
                      {f.dependents_count > 0 && (
                        <span className="text-orange-400">{f.dependents_count} dependents</span>
                      )}
                      <span>{f.repo_name}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="text-slate-500 text-xs">Last owner</p>
                    <p className="text-slate-300 text-xs font-medium">{f.primary_owner_name || '—'}</p>
                    {f.owner_departed && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/25 uppercase tracking-wide">
                        DEPARTED
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── At-Risk tab ── */}
      {tab === 'at-risk' && (
        <div className={card}>
          <h2 className="text-white font-semibold mb-1">At-Risk Files</h2>
          <p className="text-slate-600 text-xs mb-4">Ranked by combined bus factor + churn + incident history</p>
          {at_risk_files.length === 0 ? (
            <p className="text-slate-600 text-sm py-6 text-center">No data yet. Index a repository to see risk analysis.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-600 text-xs uppercase tracking-wide">
                    <th className="text-left pb-3 font-medium">File</th>
                    <th className="text-center pb-3 font-medium">Bus</th>
                    <th className="text-center pb-3 font-medium">Churn</th>
                    <th className="text-center pb-3 font-medium">Incidents</th>
                    <th className="text-center pb-3 font-medium">Risk</th>
                    <th className="text-left pb-3 font-medium">Owner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {at_risk_files.map((f: any, i: number) => (
                    <tr
                      key={i}
                      onClick={() => setDrawerFile(f)}
                      className="group hover:bg-slate-800/20 cursor-pointer"
                    >
                      <td className="py-2.5 pr-4">
                        <p className="font-mono text-blue-400 text-xs truncate max-w-[220px] group-hover:text-blue-300 transition-colors">{f.file_path}</p>
                        <p className="text-slate-700 text-[10px]">{f.repo_name}</p>
                      </td>
                      <td className="py-2.5 text-center"><BusFactorBadge bf={f.bus_factor} /></td>
                      <td className="py-2.5 text-center"><ChurnLabel score={f.churn_score} /></td>
                      <td className="py-2.5 text-center">
                        <span className={f.incident_count > 0 ? 'text-red-400 font-medium' : 'text-slate-600'}>
                          {f.incident_count}
                          {f.revert_count > 0 && <span className="text-orange-400"> (+{f.revert_count}↩)</span>}
                        </span>
                      </td>
                      <td className="py-2.5 text-center"><RiskBadge score={f.knowledge_risk_score} /></td>
                      <td className="py-2.5 text-slate-400 text-xs">{f.primary_owner_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
