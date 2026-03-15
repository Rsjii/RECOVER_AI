// PHASE2_DISABLED — AdminReport. Re-enable with PHASE2_ENABLED=true.
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from '../../config/axios';
import {
  FileText, Printer, AlertTriangle, Users, Shield,
  TrendingUp, CheckCircle, RefreshCw,
} from 'lucide-react';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8 print:mb-6">
      <h2 className="text-lg font-bold text-white border-b border-slate-700 pb-2 mb-4 print:text-black print:border-gray-300">
        {title}
      </h2>
      {children}
    </div>
  );
}

function StatBox({ label, value, color = 'text-white' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-4 text-center print:bg-gray-50 print:border-gray-200">
      <div className={`text-2xl font-bold ${color} print:text-black`}>{value}</div>
      <div className="text-slate-500 text-xs mt-1 print:text-gray-500">{label}</div>
    </div>
  );
}

function RiskDot({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-red-500' : score >= 50 ? 'bg-orange-500' : score >= 25 ? 'bg-yellow-500' : 'bg-green-500';
  const label = score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MEDIUM' : 'LOW';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs font-medium">{label}</span>
    </span>
  );
}

export default function AdminReport() {
  // Inject print styles so sidebar hides when printing
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'report-print-styles';
    style.textContent = `
      @media print {
        aside { display: none !important; }
        nav   { display: none !important; }
        .no-print { display: none !important; }
        body  { background: white !important; }
        @page { margin: 1.5cm; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById('report-print-styles')?.remove(); };
  }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['insights-report'],
    queryFn: () => axios.get('/api/admin/insights-report').then(r => r.data),
    staleTime: 10 * 60_000,
  });

  if (isLoading) return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-2xl font-bold text-white">Insights Report</h1>
      {[1,2,3].map(i => <div key={i} className="skeleton h-32 rounded-xl" />)}
    </div>
  );

  if (isError || !data) return (
    <div className="max-w-4xl space-y-6 fade-in">
      <h1 className="text-2xl font-bold text-white">Insights Report</h1>
      <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-8 text-center">
        <AlertTriangle size={28} className="text-red-400 mx-auto mb-3" />
        <p className="text-slate-200 font-medium mb-2">Failed to load report data</p>
        <p className="text-slate-500 text-sm mb-5">Make sure repositories are indexed and try again.</p>
        <button onClick={() => refetch()} className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm">
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    </div>
  );

  const { org_name, generated_at, repos, pr_stats, knowledge_risk, code_health, action_items } = data;
  const genDate = new Date(generated_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="max-w-4xl fade-in">
      {/* Toolbar — hidden when printing */}
      <div className="no-print flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText size={22} className="text-indigo-400" />
            Insights Report
          </h1>
          <p className="text-slate-500 text-sm mt-1">Generated {genDate} · Share with your CTO or engineering leadership</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Printer size={15} /> Download PDF
        </button>
      </div>

      {/* ── REPORT BODY ─────────────────────────────────────────────────────── */}
      <div className="bg-[#0a0f1c] border border-slate-800 rounded-2xl p-8 space-y-8 print:bg-white print:border-0 print:p-0 print:space-y-6">

        {/* Report header (shown in print) */}
        <div className="pb-6 border-b border-slate-800 print:border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white print:text-black">{org_name}</h1>
              <p className="text-slate-400 text-sm mt-1 print:text-gray-500">Engineering Insights Report · {genDate}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-600 text-xs print:text-gray-400">
                {repos?.filter((r: any) => r.status === 'ready').length || 0} repos analyzed
              </p>
            </div>
          </div>
        </div>

        {/* ── SECTION 1: Executive Summary ── */}
        <Section title="Executive Summary">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <StatBox
              label="PRs Last 30 Days"
              value={pr_stats.total_30d}
              color="text-blue-400"
            />
            <StatBox
              label="Critical Risk PRs"
              value={`${pr_stats.critical_30d} (${pr_stats.critical_pct}%)`}
              color={pr_stats.critical_pct > 20 ? 'text-red-400' : 'text-orange-400'}
            />
            <StatBox
              label="Avg Bus Factor"
              value={knowledge_risk.avg_bus_factor || '—'}
              color={knowledge_risk.avg_bus_factor <= 1.5 ? 'text-red-400' : knowledge_risk.avg_bus_factor <= 2.5 ? 'text-orange-400' : 'text-green-400'}
            />
            <StatBox
              label="Knowledge Risk Score"
              value={`${knowledge_risk.knowledge_risk_score}/100`}
              color={knowledge_risk.knowledge_risk_score >= 75 ? 'text-red-400' : knowledge_risk.knowledge_risk_score >= 50 ? 'text-orange-400' : 'text-yellow-400'}
            />
          </div>

          {/* Top risks summary */}
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 print:bg-gray-50 print:border-gray-200">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">Top Risks Identified</p>
            <ul className="space-y-2">
              {knowledge_risk.knowledge_silo_count > 0 && (
                <li className="flex items-start gap-2 text-sm">
                  <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300 print:text-gray-700">
                    <strong>{knowledge_risk.knowledge_silo_count} knowledge silos</strong> — files known by only one person
                  </span>
                </li>
              )}
              {pr_stats.critical_pct > 15 && (
                <li className="flex items-start gap-2 text-sm">
                  <AlertTriangle size={14} className="text-orange-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300 print:text-gray-700">
                    <strong>{pr_stats.critical_pct}% of PRs are critical risk</strong> — review process needs attention
                  </span>
                </li>
              )}
              {knowledge_risk.avg_bus_factor < 2 && (
                <li className="flex items-start gap-2 text-sm">
                  <AlertTriangle size={14} className="text-orange-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300 print:text-gray-700">
                    <strong>Bus factor {knowledge_risk.avg_bus_factor}</strong> — average of fewer than 2 people per file
                  </span>
                </li>
              )}
              {code_health.complex_files?.[0] && Number(code_health.complex_files[0].cyclomatic_complexity) > 30 && (
                <li className="flex items-start gap-2 text-sm">
                  <TrendingUp size={14} className="text-yellow-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300 print:text-gray-700">
                    <strong>High code complexity</strong> — {code_health.complex_files[0].file_path} scores {code_health.complex_files[0].cyclomatic_complexity}
                  </span>
                </li>
              )}
              {pr_stats.total_30d === 0 && (
                <li className="flex items-start gap-2 text-sm">
                  <CheckCircle size={14} className="text-green-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300 print:text-gray-700">No PRs analyzed yet — add repositories and open PRs to see data</span>
                </li>
              )}
            </ul>
          </div>
        </Section>

        {/* ── SECTION 2: Knowledge Risk ── */}
        <Section title="Knowledge Risk & Bus Factor">
          <div className="grid grid-cols-3 gap-3 mb-5">
            <StatBox label="Knowledge Silos" value={knowledge_risk.knowledge_silo_count} color={knowledge_risk.knowledge_silo_count > 10 ? 'text-red-400' : 'text-orange-400'} />
            <StatBox label="Orphaned Files" value={knowledge_risk.orphaned_files_count} color="text-slate-400" />
            <StatBox label="Avg Bus Factor" value={knowledge_risk.avg_bus_factor || '—'} color={knowledge_risk.avg_bus_factor <= 1.5 ? 'text-red-400' : 'text-green-400'} />
          </div>

          {/* Engineer coverage */}
          {knowledge_risk.engineer_coverage?.length > 0 && (
            <div className="mb-5">
              <p className="text-slate-400 text-xs font-semibold mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                <Users size={12} /> Engineer Knowledge Distribution
              </p>
              <div className="space-y-2">
                {knowledge_risk.engineer_coverage.slice(0, 6).map((e: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-slate-900/40 rounded-lg border border-slate-800/50 print:bg-gray-50 print:border-gray-200">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-slate-200 text-sm font-medium print:text-black">{e.name || e.email}</span>
                        {Number(e.sole_owner_files) > 0 && (
                          <span className="text-xs px-1.5 py-0.5 bg-red-500/15 text-red-400 rounded border border-red-500/20">
                            {e.sole_owner_files} sole owner
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 text-xs text-slate-500">
                      <span className="text-slate-300 font-medium">{e.files_owned}</span> files owned
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top knowledge silos */}
          {knowledge_risk.top_silos?.length > 0 && (
            <div>
              <p className="text-slate-400 text-xs font-semibold mb-3 flex items-center gap-1.5 uppercase tracking-wide">
                <Shield size={12} /> Critical Single-Owner Files
              </p>
              <div className="space-y-1.5">
                {knowledge_risk.top_silos.slice(0, 6).map((f: any, i: number) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 bg-red-500/5 border border-red-500/15 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-red-300 text-xs truncate print:text-red-700">{f.file_path}</p>
                      <p className="text-slate-600 text-[10px]">{f.repo_name} · Only: {f.primary_owner_name}</p>
                    </div>
                    <RiskDot score={f.knowledge_risk_score} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* ── SECTION 3: PR Review Efficiency ── */}
        <Section title="PR Review Efficiency (Last 30 Days)">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatBox label="PRs Analyzed" value={pr_stats.total_30d} color="text-blue-400" />
            <StatBox label="Critical" value={`${pr_stats.critical_30d} (${pr_stats.critical_pct}%)`} color={pr_stats.critical_pct > 20 ? 'text-red-400' : 'text-orange-400'} />
            <StatBox label="High Risk" value={`${pr_stats.high_30d} (${pr_stats.high_pct}%)`} color="text-orange-400" />
            <StatBox label="Avg Review Time" value={pr_stats.avg_review_minutes > 0 ? `${pr_stats.avg_review_minutes}m` : '—'} color="text-slate-300" />
          </div>
          {pr_stats.critical_pct > 20 && (
            <div className="flex items-start gap-2 p-3 bg-red-500/8 border border-red-500/20 rounded-lg text-sm">
              <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-300 print:text-red-700">
                <strong>{pr_stats.critical_pct}%</strong> of recent PRs are critical risk. Consider adding mandatory secondary review for critical-risk PRs.
              </p>
            </div>
          )}
        </Section>

        {/* ── SECTION 4: Code Health ── */}
        {code_health.complex_files?.length > 0 && (
          <Section title="Code Health — Most Complex Files">
            <div className="space-y-2">
              {code_health.complex_files.map((f: any, i: number) => (
                <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-slate-900/40 border border-slate-800/50 rounded-lg print:bg-gray-50 print:border-gray-200">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-blue-400 text-xs truncate print:text-blue-700">{f.file_path}</p>
                    <p className="text-slate-600 text-[10px]">{f.repo_name} · {(f.lines_of_code || 0).toLocaleString()} lines</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`text-sm font-bold ${Number(f.cyclomatic_complexity) >= 50 ? 'text-red-400' : Number(f.cyclomatic_complexity) >= 20 ? 'text-orange-400' : 'text-yellow-400'} print:text-black`}>
                      {f.cyclomatic_complexity}
                    </span>
                    <p className="text-slate-700 text-[10px]">complexity</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-slate-600 text-xs mt-3">
              Cyclomatic complexity measures code branching. Above 50 = hard to test and maintain. Above 20 = refactor candidate.
            </p>
          </Section>
        )}

        {/* ── SECTION 5: Action Items ── */}
        <Section title="Recommended Actions">
          <div className="space-y-3">
            {action_items.map((action: string, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-lg">
                <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xs font-bold">
                  {i + 1}
                </span>
                <p className="text-slate-300 text-sm leading-relaxed print:text-gray-700">{action}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 text-center print:border-gray-200">
          <p className="text-slate-700 text-xs print:text-gray-400">
            Generated by Codebase Memory · {genDate}
          </p>
        </div>
      </div>
    </div>
  );
}
