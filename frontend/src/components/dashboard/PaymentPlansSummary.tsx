import { BENCHMARKS } from '../../constants/benchmarks';

interface PlanItem {
  planId: string;
  customerName: string;
  totalAmount: number;
  status: string;
  installmentsTotal: number;
  installmentsPaid: number;
  pctComplete: number;
}

interface PlansSummary {
  activePlans: number;
  completedPlans: number;
  defaultedPlans: number;
  totalOffered: number;
  acceptanceRate: number;
  completionRate: number;
  totalValueActive: number;
  recentPlans: PlanItem[];
}

interface PaymentPlansSummaryProps {
  summary?: PlansSummary;
  loading?: boolean;
}

const statusBadge: Record<string, string> = {
  active:    'bg-emerald-500/15 text-emerald-400',
  completed: 'bg-blue-500/15 text-blue-400',
  defaulted: 'bg-rose-500/15 text-rose-400',
};

const fmt = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${v.toFixed(0)}`;

export default function PaymentPlansSummary({ summary, loading = false }: PaymentPlansSummaryProps) {
  if (loading) {
    return (
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5 animate-pulse">
        <div className="h-3 w-32 bg-white/10 rounded mb-4" />
        <div className="grid grid-cols-4 gap-3 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[#18181b] rounded-lg h-16" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 bg-white/[0.04] rounded" />
          ))}
        </div>
      </div>
    );
  }

  const acceptStatus = summary
    ? summary.acceptanceRate >= BENCHMARKS.planAcceptance.excellent ? 'text-emerald-400'
    : summary.acceptanceRate >= BENCHMARKS.planAcceptance.target ? 'text-amber-400' : 'text-rose-400'
    : 'text-white';

  const completeStatus = summary
    ? summary.completionRate >= BENCHMARKS.planCompletion.excellent ? 'text-emerald-400'
    : summary.completionRate >= BENCHMARKS.planCompletion.target ? 'text-amber-400' : 'text-rose-400'
    : 'text-white';

  const isEmpty = !summary || summary.activePlans + summary.completedPlans + summary.defaultedPlans === 0;

  return (
    <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white mb-3">Payment Plans</h3>

      {isEmpty ? (
        <p className="text-xs text-zinc-500 py-4">No payment plans created yet</p>
      ) : (
        <>
          {/* 4-card summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-[#18181b] rounded-lg px-3 py-2">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Active</p>
              <p className="text-xl font-bold text-white">{summary?.activePlans ?? 0}</p>
            </div>
            <div className="bg-[#18181b] rounded-lg px-3 py-2">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Acceptance</p>
              <p className={`text-xl font-bold ${acceptStatus}`}>{summary?.acceptanceRate ?? 0}%</p>
            </div>
            <div className="bg-[#18181b] rounded-lg px-3 py-2">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Completion</p>
              <p className={`text-xl font-bold ${completeStatus}`}>{summary?.completionRate ?? 0}%</p>
            </div>
            <div className="bg-[#18181b] rounded-lg px-3 py-2">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Active Value</p>
              <p className="text-xl font-bold text-white">{fmt(summary?.totalValueActive ?? 0)}</p>
            </div>
          </div>

          {/* Recent plans mini-table */}
          {summary && summary.recentPlans.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-500 border-b border-white/[0.05]">
                    <th className="text-left pb-2 font-medium">Customer</th>
                    <th className="text-right pb-2 font-medium">Amount</th>
                    <th className="text-center pb-2 font-medium">Status</th>
                    <th className="text-right pb-2 font-medium">Complete</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentPlans.map((plan, i) => (
                    <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="py-1.5 text-zinc-300 truncate max-w-[120px]">{plan.customerName}</td>
                      <td className="py-1.5 text-right text-zinc-300">{fmt(plan.totalAmount)}</td>
                      <td className="py-1.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusBadge[plan.status] ?? ''}`}>
                          {plan.status}
                        </span>
                      </td>
                      <td className="py-1.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${plan.pctComplete}%` }}
                            />
                          </div>
                          <span className="text-zinc-400">{plan.pctComplete}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
