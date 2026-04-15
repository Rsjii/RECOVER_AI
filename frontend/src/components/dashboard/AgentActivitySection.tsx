import React, { useState } from 'react';
import { CollapsibleSection } from './CollapsibleSection';

export interface AgentPreview {
  emailsWouldQueue: number;
  // plansWouldOffer: number; // 🔴 DISABLED — Payment plans awaiting client decision
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

interface AgentActivitySectionProps {
  preview: AgentPreview | null;
  loading?: boolean;
  isDemo?: boolean;
  onTrigger?: () => void;
  triggeringAgent?: boolean;
}

const EMAIL_TYPE_SHORT: Record<string, string> = {
  dunning_1: 'Reminder 1',
  dunning_2: 'Reminder 2',
  dunning_3: 'Reminder 3',
  dunning_4: 'Formal notice',
  dunning_5: 'Escalation',
  // payment_plan_offer: 'Payment plan', // 🔴 DISABLED
};

export const AgentActivitySection: React.FC<AgentActivitySectionProps> = ({
  preview,
  isDemo = false,
  onTrigger,
  triggeringAgent = false,
}) => {
  const [showAll, setShowAll] = useState(false);

  if (!preview) {
    return null;
  }

  const displayed = showAll ? preview.previews : preview.previews.slice(0, 3);

  return (
    <CollapsibleSection
      title="Agent Activity Preview"
      subtitle={`Ready to send ${preview.emailsWouldQueue} email${preview.emailsWouldQueue !== 1 ? 's' : ''}`}
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014.735 9.75H9.265c-.845 0-1.646.345-2.22.955l-.548.547z" />
        </svg>
      }
    >
      <div className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Invoices scanned', value: preview.invoicesScanned, color: 'text-gray-900 dark:text-white' },
            { label: 'Emails to send', value: preview.emailsWouldQueue, color: 'text-blue-600 dark:text-blue-400' },
            // { label: 'Payment plans', value: preview.plansWouldOffer, color: 'text-purple-600 dark:text-purple-400' }, // 🔴 DISABLED
            { label: 'Est. recovery', value: `$${preview.estimatedRecoveryUsd.toLocaleString()}`, color: 'text-green-600 dark:text-green-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-50 dark:bg-white/[0.02] rounded-lg p-3 text-center border border-gray-200 dark:border-white/[0.05]">
              <div className={`text-lg font-bold ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Preview List */}
        {preview.previews.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Action Queue</h3>
            <div className="bg-gray-50 dark:bg-white/[0.01] rounded-lg border border-gray-200 dark:border-white/[0.05] overflow-hidden">
              <div className="divide-y divide-gray-200 dark:divide-white/[0.05]">
                {displayed.map((item) => (
                  <div key={`${item.invoiceId}-${item.emailType}`} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 dark:text-white text-sm">{item.customerName}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500 dark:text-gray-400">{item.daysOverdue}d</span>
                        <span className="font-semibold text-gray-900 dark:text-white">${item.amount.toLocaleString()}</span>
                        <span className={`px-2 py-1 rounded font-medium text-xs ${
                          item.riskScore >= 80 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          item.riskScore >= 50 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}>
                          {item.riskScore}
                        </span>
                        <span className="bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-300 px-2 py-1 rounded">
                          {EMAIL_TYPE_SHORT[item.emailType] || item.emailType}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.recipientEmail}</p>
                  </div>
                ))}
              </div>
            </div>

            {preview.previews.length > 3 && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full text-xs py-2 mt-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded transition-colors"
              >
                +{preview.previews.length - 3} more actions
              </button>
            )}

            {showAll && preview.previews.length > 3 && (
              <button
                onClick={() => setShowAll(false)}
                className="w-full text-xs py-2 mt-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.04] rounded transition-colors"
              >
                Show less
              </button>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {!isDemo && onTrigger && (
          <div className="flex gap-3 pt-2 border-t border-gray-200 dark:border-white/[0.05]">
            <button
              onClick={onTrigger}
              disabled={triggeringAgent}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {triggeringAgent ? 'Approving...' : `Approve & Send ${preview.emailsWouldQueue}`}
            </button>
          </div>
        )}

        {isDemo && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2 text-xs text-amber-800 dark:text-amber-400">
            📌 Demo mode: Emails will not be sent. Use "Use my real data →" to connect your account.
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};

export default AgentActivitySection;
