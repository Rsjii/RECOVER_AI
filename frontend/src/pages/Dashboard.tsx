import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { formatCurrency, formatNumber } from '../lib/utils';
import { DashboardSkeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { StatsCard } from '../components/dashboard/StatsCard';
import { RecoveryChart } from '../components/dashboard/RecoveryChart';
import { RiskBreakdownChart } from '../components/dashboard/RiskBreakdownChart';
import { TopCustomersTable } from '../components/dashboard/TopCustomersTable';
import { RunwayWidget } from '../components/dashboard/RunwayWidget';
import type { RunwayData } from '../components/dashboard/RunwayWidget';
import { CashPositionWidget } from '../components/dashboard/CashPositionWidget';
import { WhatIfWidget } from '../components/dashboard/WhatIfWidget';
import { CashLeakageWidget } from '../components/dashboard/CashLeakageWidget';
import type { CashLeakageData } from '../components/dashboard/CashLeakageWidget';
import { AtRiskWidget } from '../components/dashboard/AtRiskWidget';
import { EmailPreviewModal } from '../components/invoices/EmailPreviewModal';
import type { DashboardStats, InvoicePipeline, CustomerRisk } from '../types';

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

const EMAIL_TYPE_SHORT: Record<string, string> = {
  dunning_1: 'Reminder 1',
  dunning_2: 'Reminder 2',
  dunning_3: 'Reminder 3',
  dunning_4: 'Formal notice',
  dunning_5: 'Escalation',
  payment_plan_offer: 'Payment plan',
};

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
  const [expandAll, setExpandAll] = useState(false);
  const [selectedEmailForModal, setSelectedEmailForModal] = useState<AgentPreview['previews'][0] | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [emailOverrides, setEmailOverrides] = useState<Record<string, string>>({}); // invoiceId → email
  const [editingEmail, setEditingEmail] = useState<string | null>(null); // which invoiceId is being edited
  const [sendingIndividual, setSendingIndividual] = useState<string | null>(null); // which invoiceId is sending
  const [atRisk, setAtRisk] = useState<AtRiskCustomer[]>([]);
  const [cashPosition, setCashPosition] = useState<CashPosition | null>(null);
  const [cashBalanceInput, setCashBalanceInput] = useState<string>('');
  const [runway, setRunway] = useState<RunwayData | null>(null);
  const [leakage, setLeakage] = useState<CashLeakageData | null>(null);

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
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [statsRes, pipelineRes, riskRes, atRiskRes, cashRes, runwayRes, leakageRes] = await Promise.all([
          api.get<{ data: DashboardStats }>(API_ENDPOINTS.dashboard.stats),
          api.get<{ data: InvoicePipeline }>(API_ENDPOINTS.dashboard.pipeline),
          api.get<{ data: CustomerRisk[]; total: number }>(API_ENDPOINTS.dashboard.riskList + '?limit=10'),
          api.get<{ data: AtRiskCustomer[] }>('/api/dashboard/at-risk').catch(() => ({ data: [] as AtRiskCustomer[] })),
          api.get<{ data: CashPosition }>('/api/dashboard/cash-position').catch(() => ({ data: null as CashPosition | null })),
          api.get<{ data: RunwayData }>('/api/dashboard/runway').catch(() => ({ data: null as RunwayData | null })),
          api.get<{ data: CashLeakageData }>('/api/dashboard/cash-leakage').catch(() => ({ data: null as CashLeakageData | null })),
        ]);
        setStats(statsRes.data);
        setPipeline(pipelineRes.data);
        setRiskList(riskRes.data);
        setAtRisk(atRiskRes.data || []);
        if (cashRes.data) {
          setCashPosition(cashRes.data);
          setCashBalanceInput(String(cashRes.data.currentBalance || 0));
        }
        setRunway(runwayRes.data);
        setLeakage(leakageRes.data);
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

  const handleSendIndividual = async (invoiceId: string, originalEmail: string) => {
    setSendingIndividual(invoiceId);
    try {
      const email = emailOverrides[invoiceId] || originalEmail;
      const res = await api.post<{ message: string; recipientEmail: string }>(`/api/dashboard/agent/trigger-single`, { invoiceId, emailOverride: email });
      setAgentMsg(`Email queued for ${res.recipientEmail} ✓`);
      setTimeout(() => setAgentMsg(null), 5000);
    } catch (err: any) {
      setAgentMsg(`Failed to send: ${err.message}`);
    } finally {
      setSendingIndividual(null);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <div className="flex items-center gap-3">
          {agentMsg && (
            <p className="text-xs text-green-600 dark:text-green-400 max-w-xs text-right">{agentMsg}</p>
          )}
          <Button variant="secondary" size="sm" onClick={handlePreviewAgent} loading={loadingPreview}>
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview Agent
          </Button>
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

      {/* Agent Preview Panel — shows what agent WOULD do, pending approval */}
      {agentPreview && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
                Agent Preview — Pending Your Approval
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                No emails sent yet. Review what the agent plans to do, then approve.
              </p>
            </div>
            <button
              onClick={() => setAgentPreview(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-4"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Invoices scanned', value: agentPreview.invoicesScanned, color: 'text-gray-900 dark:text-white' },
              { label: 'Emails to send', value: agentPreview.emailsWouldQueue, color: 'text-blue-600' },
              { label: 'Payment plans', value: agentPreview.plansWouldOffer, color: 'text-purple-600' },
              { label: 'Est. recovery', value: `$${agentPreview.estimatedRecoveryUsd.toLocaleString()}`, color: 'text-green-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white dark:bg-[#111113] rounded-lg p-3 text-center border border-gray-200 dark:border-white/[0.06]">
                <div className={`text-xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          {agentPreview.previews.length > 0 && (
            <div className="bg-white dark:bg-[#111113] rounded-lg border border-gray-200 dark:border-white/[0.06] mb-4 overflow-hidden">
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {agentPreview.previews.slice(0, expandAll ? undefined : 5).map((item) => {
                  const isEditing = editingEmail === item.invoiceId;
                  const isSending = sendingIndividual === item.invoiceId;
                  const overrideEmail = emailOverrides[item.invoiceId];
                  return (
                    <div key={`${item.invoiceId}-${item.emailType}`} className="px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 dark:text-white">{item.customerName}</span>
                        <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                          <span className="text-gray-500">{item.daysOverdue}d</span>
                          <span className="font-medium text-gray-700 dark:text-gray-300">${item.amount.toLocaleString()}</span>
                          <span className={`px-1.5 py-0.5 rounded font-medium ${item.riskScore >= 80 ? 'bg-red-100 text-red-700' : item.riskScore >= 50 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                            {item.riskScore}
                          </span>
                          <span className="bg-gray-100 dark:bg-white/[0.03] text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                            {EMAIL_TYPE_SHORT[item.emailType] || item.emailType}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500 flex-shrink-0">Email:</span>
                        {isEditing ? (
                          <input
                            type="email"
                            value={overrideEmail || item.recipientEmail}
                            onChange={(e) => setEmailOverrides({ ...emailOverrides, [item.invoiceId]: e.target.value })}
                            onBlur={() => setEditingEmail(null)}
                            autoFocus
                            className="flex-1 px-2 py-1 border border-blue-400 dark:border-blue-500 rounded bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white text-xs focus:outline-none"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingEmail(item.invoiceId)}
                            className="flex items-center gap-1 flex-1 min-w-0 px-2 py-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] hover:text-gray-900 dark:hover:text-white rounded transition-colors group"
                          >
                            <span className="truncate">{overrideEmail || item.recipientEmail}</span>
                            <svg className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedEmailForModal(item)}
                          className="px-2 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors flex-shrink-0"
                        >
                          View
                        </button>
                        {!isDemo && (
                          <button
                            onClick={() => handleSendIndividual(item.invoiceId, item.recipientEmail)}
                            disabled={isSending}
                            className="px-2 py-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSending ? 'Sending...' : 'Send →'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {agentPreview.previews.length > 5 && !expandAll && (
                  <button
                    onClick={() => setExpandAll(true)}
                    className="w-full px-4 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-center transition-colors"
                  >
                    +{agentPreview.previews.length - 5} more
                  </button>
                )}
                {expandAll && agentPreview.previews.length > 5 && (
                  <button
                    onClick={() => setExpandAll(false)}
                    className="w-full px-4 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-center transition-colors"
                  >
                    Show less
                  </button>
                )}
              </div>
            </div>
          )}
          {isDemo ? (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2 text-xs text-amber-800 dark:text-amber-400">
              📌 Demo mode: Emails not sent. Click individual "Send →" buttons above to test, or <a href="/demo" className="underline font-medium">Try with your real data</a>.
            </div>
          ) : (
            <div className="flex gap-3">
              <Button size="sm" onClick={handleTriggerAgent} loading={triggeringAgent}>
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Approve & Send {agentPreview.emailsWouldQueue} Email{agentPreview.emailsWouldQueue !== 1 ? 's' : ''}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setAgentPreview(null)}>
                Skip This Batch
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ═══ CASH COMMAND CENTER ═══ */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Cash Command Center</h2>

        {/* Runway Widget — full width, prominent */}
        <RunwayWidget runway={runway} loading={loading} />

        {/* Cash Position + What-If side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CashPositionWidget
            cashPosition={cashPosition}
            cashBalanceInput={cashBalanceInput}
            onBalanceChange={setCashBalanceInput}
            onBalanceSubmit={handleCashBalanceSubmit}
            loading={loading}
          />
          <WhatIfWidget onCalculate={handleWhatIf} customers={whatIfCustomers} />
        </div>

        {/* Cash Leakage — full width */}
        <CashLeakageWidget leakage={leakage} loading={loading} />
      </div>

      {/* ═══ RISK INTELLIGENCE ═══ */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Risk Intelligence</h2>
        <AtRiskWidget
          atRiskCustomers={atRisk.map(c => ({
            customerId: c.customerId,
            customerName: c.name,
            score: c.score,
            signals: c.signals.map(s => s.description),
            invoiceAmount: c.invoiceAmount || 0,
            daysUntilDue: c.daysUntilDue || 0,
          }))}
          loading={loading}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Total Owed" value={formatCurrency(stats?.totalOwed || 0)}
          subtitle={`${stats?.totalInvoices || 0} total invoices`}
          icon={<span className="text-2xl">💰</span>} color="text-red-600" />
        <StatsCard label="Recovered" value={formatCurrency(stats?.totalRecovered || 0)}
          subtitle={`${stats?.recoveryRate || 0}% recovery rate`}
          icon={<span className="text-2xl">✅</span>} color="text-green-600" />
        <StatsCard label="Overdue" value={formatNumber(stats?.overdueCount || 0)}
          subtitle={formatCurrency(stats?.overdueAmount || 0) + ' at risk'}
          icon={<span className="text-2xl">⚠️</span>} color="text-orange-600" />
        <StatsCard label="Avg Collection" value={`${stats?.avgDaysToCollect || 0} days`}
          subtitle="Days sales outstanding"
          icon={<span className="text-2xl">📊</span>} />
      </div>

      {/* Activation Path */}
      <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Activation Path</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded border border-gray-200 dark:border-white/[0.06] p-3">
            <div className="text-gray-500 dark:text-gray-400">Signup to Integration</div>
            <div className="text-gray-900 dark:text-white font-medium mt-1">
              {stats && stats.totalInvoices > 0 ? 'Completed' : 'Pending'}
            </div>
          </div>
          <div className="rounded border border-gray-200 dark:border-white/[0.06] p-3">
            <div className="text-gray-500 dark:text-gray-400">Integration to First Recovery</div>
            <div className="text-gray-900 dark:text-white font-medium mt-1">
              {stats && stats.totalRecovered > 0 ? 'Completed' : 'In progress'}
            </div>
          </div>
          <div className="rounded border border-gray-200 dark:border-white/[0.06] p-3">
            <div className="text-gray-500 dark:text-gray-400">Estimated ROI This Month</div>
            <div className="text-gray-900 dark:text-white font-medium mt-1">
              {formatCurrency(stats?.totalRecovered || 0)}
            </div>
          </div>
        </div>
      </div>

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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {pipeline && <RecoveryChart pipeline={pipeline} />}
        {pipeline && <RiskBreakdownChart pipeline={pipeline} />}
      </div>

      {/* Top At-Risk Customers */}
      <TopCustomersTable customers={riskList}
        onCustomerClick={(id) => navigate(`/customers?id=${id}`)} />

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
  );
};

export default Dashboard;
