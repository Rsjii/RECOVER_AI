import { RefreshCw, Trash2, CheckCircle, Clock, AlertCircle, Loader2, GitBranch } from 'lucide-react';

interface Repo {
  id: string;
  full_name: string;
  status: string;
  indexing_progress: number;
  total_chunks: number;
  indexed_at: string | null;
  error_message: string | null;
}

interface Props {
  repo: Repo;
  onReindex: (id: string) => void;
  onRemove: (id: string) => void;
}

const STATUS: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  ready:    { icon: <CheckCircle size={13} />, label: 'Ready',    color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  indexing: { icon: <Loader2 size={13} className="animate-spin" />, label: 'Indexing…', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  pending:  { icon: <Clock size={13} />,       label: 'Queued',   color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  error:    { icon: <AlertCircle size={13} />, label: 'Error',    color: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

export default function RepoCard({ repo, onReindex, onRemove }: Props) {
  const status = STATUS[repo.status] || STATUS.pending;
  const [owner, name] = repo.full_name.split('/');

  return (
    <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
            <GitBranch size={14} className="text-slate-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-white text-sm font-medium">
                <span className="text-slate-500">{owner}/</span>{name}
              </span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${status.color}`}>
                {status.icon} {status.label}
              </span>
            </div>

            {repo.status === 'ready' && (
              <p className="text-slate-600 text-xs">
                {repo.total_chunks.toLocaleString()} chunks indexed
                {repo.indexed_at && ` · ${new Date(repo.indexed_at).toLocaleDateString()}`}
              </p>
            )}
            {repo.status === 'error' && (
              <p className="text-red-400 text-xs mt-0.5 truncate">{repo.error_message || 'Unknown error'}</p>
            )}
            {repo.status === 'indexing' && (
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>Indexing repository…</span>
                  <span>{repo.indexing_progress}%</span>
                </div>
                <div className="bg-slate-800 rounded-full h-1">
                  <div
                    className="bg-blue-500 h-1 rounded-full transition-all duration-500"
                    style={{ width: `${repo.indexing_progress}%` }}
                  />
                </div>
              </div>
            )}
            {repo.status === 'pending' && (
              <p className="text-slate-600 text-xs">Waiting to start indexing…</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onReindex(repo.id)}
            disabled={repo.status === 'indexing' || repo.status === 'pending'}
            title="Reindex"
            className="p-2 text-slate-600 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-30"
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={() => onRemove(repo.id)}
            title="Remove"
            className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
