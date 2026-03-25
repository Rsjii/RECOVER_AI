import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { useNotification } from '../hooks/useNotification';
import type { BillingInvoice } from '../types';
import { formatDate } from '../lib/utils';

type BillingTab = 'subscription' | 'billing-history';

const Billing: React.FC = () => {
  useEffect(() => {
    document.title = 'Billing — RecoverAI';
  }, []);

  const { addToast } = useNotification();
  const [activeTab, setActiveTab] = useState<BillingTab>('subscription');
  const [subscription, setSubscription] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subRes, invoicesRes, companyRes] = await Promise.all([
        api.get(API_ENDPOINTS.billing.subscription).catch(() => ({ data: null })),
        api.get(API_ENDPOINTS.billing.invoices).catch(() => ({ data: [] })),
        api.get('/api/company').catch(() => ({ data: null })),
      ]);

      setSubscription((subRes as any).data);
      setInvoices((invoicesRes as any).data || []);
      setCompany((companyRes as any).data);
    } finally {
      setLoading(false);
    }
  };

  const isPilot = company?.account_type === 'pilot';
  const pilotEndsAt = company?.pilot_ends_at ? new Date(company.pilot_ends_at) : null;
  const now = new Date();
  const daysRemaining = pilotEndsAt ? Math.ceil((pilotEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const totalPilotDays = 14;
  const pilotProgress = Math.max(0, Math.min(100, ((totalPilotDays - daysRemaining) / totalPilotDays) * 100));

  return (
    <div className="bg-gray-50 dark:bg-[#09090b] py-8 px-4 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">Billing</h1>
          <p className="text-base text-gray-600 dark:text-gray-400">
            {isPilot ? 'Pilot program details and timeline' : 'Manage your subscription and invoices'}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size="md" text="Loading billing info..." />
          </div>
        ) : (
          <>
            {/* PILOT PROGRAM INFO - Show if pilot */}
            {isPilot && (
              <div className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800/50 p-8">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-3xl">🎉</span>
                      <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">PILOT PROGRAM</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Free for {daysRemaining} days</h2>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                      You're in our pilot program. Full platform access, no charges.
                    </p>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Timeline</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {totalPilotDays - daysRemaining} of {totalPilotDays} days used
                        </span>
                      </div>
                      <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${pilotProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                        Ends on {pilotEndsAt?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>

                    {/* Estimated Recovery */}
                    <div className="mb-6 p-4 bg-white dark:bg-white/5 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Estimated recovery from pilot:</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">Coming soon</p>
                    </div>

                    {/* Conversion Info */}
                    <div className="bg-white dark:bg-white/5 rounded-lg p-4 mb-6">
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">If you continue after pilot:</p>
                      <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                        <li>✓ $2,500/month base fee</li>
                        <li>✓ 1% of all recoveries (success fee)</li>
                        <li>✓ First month typically ~$2,730 (if you recover $23K)</li>
                      </ul>
                    </div>

                    {/* CTA Buttons */}
                    <div className="flex gap-3">
                      <Button
                        onClick={() => {
                          addToast({ type: 'info', message: 'Contacting sales team...', duration: 3000 });
                        }}
                        variant="primary"
                        size="md"
                      >
                        Convert to Paid
                      </Button>
                      <a
                        href="mailto:sales@recoverai.com"
                        className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium text-sm transition-colors"
                      >
                        Contact Us
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tabs - Only show subscription for paid customers, hidden tabs for pilots */}
            {!isPilot && (
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
            {!isPilot && activeTab === 'subscription' && (
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
            {!isPilot && activeTab === 'billing-history' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
                  {invoices.length > 0 ? (
                    <div className="overflow-x-auto">
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
