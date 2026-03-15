import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from '../../config/axios';
import { Loader2, RefreshCw } from 'lucide-react';

interface Props {
  onNext: () => void;
}

interface PreviewBrief {
  content_raw: string;
  pattern_count: number;
  severity_high: number;
  severity_medium: number;
  items: Array<{
    pattern_type: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    title: string;
    description: string;
    action_suggestion: string;
  }>;
}

const SEVERITY_CONFIG = {
  HIGH:   { icon: '🔴', color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
  MEDIUM: { icon: '🟡', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  LOW:    { icon: '🟢', color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
};

export default function Step5Preview({ onNext }: Props) {
  const [brief, setBrief] = useState<PreviewBrief | null>(null);

  const generate = useMutation({
    mutationFn: () => axios.post('/api/briefs/preview').then(r => r.data),
    onSuccess: (data: PreviewBrief) => setBrief(data),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white text-lg font-semibold">Preview Your Brief</h2>
        <p className="text-slate-500 text-sm mt-1">
          Generate a sample brief from the last 7 days of data to see what your daily report will look like.
        </p>
      </div>

      {!brief && !generate.isPending && (
        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
          <p className="text-slate-500 text-sm mb-4">No preview generated yet.</p>
          <button
            onClick={() => generate.mutate()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium mx-auto"
          >
            <RefreshCw size={14} /> Generate Preview
          </button>
        </div>
      )}

      {generate.isPending && (
        <div className="rounded-xl border border-slate-700 p-8 text-center">
          <Loader2 size={24} className="animate-spin text-indigo-400 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Analysing last 7 days of data...</p>
          <p className="text-slate-600 text-xs mt-1">This may take a few seconds</p>
        </div>
      )}

      {brief && (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">AI Brief Summary</span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded px-1.5 py-0.5">Preview</span>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">{brief.content_raw}</p>
          </div>

          {brief.items.length > 0 && (
            <div className="space-y-2">
              {brief.items.map((item, i) => {
                const cfg = SEVERITY_CONFIG[item.severity];
                return (
                  <div key={i} className={`rounded-lg border p-3 ${cfg.bg}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold ${cfg.color}`}>{cfg.icon} {item.severity}</span>
                    </div>
                    <p className="text-slate-200 text-sm font-medium">{item.title}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{item.description}</p>
                    <p className="text-slate-500 text-xs mt-0.5 italic">{item.action_suggestion}</p>
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={() => generate.mutate()}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300"
          >
            <RefreshCw size={12} /> Regenerate
          </button>
        </div>
      )}

      <div className="flex gap-3">
        {brief && (
          <button
            onClick={onNext}
            className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
          >
            Looks good — Finish setup →
          </button>
        )}
      </div>
    </div>
  );
}
