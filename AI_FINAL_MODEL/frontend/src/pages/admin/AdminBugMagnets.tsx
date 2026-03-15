// PHASE2_DISABLED — AdminBugMagnets. Re-enable with PHASE2_ENABLED=true.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from '../../config/axios';
import { Bug, Flame, RefreshCw, AlertTriangle, TrendingUp } from 'lucide-react';

function StatCard({ label, value, sub, color = 'text-white' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-5">
      <p className="text-slate-500 text-xs mb-2">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-slate-600 text-xs mt-1">{sub}</p>}
    </div>
  );
}

function SeverityBadge({ count }: { count: number }) {
  if (count >= 20) return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-500/15 text-red-400 border border-red-500/25">CRITICAL</span>;
  if (count >= 10) return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/25">HIGH</span>;
  if (count >= 5)  return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">MEDIUM</span>;
  return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-700/50 text-slate-400 border border-slate-700">LOW</span>;
}

export default function AdminBugMagnets() {
  const [repoId, setRepoId] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['bug-magnets', repoId],
    queryFn: () => axios.get('/api/admin/bug-magnets', { params: repoId ? { repoId } : {} }).then(r => r.data),
    staleTime: 5 * 60_000,
  });

  const files   = data?.files   ?? [];
  const summary = data?.summary ?? {};
  const repos   = data?.repos   ?? [];

  const totalBugFixes   = Number(summary.total_incidents ?? 0);
  const totalReverts    = Number(summary.total_reverts   ?? 0);
  const hotspots        = Number(summary.hotspot_count   ?? 0);
  const reposAffected   = Number(summary.repos_affected  ?? 0);

  return (
    <div className="max-w-5xl fade-in space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bug size={20} className="text-red-400" />
            Bug Magnet Files
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Files ranked by bug-fix commit frequency — where your tech debt lives.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs px-3 py-2 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Bug-Fix Commits"
          value={totalBugFixes.toLocaleString()}
          sub="fix/hotfix/error keywords"
          color={totalBugFixes > 100 ? 'text-red-400' : 'text-white'}
        />
        <StatCard
          label="Reverts"
          value={totalReverts.toLocaleString()}
          sub="revert commits detected"
          color={totalReverts > 20 ? 'text-orange-400' : 'text-white'}
        />
        <StatCard
          label="Hotspot Files"
          value={hotspots}
          sub="5+ bug-fix commits"
          color={hotspots > 5 ? 'text-red-400' : hotspots > 0 ? 'text-orange-400' : 'text-green-400'}
        />
        <StatCard label="Repos Affected" value={reposAffected} />
      </div>

      {/* Repo filter */}
      {repos.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-sm">Filter:</span>
          <select
            value={repoId}
            onChange={e => setRepoId(e.target.value)}
            className="bg-[#0d1424] border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All repos</option>
            {repos.map((r: any) => (
              <option key={r.id} value={r.id}>{r.full_name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Files table */}
      <div className="bg-[#0d1424] border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-800/80">
          <Flame size={14} className="text-red-400" />
          <h2 className="text-white font-semibold text-sm">Files Ranked by Bug Frequency</h2>
          <span className="text-slate-600 text-xs ml-auto">
            {files.length} files with bug-fix history
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-600 text-sm">Loading…</div>
        ) : isError ? (
          <div className="p-8 text-center text-red-400 text-sm">Failed to load. Make sure repos are indexed.</div>
        ) : files.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <TrendingUp size={28} className="text-slate-700 mx-auto" />
            <p className="text-slate-500 text-sm">No bug-fix patterns detected yet.</p>
            <p className="text-slate-600 text-xs">Index repositories with commit history to see bug magnet analysis.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-4 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              <span>File</span>
              <span className="text-center w-20">Severity</span>
              <span className="text-right w-16">Bug Fixes</span>
              <span className="text-right w-14">Reverts</span>
              <span className="text-right w-16">Density</span>
              <span className="text-right w-20">Last Commit</span>
            </div>

            {files.map((f: any, i: number) => {
              const bugFixes = Number(f.incident_count ?? 0);
              const reverts  = Number(f.revert_count   ?? 0);
              const density  = Number(f.bug_density_pct ?? 0);
              const lastDate = f.last_commit_date
                ? new Date(f.last_commit_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                : '—';
              const fileName = f.file_path.split('/').pop();
              const filePath = f.file_path.split('/').slice(0, -1).join('/');

              return (
                <div
                  key={i}
                  className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-4 px-5 py-3 hover:bg-white/2 transition-colors ${
                    i === 0 ? 'bg-red-500/3' : ''
                  }`}
                >
                  {/* File info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono text-slate-200 text-xs font-medium">{fileName}</p>
                      {i < 3 && <Flame size={11} className="text-red-400 shrink-0" />}
                    </div>
                    <p className="text-slate-600 text-[10px] truncate mt-0.5">
                      {f.repo_name?.split('/')[1] ?? f.repo_name}
                      {filePath && ` · ${filePath}`}
                    </p>
                    {f.primary_owner_name && f.primary_owner_name !== 'unknown' && (
                      <p className="text-slate-700 text-[10px] mt-0.5">Owner: {f.primary_owner_name}</p>
                    )}
                  </div>

                  {/* Severity */}
                  <div className="w-20 flex justify-center">
                    <SeverityBadge count={bugFixes} />
                  </div>

                  {/* Bug fixes */}
                  <div className="w-16 text-right">
                    <span className={`text-sm font-bold ${bugFixes >= 10 ? 'text-red-400' : bugFixes >= 5 ? 'text-orange-400' : 'text-slate-300'}`}>
                      {bugFixes}
                    </span>
                    <p className="text-slate-700 text-[10px]">fixes</p>
                  </div>

                  {/* Reverts */}
                  <div className="w-14 text-right">
                    <span className={`text-sm font-semibold ${reverts > 0 ? 'text-orange-400' : 'text-slate-600'}`}>
                      {reverts}
                    </span>
                    <p className="text-slate-700 text-[10px]">reverts</p>
                  </div>

                  {/* Bug density */}
                  <div className="w-16 text-right">
                    <span className={`text-sm font-semibold ${density >= 30 ? 'text-red-400' : density >= 15 ? 'text-orange-400' : 'text-slate-400'}`}>
                      {density}%
                    </span>
                    <p className="text-slate-700 text-[10px]">of commits</p>
                  </div>

                  {/* Last commit */}
                  <div className="w-20 text-right">
                    <p className="text-slate-500 text-xs">{lastDate}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Explainer */}
      {files.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-slate-900/40 border border-slate-800/50 rounded-xl">
          <AlertTriangle size={14} className="text-yellow-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-500 space-y-1">
            <p><strong className="text-slate-400">Bug Fixes:</strong> Commits with keywords: fix, bugfix, hotfix, critical, emergency, rollback, crash, error, outage.</p>
            <p><strong className="text-slate-400">Density:</strong> Bug-fix commits as % of total commits. A file with 30%+ density is spending more time being repaired than built.</p>
            <p><strong className="text-slate-400">Action:</strong> Files with CRITICAL severity are refactor candidates. Start with the highest density + highest churn combination.</p>
          </div>
        </div>
      )}
    </div>
  );
}
