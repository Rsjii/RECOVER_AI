import { useState } from 'react';
import { DashboardDetailModal } from './DashboardDetailModal';

interface EmailAnalytics {
  period: string;
  sent: number;
  opened: number;
  clicked: number;
  openRate: number;
  ctr: number;
  ctor: number;
  openRateBenchmark: number;
  ctrBenchmark: number;
  byEmailType: Array<{ type: string; sent: number; opened: number; clicked: number; openRate: number; ctr: number }>;
}

interface EmailAnalyticsRowProps {
  analytics?: EmailAnalytics;
  loading?: boolean;
  hideHeader?: boolean;
}

interface MetricPillProps {
  label: string;
  value: string;
  benchmark?: string;
  status?: 'good' | 'ok' | 'poor';
  sublabel?: string;
}

function MetricPill({ label, value, benchmark, status, sublabel }: MetricPillProps) {
  const statusColor = status === 'good' ? 'text-emerald-500' : status === 'poor' ? 'text-rose-500' : 'text-amber-500';
  const vsColor = status === 'good' ? 'text-emerald-500/60' : status === 'poor' ? 'text-rose-500/60' : 'text-gray-400 dark:text-zinc-500';

  return (
    <div className="bg-gray-50 dark:bg-[#18181b] rounded-lg px-2 md:px-3 lg:px-4 py-2 md:py-3 lg:py-3 flex-1 min-w-0">
      <p className="text-[8px] md:text-[9px] lg:text-[10px] text-gray-500 dark:text-zinc-500 uppercase tracking-wide mb-1 truncate">{label}</p>
      <p className={`text-base md:text-lg lg:text-xl font-bold ${status ? statusColor : 'text-gray-900 dark:text-white'}`}>{value}</p>
      {benchmark && (
        <p className={`text-[9px] md:text-[10px] mt-0.5 ${vsColor}`}>vs {benchmark} avg</p>
      )}
      {sublabel && (
        <p className="text-[8px] md:text-[9px] text-gray-500 dark:text-zinc-500 mt-0.5 truncate">{sublabel}</p>
      )}
    </div>
  );
}

