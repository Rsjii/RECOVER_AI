import { BENCHMARKS } from '../../constants/benchmarks';

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
}

interface MetricPillProps {
  label: string;
  value: string;
  benchmark?: string;
  status?: 'good' | 'ok' | 'poor';
  sublabel?: string;
}

function MetricPill({ label, value, benchmark, status, sublabel }: MetricPillProps) {
  const statusColor = status === 'good' ? 'text-emerald-400' : status === 'poor' ? 'text-rose-400' : 'text-amber-400';
  const vsColor = status === 'good' ? 'text-emerald-500/60' : status === 'poor' ? 'text-rose-500/60' : 'text-zinc-500';

  return (
    <div className="bg-[#18181b] rounded-lg px-4 py-3 flex-1 min-w-0">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-bold ${status ? statusColor : 'text-white'}`}>{value}</p>
      {benchmark && (
        <p className={`text-[11px] mt-0.5 ${vsColor}`}>vs {benchmark} avg</p>
      )}
      {sublabel && (
        <p className="text-[11px] text-zinc-500 mt-0.5">{sublabel}</p>
      )}
    </div>
  );
}

export default function EmailAnalyticsRow({ analytics, loading = false }: EmailAnalyticsRowProps) {
  if (loading) {
    return (
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5 animate-pulse">
        <div className="h-3 w-40 bg-white/10 rounded mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-[#18181b] rounded-lg p-3 h-20" />
          ))}
        </div>
      </div>
    );
  }

  const openStatus = analytics
    ? analytics.openRate >= BENCHMARKS.emailOpenRate.excellent ? 'good'
    : analytics.openRate >= BENCHMARKS.emailOpenRate.target ? 'ok' : 'poor'
    : undefined;

  const ctrStatus = analytics
    ? analytics.ctr >= BENCHMARKS.emailCtr.excellent ? 'good'
    : analytics.ctr >= BENCHMARKS.emailCtr.target ? 'ok' : 'poor'
    : undefined;

  return (
    <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Dunning Campaign Performance</h3>
          <p className="text-xs text-zinc-500">{analytics?.period ?? 'Last 30 days'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricPill
          label="Emails Sent"
          value={(analytics?.sent ?? 0).toLocaleString()}
          sublabel="dunning emails"
        />
        <MetricPill
          label="Open Rate"
          value={`${analytics?.openRate ?? 0}%`}
          benchmark={`${BENCHMARKS.emailOpenRate.target}%`}
          status={openStatus}
        />
        <MetricPill
          label="Click Rate (CTR)"
          value={`${analytics?.ctr ?? 0}%`}
          benchmark={`${BENCHMARKS.emailCtr.target}%`}
          status={ctrStatus}
        />
        <MetricPill
          label="Click-to-Open"
          value={`${analytics?.ctor ?? 0}%`}
          sublabel="of openers clicked"
        />
        <MetricPill
          label="Opened"
          value={(analytics?.opened ?? 0).toLocaleString()}
          sublabel={`${analytics?.clicked ?? 0} clicked`}
        />
      </div>

      {/* Email type breakdown mini-table */}
      {analytics && analytics.byEmailType.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-white/[0.05]">
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
                <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="py-1.5 text-zinc-300 capitalize">{row.type.replace(/_/g, ' ')}</td>
                  <td className="py-1.5 text-right text-zinc-300">{row.sent}</td>
                  <td className="py-1.5 text-right text-zinc-400">{row.opened}</td>
                  <td className={`py-1.5 text-right font-medium ${row.openRate >= 28 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                    {row.openRate}%
                  </td>
                  <td className="py-1.5 text-right text-zinc-400">{row.clicked}</td>
                  <td className={`py-1.5 text-right font-medium ${row.ctr >= 2.5 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                    {row.ctr}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
