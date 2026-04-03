import React, { useState } from 'react';
import { CollapsibleSection } from './CollapsibleSection';

interface AgingBucket {
  label: string;
  days: string;
  amount: number;
  invoiceCount: number;
  pctOfTotal: number;
}

interface PaymentPlanSummaryItem {
  planId: string;
  customerName: string;
  totalAmount: number;
  status: string;
  installmentsTotal: number;
  installmentsPaid: number;
  pctComplete: number;
}

interface DunningFunnelSectionProps {
  totalAr: number;
  agingBuckets?: AgingBucket[];
  emailsSent: number;
  emailsDelivered: number;
  plansOffered: number;
  plansAccepted: number;
  paymentsReceived: number;
  paymentAmount: number;
  recentPlans?: PaymentPlanSummaryItem[];
  loading?: boolean;
}

export const DunningFunnelSection: React.FC<DunningFunnelSectionProps> = ({
  totalAr,
  agingBuckets = [],
  emailsSent,
  emailsDelivered,
  plansOffered,
  plansAccepted,
  paymentsReceived,
  paymentAmount,
  recentPlans = [],
}) => {
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const stages = [
    {
      id: 'eligible',
      name: 'Eligible for Dunning',
      count: agingBuckets.reduce((sum, b) => sum + b.invoiceCount, 0),
      amount: totalAr,
      icon: '📋',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
      borderColor: 'border-blue-200 dark:border-blue-800',
      textColor: 'text-blue-700 dark:text-blue-300',
      badgeBg: 'bg-blue-100 dark:bg-blue-900/40',
      description: 'Unpaid invoices ready for collection',
    },
    {
      id: 'contacted',
      name: 'Contacted',
      count: emailsSent,
      amount: 0,
      icon: '✉️',
      bgColor: 'bg-cyan-50 dark:bg-cyan-950/30',
      borderColor: 'border-cyan-200 dark:border-cyan-800',
      textColor: 'text-cyan-700 dark:text-cyan-300',
      badgeBg: 'bg-cyan-100 dark:bg-cyan-900/40',
      description: 'Dunning emails sent via Resend',
    },
    {
      id: 'offered',
      name: 'Plans Offered',
      count: plansOffered,
      amount: 0,
      icon: '💰',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
      borderColor: 'border-amber-200 dark:border-amber-800',
      textColor: 'text-amber-700 dark:text-amber-300',
      badgeBg: 'bg-amber-100 dark:bg-amber-900/40',
      description: 'Flexible payment arrangements offered',
    },
    {
      id: 'accepted',
      name: 'Plans Accepted',
      count: plansAccepted,
      amount: 0,
      icon: '✅',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
      borderColor: 'border-emerald-200 dark:border-emerald-800',
      textColor: 'text-emerald-700 dark:text-emerald-300',
      badgeBg: 'bg-emerald-100 dark:bg-emerald-900/40',
      description: 'Customers who agreed to payment plans',
    },
    {
      id: 'paid',
      name: 'Recovered',
      count: paymentsReceived,
      amount: paymentAmount,
      icon: '🎉',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
      borderColor: 'border-green-200 dark:border-green-800',
      textColor: 'text-green-700 dark:text-green-300',
      badgeBg: 'bg-green-100 dark:bg-green-900/40',
      description: 'Full or partial payments received',
    },
  ];

  // Calculate conversion rates between stages
  const conversions = [
    { from: 'eligible', to: 'contacted', rate: emailsSent > 0 ? Math.round((emailsSent / Math.max(stages[0].count, 1)) * 100) : 0 },
    { from: 'contacted', to: 'offered', rate: plansOffered > 0 ? Math.round((plansOffered / Math.max(emailsSent, 1)) * 100) : 0 },
    { from: 'offered', to: 'accepted', rate: plansAccepted > 0 ? Math.round((plansAccepted / Math.max(plansOffered, 1)) * 100) : 0 },
    { from: 'accepted', to: 'paid', rate: paymentsReceived > 0 ? Math.round((paymentsReceived / Math.max(plansAccepted, 1)) * 100) : 0 },
  ];

  return (
    <CollapsibleSection
      title="Dunning Funnel"
      subtitle={`$${totalAr.toLocaleString()} eligible → $${paymentAmount.toLocaleString()} recovered (${totalAr > 0 ? Math.round((paymentAmount / totalAr) * 100) : 0}%)`}
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      }
    >
      <div className="space-y-6">
        {/* Horizontal flow visualization */}
        <div className="space-y-2">
          {/* Stage boxes in a row */}
          <div className="grid grid-cols-5 gap-2">
            {stages.map((stage) => {
              const isExpanded = expandedStage === stage.id;

              return (
                <button
                  key={stage.id}
                  onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
                  className={`relative group transition-all`}
                >
                  {/* Card */}
                  <div className={`${stage.bgColor} ${stage.borderColor} border rounded-lg p-4 transition-all ${isExpanded ? 'ring-2' : ''}`}>
                    <div className="text-2xl mb-2">{stage.icon}</div>
                    <p className={`text-xs font-semibold mb-1 ${stage.textColor}`}>{stage.name}</p>
                    <p className={`text-lg font-bold ${stage.textColor}`}>{stage.count.toLocaleString()}</p>
                    {stage.amount > 0 && (
                      <p className={`text-xs mt-1 opacity-75 ${stage.textColor}`}>${stage.amount.toLocaleString()}</p>
                    )}
                  </div>

                  {/* Conversion arrow to next stage */}
                  {conversions.find(c => c.from === stage.id) && (
                    <div className="absolute -right-4 top-1/2 transform -translate-y-1/2 z-10 hidden sm:block">
                      <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded px-1.5 py-0.5 text-xs font-bold text-gray-700 dark:text-gray-300 shadow-sm">
                        {conversions.find(c => c.from === stage.id)?.rate}%
                      </div>
                      <svg
                        className="absolute left-full top-1/2 transform -translate-y-1/2 text-gray-300 dark:text-white/[0.1]"
                        width="20"
                        height="2"
                        viewBox="0 0 20 2"
                        fill="none"
                      >
                        <line x1="0" y1="1" x2="20" y2="1" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Mobile conversion rates */}
          <div className="grid grid-cols-4 gap-2 sm:hidden text-xs text-center">
            {conversions.map((conv) => (
              <div key={`${conv.from}-${conv.to}`} className="text-gray-600 dark:text-gray-400 font-medium">
                ↓ {conv.rate}%
              </div>
            ))}
          </div>
        </div>

        {/* Expanded details section */}
        {expandedStage && (
          <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg p-4 space-y-3">
            {expandedStage === 'eligible' && agingBuckets.length > 0 && (
              <div>
                <p className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">Breakdown by Aging Bucket</p>
                <div className="space-y-2">
                  {agingBuckets.map((bucket) => (
                    <div key={bucket.label} className="flex items-center justify-between bg-white dark:bg-white/[0.03] p-2.5 rounded-lg border border-gray-100 dark:border-white/[0.05]">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{bucket.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{bucket.invoiceCount} invoices</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">${bucket.amount.toLocaleString()}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{bucket.pctOfTotal}% of total</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {expandedStage === 'contacted' && (
              <div>
                <p className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">Email Delivery</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-white dark:bg-white/[0.03] p-2.5 rounded-lg border border-gray-100 dark:border-white/[0.05]">
                    <p className="text-sm text-gray-900 dark:text-white font-medium">Sent</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{emailsSent.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center justify-between bg-white dark:bg-white/[0.03] p-2.5 rounded-lg border border-gray-100 dark:border-white/[0.05]">
                    <p className="text-sm text-gray-900 dark:text-white font-medium">Delivered</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{emailsDelivered.toLocaleString()} ({emailsSent > 0 ? Math.round((emailsDelivered / emailsSent) * 100) : 0}%)</p>
                  </div>
                </div>
              </div>
            )}

            {expandedStage === 'offered' && (
              <div>
                <p className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">Plan Offers</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {plansOffered} payment plans offered to customers who received dunning emails
                </p>
              </div>
            )}

            {expandedStage === 'accepted' && recentPlans.length > 0 && (
              <div>
                <p className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">Recent Plans</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {recentPlans.slice(0, 5).map((plan) => (
                    <div key={plan.planId} className="bg-white dark:bg-white/[0.03] p-2.5 rounded-lg border border-gray-100 dark:border-white/[0.05]">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{plan.customerName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">${plan.totalAmount.toLocaleString()}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          plan.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          plan.status === 'completed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {plan.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-gray-600 dark:text-gray-400">{plan.installmentsPaid}/{plan.installmentsTotal} paid</p>
                        <p className="text-xs font-semibold text-gray-900 dark:text-white">{plan.pctComplete}%</p>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-white/[0.1] rounded-full h-2">
                        <div
                          className="h-2 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full"
                          style={{ width: `${plan.pctComplete}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {expandedStage === 'paid' && (
              <div>
                <p className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">Recovery Summary</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-white dark:bg-white/[0.03] p-2.5 rounded-lg border border-gray-100 dark:border-white/[0.05]">
                    <p className="text-sm text-gray-900 dark:text-white font-medium">Total Recovered</p>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">${paymentAmount.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center justify-between bg-white dark:bg-white/[0.03] p-2.5 rounded-lg border border-gray-100 dark:border-white/[0.05]">
                    <p className="text-sm text-gray-900 dark:text-white font-medium">Recovery Rate</p>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{totalAr > 0 ? Math.round((paymentAmount / totalAr) * 100) : 0}%</p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setExpandedStage(null)}
              className="w-full text-xs py-2 text-gray-600 dark:text-gray-400 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-200 dark:border-white/[0.05]">
          <div className="bg-gray-100 dark:bg-white/[0.05] rounded-lg p-3 border border-gray-200 dark:border-white/[0.1]">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Recovery %</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {totalAr > 0 ? Math.round((paymentAmount / totalAr) * 100) : 0}%
            </p>
          </div>
          <div className="bg-gray-100 dark:bg-white/[0.05] rounded-lg p-3 border border-gray-200 dark:border-white/[0.1]">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Contacted</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {emailsSent > 0 ? Math.round((emailsSent / Math.max(stages[0].count, 1)) * 100) : 0}%
            </p>
          </div>
          <div className="bg-gray-100 dark:bg-white/[0.05] rounded-lg p-3 border border-gray-200 dark:border-white/[0.1]">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Recovered $</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white truncate">
              ${(paymentAmount / 1000).toFixed(1)}k
            </p>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
};

export default DunningFunnelSection;
