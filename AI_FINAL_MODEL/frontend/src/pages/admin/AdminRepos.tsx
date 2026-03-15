import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../../config/axios';
import { useState } from 'react';
import { Plus, Loader2, X, Database, AlertCircle, GitPullRequest, ExternalLink } from 'lucide-react';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';

const RISK_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-500',
  medium:   'bg-yellow-500',
  low:      'bg-green-500',
};

const STATUS_BADGE: Record<string, string> = {
  ready:    'text-green-400 bg-green-500/10 border-green-500/20',
  indexing: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  pending:  'text-slate-400 bg-slate-800 border-slate-700',
  error:    'text-red-400 bg-red-500/10 border-red-500/20',
};

function getIndexingStage(progress: number): string {
  if (progress < 15)  return 'Cloning repository…';
  if (progress < 50)  return 'Parsing files…';
  if (progress < 72)  return 'Generating embeddings…';
  if (progress < 78)  return 'Building dependency graph…';
  if (progress < 86)  return 'Analyzing git history…';
  if (progress < 93)  return 'Indexing historical PRs…';
  if (progress < 100) return 'Registering webhook…';
  return 'Complete';
}

function RiskBar({ stats }: { stats: { critical: number; high: number; medium: number; low: number; total: number } }) {
  if (!stats.total) return <span className="text-slate-600 text-xs">No PRs analyzed</span>;
  const pct = (n: number) => `${Math.round((n / stats.total) * 100)}%`;
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-1.5 w-24 rounded-full overflow-hidden bg-slate-800">
        {(['critical','high','medium','low'] as const).map(r => (
          stats[r] > 0 && <div key={r} style={{ width: pct(stats[r]) }} className={`${RISK_COLORS[r]} h-full`} />
        ))}
      </div>
      <span className="text-slate-500 text-xs">{stats.total} PRs</span>
    </div>
  );
}

