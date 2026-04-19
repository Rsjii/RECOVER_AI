import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
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

// interface PlanItem {
//   planId: string; customerName: string; customerEmail: string;
//   totalAmount: number; status: string;
//   installmentsTotal: number; installmentsPaid: number;
//   pctComplete: number; nextDueDate: string | null; createdAt: string;
// }

// interface PlansSummary {
//   activePlans: number; completedPlans: number; defaultedPlans: number;
//   totalOffered: number; acceptanceRate: number; completionRate: number;
//   totalValue: number; activeValue: number;
// }

interface KpiTrendPoint {
  month: string; recoveryRate: number;
  recovered: number; total: number;
  emailsSent: number; openRate: number; ctr: number;
}

// ─── Sub-tabs ─────────────────────────────────────────────────────────────────

// FULL TABS (for type safety even though Payment Plans & Attribution are hidden)
const ALL_TABS = ['Overview', 'Campaigns', 'Aging', 'Payment Plans', 'Attribution'] as const;
type Tab = typeof ALL_TABS[number];
// Filtered tabs for UI (Payment Plans & Attribution commented out for Month 2+)
const TABS = ['Overview', 'Campaigns', 'Aging'] as const;

const BUCKET_COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444'];
// const STATUS_BADGE: Record<string, string> = {
//   active: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
//   completed: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
//   defaulted: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
// };

