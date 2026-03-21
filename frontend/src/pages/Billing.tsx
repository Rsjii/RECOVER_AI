import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import type { BillingInvoice } from '../types';
import { formatCurrency, formatDate } from '../lib/utils';

type BillingTab = 'subscription' | 'payment-methods' | 'billing-history' | 'upgrade-plan';
type BillingInterval = 'monthly' | 'annual';

const Billing: React.FC = () => {
  useEffect(() => {
    document.title = 'Billing — RecoverAI';
  }, []);

  const [activeTab, setActiveTab] = useState<BillingTab>('subscription');
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');
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

  const handleChangePlan = async (planCode: string) => {
    try {
      const res = await api.post(API_ENDPOINTS.billing.checkout, {
        plan: planCode,
        billingInterval,
      });
      if ((res as any).checkoutUrl) {
        window.location.href = (res as any).checkoutUrl;
      }
    } catch (err) {
      console.error('Upgrade failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090b] py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">Billing & Plans</h1>
          <p className="text-base text-gray-600 dark:text-gray-400">
            Manage your subscription, payment methods, and invoices
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-gray-200 dark:border-white/[0.06]">
          {(
            [
              { id: 'subscription', label: 'Subscription' },
              { id: 'payment-methods', label: 'Payment Methods' },
              { id: 'billing-history', label: 'Billing History' },
              { id: 'upgrade-plan', label: 'Upgrade Plan' },
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

        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size="md" text="Loading billing info..." />
          </div>
        ) : (
          <>
            {/* SUBSCRIPTION TAB */}
            {activeTab === 'subscription' && (
              <div className="space-y-6">
                {/* Hero Section */}
                <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-8">
                  <div className="grid md:grid-cols-3 gap-8">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-2">Current Plan</p>
                      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                        {subscription?.plan_name || 'None'}
                      </h2>
                      {subscription?.status === 'trialing' && (
                        <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                          Trial ends {subscription?.trial_ends_at ? formatDate(subscription.trial_ends_at) : 'soon'}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-2">Monthly Cost</p>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white">
                        {subscription ? (
                          <>
                            ${subscription.base_price || 0}
                            <span className="text-lg text-gray-600 dark:text-gray-400">/mo</span>
                          </>
                        ) : (
                          'N/A'
                        )}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">+ tiered success fees</p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-2">Next Billing</p>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white">
                        {subscription?.current_period_end ? formatDate(subscription.current_period_end) : 'N/A'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Billing cycle</p>
                    </div>
                  </div>

                  <div className="mt-8 pt-8 border-t border-gray-200 dark:border-white/[0.06] flex gap-3">
                    <Button variant="primary" onClick={() => setActiveTab('upgrade-plan')}>
                      Upgrade Plan →
                    </Button>
                    <Button variant="outline">Manage Billing</Button>
                  </div>
                </div>

                {/* Recovery Stats */}
                {subscription?.recovery_fee && subscription.recovery_fee.recoveredUsd > 0 && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30 rounded-lg p-6">
                      <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium mb-1">
                        Recovered This Month
                      </p>
                      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                        {formatCurrency(subscription.recovery_fee.recoveredUsd)}
                      </p>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-lg p-6">
                      <p className="text-sm text-blue-700 dark:text-blue-400 font-medium mb-1">
                        Your Success Fee
                      </p>
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                        {formatCurrency(subscription.recovery_fee.totalUsd)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PAYMENT METHODS TAB */}
            {activeTab === 'payment-methods' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Methods</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Manage your payment methods securely. We use Stripe for secure payment processing.
                  </p>
                  <div className="text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      Payment methods managed through LemonSqueezy checkout.
                    </p>
                    <Button variant="primary">Add Payment Method</Button>
                  </div>
                </div>
              </div>
            )}

            {/* BILLING HISTORY TAB */}
            {activeTab === 'billing-history' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-white/[0.06]">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Invoices</h3>
                  </div>

                  {invoices && invoices.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/[0.06]">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                              Date
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                              Invoice ID
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">
                              Amount
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">
                              Status
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-white/[0.06]">
                          {invoices.map((invoice) => (
                            <tr
                              key={invoice.id}
                              className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                            >
                              <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                {formatDate(invoice.created_at)}
                              </td>
                              <td className="px-6 py-4 text-sm font-mono text-gray-600 dark:text-gray-400">
                                {invoice.id.slice(0, 12)}...
                              </td>
                              <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white text-right">
                                {formatCurrency(Number(invoice.total_amount_usd))}
                              </td>
                              <td className="px-6 py-4 text-sm">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    invoice.status === 'paid'
                                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
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
                              <td className="px-6 py-4 text-sm text-right">
                                <button className="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium">
                                  PDF ↓
                                </button>
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

            {/* UPGRADE PLAN TAB */}
            {activeTab === 'upgrade-plan' && (
              <div className="space-y-8">
                {/* Billing Toggle */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => setBillingInterval('monthly')}
                    className={`px-4 py-2 font-medium text-sm rounded-lg transition-colors ${
                      billingInterval === 'monthly'
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-200 dark:bg-white/[0.06] text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingInterval('annual')}
                    className={`px-4 py-2 font-medium text-sm rounded-lg transition-colors relative ${
                      billingInterval === 'annual'
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-200 dark:bg-white/[0.06] text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Annual
                    <span className="absolute -top-2 -right-3 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded">
                      Save 20%
                    </span>
                  </button>
                </div>

                {/* Plan Cards */}
                <div className="grid md:grid-cols-3 gap-6">
                  {/* Phase 0 */}
                  <div
                    className={`relative rounded-xl border-2 p-6 transition-all ${
                      subscription?.plan_code === 'phase_0'
                        ? 'border-brand-600 bg-white dark:bg-[#111113]'
                        : 'border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#111113] hover:border-gray-300 dark:hover:border-white/[0.1]'
                    }`}
                  >
                    {subscription?.plan_code === 'phase_0' && (
                      <div className="absolute top-0 right-6 -translate-y-1/2">
                        <span className="bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                          Current Plan
                        </span>
                      </div>
                    )}

                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Phase 0</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">For getting started</p>

                    <div className="mb-6">
                      <div className="text-4xl font-bold text-gray-900 dark:text-white">$0</div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">First 30 days, then $2.5k+</p>
                    </div>

                    <ul className="space-y-3 mb-6">
                      {['AI email dunning', 'Risk scoring', 'Stripe integration', 'Up to 200 invoices/month'].map(
                        (feature) => (
                          <li key={feature} className="flex items-start gap-3">
                            <span className="text-emerald-600 dark:text-emerald-400 text-lg">✓</span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                          </li>
                        )
                      )}
                    </ul>

                    <Button
                      variant={subscription?.plan_code === 'phase_0' ? 'outline' : 'primary'}
                      disabled={subscription?.plan_code === 'phase_0'}
                      onClick={() => handleChangePlan('phase_0')}
                      className="w-full"
                    >
                      {subscription?.plan_code === 'phase_0' ? 'Current Plan' : 'Get Started'}
                    </Button>
                  </div>

                  {/* Growth */}
                  <div
                    className={`relative rounded-xl border-2 p-6 transition-all ring-2 ring-brand-600/20 ${
                      subscription?.plan_code === 'growth'
                        ? 'border-brand-600 bg-brand-600/5 dark:bg-brand-900/20'
                        : 'border-brand-600/50 bg-white dark:bg-[#111113]'
                    }`}
                  >
                    {subscription?.plan_code === 'growth' && (
                      <div className="absolute top-0 right-6 -translate-y-1/2">
                        <span className="bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                          Current Plan
                        </span>
                      </div>
                    )}

                    {subscription?.plan_code !== 'growth' && (
                      <div className="absolute top-0 right-6 -translate-y-1/2">
                        <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                          Most Popular
                        </span>
                      </div>
                    )}

                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Growth</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">For scaling teams</p>

                    <div className="mb-6">
                      <div className="text-4xl font-bold text-gray-900 dark:text-white">
                        $2,500<span className="text-lg font-normal text-gray-600 dark:text-gray-400">/mo</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">+ 1-5% on recovery</p>
                    </div>

                    <ul className="space-y-3 mb-6">
                      {[
                        'Everything in Phase 0',
                        'SMS dunning',
                        'Payment plans',
                        'QuickBooks sync',
                        'Priority support',
                        'Up to 20 users',
                      ].map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <span className="text-emerald-600 dark:text-emerald-400 text-lg">✓</span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      variant={subscription?.plan_code === 'growth' ? 'outline' : 'primary'}
                      disabled={subscription?.plan_code === 'growth'}
                      onClick={() => handleChangePlan('growth')}
                      className="w-full"
                    >
                      {subscription?.plan_code === 'growth' ? 'Current Plan' : 'Upgrade'}
                    </Button>
                  </div>

                  {/* Enterprise */}
                  <div
                    className={`relative rounded-xl border-2 p-6 transition-all ${
                      subscription?.plan_code === 'enterprise'
                        ? 'border-brand-600 bg-white dark:bg-[#111113]'
                        : 'border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#111113] hover:border-gray-300 dark:hover:border-white/[0.1]'
                    }`}
                  >
                    {subscription?.plan_code === 'enterprise' && (
                      <div className="absolute top-0 right-6 -translate-y-1/2">
                        <span className="bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                          Current Plan
                        </span>
                      </div>
                    )}

                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Enterprise</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Custom requirements</p>

                    <div className="mb-6">
                      <div className="text-4xl font-bold text-gray-900 dark:text-white">Custom</div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Contact sales for pricing</p>
                    </div>

                    <ul className="space-y-3 mb-6">
                      {[
                        'Everything in Growth',
                        'Xero & NetSuite sync',
                        'API access',
                        'White-label option',
                        'Dedicated account manager',
                        'Custom integrations',
                      ].map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <span className="text-emerald-600 dark:text-emerald-400 text-lg">✓</span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button variant="outline" className="w-full">
                      {subscription?.plan_code === 'enterprise' ? 'Current Plan' : 'Contact Sales'}
                    </Button>
                  </div>
                </div>

                {/* FAQ */}
                <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-8">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Questions?</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white mb-2">Can I change plans anytime?</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Yes, upgrade or downgrade your plan at any time. Changes take effect at your next billing cycle.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white mb-2">What's included in success fees?</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Only charged on actual recovery. Tiered pricing means you save money the more you recover.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white mb-2">Do you offer annual pricing?</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Yes, annual plans include 20% discount. Switch the toggle above to see annual pricing.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white mb-2">Need help choosing?</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Email sales@recoverai.com or use the chat below. We're here to help find the right plan.
                      </p>
                    </div>
                  </div>
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
