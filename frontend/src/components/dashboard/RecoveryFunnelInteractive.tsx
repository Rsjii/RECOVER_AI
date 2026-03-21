import React, { useState } from 'react';
import RecoveryFunnelChart from './RecoveryFunnelChart';
import { DashboardDetailModal } from './DashboardDetailModal';

interface RecoveryFunnelInteractiveProps {
  invoicesAtRisk: number;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  invoicesPaid: number;
  loading?: boolean;
}

export const RecoveryFunnelInteractive: React.FC<RecoveryFunnelInteractiveProps> = ({
  invoicesAtRisk,
  emailsSent,
  emailsOpened,
  emailsClicked,
  invoicesPaid,
  loading = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const stages = [
    { name: 'At-Risk', value: invoicesAtRisk, percentage: 100 },
    { name: 'Contacted', value: emailsSent, percentage: invoicesAtRisk > 0 ? (emailsSent / invoicesAtRisk) * 100 : 0 },
    { name: 'Opened', value: emailsOpened, percentage: emailsSent > 0 ? (emailsOpened / emailsSent) * 100 : 0 },
    { name: 'Clicked', value: emailsClicked, percentage: emailsOpened > 0 ? (emailsClicked / emailsOpened) * 100 : 0 },
    { name: 'Recovered', value: invoicesPaid, percentage: emailsClicked > 0 ? (invoicesPaid / emailsClicked) * 100 : 0 },
  ];

  return (
    <>
      <div className="relative">
        <RecoveryFunnelChart
          invoicesAtRisk={invoicesAtRisk}
          emailsSent={emailsSent}
          emailsOpened={emailsOpened}
          emailsClicked={emailsClicked}
          invoicesPaid={invoicesPaid}
          loading={loading}
        />
        <button
          onClick={() => setIsExpanded(true)}
          className="absolute top-4 right-4 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-[#18181b] border border-gray-200 dark:border-white/[0.06] rounded-lg hover:border-gray-300 dark:hover:border-white/[0.1] transition-colors"
        >
          Expand →
        </button>
      </div>

      {isExpanded && (
        <DashboardDetailModal
          isOpen={true}
          onClose={() => setIsExpanded(false)}
          title="Recovery Funnel Analysis"
          subtitle="Complete conversion path from at-risk invoices to paid recovery"
        >
          <div className="space-y-6">
            <RecoveryFunnelChart
              invoicesAtRisk={invoicesAtRisk}
              emailsSent={emailsSent}
              emailsOpened={emailsOpened}
              emailsClicked={emailsClicked}
              invoicesPaid={invoicesPaid}
              loading={loading}
            />

            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Detailed Breakdown</h3>
                <div className="space-y-4">
                  {stages.map((stage, idx) => (
                    <div key={stage.name} className="bg-gray-50 dark:bg-white/[0.02] rounded-lg p-4 border border-gray-200 dark:border-white/[0.05]">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{stage.name}</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stage.value.toLocaleString()} items</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900 dark:text-white">{stage.percentage.toFixed(1)}%</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">of start</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-white/[0.06] rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            idx === 0 ? 'bg-blue-500' :
                            idx === 1 ? 'bg-cyan-500' :
                            idx === 2 ? 'bg-purple-500' :
                            idx === 3 ? 'bg-indigo-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${stage.percentage}%` }}
                        />
                      </div>
                      {idx < stages.length - 1 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          Conversion: {((stages[idx + 1].value / stage.value) * 100).toFixed(1)}% → next stage
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Overall Success Rate</p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                    {invoicesAtRisk > 0 ? ((invoicesPaid / invoicesAtRisk) * 100).toFixed(1) : 0}%
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Total Emails Sent</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{emailsSent.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">About the Funnel</p>
              <p className="text-sm text-blue-800 dark:text-blue-300 mt-2">
                The recovery funnel tracks how many at-risk invoices are contacted, how many customers engage with emails, and ultimately how many are recovered. Each stage represents a conversion point where you can optimize your dunning strategy.
              </p>
            </div>
          </div>
        </DashboardDetailModal>
      )}
    </>
  );
};

export default RecoveryFunnelInteractive;