const fmt = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${v.toFixed(0)}`;

// ─── Component ───────────────────────────────────────────────────────────────

const Reports: React.FC = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => { document.title = 'Reports — RecoverAI'; }, []);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['Overview', 'Campaigns', 'Aging'].includes(tabParam)) {
      return tabParam as 'Overview' | 'Campaigns' | 'Aging';
    }
    return 'Overview';
  });
  const [months, setMonths] = useState(6);
  const [campaignPeriod, setCampaignPeriod] = useState(30);
  const [agingPeriod, setAgingPeriod] = useState(180); // All time by default

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

  // Payment Plans state (commented out for Month 2+)
  // const [plansSummary, setPlansSummary] = useState<PlansSummary | null>(null);
  // const [plans, setPlans] = useState<PlanItem[]>([]);
  // const [loadingPlans, setLoadingPlans] = useState(false);

  // Attribution state (commented out for Month 2-3+)
  // const [attributionByStage, setAttributionByStage] = useState<any[]>([]);
  // const [attributionByAction, setAttributionByAction] = useState<any[]>([]);
  // const [roiData, setRoiData] = useState<any>(null);
  // const [loadingAttribution, setLoadingAttribution] = useState(false);

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
      const res = await api.get<{ data: { buckets: AgingBucket[]; totalAr: number } }>(
        `/api/reports/aging-detail?days=${agingPeriod}`
      );
      setAgingBuckets(res.data.buckets);
      setAgingTotal(res.data.totalAr);
    } catch { /* silent */ } finally {
      setLoadingAging(false);
    }
  }, [agingPeriod]);

  // const fetchPlans = useCallback(async () => {
  //   setLoadingPlans(true);
  //   try {
  //     const res = await api.get<{ data: { summary: PlansSummary; plans: PlanItem[] } }>('/api/reports/payment-plans-detail');
  //     setPlansSummary(res.data.summary);
  //     setPlans(res.data.plans);
  //   } catch { /* silent */ } finally {
  //     setLoadingPlans(false);
  //   }
  // }, []);

  // const fetchAttribution = useCallback(async () => {
  //   setLoadingAttribution(true);
  //   try {
  //     const [stageRes, actionRes, roiRes] = await Promise.all([
  //       api.get<{ data: any }>('/api/attribution/by-stage?month=' + new Date().toISOString().slice(0, 7)),
  //       api.get<{ data: any }>('/api/attribution/by-action?month=' + new Date().toISOString().slice(0, 7)),
  //       api.get<{ data: any }>('/api/attribution/roi?days=30'),
  //     ]);
  //     setAttributionByStage(stageRes.data.breakdown || []);
  //     setAttributionByAction(actionRes.data.breakdown || []);
  //     setRoiData(roiRes.data);
  //   } catch { /* silent */ } finally {
  //     setLoadingAttribution(false);
  //   }
  // }, []);

  // Respond to URL parameter changes
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['Overview', 'Campaigns', 'Aging'].includes(tabParam)) {
      setActiveTab(tabParam as 'Overview' | 'Campaigns' | 'Aging');
    }
  }, [searchParams]);

  // Fetch on tab switch or filter change
  useEffect(() => {
    if (activeTab === 'Overview') fetchOverview();
    if (activeTab === 'Campaigns') fetchCampaign();
    if (activeTab === 'Aging') fetchAging();
    // if (activeTab === 'Payment Plans') fetchPlans();
    // if (activeTab === 'Attribution') fetchAttribution();
  }, [activeTab, fetchOverview, fetchCampaign, fetchAging]);

  const downloadCsv = (rows: (string | number)[][], filename: string) => {
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    // Delay revoke so browser has time to start the download
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1000);
  };

  const handleExportCSV = async () => {
    setExportingCSV(true);

    // Longer delay to ensure UI renders before blocking work
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      if (!timeline || !timeline.length) {
        alert('No data to export. Please wait for data to load.');
        return;
      }

      const headers = ['Period', 'Recovered', 'Invoiced', 'Count Recovered', 'Count Total'];
      const rows = timeline.map(r => [
        r.period.slice(0, 7),
        Number(r.recovered_amount || 0).toFixed(2),
        Number(r.amount_created || 0).toFixed(2),
        r.recovered_count || 0,
        r.total_count || 0
      ]);

      downloadCsv([headers, ...rows], `recoverai-overview-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) {
      alert('Failed to export CSV. Please try again.');
    } finally {
      setExportingCSV(false);
    }
  };

  const handleExportCampaignCSV = async () => {
    setExportingCSV(true);

    // Longer delay to ensure UI renders before blocking work
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      if (!campaignByType || !campaignByType.length) {
        alert('No campaign data to export. Please wait for data to load.');
        return;
      }

      const headers = ['Email Type', 'Sent', 'Opened', 'Clicked', 'Open Rate', 'CTR'];
      const rows = campaignByType.map(r => [
        r.type || '',
        r.sent || 0,
        r.opened || 0,
        r.clicked || 0,
        r.openRate ? `${r.openRate.toFixed(1)}%` : '0%',
        r.ctr ? `${r.ctr.toFixed(1)}%` : '0%'
      ]);

      downloadCsv([headers, ...rows], `recoverai-campaigns-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) {
      alert('Failed to export campaign CSV. Please try again.');
    } finally {
      setExportingCSV(false);
    }
  };

  const handleExportAgingCSV = async () => {
    setExportingCSV(true);

    // Longer delay to ensure UI renders before blocking work
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      if (!agingBuckets || !agingBuckets.length) {
        alert('No aging data to export. Please wait for data to load.');
        return;
      }

      const headers = ['Bucket', 'Invoice Count', 'Total Amount', '% of Total', 'Avg Days Overdue'];
      const rows = agingBuckets.map(r => [
        r.bucket || '',
        r.invoiceCount || 0,
        Number(r.totalAmount || 0).toFixed(2),
        `${Number(r.pctOfTotal || 0).toFixed(1)}%`,
        r.avgDaysOverdue || 0
      ]);

      downloadCsv([headers, ...rows], `recoverai-aging-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) {
      alert('Failed to export aging CSV. Please try again.');
    } finally {
      setExportingCSV(false);
    }
  };

  // const handleExportPlansCSV = () => {
  //   if (!plans.length) return;
  //   const headers = ['Customer', 'Email', 'Total Amount', 'Status', 'Progress', 'Next Due Date', 'Created'];
  //   const rows = plans.map(r => [r.customerName, r.customerEmail, r.totalAmount.toFixed(2), r.status, `${r.pctComplete}%`, r.nextDueDate ?? '—', r.createdAt.slice(0, 10)]);
  //   downloadCsv([headers, ...rows], `recoverai-plans-${new Date().toISOString().slice(0, 10)}.csv`);
  // };

  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);

  const handleExportPDF = async () => {
    if (!stats) {
      alert('No data available to export. Please wait for data to load.');
      return;
    }

    setExportingPDF(true);
    // Let React render the spinner before blocking work
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // Use jsPDF directly — bypasses html2canvas entirely
      // html2canvas fails on Tailwind v4 oklch() color functions
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pageW = doc.internal.pageSize.getWidth();
      const margin = 15;
      const colW = pageW - margin * 2;
      let y = margin;

      const today = new Date();
      const monthsAgo = new Date(today);
      monthsAgo.setMonth(monthsAgo.getMonth() - months);

      const fmtCur = (v: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

      const addPageIfNeeded = (needed: number) => {
        if (y + needed > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
      };

      // ── Header ───────────────────────────────────────────────────────────
      doc.setFillColor(79, 70, 229); // indigo-600
      doc.rect(margin, y, colW, 18, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('RecoverAI Reports', margin + 5, y + 7);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Accounts Receivable Recovery Dashboard', margin + 5, y + 13);
      y += 22;

      doc.setTextColor(107, 114, 128); // gray-500
      doc.setFontSize(8);
      const periodStr = `Report Period: ${format(monthsAgo, 'MMM dd, yyyy')} — ${format(today, 'MMM dd, yyyy')}`;
      doc.text(periodStr, margin, y);
      y += 10;

      // ── Executive Summary ────────────────────────────────────────────────
      doc.setTextColor(17, 24, 39);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Executive Summary', margin, y);
      y += 6;

      const kpiRows = [
        ['Recovery Rate', `${stats?.recoveryRate ?? 0}%`, [5, 150, 105]],
        ['Total Recovered (All Time)', fmtCur(stats?.totalRecovered ?? 0), [37, 99, 235]],
        ['Days Sales Outstanding (DSO)', `${stats?.avgDaysToCollect ?? 0} days`, [79, 70, 229]],
        ['Overdue Invoices', `${stats?.overdueCount ?? 0}`, [217, 119, 6]],
        ['Target Recovery Rate', `${BENCHMARKS.recoveryRate.target}%`, [75, 85, 99]],
      ] as [string, string, [number, number, number]][];

      const rowH = 9;
      kpiRows.forEach(([label, value, color], i) => {
        addPageIfNeeded(rowH);
        const bgColor = i % 2 === 0 ? [249, 250, 251] : [255, 255, 255];
        doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
        doc.rect(margin, y, colW, rowH, 'F');
        doc.setDrawColor(209, 213, 219);
        doc.rect(margin, y, colW, rowH, 'S');

        doc.setTextColor(55, 65, 81);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(label, margin + 3, y + 6);

        doc.setTextColor(color[0], color[1], color[2]);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(value, pageW - margin - 3, y + 6.5, { align: 'right' });
        y += rowH;
      });
      y += 8;

      // ── Recovery Timeline ────────────────────────────────────────────────
      if (timeline.length > 0) {
        addPageIfNeeded(30);
        doc.setTextColor(17, 24, 39);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(`Recovery Timeline (Last ${months} Months)`, margin, y);
        y += 6;

        const tCols = [28, 42, 42, 28, 28];
        const tHeaders = ['Period', 'Recovered', 'Invoiced', 'Rec. #', 'Total #'];

        doc.setFillColor(229, 231, 235);
        doc.rect(margin, y, colW, 8, 'F');
        doc.setDrawColor(209, 213, 219);
        doc.rect(margin, y, colW, 8, 'S');
        let cx = margin;
        tHeaders.forEach((h, i) => {
          doc.setTextColor(55, 65, 81);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          const align = i > 0 ? 'right' : 'left';
          doc.text(h, align === 'right' ? cx + tCols[i] - 2 : cx + 2, y + 5.5, { align });
          cx += tCols[i];
        });
        y += 8;

        timeline.forEach((row, idx) => {
          addPageIfNeeded(8);
          const bg = idx % 2 === 0 ? [255, 255, 255] : [249, 250, 251];
          doc.setFillColor(bg[0], bg[1], bg[2]);
          doc.rect(margin, y, colW, 8, 'F');
          doc.setDrawColor(229, 231, 235);
          doc.rect(margin, y, colW, 8, 'S');

          const cells = [
            row.period.slice(0, 7),
            fmtCur(row.recovered_amount),
            fmtCur(row.amount_created),
            String(row.recovered_count),
            String(row.total_count),
          ];
          cx = margin;
          cells.forEach((cell, i) => {
            doc.setTextColor(55, 65, 81);
            doc.setFontSize(8);
            doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
            const align = i > 0 ? 'right' : 'left';
            doc.text(cell, align === 'right' ? cx + tCols[i] - 2 : cx + 2, y + 5.5, { align });
            cx += tCols[i];
          });
          y += 8;
        });
        y += 8;
      }

      // ── KPI Trends ───────────────────────────────────────────────────────
      if (kpiTrends.length > 0) {
        addPageIfNeeded(30);
        doc.setTextColor(17, 24, 39);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text('KPI Trends', margin, y);
        y += 6;

        const kCols = [40, 45, 45, 40];
        const kHeaders = ['Month', 'Recovery Rate', 'Email Open Rate', 'Click Rate'];

        doc.setFillColor(229, 231, 235);
        doc.rect(margin, y, colW, 8, 'F');
        doc.setDrawColor(209, 213, 219);
        doc.rect(margin, y, colW, 8, 'S');
        let kx = margin;
        kHeaders.forEach((h, i) => {
          doc.setTextColor(55, 65, 81);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          const align = i > 0 ? 'right' : 'left';
          doc.text(h, align === 'right' ? kx + kCols[i] - 2 : kx + 2, y + 5.5, { align });
          kx += kCols[i];
        });
        y += 8;

        kpiTrends.forEach((row, idx) => {
          addPageIfNeeded(8);
          const bg = idx % 2 === 0 ? [255, 255, 255] : [249, 250, 251];
          doc.setFillColor(bg[0], bg[1], bg[2]);
          doc.rect(margin, y, colW, 8, 'F');
          doc.setDrawColor(229, 231, 235);
          doc.rect(margin, y, colW, 8, 'S');

          const cells = [row.month, `${row.recoveryRate.toFixed(1)}%`, `${row.openRate.toFixed(1)}%`, `${row.ctr.toFixed(1)}%`];
          kx = margin;
          cells.forEach((cell, i) => {
            doc.setTextColor(55, 65, 81);
            doc.setFontSize(8);
            doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
            const align = i > 0 ? 'right' : 'left';
            doc.text(cell, align === 'right' ? kx + kCols[i] - 2 : kx + 2, y + 5.5, { align });
            kx += kCols[i];
          });
          y += 8;
        });
        y += 8;
      }

      // ── Footer ───────────────────────────────────────────────────────────
      addPageIfNeeded(14);
      doc.setDrawColor(209, 213, 219);
      doc.line(margin, y, pageW - margin, y);
      y += 5;
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Generated by RecoverAI on ${format(today, 'MMMM dd, yyyy')} at ${format(today, 'HH:mm:ss')}   •   Confidential — For authorized users only`,
        pageW / 2, y + 4, { align: 'center' }
      );

      doc.save(`recoverai-overview-${today.toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      alert(`Failed to export PDF: ${(err as any)?.message || 'Unknown error'}`);
    } finally {
      setExportingPDF(false);
    }
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
                disabled={exportingCSV || !timeline.length}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white dark:bg-[#18181b] border border-gray-200 dark:border-white/10 rounded-lg text-xs sm:text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap transition-opacity"
              >
                {exportingCSV ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="hidden sm:inline">Exporting...</span>
                    <span className="sm:hidden">CSV</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="hidden sm:inline">Export CSV</span>
                    <span className="sm:hidden">CSV</span>
                  </>
                )}
              </button>
            </>
          )}
          {activeTab === 'Overview' && (
            <button
              onClick={handleExportPDF}
              disabled={exportingPDF || !stats || !timeline.length}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white dark:bg-[#18181b] border border-gray-200 dark:border-white/10 rounded-lg text-xs sm:text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed no-print whitespace-nowrap transition-opacity"
            >
              {exportingPDF ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="hidden sm:inline">Generating...</span>
                  <span className="sm:hidden">PDF</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span className="hidden sm:inline">Export PDF</span>
                  <span className="sm:hidden">PDF</span>
                </>
              )}
            </button>
          )}
          {activeTab === 'Campaigns' && (
            <>
              <select
                value={campaignPeriod}
                onChange={e => setCampaignPeriod(Number(e.target.value))}
                className="text-sm border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 bg-white dark:bg-[#18181b] text-gray-700 dark:text-zinc-300"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
              <button
                onClick={handleExportCampaignCSV}
                disabled={exportingCSV || !campaignByType.length}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#18181b] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {exportingCSV ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export CSV
                  </>
                )}
              </button>
            </>
          )}
          {activeTab === 'Aging' && (
            <>
              <select
                value={agingPeriod}
                onChange={e => setAgingPeriod(Number(e.target.value))}
                className="text-sm border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 bg-white dark:bg-[#18181b] text-gray-700 dark:text-zinc-300"
              >
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
                <option value={180}>Last 180 days</option>
                <option value={9999}>All time</option>
              </select>
              <button
                onClick={handleExportAgingCSV}
                disabled={exportingCSV || !agingBuckets.length}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#18181b] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {exportingCSV ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export CSV
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab Nav */}
      <div className="flex border-b border-gray-200 dark:border-white/[0.06] overflow-x-auto sm:scrollbar-show">
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
        <div className="space-y-6" data-tour="reports-overview">
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
                  <div className="overflow-x-auto sm:scrollbar-show">
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
        <div className="space-y-6" data-tour="reports-campaigns">
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
                  <div className="overflow-x-auto sm:scrollbar-show">
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
        <div className="space-y-6" data-tour="reports-aging">
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

      {/* ── Payment Plans Tab ── COMMENTED OUT FOR MONTH 2+ ──
         Premature for initial launch. Customers haven't decided if they want
         complex payment plan features yet. Revisit after first 5 customers
         provide feedback (Month 2+).
       */}

      {/* ── Attribution Tab ── COMMENTED OUT FOR MONTH 2-3+ ──
         Requires more data and complex ML/analytics logic.
         First customers don't care about attribution yet.
         Revisit after Month 2-3 when we have customer patterns.
       */}
    </div>
  );
};

export default Reports;
