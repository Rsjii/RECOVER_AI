import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../config/axios';
import { useAuth } from '../contexts/AuthContext';
import RiskBadge from '../components/prs/RiskBadge';
import AffectedServices from '../components/prs/AffectedServices';
import PRHistoryItem from '../components/prs/PRHistoryItem';
import { formatDate } from '../lib/utils';
import {
  ArrowLeft, ExternalLink, FileCode, GitPullRequest,
  Brain, Lightbulb, Clock, MessageSquare, Trash2, Send, Users, Copy, RefreshCw,
} from 'lucide-react';
import { useState } from 'react';

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-[#0d1424] border border-slate-800 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-800/80">
        <span className="text-slate-500">{icon}</span>
        <h2 className="text-white font-semibold text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function NotesSection({ prId }: { prId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const canNote = user?.role === 'admin' || user?.role === 'reviewer';

  const { data } = useQuery({
    queryKey: ['pr-notes', prId],
    queryFn:  () => axios.get(`/api/prs/${prId}/notes`).then(r => r.data.notes),
  });

  const addMutation = useMutation({
    mutationFn: (note: string) => axios.post(`/api/prs/${prId}/notes`, { note }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['pr-notes', prId] }); setText(''); },
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) => axios.delete(`/api/prs/${prId}/notes/${noteId}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['pr-notes', prId] }),
  });

  const notes: any[] = data || [];

  return (
    <Section icon={<MessageSquare size={15} />} title={`Team Notes${notes.length > 0 ? ` (${notes.length})` : ''}`}>
      {notes.length === 0 && !canNote && (
        <p className="text-slate-600 text-sm">No notes yet.</p>
      )}
      {notes.length > 0 && (
        <div className="space-y-3 mb-4">
          {notes.map((n: any) => (
            <div key={n.id} className="group flex items-start gap-3">
              <img
                src={`https://github.com/${n.github_username}.png?size=28`}
                className="w-7 h-7 rounded-full ring-1 ring-slate-700 shrink-0 mt-0.5"
                alt=""
              />
              <div className="flex-1 bg-slate-800/60 rounded-lg px-3 py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400 text-xs font-medium">{n.github_username}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-700 text-xs">{formatDate(n.created_at)}</span>
                    {(user?.role === 'admin' || n.user_id === user?.id) && (
                      <button
                        onClick={() => deleteMutation.mutate(n.id)}
                        className="p-0.5 text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">{n.note}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {canNote && (
        <div className="flex items-start gap-3">
          <img
            src={`https://github.com/${user?.github_username}.png?size=28`}
            className="w-7 h-7 rounded-full ring-1 ring-slate-700 shrink-0 mt-0.5"
            alt=""
          />
          <div className="flex-1 flex gap-2">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim()) addMutation.mutate(text);
              }}
              placeholder="Add a note for the team… (Ctrl+Enter to submit)"
              rows={2}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 text-sm resize-none"
            />
            <button
              onClick={() => text.trim() && addMutation.mutate(text)}
              disabled={!text.trim() || addMutation.isPending}
              className="self-end flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      )}
      {!canNote && notes.length === 0 && (
        <p className="text-slate-600 text-sm italic">Reviewers and admins can add notes here.</p>
      )}
    </Section>
  );
}