export default function EmailAnalyticsRow({ analytics, loading = false, hideHeader = false }: EmailAnalyticsRowProps) {
  const [showDetails, setShowDetails] = useState(false);
  if (loading) {
    return (
      <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-3 md:p-4 lg:p-5 animate-pulse">
        <div className="h-3 w-40 bg-gray-200 dark:bg-white/10 rounded mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-gray-100 dark:bg-[#18181b] rounded-lg p-2 md:p-3 h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-3 md:p-4 lg:p-5">
      {!hideHeader && (
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Dunning Campaign Performance</h3>
            <p className="text-xs text-gray-500 dark:text-zinc-500">{analytics?.period ?? 'Last 30 days'}</p>
          </div>
          <button onClick={() => setShowDetails(true)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
            View Details →
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2 md:gap-3">
        <MetricPill
          label="Emails Sent"
          value={(analytics?.sent ?? 0).toLocaleString()}
          sublabel="dunning emails"
        />
        <MetricPill
          label="Deliverability"
          value={`${analytics?.sent ? '100' : 0}%`}
          sublabel="via Resend"
        />
        <MetricPill
          label="Tracked"
          value="Coming Soon"
          sublabel="email engagement tracking"
        />
      </div>

      {/* Coming Soon Banner */}
      <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <p className="text-xs font-medium text-blue-900 dark:text-blue-200">📧 Email Engagement Tracking</p>
        <p className="text-xs text-blue-800 dark:text-blue-300 mt-1">
          Open rates, click rates, and detailed metrics coming soon. We're building the tracking infrastructure to measure email effectiveness accurately.
        </p>
      </div>

      {/* Email type breakdown mini-table */}
      {analytics && analytics.byEmailType.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 dark:text-zinc-500 border-b border-gray-100 dark:border-white/[0.05]">
                <th className="text-left pb-2 font-medium">Type</th>
                <th className="text-right pb-2 font-medium">Sent</th>
                <th className="text-right pb-2 font-medium">Opened</th>
                <th className="text-right pb-2 font-medium">Open %</th>
                <th className="text-right pb-2 font-medium">Clicked</th>
                <th className="text-right pb-2 font-medium">CTR</th>
              </tr>
            </thead>
            <tbody>
              {analytics.byEmailType.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 dark:border-white/[0.03] hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                  <td className="py-1.5 text-gray-700 dark:text-zinc-300 capitalize">{row.type.replace(/_/g, ' ')}</td>
                  <td className="py-1.5 text-right text-gray-700 dark:text-zinc-300">{row.sent}</td>
                  <td className="py-1.5 text-right text-gray-500 dark:text-zinc-400">{row.opened}</td>
                  <td className={`py-1.5 text-right font-medium ${row.openRate >= 28 ? 'text-emerald-500' : 'text-gray-500 dark:text-zinc-400'}`}>
                    {row.openRate}%
                  </td>
                  <td className="py-1.5 text-right text-gray-500 dark:text-zinc-400">{row.clicked}</td>
                  <td className={`py-1.5 text-right font-medium ${row.ctr >= 2.5 ? 'text-emerald-500' : 'text-gray-500 dark:text-zinc-400'}`}>
                    {row.ctr}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {showDetails && (
        <DashboardDetailModal
          isOpen={true}
          onClose={() => setShowDetails(false)}
          title="Campaign Performance Details"
          subtitle="Detailed email engagement metrics and breakdown by email type"
        >
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Open Rate</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{analytics?.openRate.toFixed(1)}%</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Target: 28%</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Click Rate</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">{analytics?.ctr.toFixed(2)}%</p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Target: 2.5%</p>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 border border-indigo-200 dark:border-indigo-800">
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Click-to-Open</p>
                <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300 mt-1">{analytics?.ctor.toFixed(1)}%</p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">Quality metric</p>
              </div>
            </div>

            {/* Email Type Breakdown Table */}
            {analytics && analytics.byEmailType.length > 0 && (
              <div className="bg-gray-50 dark:bg-white/[0.02] rounded-lg p-4 border border-gray-200 dark:border-white/[0.05]">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Performance by Email Type</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-white/[0.05]">
                        <th className="text-left py-2 font-medium">Type</th>
                        <th className="text-right py-2 font-medium">Sent</th>
                        <th className="text-right py-2 font-medium">Opened</th>
                        <th className="text-right py-2 font-medium">Rate</th>
                        <th className="text-right py-2 font-medium">CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.byEmailType.map((row: any, i: number) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-white/[0.03] hover:bg-white dark:hover:bg-white/[0.02]">
                          <td className="py-2 text-gray-900 dark:text-white font-medium capitalize">{row.type.replace(/_/g, ' ')}</td>
                          <td className="text-right py-2 text-gray-600 dark:text-gray-400">{row.sent.toLocaleString()}</td>
                          <td className="text-right py-2 text-gray-600 dark:text-gray-400">{row.opened.toLocaleString()}</td>
                          <td className={`text-right py-2 font-medium ${row.openRate >= 28 ? 'text-emerald-600' : 'text-amber-600'}`}>{row.openRate.toFixed(1)}%</td>
                          <td className={`text-right py-2 font-medium ${row.ctr >= 2.5 ? 'text-emerald-600' : 'text-amber-600'}`}>{row.ctr.toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">💡 Optimization Tips</p>
              <ul className="text-sm text-blue-800 dark:text-blue-300 mt-2 space-y-1">
                <li>• <strong>Improve Open Rate:</strong> Test subject lines, optimal send times</li>
                <li>• <strong>Increase CTR:</strong> Make payment link prominent, clearer CTA</li>
                <li>• <strong>Quality Check:</strong> CTOR shows content quality - aim for 6%+</li>
              </ul>
            </div>
          </div>
        </DashboardDetailModal>
      )}
    </div>
  );
}
