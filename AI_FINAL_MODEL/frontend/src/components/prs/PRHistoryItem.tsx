import { formatDate } from '../../lib/utils';
import { CheckCircle, XCircle, HelpCircle } from 'lucide-react';

interface SimilarPR {
  pr_number: number;
  title: string;
  outcome: 'succeeded' | 'failed' | 'unknown';
  similarity_score: number;
  pr_created_at: string;
}

const OUTCOME = {
  succeeded: { icon: <CheckCircle size={13} />, label: 'Succeeded', cls: 'text-green-400 bg-green-500/10 border-green-500/20' },
  failed:    { icon: <XCircle size={13} />,     label: 'Failed',    cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
  unknown:   { icon: <HelpCircle size={13} />,  label: 'Unknown',   cls: 'text-slate-500 bg-slate-800 border-slate-700' },
};

export default function PRHistoryItem({ pr }: { pr: SimilarPR }) {
  const o = OUTCOME[pr.outcome] || OUTCOME.unknown;
  const similarity = Math.round(pr.similarity_score * 100);

  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-800/60 last:border-0">
      <div className="shrink-0 mt-0.5">
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${o.cls}`}>
          {o.icon} {o.label}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-slate-500 text-xs font-mono">#{pr.pr_number}</span>
          <span className="text-slate-700 text-xs">·</span>
          <span className="text-slate-600 text-xs">{formatDate(pr.pr_created_at)}</span>
          <span className="text-slate-700 text-xs">·</span>
          <span className="text-indigo-500 text-xs">{similarity}% similar</span>
        </div>
        <p className="text-slate-300 text-sm leading-snug truncate">{pr.title}</p>
      </div>
    </div>
  );
}
