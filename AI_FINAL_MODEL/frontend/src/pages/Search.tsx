// PHASE2_DISABLED — Search. Re-enable with PHASE2_ENABLED=true.
import { useState } from 'react';
import axios from '../config/axios';
import { Search as SearchIcon, Loader2, Sparkles, FileCode, GitCommit, User } from 'lucide-react';

const EXAMPLES = [
  'Which files handle authentication?',
  'Who wrote the payment processing module?',
  'What broke in auth last year?',
  'Why do we use this pattern in the billing service?',
  'Which services depend on the user module?',
  'Is the payment processor safe to change?',
];

export default function Search() {
  const [query, setQuery]   = useState('');
  const [result, setResult] = useState<{ answer: string; sources: any[]; related_prs: any[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (q?: string) => {
    const q_ = q || query;
    if (!q_.trim() || loading) return;
    if (q) setQuery(q);
    setLoading(true);
    setResult(null);
    try {
      const res = await axios.post('/api/search', { query: q_ });
      setResult(res.data);
    } catch {
      setResult({ answer: 'Search failed. Please try again.', sources: [], related_prs: [] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Code Search</h1>
        <p className="text-slate-500 text-sm">
          Ask anything — code structure, ownership, history, decisions, past incidents.
        </p>
      </div>

      <div className="relative mb-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <SearchIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Who wrote the payment module? What broke last month?"
              className="w-full bg-[#0d1424] border border-slate-800 focus:border-indigo-500/50 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-slate-600 focus:outline-none transition-colors text-sm"
            />
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={loading || !query.trim()}
            className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl transition-colors flex items-center gap-2 text-sm font-medium shrink-0"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Example prompts */}
      {!result && !loading && (
        <div className="space-y-2">
          <p className="text-slate-600 text-xs uppercase tracking-wide font-medium mb-3">Try asking</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => handleSearch(ex)}
                className="px-3 py-1.5 text-sm text-slate-400 bg-[#0d1424] border border-slate-800 hover:border-slate-700 hover:text-slate-200 rounded-lg transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4 fade-in">
          {/* Answer */}
          <div className="bg-[#0d1424] border border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-800/80">
              <Sparkles size={14} className="text-indigo-400" />
              <span className="text-white text-sm font-semibold">Answer</span>
            </div>
            <div className="p-5">
              <p className="text-slate-300 leading-relaxed whitespace-pre-wrap text-sm">{result.answer}</p>
            </div>
          </div>

          {/* Relevant files with git context */}
          {result.sources?.length > 0 && (
            <div className="bg-[#0d1424] border border-slate-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-800/80">
                <FileCode size={14} className="text-slate-500" />
                <span className="text-white text-sm font-semibold">Relevant Files</span>
              </div>
              <div className="divide-y divide-slate-800/50">
                {result.sources.map((s: any, i: number) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3">
                    <span className="font-mono text-blue-400 text-sm flex-1 truncate">{s.file}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      {s.line && <span className="text-slate-600 text-xs">:{s.line}</span>}
                      {s.owner && (
                        <span className="flex items-center gap-1 text-slate-500 text-xs">
                          <User size={10} /> {s.owner}
                        </span>
                      )}
                      {s.bus_factor === 1 && (
                        <span className="text-red-400 text-xs font-medium bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                          Solo owner
                        </span>
                      )}
                      {s.incidents > 0 && (
                        <span className="text-orange-400 text-xs">⚠️ {s.incidents}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related PRs */}
          {result.related_prs?.length > 0 && (
            <div className="bg-[#0d1424] border border-slate-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-800/80">
                <GitCommit size={14} className="text-slate-500" />
                <span className="text-white text-sm font-semibold">Related PRs</span>
              </div>
              <div className="divide-y divide-slate-800/50">
                {result.related_prs.map((p: any, i: number) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3">
                    <span className="text-slate-600 text-xs shrink-0">#{p.pr_number}</span>
                    <span className="text-slate-300 text-sm flex-1 truncate">{p.title}</span>
                    <span className={`text-xs shrink-0 ${p.state === 'merged' ? 'text-green-400' : p.state === 'closed' ? 'text-slate-500' : 'text-blue-400'}`}>
                      {p.state}
                    </span>
                    <span className="text-slate-600 text-xs shrink-0">
                      {new Date(p.date).toLocaleDateString('en', { month: 'short', year: 'numeric' })}
                    </span>
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
