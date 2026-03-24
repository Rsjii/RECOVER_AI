import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { formatCurrency } from '../lib/utils';
import { DashboardSkeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { RecoveryChart } from '../components/dashboard/RecoveryChart';
import { TopCustomersTable } from '../components/dashboard/TopCustomersTable';
import type { RunwayData } from '../components/dashboard/RunwayWidget';
import type { CashLeakageData } from '../components/dashboard/CashLeakageWidget';
import { EmailPreviewModal } from '../components/invoices/EmailPreviewModal';
import DashboardDetailTabs from '../components/dashboard/DashboardDetailTabs';
import { KPIBanner } from '../components/dashboard/KPIBanner';
import { BusinessImpactGrid } from '../components/dashboard/BusinessImpactGrid';
import { RecoveryFunnelInteractive } from '../components/dashboard/RecoveryFunnelInteractive';
import { CashFlowSection } from '../components/dashboard/CashFlowSection';
import { RiskDriversSection } from '../components/dashboard/RiskDriversSection';
import { AtRiskCustomersSection } from '../components/dashboard/AtRiskCustomersSection';
import { AgentActivitySection } from '../components/dashboard/AgentActivitySection';
import { BillingOptimizationSection } from '../components/dashboard/BillingOptimizationSection';
import { VoiceStatsCard } from '../components/dashboard/VoiceStatsCard';
import type { DashboardStats, InvoicePipeline, CustomerRisk } from '../types';
import type { WorkingCapitalFreed, DSOReduction, BillingAnomaly, EnhancedCashForecast } from '../types/invoice';

interface AtRiskCustomer {
  customerId: string;
  name: string;
  email: string;
  score: number;
  signals: { type: string; description: string }[];
  invoiceId: string | null;
  invoiceAmount: number | null;
  daysUntilDue: number | null;
  currency: string;
}

interface CashPosition {
  currentBalance: number;
  balance30: number;
  balance60: number;
  balance90: number;
  pendingInvoices30: number;
  pendingInvoices60: number;
  pendingInvoices90: number;
  invoiceCount: number;
  asOfDate: string;
}

interface DashboardKpi {
  dso: number;
  cei: number;
  recoveryRate: number;
  revenueAtRisk: number;
  revenueAtRiskPct: number;
  involuntaryChurnRate: number;
  atRiskCustomerCount: number;
  totalCustomers: number;
}

interface AgingBucket {
  label: string;
  days: string;
  amount: number;
  invoiceCount: number;
  pctOfTotal: number;
}

interface AgingAnalysis {
  buckets: AgingBucket[];
  totalAr: number;
}

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

interface RiskDrivers {
  failedPayment: number;
  expiringCard: number;
  inactivity: number;
  hardDecline: number;
  total: number;
}

interface PlanItem {
  planId: string;
  customerName: string;
  totalAmount: number;
  status: string;
  installmentsTotal: number;
  installmentsPaid: number;
  pctComplete: number;
}

interface PaymentPlansSummaryData {
  activePlans: number;
  completedPlans: number;
  defaultedPlans: number;
  totalOffered: number;
  acceptanceRate: number;
  completionRate: number;
  totalValueActive: number;
  recentPlans: PlanItem[];
}

interface AgentPreview {
  emailsWouldQueue: number;
  plansWouldOffer: number;
  invoicesScanned: number;
  estimatedRecoveryUsd: number;
  previews: Array<{
    invoiceId: string;
    customerId: string;
    customerName: string;
    recipientEmail: string;
    amount: number;
    daysOverdue: number;
    emailType: string;
    riskScore: number;
  }>;
}


// Module-level cache — persists across tab switches within the same session
interface DashCache {
  stats: DashboardStats | null;
  pipeline: InvoicePipeline | null;
  riskList: CustomerRisk[];
  atRisk: AtRiskCustomer[];
  cashPosition: CashPosition | null;
  runway: RunwayData | null;
  leakage: CashLeakageData | null;
  kpi: DashboardKpi | null;
  aging: AgingAnalysis | null;
  emailAnalytics: EmailAnalytics | null;
  riskDrivers: RiskDrivers | null;
  plansSummary: PaymentPlansSummaryData | null;
  timeline: any[];
  workingCapital: WorkingCapitalFreed | null;
  dsoReduction: DSOReduction | null;
  billingAnomalies: BillingAnomaly[];
  cashForecast: EnhancedCashForecast | null;
  ts: number;
}
let dashCache: DashCache | null = null;
const CACHE_TTL = 30_000; // 30 seconds — show cached data instantly on tab switch

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pipeline, setPipeline] = useState<InvoicePipeline | null>(null);
  const [riskList, setRiskList] = useState<CustomerRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggeringAgent, setTriggeringAgent] = useState(false);
  const [agentMsg, setAgentMsg] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [agentPreview, setAgentPreview] = useState<AgentPreview | null>(null);
  const [selectedEmailForModal, setSelectedEmailForModal] = useState<AgentPreview['previews'][0] | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [atRisk, setAtRisk] = useState<AtRiskCustomer[]>([]);
  const [cashPosition, setCashPosition] = useState<CashPosition | null>(null);
  const [cashBalanceInput, setCashBalanceInput] = useState<string>('');
  const [runway, setRunway] = useState<RunwayData | null>(null);
  const [leakage, setLeakage] = useState<CashLeakageData | null>(null);
  // New analytics state
  const [kpi, setKpi] = useState<DashboardKpi | null>(null);
  const [aging, setAging] = useState<AgingAnalysis | null>(null);
  const [emailAnalytics, setEmailAnalytics] = useState<EmailAnalytics | null>(null);
  const [riskDrivers, setRiskDrivers] = useState<RiskDrivers | null>(null);
  const [plansSummary, setPlansSummary] = useState<PaymentPlansSummaryData | null>(null);
  const [workingCapital, setWorkingCapital] = useState<WorkingCapitalFreed | null>(null);
  const [dsoReduction, setDsoReduction] = useState<DSOReduction | null>(null);
  const [billingAnomalies, setBillingAnomalies] = useState<BillingAnomaly[]>([]);
  const [cashForecast, setCashForecast] = useState<EnhancedCashForecast | null>(null);

  useEffect(() => {
    document.title = 'Dashboard — RecoverAI';
    // Check localStorage first (set during demo login) — works even if token expired
    if (localStorage.getItem('isDemo') === 'true') {
      setIsDemo(true);
      return;
    }
    // Fallback: check from API
    const detectDemo = async () => {
      try {
        const user = await api.get<{ user: { email: string } }>('/api/auth/me');
        if (user.user?.email === 'demo@recoverai.com') {
          setIsDemo(true);
          localStorage.setItem('isDemo', 'true');
        }
      } catch {
        // not demo, stay false
      }
    };
    detectDemo();
  }, []);

  useEffect(() => {
    // ✅ Show cached data instantly if fresh (tab switch = no loading spinner)
    if (dashCache && Date.now() - dashCache.ts < CACHE_TTL) {
      setStats(dashCache.stats);
      setPipeline(dashCache.pipeline);
      setRiskList(dashCache.riskList);
      setAtRisk(dashCache.atRisk);
      if (dashCache.cashPosition) {
        setCashPosition(dashCache.cashPosition);
        setCashBalanceInput(String(dashCache.cashPosition.currentBalance || 0));
      }
      setRunway(dashCache.runway);
      setLeakage(dashCache.leakage);
      setKpi(dashCache.kpi);
      setAging(dashCache.aging);
      setEmailAnalytics(dashCache.emailAnalytics);
      setRiskDrivers(dashCache.riskDrivers);
      setPlansSummary(dashCache.plansSummary);
      setWorkingCapital(dashCache.workingCapital);
      setDsoReduction(dashCache.dsoReduction);
      setBillingAnomalies(dashCache.billingAnomalies);
      setCashForecast(dashCache.cashForecast);
      setLoading(false);
      return;
    }

    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [statsRes, pipelineRes, riskRes, atRiskRes, cashRes, runwayRes, leakageRes,
               kpiRes, agingRes, emailAnalyticsRes, riskDriversRes, plansSummaryRes,
               workingCapitalRes, dsoReductionRes, billingAnomaliesRes, cashForecastRes] = await Promise.all([
          api.get<{ data: DashboardStats }>(API_ENDPOINTS.dashboard.stats),
          api.get<{ data: InvoicePipeline }>(API_ENDPOINTS.dashboard.pipeline),
          api.get<{ data: CustomerRisk[]; total: number }>(API_ENDPOINTS.dashboard.riskList + '?limit=10'),
          api.get<{ data: AtRiskCustomer[] }>('/api/dashboard/at-risk').catch(() => ({ data: [] as AtRiskCustomer[] })),
          api.get<{ data: CashPosition }>('/api/dashboard/cash-position').catch(() => ({ data: null as CashPosition | null })),
          api.get<{ data: RunwayData }>('/api/dashboard/runway').catch(() => ({ data: null as RunwayData | null })),
          api.get<{ data: CashLeakageData }>('/api/dashboard/cash-leakage').catch(() => ({ data: null as CashLeakageData | null })),
          api.get<{ data: DashboardKpi }>('/api/dashboard/kpi').catch(() => ({ data: null as DashboardKpi | null })),
          api.get<{ data: AgingAnalysis }>('/api/dashboard/aging-analysis').catch(() => ({ data: null as AgingAnalysis | null })),
          api.get<{ data: EmailAnalytics }>('/api/dashboard/email-analytics').catch(() => ({ data: null as EmailAnalytics | null })),
          api.get<{ data: RiskDrivers }>('/api/dashboard/risk-drivers').catch(() => ({ data: null as RiskDrivers | null })),
          api.get<{ data: PaymentPlansSummaryData }>('/api/dashboard/payment-plans-summary').catch(() => ({ data: null as PaymentPlansSummaryData | null })),
          api.get<{ data: WorkingCapitalFreed }>('/api/dashboard/working-capital-freed').catch(() => ({ data: null as WorkingCapitalFreed | null })),
          api.get<{ data: DSOReduction }>('/api/dashboard/dso-reduction').catch(() => ({ data: null as DSOReduction | null })),
          api.get<{ data: BillingAnomaly[] }>('/api/billing-optimization').catch(() => ({ data: [] as BillingAnomaly[] })),
          api.get<{ data: EnhancedCashForecast }>('/api/dashboard/cash-forecast').catch(() => ({ data: null as EnhancedCashForecast | null })),
        ]);
        const stats = statsRes.data;
        const pipeline = pipelineRes.data;
        const riskList = riskRes.data;
        const atRisk = atRiskRes.data || [];
        const cashPosition = cashRes.data;
        const runway = runwayRes.data;
        const leakage = leakageRes.data;
        const kpiData = kpiRes.data;
        const agingData = agingRes.data;
        const emailAnalyticsData = emailAnalyticsRes.data;
        const riskDriversData = riskDriversRes.data;
        const plansSummaryData = plansSummaryRes.data;
        const workingCapitalData = workingCapitalRes.data;
        const dsoReductionData = dsoReductionRes.data;
        const billingAnomaliesData = billingAnomaliesRes.data || [];
        const cashForecastData = cashForecastRes.data;

        setStats(stats);
        setPipeline(pipeline);
        setRiskList(riskList);
        setAtRisk(atRisk);
        if (cashPosition) {
          setCashPosition(cashPosition);
          setCashBalanceInput(String(cashPosition.currentBalance || 0));
        }
        setRunway(runway);
        setLeakage(leakage);
        setKpi(kpiData);
        setAging(agingData);
        setEmailAnalytics(emailAnalyticsData);
        setRiskDrivers(riskDriversData);
        setPlansSummary(plansSummaryData);
        setWorkingCapital(workingCapitalData);
        setDsoReduction(dsoReductionData);
        setBillingAnomalies(billingAnomaliesData);
        setCashForecast(cashForecastData);

        // ✅ Save to module-level cache
        dashCache = {
          stats, pipeline, riskList, atRisk, cashPosition, runway, leakage,
          kpi: kpiData, aging: agingData, emailAnalytics: emailAnalyticsData,
          riskDrivers: riskDriversData, plansSummary: plansSummaryData, timeline: [],
          workingCapital: workingCapitalData, dsoReduction: dsoReductionData,
          billingAnomalies: billingAnomaliesData, cashForecast: cashForecastData,
          ts: Date.now(),
        };
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const handleTriggerAgent = async () => {
    setTriggeringAgent(true);
    setAgentMsg(null);
    setAgentPreview(null);
    try {
      const res = await api.post<{ emailsQueued: number; plansOffered: number; invoicesScanned: number; skipped: number }>('/api/dashboard/agent/trigger');
      const { emailsQueued, plansOffered, invoicesScanned } = res;
      if (emailsQueued === 0 && plansOffered === 0) {
        setAgentMsg(`Scanned ${invoicesScanned} invoices — all up to date.`);
      } else {
        const parts = [];
        if (emailsQueued > 0) parts.push(`${emailsQueued} email${emailsQueued !== 1 ? 's' : ''} queued`);
        if (plansOffered > 0) parts.push(`${plansOffered} plan offer${plansOffered !== 1 ? 's' : ''} sent`);
        setAgentMsg(`Agent run complete: ${parts.join(', ')} (${invoicesScanned} invoices scanned).`);
      }
    } catch (err: any) {
      setAgentMsg(err.message || 'Failed to trigger agent');
    } finally {
      setTriggeringAgent(false);
      setTimeout(() => setAgentMsg(null), 8000);
    }
  };

  const handlePreviewAgent = async () => {
    setLoadingPreview(true);
    setAgentPreview(null);
    setAgentMsg(null);
    try {
      const res = await api.post<AgentPreview>('/api/dashboard/agent/preview');
      // Deduplicate: for each customer, keep only the highest-risk dunning email
      // (payment_plan_offer shown separately, not as a duplicate row)
      const seen = new Map<string, AgentPreview['previews'][0]>();
      for (const item of res.previews) {
        if (item.emailType === 'payment_plan_offer') continue; // skip plan offers from main list
        const existing = seen.get(item.customerId);
        if (!existing || item.riskScore > existing.riskScore) {
          seen.set(item.customerId, item);
        }
      }
      const dedupedPreviews = Array.from(seen.values()).sort((a, b) => b.riskScore - a.riskScore);
      setAgentPreview({ ...res, previews: dedupedPreviews });
    } catch (err: any) {
      setAgentMsg(err.message || 'Failed to load preview');
      setTimeout(() => setAgentMsg(null), 6000);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleWhatIf = async (scenario: { type: 'remove_customer' | 'accelerate_dunning' | 'custom'; removeCustomerId?: string; customReductionPct?: number }) => {
    const res = await api.post<{ data: any }>('/api/dashboard/cash-whatif', scenario);
    return res.data;
  };

  const handleCashBalanceSubmit = async () => {
    const val = parseFloat(cashBalanceInput);
    if (!isNaN(val) && val >= 0) {
      try {
        await api.put('/api/dashboard/cash-balance', { balanceUsd: val });
        const res = await api.get<{ data: CashPosition }>('/api/dashboard/cash-position');
        if (res.data) setCashPosition(res.data);
      } catch { /* non-critical */ }
    }
  };

  const handleConfirmAnomaly = async (id: string) => {
    try {
      await api.patch(`/api/billing-optimization/${id}`, { status: 'confirmed' });
      setBillingAnomalies(prev => prev.map(a => a.id === id ? { ...a, status: 'confirmed' as const } : a));
      // Refresh working capital since confirming an anomaly may affect it
      const wcRes = await api.get<{ data: WorkingCapitalFreed }>('/api/dashboard/working-capital-freed').catch(() => null);
      if (wcRes?.data) setWorkingCapital(wcRes.data);
    } catch { /* non-critical */ }
  };

  const handleDismissAnomaly = async (id: string) => {
    try {
      await api.patch(`/api/billing-optimization/${id}`, { status: 'dismissed' });
      setBillingAnomalies(prev => prev.map(a => a.id === id ? { ...a, status: 'dismissed' as const } : a));
    } catch { /* non-critical */ }
  };

  // Build customer options for WhatIf widget from risk list
  const whatIfCustomers = riskList.map(c => ({
    id: c.customerId,
    name: c.customerName,
    totalOwed: c.totalOwed,
  }));

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 mb-4">{error}</p>
        <button className="text-blue-600 hover:underline" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#09090b] min-h-full">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
      </div>

      <div className="max-w-7xl mx-auto px-6 sm:px-8 pb-6 flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div></div>
        <div className="flex items-center gap-3">
          {agentMsg && (
            <p className="text-xs text-green-600 dark:text-green-400 max-w-xs text-right">{agentMsg}</p>
          )}
          {isDemo && (
            <Button variant="secondary" size="sm" onClick={handlePreviewAgent} loading={loadingPreview}>
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Preview Agent
            </Button>
          )}
          {!isDemo && (
            <Button variant="secondary" size="sm" onClick={handleTriggerAgent} loading={triggeringAgent}>
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Run Agent Now
            </Button>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* TIER 1: EXECUTIVE SUMMARY — Always visible, above fold */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <KPIBanner
        data={kpi && stats ? {
          dso: kpi.dso,
          collectionEfficiencyIndex: kpi.cei,
          recoveryRate: kpi.recoveryRate,
          overdueCount: kpi.atRiskCustomerCount,
          totalInvoices: kpi.totalCustomers,
          totalOwed: stats.totalOwed,
          totalRecovered: stats.totalRecovered,
        } : undefined}
        aging={aging}
        emailAnalytics={emailAnalytics}
        plansSummary={plansSummary}
        workingCapital={workingCapital}
        dsoReduction={dsoReduction}
        loading={loading}
      />

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* TIER 2: PRIMARY BUSINESS DRIVERS — Recovery funnel + impact grid */}
      {/* ════════════════════════════════════════════════════════════════ */}

      {/* Recovery Funnel */}
      <RecoveryFunnelInteractive
        invoicesAtRisk={kpi?.atRiskCustomerCount ?? 0}
        emailsSent={emailAnalytics?.sent ?? 0}
        emailsOpened={emailAnalytics?.opened ?? 0}
        emailsClicked={emailAnalytics?.clicked ?? 0}
        invoicesPaid={stats ? Math.round((stats.totalRecovered / Math.max(stats.totalOwed + stats.totalRecovered, 1)) * (kpi?.atRiskCustomerCount ?? 0)) : 0}
        loading={loading}
      />

      {/* Collections + Campaign + Payment Plans */}
      <BusinessImpactGrid
        aging={aging}
        emailAnalytics={emailAnalytics}
        plansSummary={plansSummary}
        loading={loading}
      />

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* TIER 3: SUPPORTING METRICS — Collapsible sections */}
      {/* ════════════════════════════════════════════════════════════════ */}

      {/* Billing Optimization Agent */}
      <BillingOptimizationSection
        anomalies={billingAnomalies}
        loading={loading}
        onConfirm={handleConfirmAnomaly}
        onDismiss={handleDismissAnomaly}
      />

      {/* Cash Flow & Projections */}
      <CashFlowSection
        runway={runway}
        cashPosition={cashPosition}
        leakage={leakage}
        customers={whatIfCustomers}
        cashBalanceInput={cashBalanceInput}
        onBalanceChange={setCashBalanceInput}
        onBalanceSubmit={handleCashBalanceSubmit}
        onWhatIf={handleWhatIf}
        forecast={cashForecast}
        loading={loading}
      />

      {/* Risk Signals */}
      <RiskDriversSection drivers={riskDrivers ?? undefined} loading={loading} />

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* TIER 4: ACTION ITEMS & DETAILS — Collapsible sections */}
      {/* ════════════════════════════════════════════════════════════════ */}

      {/* At-Risk Customers with Quick Actions */}
      <AtRiskCustomersSection
        customers={atRisk.map(c => ({
          customerId: c.customerId,
          customerName: c.name,
          score: c.score,
          signals: c.signals.map(s => s.description),
          invoiceAmount: c.invoiceAmount || 0,
          daysUntilDue: c.daysUntilDue || 0,
        }))}
        loading={loading}
      />

      {/* Voice Calling Stats */}
      <VoiceStatsCard />

      {/* Agent Activity Preview */}
      <AgentActivitySection
        preview={agentPreview}
        loading={loading}
        isDemo={isDemo}
        onTrigger={handleTriggerAgent}
        triggeringAgent={triggeringAgent}
      />

      {/* Detailed Analytics Tables (Optional, Collapsible) */}
      <DashboardDetailTabs
        atRiskList={riskList.map(c => ({
          customerId: c.customerId,
          customerName: c.customerName,
          customerEmail: c.customerEmail,
          unpaidInvoices: c.unpaidInvoices,
          totalOwed: c.totalOwed,
          maxRiskScore: c.maxRiskScore,
          oldestDueDays: c.oldestDueDays,
        }))}
        agingBuckets={aging?.buckets ?? []}
        loading={loading}
      />

      {/* Empty state */}
      {stats?.totalInvoices === 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Get started with RecoverAI</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
            Connect your Stripe account to start syncing invoices. Our agent will automatically detect overdue invoices and begin recovery.
          </p>
          <Button variant="primary" onClick={() => navigate('/settings')}>
            Connect Stripe →
          </Button>
        </div>
      )}

      {/* Legacy: pipeline funnel + top customers (kept for reference) */}
      {pipeline && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecoveryChart pipeline={pipeline} />
          <TopCustomersTable customers={riskList} onCustomerClick={(id) => navigate(`/customers?id=${id}`)} />
        </div>
      )}

      {/* Demo activation path */}
      {isDemo && stats && stats.totalInvoices > 0 && (
        <div className="bg-[#111113] rounded-xl border border-white/[0.06] p-4">
          <h2 className="text-sm font-semibold text-white mb-2">Activation Path</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            {[
              { label: 'Signup to Integration', value: stats.totalInvoices > 0 ? '✅ Completed' : 'Pending' },
              { label: 'Integration to First Recovery', value: stats.totalRecovered > 0 ? '✅ Completed' : 'In progress' },
              { label: 'Estimated ROI This Month', value: formatCurrency(stats.totalRecovered) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded border border-white/[0.06] p-3">
                <div className="text-zinc-400 text-xs">{label}</div>
                <div className="text-white font-medium mt-1 text-sm">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Email Preview Modal */}
      {selectedEmailForModal && (
        <EmailPreviewModal
          invoiceId={selectedEmailForModal.invoiceId}
          emailType={selectedEmailForModal.emailType}
          riskScore={selectedEmailForModal.riskScore}
          onClose={() => setSelectedEmailForModal(null)}
        />
      )}
      </div>
    </div>
  );
};

export default Dashboard;
