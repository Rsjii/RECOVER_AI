import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { formatCurrency } from '../lib/utils';
import { Spinner } from '../components/ui/Spinner';
import { useTheme } from '../hooks/useTheme';
import {
  AreaChart, Area, BarChart, Bar,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { BENCHMARKS } from '../constants/benchmarks';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TimelinePoint {
  period: string;
  recovered_amount: number;
  amount_created: number;
  recovered_count: number;
  total_count: number;
}

interface DashboardStats {
  totalOwed: number;
  totalRecovered: number;
  recoveryRate: number;
  avgDaysToCollect: number;
  overdueCount: number;
}

interface CampaignTotals {
  sent: number; opened: number; clicked: number;
  bounced: number; failed: number;
  openRate: number; ctr: number; ctor: number;
  openRateBenchmark: number; ctrBenchmark: number;
}

interface CampaignByType {
  type: string; sent: number; opened: number;
  clicked: number; openRate: number; ctr: number;
}

interface AgingBucket {
  bucket: string; invoiceCount: number;
  totalAmount: number; pctOfTotal: number; avgDaysOverdue: number;
}

interface PlanItem {
  planId: string; customerName: string; customerEmail: string;
  totalAmount: number; status: string;
  installmentsTotal: number; installmentsPaid: number;
  pctComplete: number; nextDueDate: string | null; createdAt: string;
}

interface PlansSummary {
  activePlans: number; completedPlans: number; defaultedPlans: number;
  totalOffered: number; acceptanceRate: number; completionRate: number;
  totalValue: number; activeValue: number;
}

interface KpiTrendPoint {
  month: string; recoveryRate: number;
  recovered: number; total: number;
  emailsSent: number; openRate: number; ctr: number;
}

// ─── Sub-tabs ─────────────────────────────────────────────────────────────────

const TABS = ['Overview', 'Campaigns', 'Aging', 'Payment Plans'] as const;
type Tab = typeof TABS[number];

const BUCKET_COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444'];
const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  completed: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  defaulted: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
};

