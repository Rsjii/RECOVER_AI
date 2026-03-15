import { useQuery } from '@tanstack/react-query';
import axios from '../../config/axios';
import { useNavigate } from 'react-router-dom';
import { GitBranch, AlertTriangle, GitPullRequest, Users, ArrowRight, Layers } from 'lucide-react';

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-5">
      <p className="text-slate-500 text-xs mb-2">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-slate-600 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminOrgOverview() {
  const navigate = useNavigate();

  const { data: graph } = useQuery({
    queryKey: ['dep-graph'],
    queryFn: () => axios.get('/api/admin/dependency-graph').then(r => r.data),
    staleTime: 60_000,
  });

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => axios.get('/api/admin/health').then(r => r.data),
    staleTime: 60_000,
  });

  const repos   = graph?.repos  ?? [];
  const edges   = graph?.edges  ?? [];
  const stats   = health?.stats ?? {};

  // Repos with highest dependents (most critical)
  const dependentCounts = new Map<string, number>();
  for (const e of edges) {
    dependentCounts.set(e.target_repo_id, (dependentCounts.get(e.target_repo_id) ?? 0) + 1);
  }
  const criticalRepos = repos
    .filter((r: any) => (dependentCounts.get(r.id) ?? 0) >= 2)
    .sort((a: any, b: any) => (dependentCounts.get(b.id) ?? 0) - (dependentCounts.get(a.id) ?? 0))
    .slice(0, 4);

  // Repos with low PR count (commit-based)
  const commitBasedRepos = repos.filter((r: any) => r.status === 'ready' && Number(r.pr_count ?? 0) < 5);

  const totalPRs    = Number(stats.total_prs    ?? 0);
  const criticalPRs = Number(stats.critical_prs ?? 0);
  const highPRs     = Number(stats.high_prs     ?? 0);

  return (
    <div className="max-w-5xl fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Org Overview</h1>
        <p className="text-slate-500 text-sm mt-1">Cross-repo health, dependencies, and knowledge risks.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Repos Indexed" value={repos.length} sub={`${edges.length} cross-repo deps`} />
        <StatCard label="Critical PRs" value={criticalPRs} sub="last 30 days" color={criticalPRs > 0 ? 'text-red-400' : 'text-white'} />
        <StatCard label="High Risk PRs" value={highPRs} sub="last 30 days" color={highPRs > 3 ? 'text-orange-400' : 'text-white'} />
        <StatCard label="PRs Analyzed" value={totalPRs} sub="total across all repos" />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Critical repos */}
        <div className="bg-[#0d1424] border border-slate-800 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-800/80">
            <AlertTriangle size={14} className="text-orange-400" />
            <h2 className="text-white font-semibold text-sm">Most Depended-On Repos</h2>
            <span className="text-slate-600 text-xs ml-auto">Single-point-of-failure risk</span>
          </div>
          <div className="p-4 space-y-2">
            {criticalRepos.length === 0 ? (
              <p className="text-slate-600 text-sm text-center py-4">No dependency data yet. Repos still indexing.</p>
            ) : criticalRepos.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-slate-900/40 rounded-lg border border-slate-800/50">
                <div>
                  <p className="text-slate-200 text-sm font-medium">{r.full_name.split('/')[1]}</p>
                  <p className="text-slate-600 text-xs mt-0.5">{r.full_name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-orange-400 text-sm font-semibold">
                    {dependentCounts.get(r.id) ?? 0} repos depend
                  </span>
                  <button onClick={() => navigate('/admin/dependency-graph')}
                    className="p-1.5 text-slate-600 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dependency summary */}
        <div className="bg-[#0d1424] border border-slate-800 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-800/80">
            <Layers size={14} className="text-indigo-400" />
            <h2 className="text-white font-semibold text-sm">Cross-Repo Dependencies</h2>
            <button onClick={() => navigate('/admin/dependency-graph')}
              className="text-indigo-400 hover:text-indigo-300 text-xs ml-auto flex items-center gap-1 transition-colors">
              View Graph <ArrowRight size={11} />
            </button>
          </div>
          <div className="p-4">
            {edges.length === 0 ? (
              <p className="text-slate-600 text-sm text-center py-4">No cross-repo dependencies detected yet.</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {edges.slice(0, 8).map((e: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 font-medium truncate max-w-[120px]">{e.source_name?.split('/')[1]}</span>
                    <span className="text-slate-700">→</span>
                    <span className="text-indigo-400 font-medium truncate max-w-[120px]">{e.target_name?.split('/')[1]}</span>
                    <span className={`ml-auto shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                      e.dependency_type === 'npm_package'
                        ? 'text-green-400 bg-green-500/10 border-green-500/20'
                        : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                    }`}>{e.dependency_type === 'npm_package' ? 'npm' : 'import'}</span>
                  </div>
                ))}
                {edges.length > 8 && (
                  <p className="text-slate-600 text-xs text-center pt-1">+{edges.length - 8} more</p>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Commit-based repos warning */}
      {commitBasedRepos.length > 0 && (
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={15} className="text-yellow-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-yellow-300 text-sm font-medium mb-1">
                {commitBasedRepos.length} repo{commitBasedRepos.length > 1 ? 's' : ''} using commit-based analysis
              </p>
              <p className="text-slate-500 text-xs mb-2">
                These repos have fewer than 5 PRs. Ownership data comes from commits, which is less accurate.
              </p>
              <div className="flex flex-wrap gap-2">
                {commitBasedRepos.map((r: any) => (
                  <span key={r.id} className="text-xs px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-400 font-mono">
                    {r.full_name.split('/')[1]}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: <GitBranch size={15} />, label: 'Dependency Graph', desc: 'Visual cross-repo map', to: '/admin/dependency-graph' },
          { icon: <Users size={15} />, label: 'Expert Finder', desc: 'Who knows what across repos', to: '/admin/experts' },
          { icon: <GitPullRequest size={15} />, label: 'Eng Health', desc: 'PR risk & bus factor', to: '/admin/health' },
        ].map(item => (
          <button key={item.to} onClick={() => navigate(item.to)}
            className="flex items-center gap-3 p-4 bg-[#0d1424] border border-slate-800 hover:border-indigo-500/40 rounded-xl text-left transition-colors group">
            <span className="text-slate-500 group-hover:text-indigo-400 transition-colors">{item.icon}</span>
            <div>
              <p className="text-slate-200 text-sm font-medium">{item.label}</p>
              <p className="text-slate-600 text-xs">{item.desc}</p>
            </div>
            <ArrowRight size={13} className="text-slate-700 group-hover:text-indigo-400 ml-auto transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}
