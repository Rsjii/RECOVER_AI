import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import type { BillingInvoice, CompanySubscription, SubscriptionPlan, UsageRollup } from '../types';
import { formatCurrency, formatDate } from '../lib/utils';

interface RecoveryFee {
  baseFeeUsd: number;
  recoveredUsd: number;
  feePct: number;
  recoveryFeeUsd: number;
  totalUsd: number;
}

const Billing: React.FC = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<CompanySubscription | null>(null);
  const [recoveryFee, setRecoveryFee] = useState<RecoveryFee | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [usage, setUsage] = useState<UsageRollup[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [plansRes, subRes, invRes, usageRes] = await Promise.all([
        api.get<{ data: SubscriptionPlan[] }>(API_ENDPOINTS.billing.plans),
        api.get<{ data: CompanySubscription | null }>(API_ENDPOINTS.billing.subscription),
        api.get<{ data: BillingInvoice[] }>(API_ENDPOINTS.billing.invoices),
        api.get<{ data: UsageRollup[] }>(API_ENDPOINTS.billing.usage),
      ]);
      setPlans(plansRes.data || []);
      setSubscription((subRes as any).data || null);
      setRecoveryFee((subRes as any).recoveryFee || null);
      setInvoices(invRes.data || []);
      setUsage(usageRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Billing — RecoverAI';
    void load();
  }, []);

  const changePlan = async (planCode: string) => {
    setActionLoading(true);
    try {
      await api.put(API_ENDPOINTS.billing.subscription, { planCode, status: 'active' });
      await load();
    } finally {
      setActionLoading(false);
    }
  };

  const generateInvoice = async () => {
    setActionLoading(true);
    try {
      await api.post(API_ENDPOINTS.billing.generateInvoice);
      await load();
    } finally {
      setActionLoading(false);
    }
  };

  const reconcileUsage = async () => {
    setActionLoading(true);
    try {
      await api.post(API_ENDPOINTS.billing.syncRecovered);
      await api.post(API_ENDPOINTS.billing.reconcileUsage);
      await load();
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Billing</h1>
        <div className="flex gap-2">
          <Button variant="outline" loading={actionLoading} onClick={reconcileUsage}>
            Reconcile Usage
          </Button>
          <Button variant="outline" loading={actionLoading} onClick={generateInvoice}>
            Generate Monthly Invoice
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>Loading billing...</Card>
      ) : (
        <>
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Current Subscription</h2>
            {subscription ? (
              <div className="space-y-3">
                <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  <p>Plan: <span className="font-medium">{subscription.plan_name}</span></p>
                  <p>Status: <span className="font-medium capitalize">{subscription.status}</span></p>
                  <p>Period ends: {subscription.current_period_end ? formatDate(subscription.current_period_end) : 'N/A'}</p>
                </div>
                {recoveryFee && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-1">
                    <p className="font-medium text-gray-900 dark:text-white mb-2">This Month's Bill Estimate</p>
                    <div className="flex justify-between text-gray-600 dark:text-gray-300">
                      <span>Base fee</span>
                      <span>{formatCurrency(recoveryFee.baseFeeUsd)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 dark:text-gray-300">
                      <span>Recovery fee ({recoveryFee.feePct}% of {formatCurrency(recoveryFee.recoveredUsd)} recovered)</span>
                      <span>{formatCurrency(recoveryFee.recoveryFeeUsd)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
                      <span>Estimated total</span>
                      <span>{formatCurrency(recoveryFee.totalUsd)}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : <p className="text-sm text-gray-500">No active subscription</p>}
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <Card key={plan.id}>
                <h3 className="font-semibold text-gray-900 dark:text-white">{plan.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{formatCurrency(Number(plan.base_price_usd))}/month + {plan.success_fee_percent}% success fee</p>
                <Button
                  className="mt-4 w-full"
                  variant={subscription?.plan_code === plan.code ? 'secondary' : 'primary'}
                  disabled={subscription?.plan_code === plan.code || actionLoading}
                  onClick={() => changePlan(plan.code)}
                >
                  {subscription?.plan_code === plan.code ? 'Current Plan' : 'Switch Plan'}
                </Button>
              </Card>
            ))}
          </div>

          <Card>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Current Month Usage</h2>
            <div className="space-y-2">
              {usage.length === 0 && <p className="text-sm text-gray-500">No usage tracked yet.</p>}
              {usage.map((u) => (
                <div key={u.metric_key} className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">{u.metric_key}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{u.quantity}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Billing Invoices</h2>
            <div className="space-y-2">
              {invoices.length === 0 && <p className="text-sm text-gray-500">No billing invoices yet.</p>}
              {invoices.map((inv) => (
                <div key={inv.id} className="flex justify-between text-sm p-2 rounded bg-gray-50 dark:bg-gray-800">
                  <span className="text-gray-600 dark:text-gray-300">{formatDate(inv.period_start)} - {formatDate(inv.period_end)} ({inv.status})</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(Number(inv.total_amount_usd))}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default Billing;


