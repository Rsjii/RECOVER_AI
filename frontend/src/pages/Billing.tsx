import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { useNotification } from '../hooks/useNotification';
import type { BillingInvoice } from '../types';
import { formatDate } from '../lib/utils';

type BillingTab = 'subscription' | 'billing-history';

const Billing: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useNotification();

  // Redirect demo users away from Billing
  useEffect(() => {
    if (localStorage.getItem('isDemo') === 'true') {
      addToast({ type: 'info', message: 'Demo mode — Billing not available' });
      navigate('/dashboard', { replace: true });
    }
  }, [navigate, addToast]);

  useEffect(() => {
    document.title = 'Billing — RecoverAI';
  }, []);

  const [activeTab, setActiveTab] = useState<BillingTab>('subscription');
  const [subscription, setSubscription] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subRes, invoicesRes, settingsRes] = await Promise.all([
        api.get(API_ENDPOINTS.billing.subscription).catch(() => ({ data: null })),
        api.get(API_ENDPOINTS.billing.invoices).catch(() => ({ data: [] })),
        api.get('/api/settings').catch(() => ({ data: null })),
      ]);

      setSubscription((subRes as any).data);
      setInvoices((invoicesRes as any).data || []);
      setCompany((settingsRes as any).data);
    } finally {
      setLoading(false);
    }
  };

  const [pilotRecovery, setPilotRecovery] = useState<number>(0);

  const isTrial = company?.trialStatus === 'active';
  const isPilot = company?.accountType === 'pilot';
  const trialEndsAt = company?.trialEndsAt ? new Date(company.trialEndsAt) : null;
  const pilotEndsAt = company?.pilot_ends_at ? new Date(company.pilot_ends_at) : trialEndsAt;
  const now = new Date();
  const daysRemaining = pilotEndsAt ? Math.max(0, Math.ceil((pilotEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const totalPilotDays = 21;
  const pilotProgress = Math.max(0, Math.min(100, ((totalPilotDays - daysRemaining) / totalPilotDays) * 100));

  useEffect(() => {
    if ((isPilot || isTrial) && company?.companyId) {
      api.get('/api/dashboard/stats').then((res) => {
        setPilotRecovery(res.data?.totalRecovered || 0);
      }).catch(() => setPilotRecovery(0));
    }
  }, [company?.companyId, isPilot, isTrial]);

  const handleExportBillingCSV = () => {
    if (!invoices.length) return;
    const headers = ['Period', 'Base Amount', 'Success Fee', 'Total', 'Status'];
    const rows = invoices.map(inv => [
      `${formatDate(inv.period_start)} - ${formatDate(inv.period_end)}`,
      `$${parseFloat(inv.base_amount_usd).toFixed(2)}`,
      `$${parseFloat(inv.success_fee_amount_usd).toFixed(2)}`,
      `$${parseFloat(inv.total_amount_usd).toFixed(2)}`,
      inv.status,
    ]);
    const csv = [headers, ...rows].map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `billing-history-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleConvertToPaid = async () => {
    setConverting(true);
    try {
      const response = await api.post('/api/billing/checkout/pilot-conversion', {});
      if (response.data?.checkoutUrl) {
        window.location.href = response.data.checkoutUrl;
      } else {
        addToast({
          type: 'error',
          message: 'Failed to initiate conversion. Please try again.',
        });
      }
    } catch (error: any) {
      addToast({
        type: 'error',
        message: error?.response?.data?.error || 'Failed to convert pilot to paid account',
      });
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-[#09090b] py-8 px-4 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">Billing</h1>
          <p className="text-base text-gray-600 dark:text-gray-400">
            {loading ? '' : (isPilot || isTrial) ? 'Your free trial details and upgrade options' : 'Manage your subscription and invoices'}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size="md" text="Loading billing info..." />
          </div>
        ) : (
          <>
            {/* TRIAL / PILOT BANNER */}
            {(isPilot || isTrial) && (
              <div className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800/50 p-8">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-3xl">🚀</span>
                    <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full uppercase tracking-wide">
                      {daysRemaining > 0 ? `${daysRemaining} Days Left in Trial` : 'Trial Ended'}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {daysRemaining > 0 ? `Free trial — ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining` : 'Your trial has ended'}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Full platform access. No charges until you upgrade.
                  </p>

                  {/* Progress Bar */}
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Trial Progress</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {Math.min(totalPilotDays, totalPilotDays - daysRemaining)} of {totalPilotDays} days used
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all ${daysRemaining <= 3 ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-blue-600'}`}
                        style={{ width: `${pilotProgress}%` }}
                      />
                    </div>
                    {pilotEndsAt && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                        Ends {pilotEndsAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>

                  {/* 2-col: Recovery + Pricing */}
                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Recovered So Far</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {pilotRecovery > 0 ? `$${pilotRecovery.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '$0'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {pilotRecovery > 0 ? 'recovered during trial' : 'during your trial period'}
                      </p>
                    </div>
                    <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">After Trial</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">$2,500<span className="text-sm font-normal text-gray-500">/mo</span></p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">+ 1% of recoveries (outcome-based)</p>
                    </div>
                  </div>

                  {/* What you get */}
                  <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10 p-4 mb-6">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">What's included after upgrade:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
                      {[
                        'Autonomous AR agent',
                        'AI-written dunning emails',
                        'Payment plan automation',
                        'Stripe + QuickBooks sync',
                        'Cash forecast dashboard',
                        'Decline code intelligence',
                      ].map(item => (
                        <div key={item} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <span className="text-green-500 font-bold">✓</span> {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CTAs */}
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={handleConvertToPaid} variant="primary" size="md" disabled={converting}>
                      {converting ? 'Redirecting to checkout...' : 'Upgrade to Paid →'}
                    </Button>
                    <a
                      href="mailto:sales@recoverai.com"
                      className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium text-sm transition-colors"
                    >
                      Talk to Sales
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Tabs - Only show for paid customers */}
            {!isPilot && !isTrial && (
              <div className="flex gap-1 mb-8 border-b border-gray-200 dark:border-white/[0.06]">
                {(
                  [
                    { id: 'subscription', label: 'Subscription' },
                    { id: 'billing-history', label: 'Billing History' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {/* SUBSCRIPTION TAB - Paid customers only */}
            {!isPilot && !isTrial && activeTab === 'subscription' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-8">
                  <div className="grid md:grid-cols-2 gap-8">
                    {/* Current Plan */}
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-2">Current Plan</p>
                      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                        {subscription?.plan_name || 'Standard Plan'}
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Status: <span className="font-medium text-gray-900 dark:text-white capitalize">{subscription?.status || 'Active'}</span>
                      </p>
                    </div>

                    {/* Next Billing Date */}
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-2">Next Billing Date</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        {subscription?.next_billing_date ? formatDate(subscription.next_billing_date) : 'N/A'}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">To make changes to your plan, contact our sales team</p>
                    </div>
                  </div>

                  {/* Contact Sales Button */}
                  <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <a
                      href="mailto:sales@recoverai.com"
                      className="inline-flex items-center px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium transition-colors"
                    >
                      Contact Sales for Plan Changes
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* BILLING HISTORY TAB - Paid customers only */}
            {!isPilot && !isTrial && activeTab === 'billing-history' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Billing Invoices</h2>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleExportBillingCSV}
                    disabled={!invoices.length}
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export CSV
                  </Button>
                </div>
                <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
                  {invoices.length > 0 ? (
                    <div className="overflow-x-auto sm:scrollbar-show">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/[0.06]">
                          <tr>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Period</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Base Amount</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Success Fee</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Total</th>
                            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-white/[0.06]">
                          {invoices.map((invoice) => (
                            <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                              <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                                {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
                                ${parseFloat(invoice.base_amount_usd).toFixed(2)}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
                                ${parseFloat(invoice.success_fee_amount_usd).toFixed(2)}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-bold">
                                ${parseFloat(invoice.total_amount_usd).toFixed(2)}
                              </td>
                              <td className="px-6 py-4 text-sm">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    invoice.status === 'paid'
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                      : invoice.status === 'pending'
                                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                  }`}
                                >
                                  {invoice.status === 'paid' && '✓ Paid'}
                                  {invoice.status === 'pending' && '⏱ Pending'}
                                  {invoice.status === 'failed' && '✕ Failed'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="px-6 py-12 text-center">
                      <p className="text-gray-500 dark:text-gray-400">
                        No invoices yet. Invoices will appear once your first billing cycle completes.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Billing;
