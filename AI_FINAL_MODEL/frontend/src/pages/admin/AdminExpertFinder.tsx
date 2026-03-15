// PHASE2_DISABLED — AdminExpertFinder. Re-enable with PHASE2_ENABLED=true.
import { useState } from 'react';
import axios from '../../config/axios';
import { Search, Users, Loader2, FileCode } from 'lucide-react';

interface Expert {
  login: string;
  name: string;
  score: number;
  total_files: number;
  repos: string[];
  top_files: Array<{ repo: string; file: string; pct: number }>;
}

interface RelatedFile {
  file_path: string;
  repo_name: string;
  owner: string | null;
}

export default function AdminExpertFinder() {
  const [topic, setTopic]   = useState('');
  const [query, setQuery]   = useState('');
  const [loading, setLoad]  = useState(false);
  const [result, setResult] = useState<{ experts: Expert[]; related_files: RelatedFile[] } | null>(null);

  const search = async () => {
    if (!topic.trim()) return;
    setLoad(true);
    setQuery(topic.trim());
    try {
      const res = await axios.get('/api/admin/experts', { params: { topic: topic.trim() } });
      setResult(res.data);
    } catch {
      setResult({ experts: [], related_files: [] });
    } finally {
      setLoad(false);
    }
  };

  const getRepoName = (full: string) => full.split('/')[1] ?? full;

  return (
    <div className="max-w-3xl fade-in space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Expert Finder</h1>
        <p className="text-slate-500 text-sm mt-1">
          Who knows what, across your entire codebase?
        </p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Search topic or file pattern… e.g. authentication, payments, database"
          className="flex-1 bg-[#0d1424] border border-slate-800 focus:border-indigo-500/50 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none text-sm transition-colors"
        />
        <button onClick={search} disabled={loading || !topic.trim()}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-5 py-3 rounded-xl text-sm font-medium transition-colors">
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          Find
        </button>
      </div>

      {/* Quick topic chips */}
      {!result && (
        <div className="flex flex-wrap gap-2">
          {['auth', 'payment', 'database', 'api', 'frontend', 'webhook', 'email', 'queue'].map(t => (
            <button key={t} onClick={async () => {
              setTopic(t); setLoad(true); setQuery(t);
              try {
                const res = await axios.get('/api/admin/experts', { params: { topic: t } });
                setResult(res.data);
              } catch { setResult({ experts: [], related_files: [] }); }
              finally { setLoad(false); }
            }}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700 transition-colors">
              {t}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 gap-2">
          <Loader2 size={20} className="animate-spin text-indigo-400" />
          <p className="text-slate-500 text-sm">Searching across all repos…</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          <p className="text-slate-500 text-sm">
            Results for <span className="text-white font-medium">"{query}"</span> across all repos
          </p>

          {/* Experts */}
          {result.experts.length === 0 ? (
            <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-8 text-center">
              <Users size={28} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 font-medium mb-1">No experts found</p>
              <p className="text-slate-600 text-sm">Try a different search term, or wait for repos to finish indexing.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {result.experts.map((expert, i) => (
                <div key={expert.login} className="bg-[#0d1424] border border-slate-800 rounded-xl p-4">
                  <div className="flex items-start gap-4">
                    <div className="relative shrink-0">
                      <img
                        src={`https://github.com/${expert.login}.png?size=40`}
                        className="w-10 h-10 rounded-full ring-1 ring-slate-700"
                        alt=""
                        onError={(ev) => { (ev.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${expert.login}`; }}
                      />
                      <span className="absolute -top-1 -right-1 text-[11px] leading-none">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="text-white font-semibold">{expert.login}</p>
                        <span className="text-slate-600 text-xs">{expert.total_files} files</span>
                        <div className="flex gap-1 flex-wrap ml-1">
                          {expert.repos.map(r => (
                            <span key={r} className="text-[10px] px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded font-mono">
                              {getRepoName(r)}
                            </span>
                          ))}
                        </div>
                      </div>
                      {/* Score bar */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-indigo-500 transition-all" style={{ width: `${expert.score}%` }} />
                        </div>
                        <span className="text-indigo-400 text-xs font-medium shrink-0 w-12 text-right">
                          {expert.score}/100
                        </span>
                      </div>
                      {/* Top files */}
                      <div className="space-y-1">
                        {expert.top_files.slice(0, 3).map((f, j) => (
                          <div key={j} className="flex items-center gap-2 text-xs">
                            <FileCode size={11} className="text-slate-700 shrink-0" />
                            <span className="text-slate-500 shrink-0">{getRepoName(f.repo)}:</span>
                            <span className="font-mono text-slate-400 truncate">{f.file}</span>
                            <span className="text-slate-700 shrink-0 ml-auto">{f.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Related files */}
          {result.related_files.length > 0 && (
            <div className="bg-[#0d1424] border border-slate-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-800/80">
                <FileCode size={14} className="text-slate-500" />
                <h2 className="text-white font-semibold text-sm">Related Files Across Repos</h2>
              </div>
              <div className="p-4 space-y-1.5">
                {result.related_files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs py-1">
                    <span className="text-slate-500 shrink-0 w-28 truncate">{getRepoName(f.repo_name)}</span>
                    <span className="font-mono text-slate-400 flex-1 truncate">{f.file_path}</span>
                    {f.owner && <span className="text-slate-600 shrink-0">@{f.owner}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
