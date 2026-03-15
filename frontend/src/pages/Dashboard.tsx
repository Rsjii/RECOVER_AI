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
import type { DashboardStats, InvoicePipeline, CustomerRisk } from '../types';

interface AgentPreview {
  emailsWouldQueue: number;
  plansWouldOffer: number;
  invoicesScanned: number;
  estimatedRecoveryUsd: number;
  previews: Array<{
    invoiceId: string;
    customerName: string;
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

  useEffect(() => {
    document.title = 'Dashboard — RecoverAI';
  }, []);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [statsRes, pipelineRes, riskRes] = await Promise.all([
          api.get<{ data: DashboardStats }>(API_ENDPOINTS.dashboard.stats),
          api.get<{ data: InvoicePipeline }>(API_ENDPOINTS.dashboard.pipeline),
          api.get<{ data: CustomerRisk[]; total: number }>(API_ENDPOINTS.dashboard.riskList + '?limit=10'),
        ]);
        setStats(statsRes.data);
        setPipeline(pipelineRes.data);
        setRiskList(riskRes.data);
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
      setAgentPreview(res);
    } catch (err: any) {
      setAgentMsg(err.message || 'Failed to load preview');
      setTimeout(() => setAgentMsg(null), 6000);
    } finally {
      setLoadingPreview(false);
    }
  };

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
          <Button variant="secondary" size="sm" onClick={handleTriggerAgent} loading={triggeringAgent}>
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Run Agent Now
          </Button>
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
              <div key={label} className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center border border-gray-200 dark:border-gray-700">
                <div className={`text-xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          {agentPreview.previews.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-4 overflow-hidden">
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {agentPreview.previews.slice(0, 5).map((item) => (
                  <div key={`${item.invoiceId}-${item.emailType}`} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-gray-900 dark:text-white truncate">{item.customerName}</span>
                    <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                      <span className="text-gray-500">{item.daysOverdue}d overdue</span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">${item.amount.toLocaleString()}</span>
                      <span className={`px-1.5 py-0.5 rounded font-medium ${item.riskScore >= 80 ? 'bg-red-100 text-red-700' : item.riskScore >= 50 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                        {item.riskScore}
                      </span>
                      <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                        {EMAIL_TYPE_SHORT[item.emailType] || item.emailType}
                      </span>
                    </div>
                  </div>
                ))}
                {agentPreview.previews.length > 5 && (
                  <div className="px-4 py-2 text-xs text-gray-500 text-center">
                    +{agentPreview.previews.length - 5} more
                  </div>
                )}
              </div>
            </div>
          )}
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
        </div>
      )}

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

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Activation Path</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-gray-500 dark:text-gray-400">Signup to Integration</div>
            <div className="text-gray-900 dark:text-white font-medium mt-1">
              {stats && stats.totalInvoices > 0 ? 'Completed' : 'Pending'}
            </div>
          </div>
          <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-gray-500 dark:text-gray-400">Integration to First Recovery</div>
            <div className="text-gray-900 dark:text-white font-medium mt-1">
              {stats && stats.totalRecovered > 0 ? 'Completed' : 'In progress'}
            </div>
          </div>
          <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
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
    </div>
  );
};

export default Dashboard;