const fmt = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${v.toFixed(0)}`;

// ─── Component ───────────────────────────────────────────────────────────────

const Reports: React.FC = () => {
  useEffect(() => { document.title = 'Reports — RecoverAI'; }, []);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [months, setMonths] = useState(6);
  const [campaignPeriod, setCampaignPeriod] = useState(30);

  // Overview state
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [kpiTrends, setKpiTrends] = useState<KpiTrendPoint[]>([]);
  const [loadingOverview, setLoadingOverview] = useState(true);

  // Campaign state
  const [campaignTotals, setCampaignTotals] = useState<CampaignTotals | null>(null);
  const [campaignByType, setCampaignByType] = useState<CampaignByType[]>([]);
  const [loadingCampaign, setLoadingCampaign] = useState(false);

  // Aging state
  const [agingBuckets, setAgingBuckets] = useState<AgingBucket[]>([]);
  const [agingTotal, setAgingTotal] = useState(0);
  const [loadingAging, setLoadingAging] = useState(false);

  // Payment Plans state
  const [plansSummary, setPlansSummary] = useState<PlansSummary | null>(null);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  const chartColors = {
    grid: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
    axis: isDark ? '#52525b' : '#d4d4d8',
    tooltip: {
      background: isDark ? '#18181b' : '#fff',
      border: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb',
      color: isDark ? '#f4f4f5' : '#111827',
    },
  };

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const [statsRes, timelineRes, trendsRes] = await Promise.all([
        api.get<{ data: DashboardStats }>(API_ENDPOINTS.dashboard.stats),
        api.get<{ data: TimelinePoint[] }>(`${API_ENDPOINTS.dashboard.timeline}?months=${months}&period=monthly`),
        api.get<{ data: { trends: KpiTrendPoint[] } }>(`/api/reports/kpi-trends?months=${months}`).catch(() => ({ data: { trends: [] } })),
      ]);
      setStats(statsRes.data as unknown as DashboardStats);
      setTimeline((timelineRes as any).data || []);
      setKpiTrends(trendsRes.data.trends || []);
    } catch { /* silent */ } finally {
      setLoadingOverview(false);
    }
  }, [months]);

  const fetchCampaign = useCallback(async () => {
    setLoadingCampaign(true);
    try {
      const res = await api.get<{ data: { totals: CampaignTotals; byEmailType: CampaignByType[] } }>(
        `/api/reports/campaign-analytics?period=${campaignPeriod}`
      );
      setCampaignTotals(res.data.totals);
      setCampaignByType(res.data.byEmailType);
    } catch { /* silent */ } finally {
      setLoadingCampaign(false);
    }
  }, [campaignPeriod]);

  const fetchAging = useCallback(async () => {
    setLoadingAging(true);
    try {
      const res = await api.get<{ data: { buckets: AgingBucket[]; totalAr: number } }>('/api/reports/aging-detail');
      setAgingBuckets(res.data.buckets);
      setAgingTotal(res.data.totalAr);
    } catch { /* silent */ } finally {
      setLoadingAging(false);
    }
  }, []);

  const fetchPlans = useCallback(async () => {
    setLoadingPlans(true);
    try {
      const res = await api.get<{ data: { summary: PlansSummary; plans: PlanItem[] } }>('/api/reports/payment-plans-detail');
      setPlansSummary(res.data.summary);
      setPlans(res.data.plans);
    } catch { /* silent */ } finally {
      setLoadingPlans(false);
    }
  }, []);

  // Fetch on tab switch
  useEffect(() => {
    if (activeTab === 'Overview') fetchOverview();
    if (activeTab === 'Campaigns') fetchCampaign();
    if (activeTab === 'Aging') fetchAging();
    if (activeTab === 'Payment Plans') fetchPlans();
  }, [activeTab, fetchOverview, fetchCampaign, fetchAging, fetchPlans]);

  const handleExportCSV = () => {
    if (!timeline.length) return;
    const rows = timeline.map(r => [
      r.period.slice(0, 7),
      r.recovered_amount.toFixed(2),
      r.amount_created.toFixed(2),
      r.recovered_count,
      r.total_count,
    ]);
    const csv = [['Period', 'Recovered', 'Invoiced', 'Count Recovered', 'Count Total'], ...rows]
      .map(r => r.join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `recoverai-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const formatMonth = (s: string) => { try { return format(parseISO(s + '-01'), 'MMM yy'); } catch { return s; } };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col space-y-6 pb-6 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
        <div className="flex items-center gap-3">
          {activeTab === 'Overview' && (
            <>
              <select
                value={months}
                onChange={e => setMonths(Number(e.target.value))}
                className="text-sm border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 bg-white dark:bg-[#18181b] text-gray-700 dark:text-zinc-300"
              >
                <option value={3}>Last 3 months</option>
                <option value={6}>Last 6 months</option>
                <option value={12}>Last 12 months</option>
              </select>
              <button
                onClick={handleExportCSV}
                disabled={!timeline.length}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#18181b] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV
              </button>
            </>
          )}
          {activeTab === 'Campaigns' && (
            <select
              value={campaignPeriod}
              onChange={e => setCampaignPeriod(Number(e.target.value))}
              className="text-sm border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 bg-white dark:bg-[#18181b] text-gray-700 dark:text-zinc-300"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          )}
        </div>
      </div>

      {/* Tab Nav */}
      <div className="flex border-b border-gray-200 dark:border-white/[0.06] overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'text-gray-900 dark:text-white border-b-2 border-indigo-500'
                : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === 'Overview' && (
        <div className="space-y-6">
          {loadingOverview ? (
            <div className="flex justify-center py-20"><Spinner size="lg" text="Loading reports..." /></div>
          ) : (
            <>
              {/* KPI summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Recovery Rate', value: `${stats?.recoveryRate ?? 0}%`, color: 'text-emerald-400', sub: `target ${BENCHMARKS.recoveryRate.target}%` },
                  { label: 'Total Recovered', value: formatCurrency(stats?.totalRecovered ?? 0), color: 'text-blue-400', sub: 'all time' },
                  { label: 'DSO', value: `${stats?.avgDaysToCollect ?? 0}d`, color: 'text-indigo-400', sub: 'days sales outstanding' },
                  { label: 'Overdue Invoices', value: String(stats?.overdueCount ?? 0), color: 'text-amber-400', sub: 'currently overdue' },
                ].map(({ label, value, color, sub }) => (
                  <div key={label} className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4">
                    <p className="text-xs text-gray-500 dark:text-zinc-500 uppercase tracking-wide">{label}</p>
                    <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>

              {/* Recovery timeline area chart */}
              <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Recovery Timeline</h3>
                {timeline.length === 0 ? (
                  <div className="h-56 flex items-center justify-center text-gray-500 dark:text-zinc-500 text-sm">No data for this period</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={timeline.map(r => ({ ...r, label: r.period.slice(0, 7) }))}>
                      <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tickFormatter={formatMonth} tick={{ fill: chartColors.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}K`} tick={{ fill: chartColors.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                      <Tooltip
                        formatter={(v: any, name: any) => [formatCurrency(v), name === 'recovered_amount' ? 'Recovered' : 'Invoiced']}
                        contentStyle={{ background: chartColors.tooltip.background, border: `1px solid ${chartColors.tooltip.border}`, borderRadius: 8, color: chartColors.tooltip.color }}
                      />
                      <Legend formatter={v => <span className="text-xs text-gray-500 dark:text-zinc-400">{v === 'recovered_amount' ? 'Recovered' : 'Invoiced'}</span>} />
                      <Area type="monotone" dataKey="amount_created" stroke="#6366f1" fill={isDark ? 'rgba(99,102,241,0.1)' : '#e0e7ff'} strokeWidth={2} />
                      <Area type="monotone" dataKey="recovered_amount" stroke="#10b981" fill={isDark ? 'rgba(16,185,129,0.1)' : '#d1fae5'} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* KPI trends line chart */}
              {kpiTrends.length > 0 && (
                <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Recovery Rate Trend</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={kpiTrends}>
                      <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fill: chartColors.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={v => `${v}%`} tick={{ fill: chartColors.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                      <Tooltip
                        formatter={(v: any, name: any) => [`${v}%`, name === 'recoveryRate' ? 'Recovery Rate' : 'Email Open Rate']}
                        contentStyle={{ background: chartColors.tooltip.background, border: `1px solid ${chartColors.tooltip.border}`, borderRadius: 8, color: chartColors.tooltip.color }}
                      />
                      <Legend formatter={v => <span className="text-xs text-gray-500 dark:text-zinc-400">{v === 'recoveryRate' ? 'Recovery Rate' : 'Email Open Rate'}</span>} />
                      <Line type="monotone" dataKey="recoveryRate" name="Recovery Rate" stroke="#10b981" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="openRate" name="Email Open Rate" stroke="#6366f1" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Period breakdown table */}
              {timeline.length > 0 && (
                <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-white/[0.05]">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Period Breakdown</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 dark:text-zinc-500 border-b border-gray-100 dark:border-white/[0.05]">
                          <th className="text-left px-5 py-3 font-medium">Period</th>
                          <th className="text-right px-5 py-3 font-medium">Total Invoices</th>
                          <th className="text-right px-5 py-3 font-medium">Recovered</th>
                          <th className="text-right px-5 py-3 font-medium">Invoiced</th>
                          <th className="text-right px-5 py-3 font-medium">Recovered $</th>
                          <th className="text-right px-5 py-3 font-medium">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {timeline.map((r, i) => {
                          const rate = r.total_count > 0 ? Math.round((r.recovered_count / r.total_count) * 100) : 0;
                          return (
                            <tr key={i} className="border-b border-gray-50 dark:border-white/[0.03] hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                              <td className="px-5 py-3 text-gray-900 dark:text-white font-medium">{formatMonth(r.period.slice(0, 7))}</td>
                              <td className="px-5 py-3 text-right text-gray-600 dark:text-zinc-400">{r.total_count}</td>
                              <td className="px-5 py-3 text-right text-gray-600 dark:text-zinc-400">{r.recovered_count}</td>
                              <td className="px-5 py-3 text-right text-gray-600 dark:text-zinc-400">{formatCurrency(r.amount_created)}</td>
                              <td className="px-5 py-3 text-right text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(r.recovered_amount)}</td>
                              <td className="px-5 py-3 text-right">
                                <span className={`font-medium ${rate >= 50 ? 'text-emerald-600 dark:text-emerald-400' : rate >= 25 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>{rate}%</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Campaigns Tab ── */}
      {activeTab === 'Campaigns' && (
        <div className="space-y-6">
          {loadingCampaign ? (
            <div className="flex justify-center py-20"><Spinner size="lg" text="Loading campaign data..." /></div>
          ) : (
            <>
              {/* Summary metric cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Emails Sent', value: (campaignTotals?.sent ?? 0).toLocaleString(), color: 'text-gray-900 dark:text-white' },
                  {
                    label: 'Open Rate',
                    value: `${campaignTotals?.openRate ?? 0}%`,
                    color: (campaignTotals?.openRate ?? 0) >= BENCHMARKS.emailOpenRate.target ? 'text-emerald-400' : 'text-rose-400',
                    sub: `avg ${BENCHMARKS.emailOpenRate.target}%`,
                  },
                  {
                    label: 'CTR',
                    value: `${campaignTotals?.ctr ?? 0}%`,
                    color: (campaignTotals?.ctr ?? 0) >= BENCHMARKS.emailCtr.target ? 'text-emerald-400' : 'text-rose-400',
                    sub: `avg ${BENCHMARKS.emailCtr.target}%`,
                  },
                  { label: 'CTOR', value: `${campaignTotals?.ctor ?? 0}%`, color: 'text-indigo-400', sub: 'click-to-open' },
                  { label: 'Bounced', value: (campaignTotals?.bounced ?? 0).toLocaleString(), color: 'text-amber-400' },
                ].map(({ label, value, color, sub }) => (
                  <div key={label} className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4">
                    <p className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase tracking-wide">{label}</p>
                    <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
                    {sub && <p className="text-[11px] text-gray-500 dark:text-zinc-500 mt-0.5">{sub}</p>}
                  </div>
                ))}
              </div>

              {/* Bar chart: sent vs opened vs clicked by type */}
              {campaignByType.length > 0 && (
                <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Engagement by Email Type</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={campaignByType.map(r => ({ ...r, label: r.type.replace(/_/g, ' ') }))}>
                      <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: chartColors.axis, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: chartColors.axis, fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                      <Tooltip contentStyle={{ background: chartColors.tooltip.background, border: `1px solid ${chartColors.tooltip.border}`, borderRadius: 8, color: chartColors.tooltip.color }} />
                      <Legend formatter={v => <span className="text-xs text-gray-500 dark:text-zinc-400 capitalize">{v}</span>} />
                      <Bar dataKey="sent" fill="#6366f1" name="Sent" radius={[2,2,0,0]} />
                      <Bar dataKey="opened" fill="#10b981" name="Opened" radius={[2,2,0,0]} />
                      <Bar dataKey="clicked" fill="#f59e0b" name="Clicked" radius={[2,2,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Detailed table */}
              {campaignByType.length > 0 ? (
                <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-white/[0.05]">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Campaign Breakdown</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 dark:text-zinc-500 border-b border-gray-100 dark:border-white/[0.05]">
                          <th className="text-left px-5 py-3 font-medium">Email Type</th>
                          <th className="text-right px-5 py-3 font-medium">Sent</th>
                          <th className="text-right px-5 py-3 font-medium">Opened</th>
                          <th className="text-right px-5 py-3 font-medium">Open %</th>
                          <th className="text-right px-5 py-3 font-medium">Clicked</th>
                          <th className="text-right px-5 py-3 font-medium">CTR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaignByType.map((row, i) => (
                          <tr key={i} className="border-b border-gray-50 dark:border-white/[0.03] hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                            <td className="px-5 py-3 text-gray-800 dark:text-zinc-200 capitalize">{row.type.replace(/_/g, ' ')}</td>
                            <td className="px-5 py-3 text-right text-gray-700 dark:text-zinc-300">{row.sent}</td>
                            <td className="px-5 py-3 text-right text-gray-600 dark:text-zinc-400">{row.opened}</td>
                            <td className={`px-5 py-3 text-right font-medium ${row.openRate >= BENCHMARKS.emailOpenRate.target ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-zinc-400'}`}>{row.openRate}%</td>
                            <td className="px-5 py-3 text-right text-gray-600 dark:text-zinc-400">{row.clicked}</td>
                            <td className={`px-5 py-3 text-right font-medium ${row.ctr >= BENCHMARKS.emailCtr.target ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-zinc-400'}`}>{row.ctr}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-10 text-center">
                  <p className="text-gray-500 dark:text-zinc-500 text-sm">No campaign data for this period</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Aging Tab ── */}
      {activeTab === 'Aging' && (
        <div className="space-y-6">
          {loadingAging ? (
            <div className="flex justify-center py-20"><Spinner size="lg" text="Loading aging data..." /></div>
          ) : agingBuckets.length === 0 ? (
            <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-10 text-center">
              <p className="text-gray-500 dark:text-zinc-500 text-sm">No outstanding invoices</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {agingBuckets.map((b, i) => (
                  <div key={i} className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4">
                    <p className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase tracking-wide">{b.bucket}</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{fmt(b.totalAmount)}</p>
                    <p className="text-[11px] text-gray-500 dark:text-zinc-500 mt-0.5">{b.invoiceCount} invoice{b.invoiceCount !== 1 ? 's' : ''} · {b.pctOfTotal}%</p>
                  </div>
                ))}
              </div>

              {/* Horizontal bar chart */}
              <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">A/R Aging Distribution</h3>
                  <span className="text-xs text-gray-600 dark:text-zinc-400">Total: {fmt(agingTotal)}</span>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={agingBuckets} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="bucket" tick={{ fill: chartColors.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                    <Tooltip
                      formatter={(v: any) => [fmt(v), 'Amount']}
                      contentStyle={{ background: chartColors.tooltip.background, border: `1px solid ${chartColors.tooltip.border}`, borderRadius: 8, color: chartColors.tooltip.color }}
                    />
                    <Bar dataKey="totalAmount" radius={[0,4,4,0]} maxBarSize={22}>
                      {agingBuckets.map((_, i) => <Cell key={i} fill={BUCKET_COLORS[i]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Detail table */}
              <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-white/[0.05]">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Aging Detail</h3>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 dark:text-zinc-500 border-b border-gray-100 dark:border-white/[0.05]">
                      <th className="text-left px-5 py-3 font-medium">Bucket</th>
                      <th className="text-right px-5 py-3 font-medium">Invoices</th>
                      <th className="text-right px-5 py-3 font-medium">Amount</th>
                      <th className="text-right px-5 py-3 font-medium">% of A/R</th>
                      <th className="text-right px-5 py-3 font-medium">Avg Days Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agingBuckets.map((b, i) => (
                      <tr key={i} className="border-b border-gray-50 dark:border-white/[0.03] hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                        <td className="px-5 py-3 text-gray-900 dark:text-white font-medium">{b.bucket}</td>
                        <td className="px-5 py-3 text-right text-gray-600 dark:text-zinc-400">{b.invoiceCount}</td>
                        <td className="px-5 py-3 text-right font-medium text-gray-900 dark:text-white">{fmt(b.totalAmount)}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${b.pctOfTotal}%`, background: BUCKET_COLORS[i] }} />
                            </div>
                            <span className="text-gray-700 dark:text-zinc-300 w-8 text-right">{b.pctOfTotal}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-gray-600 dark:text-zinc-400">{b.avgDaysOverdue}d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Payment Plans Tab ── */}
      {activeTab === 'Payment Plans' && (
        <div className="space-y-6">
          {loadingPlans ? (
            <div className="flex justify-center py-20"><Spinner size="lg" text="Loading payment plans..." /></div>
          ) : !plansSummary || (plansSummary.activePlans + plansSummary.completedPlans + plansSummary.defaultedPlans === 0) ? (
            <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-10 text-center">
              <p className="text-gray-500 dark:text-zinc-500 text-sm">No payment plans created yet</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Active Plans', value: plansSummary.activePlans, color: 'text-emerald-400' },
                  { label: 'Acceptance Rate', value: `${plansSummary.acceptanceRate}%`, color: plansSummary.acceptanceRate >= BENCHMARKS.planAcceptance.target ? 'text-emerald-400' : 'text-amber-400' },
                  { label: 'Completion Rate', value: `${plansSummary.completionRate}%`, color: plansSummary.completionRate >= BENCHMARKS.planCompletion.target ? 'text-emerald-400' : 'text-amber-400' },
                  { label: 'Active Value', value: fmt(plansSummary.activeValue), color: 'text-gray-900 dark:text-white' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4">
                    <p className="text-[10px] text-gray-500 dark:text-zinc-500 uppercase tracking-wide">{label}</p>
                    <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Status breakdown */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Active', count: plansSummary.activePlans, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                  { label: 'Completed', count: plansSummary.completedPlans, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                  { label: 'Defaulted', count: plansSummary.defaultedPlans, color: 'text-rose-400', bg: 'bg-rose-500/10' },
                ].map(({ label, count, color, bg }) => (
                  <div key={label} className={`${bg} border border-gray-200 dark:border-white/[0.06] rounded-xl p-4 text-center`}>
                    <p className={`text-2xl font-bold ${color}`}>{count}</p>
                    <p className="text-xs text-gray-600 dark:text-zinc-400 mt-1">{label}</p>
                  </div>
                ))}
              </div>

              {/* Plans table */}
              {plans.length > 0 && (
                <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-white/[0.05]">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">All Payment Plans</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 dark:text-zinc-500 border-b border-gray-100 dark:border-white/[0.05]">
                          <th className="text-left px-5 py-3 font-medium">Customer</th>
                          <th className="text-right px-5 py-3 font-medium">Amount</th>
                          <th className="text-center px-5 py-3 font-medium">Status</th>
                          <th className="text-right px-5 py-3 font-medium">Progress</th>
                          <th className="text-right px-5 py-3 font-medium">Next Due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plans.map((p, i) => (
                          <tr key={i} className="border-b border-gray-50 dark:border-white/[0.03] hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                            <td className="px-5 py-3">
                              <p className="text-gray-900 dark:text-white font-medium">{p.customerName}</p>
                              <p className="text-gray-500 dark:text-zinc-500 text-[10px]">{p.customerEmail}</p>
                            </td>
                            <td className="px-5 py-3 text-right text-gray-900 dark:text-white font-medium">{fmt(p.totalAmount)}</td>
                            <td className="px-5 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_BADGE[p.status] ?? ''}`}>{p.status}</span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${p.pctComplete}%` }} />
                                </div>
                                <span className="text-gray-600 dark:text-zinc-400 w-8 text-right">{p.pctComplete}%</span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-right text-gray-600 dark:text-zinc-400">
                              {p.nextDueDate ? new Date(p.nextDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Reports;
