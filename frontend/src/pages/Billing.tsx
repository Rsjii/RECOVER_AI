import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import type { BillingInvoice } from '../types';
import { formatDate } from '../lib/utils';
import BillingTrial from './BillingTrial';

type BillingTab = 'subscription' | 'billing-history';

const Billing: React.FC = () => {
  const { company } = useAuth();

  // Check if user is in trial
  const isTrial = company?.onboardingStage === 'trial_active';

  // Render trial version if user is in trial
  if (isTrial) {
    return <BillingTrial />;
  }

  useEffect(() => {
    document.title = 'Billing — CashOS';
  }, []);
  const [activeTab, setActiveTab] = useState<BillingTab>('subscription');
  const [subscription, setSubscription] = useState<any>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subRes, invoicesRes] = await Promise.all([
        api.get(API_ENDPOINTS.billing.subscription).catch(() => ({ data: null })),
        api.get(API_ENDPOINTS.billing.invoices).catch(() => ({ data: [] })),
      ]);

      setSubscription((subRes as any).data);
      setInvoices((invoicesRes as any).data || []);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="bg-white dark:bg-[#09090b] py-8 px-4 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">Billing</h1>
          <p className="text-base text-gray-600 dark:text-gray-400">
            Manage your subscription and invoices
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size="md" text="Loading billing info..." />
          </div>
        ) : (
          <>
            {/* Tabs Navigation */}
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

            {/* SUBSCRIPTION TAB */}
            {activeTab === 'subscription' && (
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
                      href="mailto:sales@cashos.io"
                      className="inline-flex items-center px-4 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium transition-colors"
                    >
                      Contact Sales for Plan Changes
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* BILLING HISTORY TAB */}
            {activeTab === 'billing-history' && (
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
