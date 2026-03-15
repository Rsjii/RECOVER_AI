// PHASE2_DISABLED — AdminDependencyGraph. Re-enable with PHASE2_ENABLED=true.
import { useQuery } from '@tanstack/react-query';
import axios from '../../config/axios';
import { useState } from 'react';
import { GitBranch, Info, Package, Code2 } from 'lucide-react';

type Repo = { id: string; full_name: string; status: string; pr_count: number };
type Edge = { source_repo_id: string; target_repo_id: string; source_name: string; target_name: string; dependency_type: string; target_package: string; confidence: number };

export default function AdminDependencyGraph() {
  const [selected, setSelected] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'npm_package' | 'import_path'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['dep-graph'],
    queryFn: () => axios.get('/api/admin/dependency-graph').then(r => r.data),
    staleTime: 60_000,
  });

  const repos: Repo[] = data?.repos ?? [];
  const allEdges: Edge[] = data?.edges ?? [];
  const edges = typeFilter === 'all' ? allEdges : allEdges.filter(e => e.dependency_type === typeFilter);

  // Build lookup maps
  const repoById = new Map(repos.map(r => [r.id, r]));

  // For selected repo: what does it depend on? What depends on it?
  const selectedDepsOn   = selected ? edges.filter(e => e.source_repo_id === selected) : [];
  const selectedDependedByArr = selected ? edges.filter(e => e.target_repo_id === selected) : [];

  // How many repos depend on each repo (for size indicator)
  const dependentCount = new Map<string, number>();
  for (const e of edges) dependentCount.set(e.target_repo_id, (dependentCount.get(e.target_repo_id) ?? 0) + 1);

  const getRepoName = (fullName: string) => fullName?.split('/')[1] ?? fullName;
  const getRisk = (repoId: string) => {
    const dc = dependentCount.get(repoId) ?? 0;
    if (dc >= 4) return 'critical';
    if (dc >= 2) return 'high';
    if (dc >= 1) return 'medium';
    return 'none';
  };

  const RISK_STYLES: Record<string, string> = {
    critical: 'border-red-500/60 bg-red-500/5',
    high:     'border-orange-500/50 bg-orange-500/5',
    medium:   'border-yellow-500/40 bg-yellow-500/5',
    none:     'border-slate-700 bg-[#0d1424]',
  };
  const RISK_DOT: Record<string, string> = {
    critical: 'bg-red-500',
    high:     'bg-orange-500',
    medium:   'bg-yellow-500',
    none:     'bg-slate-700',
  };

  if (isLoading) return (
    <div className="space-y-4 max-w-5xl fade-in">
      {[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
    </div>
  );

  return (
    <div className="max-w-5xl fade-in space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dependency Graph</h1>
          <p className="text-slate-500 text-sm mt-1">
            {repos.length} repos · {edges.length} cross-repo dependencies detected
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['all','npm_package','import_path'] as const).map(f => (
            <button key={f} onClick={() => setTypeFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                typeFilter === f
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600'
              }`}>
              {f === 'all' ? 'All' : f === 'npm_package' ? 'NPM' : 'Imports'}
            </button>
          ))}
        </div>
      </div>

      {repos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-slate-800 rounded-xl">
          <GitBranch size={32} className="text-slate-700 mb-3" />
          <p className="text-slate-400 font-medium mb-1">No repos indexed yet</p>
          <p className="text-slate-600 text-sm">Add and index repositories to see their cross-repo dependencies.</p>
        </div>
      ) : (
        <>
          {/* Repo grid — click to select */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {repos.map(repo => {
              const risk = getRisk(repo.id);
              const depsOn = edges.filter(e => e.source_repo_id === repo.id).length;
              const dependedBy = dependentCount.get(repo.id) ?? 0;
              const isSelected = selected === repo.id;
              const prMode = Number(repo.pr_count) >= 5 ? 'PR' : 'Commit';
              return (
                <button key={repo.id} onClick={() => setSelected(isSelected ? null : repo.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-indigo-500/60 bg-indigo-500/10 ring-1 ring-indigo-500/30'
                      : RISK_STYLES[risk]
                  } hover:border-indigo-500/40`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${RISK_DOT[risk]}`} />
                    <span className="text-white text-sm font-medium truncate">{getRepoName(repo.full_name)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-600">
                    {depsOn > 0 && <span className="text-blue-400">↑{depsOn} deps</span>}
                    {dependedBy > 0 && <span className="text-orange-400">↓{dependedBy} used by</span>}
                    <span className={`ml-auto ${prMode === 'PR' ? 'text-green-500' : 'text-yellow-500'}`}>
                      {prMode}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-slate-600 px-1">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />4+ repos depend on it (critical)</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500" />2-3 repos (high)</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500" />1 repo (medium)</span>
            <span className="ml-auto flex items-center gap-1.5"><span className="text-green-500">PR</span> = PR-based analysis · <span className="text-yellow-500">Commit</span> = fallback</span>
          </div>

          {/* Selected repo detail */}
          {selected && (
            <div className="bg-[#0d1424] border border-indigo-500/30 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-800/80">
                <Info size={14} className="text-indigo-400" />
                <h2 className="text-white font-semibold text-sm">
                  {getRepoName(repoById.get(selected)?.full_name ?? '')}
                </h2>
                <span className="text-slate-600 text-xs">{repoById.get(selected)?.full_name}</span>
                <button onClick={() => setSelected(null)} className="ml-auto text-slate-600 hover:text-slate-300 text-xs">
                  Close ✕
                </button>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-3">
                    Depends On ({selectedDepsOn.length})
                  </p>
                  {selectedDepsOn.length === 0
                    ? <p className="text-slate-700 text-sm">No detected dependencies</p>
                    : selectedDepsOn.map((e, i) => (
                      <div key={i} className="flex items-center gap-3 mb-2.5">
                        {e.dependency_type === 'npm_package'
                          ? <Package size={12} className="text-green-400 shrink-0" />
                          : <Code2 size={12} className="text-blue-400 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-200 text-sm font-medium truncate">
                            {getRepoName(e.target_name)}
                          </p>
                          <p className="text-slate-600 text-[10px] font-mono truncate">{e.target_package}</p>
                        </div>
                        <span className="text-slate-700 text-xs shrink-0">{Math.round(e.confidence * 100)}%</span>
                      </div>
                    ))
                  }
                </div>
                <div>
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-3">
                    Used By ({selectedDependedByArr.length})
                  </p>
                  {selectedDependedByArr.length === 0
                    ? <p className="text-slate-700 text-sm">No repos depend on this</p>
                    : selectedDependedByArr.map((e, i) => (
                      <div key={i} className="flex items-center gap-3 mb-2.5">
                        {e.dependency_type === 'npm_package'
                          ? <Package size={12} className="text-green-400 shrink-0" />
                          : <Code2 size={12} className="text-blue-400 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-200 text-sm font-medium truncate">
                            {getRepoName(e.source_name)}
                          </p>
                          <p className="text-slate-600 text-[10px] font-mono truncate">{e.target_package}</p>
                        </div>
                        <span className="text-slate-700 text-xs shrink-0">{Math.round(e.confidence * 100)}%</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          )}

          {/* All edges table */}
          <div className="bg-[#0d1424] border border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-800/80">
              <GitBranch size={14} className="text-slate-500" />
              <h2 className="text-white font-semibold text-sm">All Dependencies</h2>
              <span className="text-slate-600 text-xs">{edges.length} detected</span>
            </div>
            {edges.length === 0 ? (
              <p className="text-slate-600 text-sm text-center py-8">
                {allEdges.length > 0
                  ? 'No dependencies match this filter.'
                  : 'No cross-repo dependencies detected yet. Dependencies are auto-detected during repo indexing.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800/60">
                      <th className="text-left text-xs text-slate-600 font-medium px-5 py-3">Source</th>
                      <th className="text-left text-xs text-slate-600 font-medium px-3 py-3">→ Depends on</th>
                      <th className="text-left text-xs text-slate-600 font-medium px-3 py-3">Package</th>
                      <th className="text-left text-xs text-slate-600 font-medium px-3 py-3">Type</th>
                      <th className="text-left text-xs text-slate-600 font-medium px-3 py-3">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {edges.map((e, i) => (
                      <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                        <td className="px-5 py-2.5 text-slate-300 font-medium">{getRepoName(e.source_name)}</td>
                        <td className="px-3 py-2.5 text-indigo-400">{getRepoName(e.target_name)}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-500 text-xs">{e.target_package}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                            e.dependency_type === 'npm_package'
                              ? 'text-green-400 bg-green-500/10 border-green-500/20'
                              : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                          }`}>
                            {e.dependency_type === 'npm_package' ? 'npm' : 'import'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-12 bg-slate-800 rounded-full h-1">
                              <div className="bg-indigo-500 h-1 rounded-full" style={{ width: `${Math.round(e.confidence * 100)}%` }} />
                            </div>
                            <span className="text-slate-600 text-xs">{Math.round(e.confidence * 100)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
