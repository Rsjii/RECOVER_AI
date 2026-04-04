import { useState } from 'react';
import { BENCHMARKS } from '../../constants/benchmarks';
import { DashboardDetailModal } from './DashboardDetailModal';

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
  hideHeader?: boolean;
}

const statusBadge: Record<string, string> = {
  active:    'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  completed: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  defaulted: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
};

const fmt = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${v.toFixed(0)}`;

export default function PaymentPlansSummary({ summary, loading = false, hideHeader = false }: PaymentPlansSummaryProps) {
  const [showDetails, setShowDetails] = useState(false);
  if (loading) {
    return (
      <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-3 md:p-4 lg:p-5 animate-pulse">
        <div className="h-3 w-32 bg-gray-200 dark:bg-white/10 rounded mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-100 dark:bg-[#18181b] rounded-lg h-16" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 bg-gray-100 dark:bg-white/[0.04] rounded" />
          ))}
        </div>
      </div>
    );
  }

  const acceptStatus = summary
    ? summary.acceptanceRate >= BENCHMARKS.planAcceptance.excellent ? 'text-emerald-500'
    : summary.acceptanceRate >= BENCHMARKS.planAcceptance.target ? 'text-amber-500' : 'text-rose-500'
    : 'text-gray-900 dark:text-white';

  const completeStatus = summary
    ? summary.completionRate >= BENCHMARKS.planCompletion.excellent ? 'text-emerald-500'
    : summary.completionRate >= BENCHMARKS.planCompletion.target ? 'text-amber-500' : 'text-rose-500'
    : 'text-gray-900 dark:text-white';

  const isEmpty = !summary || summary.activePlans + summary.completedPlans + summary.defaultedPlans === 0;

  return (
    <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-3 md:p-4 lg:p-5">
      {!hideHeader && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Payment Plans</h3>
          {!isEmpty && (
            <button onClick={() => setShowDetails(true)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
              View All →
            </button>
          )}
        </div>
      )}

      {isEmpty ? (
        <p className="text-xs text-gray-500 dark:text-zinc-500 py-4">No payment plans created yet</p>
      ) : (
        <>
          {/* 4-card summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
            <div className="bg-gray-50 dark:bg-[#18181b] rounded-lg px-2 md:px-3 py-2 md:py-3">
              <p className="text-[8px] md:text-[9px] text-gray-500 dark:text-zinc-500 uppercase tracking-wide truncate">Active</p>
              <p className="text-base md:text-lg lg:text-xl font-bold text-gray-900 dark:text-white">{summary?.activePlans ?? 0}</p>
            </div>
            <div className="bg-gray-50 dark:bg-[#18181b] rounded-lg px-2 md:px-3 py-2 md:py-3">
              <p className="text-[8px] md:text-[9px] text-gray-500 dark:text-zinc-500 uppercase tracking-wide truncate">Acceptance</p>
              <p className={`text-base md:text-lg lg:text-xl font-bold ${acceptStatus}`}>{summary?.acceptanceRate ?? 0}%</p>
            </div>
            <div className="bg-gray-50 dark:bg-[#18181b] rounded-lg px-2 md:px-3 py-2 md:py-3">
              <p className="text-[8px] md:text-[9px] text-gray-500 dark:text-zinc-500 uppercase tracking-wide truncate">Completion</p>
              <p className={`text-base md:text-lg lg:text-xl font-bold ${completeStatus}`}>{summary?.completionRate ?? 0}%</p>
            </div>
            <div className="bg-gray-50 dark:bg-[#18181b] rounded-lg px-2 md:px-3 py-2 md:py-3">
              <p className="text-[8px] md:text-[9px] text-gray-500 dark:text-zinc-500 uppercase tracking-wide truncate">Active Value</p>
              <p className="text-base md:text-lg lg:text-xl font-bold text-gray-900 dark:text-white">{fmt(summary?.totalValueActive ?? 0)}</p>
            </div>
          </div>

          {/* Recent plans mini-table */}
          {summary && summary.recentPlans.length > 0 && (
            <div className="overflow-x-auto sm:scrollbar-show">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 dark:text-zinc-500 border-b border-gray-100 dark:border-white/[0.05]">
                    <th className="text-left pb-2 font-medium">Customer</th>
                    <th className="text-right pb-2 font-medium">Amount</th>
                    <th className="text-center pb-2 font-medium">Status</th>
                    <th className="text-right pb-2 font-medium">Complete</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentPlans.map((plan, i) => (
                    <tr key={i} className="border-b border-gray-50 dark:border-white/[0.03] hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                      <td className="py-1.5 text-gray-700 dark:text-zinc-300 truncate max-w-[120px]">{plan.customerName}</td>
                      <td className="py-1.5 text-right text-gray-700 dark:text-zinc-300">{fmt(plan.totalAmount)}</td>
                      <td className="py-1.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusBadge[plan.status] ?? ''}`}>
                          {plan.status}
                        </span>
                      </td>
                      <td className="py-1.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-16 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${plan.pctComplete}%` }}
                            />
                          </div>
                          <span className="text-gray-500 dark:text-zinc-400">{plan.pctComplete}%</span>
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

      {/* Detail Modal */}
      {showDetails && (
        <DashboardDetailModal
          isOpen={true}
          onClose={() => setShowDetails(false)}
          title="Payment Plans Overview"
          subtitle="All active, completed, and defaulted payment plans"
        >
          <div className="space-y-6">
            {summary && (
              <>
                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Total Offered</p>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{summary.totalOffered}</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Acceptance</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{summary.acceptanceRate.toFixed(0)}%</p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                    <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Completion</p>
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">{summary.completionRate.toFixed(0)}%</p>
                  </div>
                </div>

                {/* Status Distribution */}
                <div className="bg-gray-50 dark:bg-white/[0.02] rounded-lg p-4 border border-gray-200 dark:border-white/[0.05]">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Plan Status Distribution</h4>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Active Plans</span>
                        <span className="text-lg font-bold text-emerald-600">{summary.activePlans}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-white/[0.06] rounded-full h-3">
                        <div
                          className="h-3 rounded-full bg-emerald-500"
                          style={{ width: `${summary.totalOffered > 0 ? (summary.activePlans / summary.totalOffered) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Completed Plans</span>
                        <span className="text-lg font-bold text-blue-600">{summary.completedPlans}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-white/[0.06] rounded-full h-3">
                        <div
                          className="h-3 rounded-full bg-blue-500"
                          style={{ width: `${summary.totalOffered > 0 ? (summary.completedPlans / summary.totalOffered) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Defaulted Plans</span>
                        <span className="text-lg font-bold text-rose-600">{summary.defaultedPlans}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-white/[0.06] rounded-full h-3">
                        <div
                          className="h-3 rounded-full bg-rose-500"
                          style={{ width: `${summary.totalOffered > 0 ? (summary.defaultedPlans / summary.totalOffered) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-900 dark:text-green-200">💡 Best Practice</p>
                  <p className="text-sm text-green-800 dark:text-green-300 mt-2">
                    Payment plans work best for invoices 60+ days overdue. Typical plans: 3-6 month installments. Target acceptance rate: 50%+, Completion rate: 70%+
                  </p>
                </div>
              </>
            )}
          </div>
        </DashboardDetailModal>
      )}
    </div>
  );
}
