import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useNotification } from '../hooks/useNotification';
import { useAuth } from '../hooks/useAuth';
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
import { DunningFunnelSection } from '../components/dashboard/DunningFunnelSection';
import { RecoveryFunnelInteractive } from '../components/dashboard/RecoveryFunnelInteractive';
import { CashFlowSection } from '../components/dashboard/CashFlowSection';
import { RiskDriversSection } from '../components/dashboard/RiskDriversSection';
import { AtRiskCustomersSection } from '../components/dashboard/AtRiskCustomersSection';
import { AgentActivitySection } from '../components/dashboard/AgentActivitySection';
import { BillingOptimizationSection } from '../components/dashboard/BillingOptimizationSection';
import { TrialCountdown } from '../components/TrialCountdown';
import { useCustomTour, mainDashboardTour } from '../hooks/useCustomTour';
import { CustomTour } from '../components/dashboard/CustomTour';
import type { DashboardStats, InvoicePipeline, CustomerRisk } from '../types';
import type { WorkingCapitalFreed, DSOReduction, BillingAnomaly, EnhancedCashForecast } from '../types/invoice';

interface AtRiskInvoice {
  invoiceId: string;
  amount: number;
  daysUntilDue: number;
  currency: string;
}

interface AtRiskCustomer {
  customerId: string;
  name: string;
  email: string;
  score: number;
  signals: { type: string; description: string }[];
  invoices: AtRiskInvoice[];
  totalAmount: number;
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
  hoursSaved: { hoursSaved: number; emailsSent: number; paymentPlansOffered: number; period: string } | null;
  billingAnomalies: BillingAnomaly[];
  cashForecast: EnhancedCashForecast | null;
  ts: number;
}
let dashCache: DashCache | null = null;
const CACHE_TTL = 30_000; // 30 seconds — show cached data instantly on tab switch

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useNotification();
  const { company } = useAuth();
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
  const [hoursSaved, setHoursSaved] = useState<{ hoursSaved: number; emailsSent: number; paymentPlansOffered: number; period: string } | null>(null);
  const [billingAnomalies, setBillingAnomalies] = useState<BillingAnomaly[]>([]);
  const [cashForecast, setCashForecast] = useState<EnhancedCashForecast | null>(null);
  // Pilot controls
  const [pilotMode, setPilotMode] = useState<string | null>(null);
  const [recoveryToday, setRecoveryToday] = useState<{ amount: number; count: number } | null>(null);
  const [pausingAgent, setPausingAgent] = useState(false);
  // Trial mode
  const [isTrialMode, setIsTrialMode] = useState(false);
  const [trialAnalysis, setTrialAnalysis] = useState<any>(null);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);

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
      setHoursSaved(dashCache.hoursSaved);
      setBillingAnomalies(dashCache.billingAnomalies);
      setCashForecast(dashCache.cashForecast);
      setLoading(false);
      return;
    }

    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        // TRY TRIAL MODE FIRST
        try {
          const trialRes = await api.get<{ data: any }>('/api/dashboard/trial-analysis');
          if (trialRes.data) {
            setIsTrialMode(true);
            setTrialAnalysis(trialRes.data);
            setTrialDaysRemaining(trialRes.data.trial_days_remaining || 0);
            setLoading(false);
            return;
          }
        } catch (err) {
          // Not trial mode, fall through to normal dashboard
        }

        // NORMAL DASHBOARD MODE
        const [statsRes, pipelineRes, riskRes, atRiskRes, cashRes, runwayRes, leakageRes,
               kpiRes, agingRes, emailAnalyticsRes, riskDriversRes, plansSummaryRes,
               workingCapitalRes, dsoReductionRes, hoursSavedRes, billingAnomaliesRes, cashForecastRes] = await Promise.all([
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
          api.get<{ data: { hoursSaved: number; emailsSent: number; paymentPlansOffered: number; period: string } }>('/api/dashboard/hours-saved').catch(() => ({ data: null })),
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
        const hoursSavedData = hoursSavedRes.data;
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
        setHoursSaved(hoursSavedData);
        setBillingAnomalies(billingAnomaliesData);
        setCashForecast(cashForecastData);

        // ✅ Save to module-level cache
        dashCache = {
          stats, pipeline, riskList, atRisk, cashPosition, runway, leakage,
          kpi: kpiData, aging: agingData, emailAnalytics: emailAnalyticsData,
          riskDrivers: riskDriversData, plansSummary: plansSummaryData, timeline: [],
          workingCapital: workingCapitalData, dsoReduction: dsoReductionData,
          hoursSaved: hoursSavedData,
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

  // Recovery counter polling (10s interval for pilot accounts)
  useEffect(() => {
    const fetchRecoveryToday = async () => {
      try {
        const res = await api.get<{ data: { amount: number; count: number; change_pct: number } }>('/api/dashboard/recovery-today');
        if (res.data) {
          setRecoveryToday({ amount: res.data.amount, count: res.data.count });
        }
      } catch {
        // Non-critical: if API fails, just skip this update
      }
    };

    fetchRecoveryToday();
    const interval = setInterval(fetchRecoveryToday, 10_000);
    return () => clearInterval(interval);
  }, []);

  // Kill switch handler - pause all dunning
  const handleKillSwitch = async () => {
    setPausingAgent(true);
    try {
      await api.patch('/api/settings/pilot-mode', { mode: 'paused' });
      setPilotMode('paused');
      addToast({
        type: 'success',
        message: 'All communications paused.',
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to pause agent',
      });
    } finally {
      setPausingAgent(false);
    }
  };

  // Resume handler
  const handleResume = async () => {
    setPausingAgent(true);
    try {
      await api.patch('/api/settings/pilot-mode', { mode: 'shadow' });
      setPilotMode('shadow');
      addToast({
        type: 'success',
        message: 'Resuming in shadow mode.',
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to resume',
      });
    } finally {
      setPausingAgent(false);
    }
  };

  // Initialize custom tour (first-time only)
  const { startTour, closeTour, completeTour, markTourStarted, isTourCompleted, isTourStarted, resetTour, isOpen, currentTour } = useCustomTour();

  useEffect(() => {
    // Check if tour should run on first visit
    const tourCompleted = isTourCompleted('main_onboarding');
    const tourStarted = isTourStarted('main_onboarding');
    const shouldShowTour = !tourCompleted && !tourStarted;

    if (shouldShowTour) {
      // Auto-start after a short delay to let page settle
      const timer = setTimeout(() => {
        startTour(mainDashboardTour);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [startTour, isTourCompleted, isTourStarted]);

  // Debug: Allow manual tour reset via ?tour=reset in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tour') === 'reset') {
      resetTour('main_onboarding');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [resetTour]);

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
      {/* TRIAL BANNER */}
      {isTrialMode && trialDaysRemaining >= 0 && (
        <div className="max-w-7xl mx-auto px-6 sm:px-8 mb-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-1">🎯 14-Day Free Trial</h3>
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">{trialDaysRemaining} days remaining</p>
                <div className="w-full bg-blue-200 dark:bg-blue-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 h-full transition-all"
                    style={{ width: `${Math.round((14 - trialDaysRemaining) / 14 * 100)}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{Math.round((14 - trialDaysRemaining) / 14 * 100)}%</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">Complete</p>
                </div>
                <Button
                  onClick={() => navigate('/pricing')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg whitespace-nowrap"
                >
                  Upgrade Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TRIAL MODE: Show audit analysis */}
      {isTrialMode && trialAnalysis && (
        <div className="max-w-7xl mx-auto px-6 sm:px-8 pb-6 flex flex-col space-y-6">
          {/* Cash Clarity Score */}
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cash Clarity Score</h2>
            <div className="flex items-center gap-4">
              <div className="text-5xl font-bold text-blue-600 dark:text-blue-400">{trialAnalysis.cash_clarity_score}/100</div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Your cash health rating based on real Stripe data</p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 dark:bg-blue-400 h-full transition-all"
                    style={{ width: `${trialAnalysis.cash_clarity_score}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Available Cash</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">${(trialAnalysis.available_cash / 1000).toFixed(0)}K</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Runway</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{trialAnalysis.runway_days} days</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Overdue AR</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">${(trialAnalysis.overdue_ar / 1000).toFixed(0)}K</p>
            </div>
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Days Late</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{trialAnalysis.avg_days_late}d</p>
            </div>
          </div>

          {/* Billing Errors */}
          {trialAnalysis.billing_errors && trialAnalysis.billing_errors.total_value > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">💰 Billing Errors Detected: ${(trialAnalysis.billing_errors.total_value / 1000).toFixed(0)}K</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="border-l-4 border-orange-500 pl-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Duplicates</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{trialAnalysis.billing_errors.duplicates.count}</p>
                  <p className="text-xs text-orange-600 dark:text-orange-400">${(trialAnalysis.billing_errors.duplicates.value / 1000).toFixed(0)}K</p>
                </div>
                <div className="border-l-4 border-yellow-500 pl-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Spikes</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{trialAnalysis.billing_errors.spikes.count}</p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">${(trialAnalysis.billing_errors.spikes.value / 1000).toFixed(0)}K</p>
                </div>
                <div className="border-l-4 border-red-500 pl-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Failed Clusters</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{trialAnalysis.billing_errors.failed_clusters.count}</p>
                  <p className="text-xs text-red-600 dark:text-red-400">${(trialAnalysis.billing_errors.failed_clusters.value / 1000).toFixed(0)}K</p>
                </div>
                <div className="border-l-4 border-blue-500 pl-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Gaps</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{trialAnalysis.billing_errors.gaps.count}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">${(trialAnalysis.billing_errors.gaps.value / 1000).toFixed(0)}K</p>
                </div>
              </div>
            </div>
          )}

          {/* Risks */}
          {trialAnalysis.risks && trialAnalysis.risks.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">⚠️ Top Risks Found</h2>
              <div className="space-y-3">
                {trialAnalysis.risks.map((risk: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="mt-0.5">
                      {risk.severity === 'critical' && <div className="w-3 h-3 rounded-full bg-red-600" />}
                      {risk.severity === 'high' && <div className="w-3 h-3 rounded-full bg-orange-600" />}
                      {risk.severity === 'medium' && <div className="w-3 h-3 rounded-full bg-yellow-600" />}
                      {risk.severity === 'low' && <div className="w-3 h-3 rounded-full bg-blue-600" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">{risk.title}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{risk.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insights */}
          {trialAnalysis.insights && trialAnalysis.insights.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">💡 AI Insights</h2>
              <ul className="space-y-2">
                {trialAnalysis.insights.map((insight: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <span className="text-blue-600 dark:text-blue-400 mt-0.5">→</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* NORMAL MODE: Show regular dashboard */}
      {!isTrialMode && (
      <div className="max-w-7xl mx-auto px-6 sm:px-8 pb-6 flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
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
            <div title={company?.onboarding_stage === 'trial_active' ? 'Only available on paid plans' : undefined}>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleTriggerAgent}
                loading={triggeringAgent}
                disabled={company?.onboarding_stage === 'trial_active'}
                className={company?.onboarding_stage === 'trial_active' ? 'opacity-50 cursor-not-allowed' : ''}
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Run Agent Now
              </Button>
            </div>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              resetTour('main_onboarding');
              startTour(mainDashboardTour);
            }}
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Tour
          </Button>

          {/* Recovery Counter */}
          {!isDemo && recoveryToday && recoveryToday.amount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-green-600 dark:bg-green-400 animate-pulse" />
              <span className="text-sm font-medium text-green-900 dark:text-green-200">
                Recovered: ${recoveryToday.amount.toLocaleString()}
              </span>
            </div>
          )}

          {/* Kill Switch / Resume Buttons */}
          {!isDemo && pilotMode !== null && (
            <>
              {pilotMode !== 'paused' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleKillSwitch}
                  loading={pausingAgent}
                  className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800"
                >
                  ⏸ Pause All
                </Button>
              )}
              {pilotMode === 'paused' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleResume}
                  loading={pausingAgent}
                  className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 border border-green-200 dark:border-green-800"
                >
                  ▶ Resume
                </Button>
              )}
            </>
          )}

          <p className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* TRIAL COUNTDOWN BANNER */}
      {/* ════════════════════════════════════════════════════════════════ */}
      {company?.trial_ends_at && (
        <TrialCountdown
          trialEndsAt={company.trial_ends_at}
          onUpgrade={() => navigate('/pricing')}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* TIER 1: EXECUTIVE SUMMARY — Always visible, above fold */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div data-tour="kpi-banner">
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
          hoursSaved={hoursSaved}
          loading={loading}
        />
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* TIER 2: PRIMARY BUSINESS DRIVERS — Recovery funnel + impact grid */}
      {/* ════════════════════════════════════════════════════════════════ */}

      {/* Recovery Funnel - Now with CollapsibleSection */}
      {(() => {
        const invoicesAtRisk = kpi?.atRiskCustomerCount ?? 0;
        const emailsSent = emailAnalytics?.sent ?? 0;
        const recovered = stats ? Math.round((stats.totalRecovered / Math.max(stats.totalOwed + stats.totalRecovered, 1)) * invoicesAtRisk) : 0;
        const recoveryRate = invoicesAtRisk > 0 ? Math.round((recovered / invoicesAtRisk) * 100) : 0;

        return (
          <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
            <div className="px-4 py-3 md:px-5 md:py-4 border-b border-gray-200 dark:border-white/[0.06]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Recovery Funnel</h2>
                  <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">{invoicesAtRisk.toLocaleString()} at-risk → {recovered.toLocaleString()} recovered ({recoveryRate}%)</p>
                </div>
              </div>
            </div>
            <div className="p-4 md:p-5">
              <RecoveryFunnelInteractive
                invoicesAtRisk={invoicesAtRisk}
                emailsSent={emailsSent}
                emailsOpened={emailAnalytics?.opened ?? 0}
                emailsClicked={emailAnalytics?.clicked ?? 0}
                invoicesPaid={recovered}
                loading={loading}
              />
            </div>
          </div>
        );
      })()}

      {/* Integrated Dunning Funnel - A/R Aging + Campaign + Payment Plans */}
      {aging && (
        <DunningFunnelSection
          totalAr={aging.totalAr}
          agingBuckets={aging.buckets}
          emailsSent={emailAnalytics?.sent ?? 0}
          emailsDelivered={emailAnalytics?.sent ?? 0}
          plansOffered={plansSummary?.totalOffered ?? 0}
          plansAccepted={plansSummary?.completedPlans ?? 0}
          paymentsReceived={stats?.totalRecovered ? Math.round(stats.totalRecovered) : 0}
          paymentAmount={stats?.totalRecovered ?? 0}
          recentPlans={plansSummary?.recentPlans ?? []}
          loading={loading}
        />
      )}

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
        customers={atRisk}
        loading={loading}
      />


      {/* Agent Activity Preview */}
      <div data-tour="activity-section">
        <AgentActivitySection
          preview={agentPreview}
          loading={loading}
          isDemo={isDemo}
          onTrigger={handleTriggerAgent}
          triggeringAgent={triggeringAgent}
        />
      </div>

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
      </div>
      )}

      {/* Email Preview Modal */}
      {selectedEmailForModal && (
        <EmailPreviewModal
          invoiceId={selectedEmailForModal.invoiceId}
          emailType={selectedEmailForModal.emailType}
          riskScore={selectedEmailForModal.riskScore}
          daysOverdue={selectedEmailForModal.daysOverdue}
          onClose={() => setSelectedEmailForModal(null)}
        />
      )}

      {/* Custom Tour */}
      {currentTour && (
        <CustomTour
          steps={currentTour.steps}
          isOpen={isOpen}
          onClose={closeTour}
          onComplete={() => completeTour(currentTour.id)}
          onBackdropClick={() => markTourStarted(currentTour.id)}
        />
      )}
    </div>
  );
};

export default Dashboard;
