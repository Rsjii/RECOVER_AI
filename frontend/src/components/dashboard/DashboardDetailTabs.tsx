import { useState } from 'react';

interface AtRiskCustomer {
  customerId: string;
  customerName: string;
  customerEmail: string;
  unpaidInvoices: number;
  totalOwed: number;
  maxRiskScore: number;
  oldestDueDays: number;
}

interface AgingBucket {
  label: string;
  days: string;
  amount: number;
  invoiceCount: number;
  pctOfTotal: number;
}

interface DashboardDetailTabsProps {
  atRiskList?: AtRiskCustomer[];
  agingBuckets?: AgingBucket[];
  loading?: boolean;
}

const fmt = (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const riskColor = (score: number) =>
  score >= 60 ? 'text-rose-500' : score >= 30 ? 'text-amber-500' : 'text-emerald-500';

const riskDot = (score: number) =>
  score >= 60 ? 'bg-rose-500' : score >= 30 ? 'bg-amber-500' : 'bg-emerald-500';

const TABS = ['At-Risk Customers', 'Aging Detail'] as const;
type Tab = typeof TABS[number];

export default function DashboardDetailTabs({
  atRiskList = [],
  agingBuckets = [],
  loading = false,
}: DashboardDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('At-Risk Customers');

  return (
    <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
      {/* Tab nav */}
      <div className="flex border-b border-gray-100 dark:border-white/[0.06]">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-xs font-medium transition-colors ${
              activeTab === tab
                ? 'text-gray-900 dark:text-white border-b-2 border-indigo-500 bg-gray-50 dark:bg-white/[0.02]'
                : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
            }`}
          >
            {tab}
            {tab === 'At-Risk Customers' && atRiskList.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-rose-500/20 text-rose-500 dark:text-rose-400 rounded text-[10px]">
                {atRiskList.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* At-Risk Customers tab */}
      {activeTab === 'At-Risk Customers' && (
        <div className="overflow-x-auto sm:scrollbar-show">
          {loading ? (
            <div className="p-5 space-y-3 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-gray-100 dark:bg-white/[0.04] rounded" />
              ))}
            </div>
          ) : atRiskList.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-xs text-gray-500 dark:text-zinc-500">No at-risk customers detected</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 dark:text-zinc-500 border-b border-gray-100 dark:border-white/[0.05]">
                  <th className="text-left px-5 py-3 font-medium">Customer</th>
                  <th className="text-right px-5 py-3 font-medium">Owed</th>
                  <th className="text-center px-5 py-3 font-medium">Risk</th>
                  <th className="text-right px-5 py-3 font-medium">Days Overdue</th>
                  <th className="text-right px-5 py-3 font-medium">Invoices</th>
                </tr>
              </thead>
              <tbody>
                {atRiskList.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-white/[0.03] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-gray-900 dark:text-white font-medium">{c.customerName}</p>
                      <p className="text-gray-400 dark:text-zinc-500 text-[10px]">{c.customerEmail}</p>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900 dark:text-white">{fmt(c.totalOwed)}</td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${riskDot(c.maxRiskScore)}`} />
                        <span className={`font-semibold ${riskColor(c.maxRiskScore)}`}>{c.maxRiskScore}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600 dark:text-zinc-300">
                      {c.oldestDueDays > 0 ? `${c.oldestDueDays}d` : '—'}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-500 dark:text-zinc-400">{c.unpaidInvoices}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Aging Detail tab */}
      {activeTab === 'Aging Detail' && (
        <div className="overflow-x-auto sm:scrollbar-show">
          {loading ? (
            <div className="p-5 space-y-3 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 bg-gray-100 dark:bg-white/[0.04] rounded" />
              ))}
            </div>
          ) : agingBuckets.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-xs text-gray-500 dark:text-zinc-500">No outstanding invoices</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 dark:text-zinc-500 border-b border-gray-100 dark:border-white/[0.05]">
                  <th className="text-left px-5 py-3 font-medium">Bucket</th>
                  <th className="text-right px-5 py-3 font-medium">Invoices</th>
                  <th className="text-right px-5 py-3 font-medium">Amount</th>
                  <th className="text-right px-5 py-3 font-medium">% of A/R</th>
                  <th className="text-left px-5 py-3 font-medium">Health</th>
                </tr>
              </thead>
              <tbody>
                {agingBuckets.map((b, i) => {
                  const isRisk = i >= 3 && b.pctOfTotal > 10;
                  return (
                    <tr key={i} className="border-b border-gray-50 dark:border-white/[0.03] hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                      <td className="px-5 py-3">
                        <p className="text-gray-900 dark:text-white font-medium">{b.label}</p>
                        <p className="text-gray-400 dark:text-zinc-500 text-[10px]">{b.days}</p>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600 dark:text-zinc-300">{b.invoiceCount}</td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900 dark:text-white">{fmt(b.amount)}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${b.pctOfTotal}%`,
                                background: ['#10b981', '#f59e0b', '#f97316', '#ef4444'][i],
                              }}
                            />
                          </div>
                          <span className="text-gray-600 dark:text-zinc-300 w-8 text-right">{b.pctOfTotal}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {i === 0 ? (
                          <span className="text-[10px] text-gray-400 dark:text-zinc-500">Current</span>
                        ) : isRisk ? (
                          <span className="text-[10px] text-rose-500 font-medium">⚠ Write-off risk</span>
                        ) : (
                          <span className="text-[10px] text-amber-500">Action needed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