function RepoRow({ repo, onRemove }: { repo: any; onRemove: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  // Analysis mode badge: PR-based if ≥5 PRs, commit-based otherwise
  const prCount    = Number(repo.historical_prs_count ?? 0);
  const isReady    = repo.status === 'ready';
  const analysisMode = isReady
    ? prCount >= 5 ? 'pr' : prCount > 0 ? 'commit' : 'minimal'
    : null;

  return (
    <div className="bg-[#0d1424] border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-colors">
      <div className="flex items-center gap-4 p-4">
        {/* Repo info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <a href={`https://github.com/${repo.full_name}`} target="_blank" rel="noreferrer"
              className="text-white font-medium text-sm hover:text-indigo-300 transition-colors flex items-center gap-1 truncate">
              {repo.full_name} <ExternalLink size={11} className="shrink-0" />
            </a>
            {/* Analysis mode badge */}
            {analysisMode === 'pr' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border text-green-400 bg-green-500/10 border-green-500/20 font-medium shrink-0">
                PR-based
              </span>
            )}
            {analysisMode === 'commit' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border text-yellow-400 bg-yellow-500/10 border-yellow-500/20 font-medium shrink-0"
                title="Fewer than 5 PRs found — ownership analysis uses commit history">
                Commit-based
              </span>
            )}
            {analysisMode === 'minimal' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border text-slate-500 bg-slate-800 border-slate-700 font-medium shrink-0"
                title="No PRs or commits found yet">
                Insufficient data
              </span>
            )}
          </div>
          <RiskBar stats={repo.risk_stats || { critical: 0, high: 0, medium: 0, low: 0, total: 0 }} />
        </div>

        {/* Status */}
        <div className="shrink-0 min-w-0">
          {repo.status === 'indexing' ? (
            <div className="flex flex-col gap-1.5 items-end min-w-[140px]">
              <div className="flex items-center gap-2 w-full">
                <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-blue-500 transition-all duration-1000"
                    style={{ width: `${repo.indexing_progress || 0}%` }}
                  />
                </div>
                <span className="text-blue-400 text-xs font-medium shrink-0 w-8 text-right">
                  {repo.indexing_progress || 0}%
                </span>
              </div>
              <span className="text-slate-600 text-[10px] truncate max-w-[160px]">
                {getIndexingStage(repo.indexing_progress || 0)}
              </span>
            </div>
          ) : (
            <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${STATUS_BADGE[repo.status] || STATUS_BADGE.pending}`}>
              {repo.status}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {repo.status === 'error' && (
            <button onClick={() => setExpanded(v => !v)}
              className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="View error">
              <AlertCircle size={14} />
            </button>
          )}
          <a href={`/dashboard?repo=${repo.id}`}
            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors" title="View PRs">
            <GitPullRequest size={14} />
          </a>
          <button onClick={() => onRemove(repo.id)}
            className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Remove">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Error details */}
      {expanded && repo.error_message && (
        <div className="px-4 pb-3 pt-0">
          <div className="bg-red-500/5 border border-red-500/15 rounded-lg p-3 space-y-2">
            <p className="text-red-300 text-xs font-medium">Error details:</p>
            <p className="text-slate-400 text-xs font-mono">{repo.error_message}</p>
            <div className="pt-1.5 border-t border-red-500/10">
              <p className="text-slate-500 text-xs font-medium mb-1">Common fixes:</p>
              <ul className="text-slate-600 text-xs space-y-0.5 list-disc list-inside">
                <li>Install the GitHub App via Settings → Integrations</li>
                <li>Check the repo is not empty or archived</li>
                <li>Private repos need the GitHub App installed with read access</li>
              </ul>
              <p className="text-slate-600 text-xs mt-2">
                Still stuck? Remove this repo and add it again, or{' '}
                <a href="mailto:support@codebasememory.com" className="text-indigo-400 hover:text-indigo-300 underline">
                  contact support
                </a>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



export default function AdminRepos() {
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected]   = useState<any>(null);
  const [search, setSearch]       = useState('');

  const { data: reposData } = useQuery({
    queryKey: ['repos'],
    queryFn: () => axios.get('/api/repos').then(r => r.data),
    refetchInterval: (query) => {
      const repos = query.state.data?.repos || [];
      const hasIndexing = repos.some((r: any) => r.status === 'indexing');
      return hasIndexing ? 3000 : 20000;
    },
  });

  const { data: billingData } = useQuery({
    queryKey: ['billing-plan'],
    queryFn: () => axios.get('/api/billing/plan').then(r => r.data),
  });

  const { data: ghRepos, isLoading: ghLoading } = useQuery({
    queryKey: ['github-repos'],
    queryFn: () => axios.get('/api/repos/github').then(r => r.data.repos),
    enabled: showModal,
  });

  const addMut = useMutation({
    mutationFn: (repo: any) => axios.post('/api/repos', {
      github_repo_id: repo.id, full_name: repo.full_name, default_branch: repo.default_branch,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['repos'] }); setShowModal(false); setSelected(null); },
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/repos/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['repos'] }); toast('Repository removed', 'success'); },
    onError: () => toast('Failed to remove repository', 'error'),
  });

  const repos    = reposData?.repos || [];
  const addedIds = new Set(repos.map((r: any) => r.github_repo_id));
  const maxRepos = billingData?.plan?.maxRepos;
  const tier     = billingData?.subscription?.tier || 'free';
  const atLimit  = maxRepos != null && repos.length >= maxRepos;

  const filtered = repos.filter((r: any) =>
    !search || r.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-3xl fade-in">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Repositories</h1>
          <p className="text-slate-500 text-sm mt-1">Manage the repos being analyzed. Indexing typically takes 5–20 minutes.</p>
        </div>
        <button onClick={() => setShowModal(true)} disabled={atLimit}
          title={atLimit ? `Plan limit: ${maxRepos} repos` : undefined}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium shrink-0 transition-colors">
          <Plus size={15} /> Add Repository
        </button>
      </div>

      {/* Plan usage */}
      <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-slate-500" />
            <span className="text-slate-400 text-sm">
              <span className="text-white font-medium">{repos.length}</span>
              {maxRepos && maxRepos !== Infinity
                ? <> / <span className="text-white font-medium">{maxRepos}</span> repos</>
                : ' repos (unlimited)'}
            </span>
          </div>
          <span className="text-xs text-slate-600 capitalize font-medium">{tier} plan</span>
        </div>
        {maxRepos && maxRepos !== Infinity && (
          <div className="bg-slate-800 rounded-full h-1">
            <div className={`h-1 rounded-full transition-all ${atLimit ? 'bg-red-500' : 'bg-indigo-500'}`}
              style={{ width: `${Math.min((repos.length / maxRepos) * 100, 100)}%` }} />
          </div>
        )}
        {atLimit && (
          <p className="text-xs text-amber-400 mt-2">
            Repo limit reached. <a href="/admin/billing" className="underline hover:text-amber-300">Upgrade your plan</a> to add more.
          </p>
        )}
      </div>

      {/* Search */}
      {repos.length > 4 && (
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter repositories…"
          className="w-full bg-[#0d1424] border border-slate-800 focus:border-indigo-500/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none text-sm mb-4 transition-colors" />
      )}

      {/* Repo list */}
      {repos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-slate-800 rounded-xl">
          <Database size={32} className="text-slate-700 mb-3" />
          <p className="text-slate-400 font-medium mb-1">No repositories yet</p>
          <p className="text-slate-600 text-sm max-w-xs">Add your first GitHub repo to start analyzing PRs automatically.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((repo: any) => (
            <RepoRow
              key={repo.id}
              repo={repo}
              onRemove={async (id) => {
                const ok = await confirm({ title: 'Remove Repository', message: `Remove ${repo.full_name}? This will stop analyzing its PRs.`, confirmText: 'Remove' });
                if (ok) removeMut.mutate(id);
              }}
            />
          ))}
          {filtered.length === 0 && search && (
            <p className="text-center text-slate-600 py-8 text-sm">No repos matching "{search}"</p>
          )}
        </div>
      )}

      {/* Add repo modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d1424] border border-slate-800 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Add Repository</h2>
              <button onClick={() => { setShowModal(false); setSelected(null); }}
                className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>
            {ghLoading ? (
              <div className="flex items-center justify-center py-12 gap-2">
                <Loader2 size={20} className="animate-spin text-indigo-400" />
                <p className="text-slate-500 text-sm">Fetching your repos…</p>
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 space-y-1.5 min-h-0">
                {(ghRepos || []).filter((r: any) => !addedIds.has(String(r.id))).length === 0
                  ? <p className="text-slate-500 text-sm text-center py-8">All repos are already added.</p>
                  : (ghRepos || []).filter((r: any) => !addedIds.has(String(r.id))).map((repo: any) => (
                    <div key={repo.id} onClick={() => setSelected(repo)}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer border transition-all ${
                        selected?.id === repo.id
                          ? 'border-indigo-500/50 bg-indigo-500/10'
                          : 'border-slate-800 hover:border-slate-700 bg-[#070c14]'
                      }`}>
                      <div>
                        <p className="text-white text-sm font-medium">{repo.full_name}</p>
                        <p className="text-slate-500 text-xs mt-0.5">
                          {repo.private ? '🔒 Private' : '🌐 Public'}
                          {repo.language && ` · ${repo.language}`}
                        </p>
                      </div>
                      {selected?.id === repo.id && <span className="text-indigo-400 text-xs font-medium">✓</span>}
                    </div>
                  ))
                }
              </div>
            )}
            <div className="flex gap-3 mt-4 pt-4 border-t border-slate-800">
              <button onClick={() => { setShowModal(false); setSelected(null); }}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors">
                Cancel
              </button>
              <button onClick={() => selected && addMut.mutate(selected)} disabled={!selected || addMut.isPending}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
                {addMut.isPending ? <><Loader2 size={14} className="animate-spin" /> Adding…</> : 'Add & Index'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
