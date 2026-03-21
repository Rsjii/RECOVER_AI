interface FunnelStage {
  label: string;
  value: number;
  pct?: number;
  color: string;
  sublabel?: string;
}

interface RecoveryFunnelChartProps {
  invoicesAtRisk: number;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  invoicesPaid: number;
  loading?: boolean;
}

function FunnelBar({ stage, maxValue }: { stage: FunnelStage; maxValue: number }) {
  const widthPct = maxValue > 0 ? Math.max((stage.value / maxValue) * 100, 4) : 4;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-gray-500 dark:text-zinc-400 w-24 flex-shrink-0 text-right leading-tight">
        {stage.label}
      </span>
      <div className="flex-1 relative h-6 flex items-center">
        <div
          className="h-6 rounded-md transition-all duration-500 flex items-center pl-2"
          style={{ width: `${widthPct}%`, background: stage.color }}
        >
          <span className="text-[10px] font-semibold text-white whitespace-nowrap">
            {stage.value.toLocaleString()}
          </span>
        </div>
        {stage.pct !== undefined && (
          <span className="ml-2 text-[11px] text-gray-500 dark:text-zinc-400">
            {stage.pct}%
          </span>
        )}
      </div>
    </div>
  );
}

export default function RecoveryFunnelChart({
  invoicesAtRisk,
  emailsSent,
  emailsOpened,
  emailsClicked,
  invoicesPaid,
  loading = false,
}: RecoveryFunnelChartProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-5 animate-pulse">
        <div className="h-3 w-28 bg-gray-200 dark:bg-white/10 rounded mb-4" />
        <div className="space-y-3">
          {[100, 82, 31, 10, 5].map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-2 w-20 bg-gray-200 dark:bg-white/10 rounded" />
              <div className="h-6 bg-gray-200 dark:bg-white/10 rounded" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

  const stages: FunnelStage[] = [
    { label: 'At Risk', value: invoicesAtRisk, color: '#6366f1' },
    { label: 'Emails Sent', value: emailsSent, pct: pct(emailsSent, invoicesAtRisk), color: '#8b5cf6' },
    { label: 'Opened', value: emailsOpened, pct: pct(emailsOpened, emailsSent), color: '#f59e0b' },
    { label: 'Clicked', value: emailsClicked, pct: pct(emailsClicked, emailsOpened), color: '#f97316' },
    { label: 'Paid', value: invoicesPaid, pct: pct(invoicesPaid, invoicesAtRisk), color: '#10b981' },
  ];

  const maxValue = Math.max(...stages.map(s => s.value), 1);

  return (
    <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Recovery Funnel</h3>
      <p className="text-xs text-gray-500 dark:text-zinc-500 mb-4">At-risk → Paid conversion</p>

      <div className="space-y-2.5">
        {stages.map((stage, i) => (
          <FunnelBar key={i} stage={stage} maxValue={maxValue} />
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/[0.05] flex justify-between text-[11px]">
        <span className="text-gray-500 dark:text-zinc-500">End-to-end recovery</span>
        <span className="font-semibold text-emerald-500">
          {pct(invoicesPaid, invoicesAtRisk)}%
        </span>
      </div>
    </div>
  );
}