const RANK_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function ReviewerCard({ reviewer, index }: { reviewer: any; index: number }) {
  const medal        = RANK_MEDAL[reviewer.rank ?? (index + 1)];
  const ownershipPct = Math.min(Math.round(reviewer.ownership_pct ?? 0), 100);
  const name         = reviewer.name || reviewer.email || '?';

  return (
    <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-800">
      <div className="flex items-center gap-3 mb-2">
        <div className="relative shrink-0">
          <img
            src={`https://github.com/${name}.png?size=32`}
            className="w-8 h-8 rounded-full ring-1 ring-slate-700"
            onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none'; }}
            alt=""
          />
          {medal && (
            <span className="absolute -top-1 -right-1 text-[11px] leading-none">{medal}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-slate-200 text-sm font-medium truncate">{name}</p>
            {reviewer.is_architecture_expert && (
              <span className="text-[9px] px-1.5 py-0.5 bg-purple-500/15 text-purple-400 border border-purple-500/20 rounded font-medium shrink-0">
                ARCH
              </span>
            )}
          </div>
          <p className="text-slate-500 text-xs truncate">{reviewer.reason}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-indigo-400 text-sm font-semibold">{reviewer.files_owned || 0}</span>
          <p className="text-slate-600 text-[10px]">files</p>
        </div>
      </div>
      {ownershipPct > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-600 text-[10px]">ownership of changed files</span>
            <span className="text-slate-400 text-[10px] font-medium">{ownershipPct}%</span>
          </div>
          <div className="bg-slate-800 rounded-full h-1">
            <div className="h-1 rounded-full bg-indigo-500" style={{ width: `${ownershipPct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

function DuplicateCodeSection({ findings }: { findings: any[] }) {
  if (!findings?.length) return null;
  return (
    <Section icon={<Copy size={15} />} title={`Similar Code Found (${findings.length})`}>
      <p className="text-slate-500 text-xs mb-4">
        These sections of this PR closely match existing code in your codebase. Consider reusing or abstracting shared logic.
      </p>
      <div className="space-y-3">
        {findings.map((f: any, i: number) => (
          <div key={i} className="bg-slate-900/60 rounded-lg p-3 border border-slate-800/50">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0 flex-1">
                <p className="text-slate-400 text-xs font-medium mb-0.5">Existing code in:</p>
                <p className="font-mono text-blue-400 text-xs truncate">{f.file_path || f.existing_file}</p>
              </div>
              <span className="shrink-0 text-xs px-2 py-0.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded font-medium">
                {Math.round((f.similarity ?? 0))}% similar
              </span>
            </div>
            {(f.content_preview || f.snippet) && (
              <div className="bg-[#060910] rounded p-2 border border-slate-800/50">
                <pre className="text-slate-400 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-24 overflow-y-auto">
                  {(f.content_preview || f.snippet || '').slice(0, 300)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-slate-700 text-xs mt-4 border-t border-slate-800 pt-3">
        Similarity computed using vector embeddings of added code vs existing codebase.
      </p>
    </Section>
  );
}

function CrossRepoImpactSection({ prId }: { prId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['cross-repo-impact', prId],
    queryFn:  () => axios.get(`/api/admin/cross-repo-impact/${prId}`).then(r => r.data.impacts),
    staleTime: 300_000,
  });

  const impacts: any[] = data ?? [];

  if (isLoading) return null;
  if (impacts.length === 0) return null;

  return (
    <Section icon={<GitPullRequest size={15} />} title={`Cross-Repo Impact (${impacts.length} repos affected)`}>
      <p className="text-slate-500 text-xs mb-4">
        Files changed in this PR are used by downstream repositories.
      </p>
      <div className="space-y-3">
        {impacts.map((impact: any, i: number) => (
          <div key={i} className="p-3 bg-slate-900/60 rounded-lg border border-slate-800/50">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-slate-200 text-sm font-medium">{impact.repo_name?.split('/')[1] ?? impact.repo_name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${
                    impact.dependency_type === 'npm_package'
                      ? 'text-green-400 bg-green-500/10 border-green-500/20'
                      : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                  }`}>
                    {impact.dependency_type === 'npm_package' ? 'npm' : 'import'}
                  </span>
                </div>
                <p className="text-slate-600 text-xs font-mono">{impact.repo_name}</p>
                <p className="text-slate-600 text-xs mt-1">
                  via <span className="text-slate-500 font-mono">{impact.target_package}</span>
                </p>
              </div>
              {impact.top_owner && (
                <div className="shrink-0 flex items-center gap-2 text-xs">
                  <img
                    src={`https://github.com/${impact.top_owner}.png?size=20`}
                    className="w-5 h-5 rounded-full ring-1 ring-slate-700"
                    alt=""
                    onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="text-right">
                    <p className="text-slate-400">@{impact.top_owner}</p>
                    <p className="text-slate-700">{Math.round(impact.top_owner_pct)}% owner</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="text-slate-700 text-xs mt-4 border-t border-slate-800 pt-3">
        Cross-repo dependencies auto-detected from package.json and import statements.
      </p>
    </Section>
  );
}

export default function PRDetail() {
  const { prId }   = useParams<{ prId: string }>();
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['pr', prId],
    queryFn:  () => axios.get(`/api/prs/${prId}`).then(r => r.data.pr),
    refetchInterval: (query) => {
      // Auto-refresh while PR is being analyzed
      return query.state.data?.status === 'analyzing' ? 3000 : false;
    },
  });

  // Manual re-analyze — admin only
  const reanalyzeMutation = useMutation({
    mutationFn: () => axios.post(`/api/admin/prs/${prId}/reanalyze`),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['pr', prId] }),
  });

  if (isLoading) return (
    <div className="space-y-4 max-w-4xl fade-in">
      {[1, 2, 3].map(i => <div key={i} className="skeleton h-32 w-full rounded-xl" />)}
    </div>
  );
  if (error || !data) return (
    <div className="text-center py-16">
      <p className="text-red-400 font-medium">PR not found</p>
      <button onClick={() => navigate(-1)} className="text-slate-500 text-sm mt-2 hover:text-slate-300 transition-colors">
        ← Go back
      </button>
    </div>
  );

  const pr = data;
  const isAnalyzing = pr.status === 'analyzing';

  return (
    <div className="max-w-4xl fade-in">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm mb-5 transition-colors group"
        >
          <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to PR Feed
        </button>

        <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <RiskBadge level={pr.risk_level} />
                <span className="text-slate-600 font-mono text-sm">#{pr.pr_number}</span>
                {pr.github_pr_url && (
                  <a
                    href={pr.github_pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-slate-500 hover:text-blue-400 text-xs transition-colors"
                  >
                    View on GitHub <ExternalLink size={12} />
                  </a>
                )}
                {/* Re-analyze button — admin only */}
                {user?.role === 'admin' && (
                  <button
                    onClick={() => reanalyzeMutation.mutate()}
                    disabled={reanalyzeMutation.isPending || isAnalyzing}
                    className="flex items-center gap-1.5 text-xs px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition-colors disabled:opacity-40"
                  >
                    <RefreshCw size={11} className={(reanalyzeMutation.isPending || isAnalyzing) ? 'animate-spin' : ''} />
                    {isAnalyzing ? 'Analyzing…' : reanalyzeMutation.isPending ? 'Queuing…' : 'Re-analyze'}
                  </button>
                )}
              </div>
              <h1 className="text-xl font-bold text-white mb-2 leading-snug">{pr.title}</h1>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                  <img src={`https://github.com/${pr.author}.png?size=20`} className="w-5 h-5 rounded-full" alt="" />
                  {pr.author}
                </div>
                <span className="text-slate-700 text-sm">{pr.repo_full_name}</span>
                <div className="flex items-center gap-1 text-slate-600 text-sm">
                  <Clock size={13} />
                  {formatDate(pr.pr_created_at)}
                </div>
                {isAnalyzing && (
                  <span className="text-xs text-yellow-400 flex items-center gap-1">
                    <RefreshCw size={11} className="animate-spin" /> Analyzing…
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-3xl font-bold text-white">{pr.risk_score}</div>
              <div className="text-slate-600 text-xs">risk score</div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <Section icon={<FileCode size={15} />} title={`Files Changed (${pr.files_changed?.length || 0})`}>
          <div className="space-y-1">
            {(pr.files_changed || []).map((f: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-800/50 last:border-0">
                <span className="font-mono text-slate-300 text-xs truncate flex-1">{f.path}</span>
                <div className="flex items-center gap-3 text-xs shrink-0 ml-4">
                  <span className="text-emerald-400">+{f.additions}</span>
                  <span className="text-red-400">-{f.deletions}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section icon={<GitPullRequest size={15} />} title="What Will Be Affected">
          <AffectedServices services={pr.affected_services || []} />
        </Section>

        {prId && user?.role === 'admin' && <CrossRepoImpactSection prId={prId} />}

        {pr.similar_prs?.length > 0 && (
          <Section icon={<Clock size={15} />} title="History of These Files">
            <div className="space-y-2">
              {pr.similar_prs.map((p: any, i: number) => <PRHistoryItem key={i} pr={p} />)}
            </div>
          </Section>
        )}

        {pr.ai_analysis && (
          <Section icon={<Brain size={15} />} title="AI Analysis">
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{pr.ai_analysis}</p>
          </Section>
        )}

        {pr.recommendations?.length > 0 && (
          <Section icon={<Lightbulb size={15} />} title="Recommendations">
            <ul className="space-y-3">
              {pr.recommendations.map((r: any, i: number) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="text-indigo-400 font-bold mt-0.5 shrink-0">{i + 1}.</span>
                  <span className="text-slate-300">{r.text}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {pr.suggested_reviewers?.length > 0 && (
          <Section icon={<Users size={15} />} title="Suggested Reviewers">
            <div className="space-y-2">
              {pr.suggested_reviewers.map((r: any, i: number) => (
                <ReviewerCard key={i} reviewer={r} index={i} />
              ))}
            </div>
            <p className="text-slate-700 text-xs mt-3 border-t border-slate-800 pt-3">
              Based on PR ownership history for changed files
            </p>
          </Section>
        )}

        <DuplicateCodeSection findings={pr.duplicate_code_findings || []} />

        {prId && <NotesSection prId={prId} />}
      </div>
    </div>
  );
}
