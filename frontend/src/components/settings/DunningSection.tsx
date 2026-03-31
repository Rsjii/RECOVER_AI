import React from 'react';
import { cn } from '../../lib/utils';
import type { DunningPaymentPlansFormData } from '../../types/settings';

interface DunningSectionProps {
  data: DunningPaymentPlansFormData;
  onChange: (field: string, value: any) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
  isDirty: boolean;
  errors?: Record<string, string>;
}

export const DunningSection: React.FC<DunningSectionProps> = ({
  data,
  onChange,
  onSave,
  isSaving,
  isDirty,
  errors = {},
}) => {
  const handleSave = async () => {
    await onSave();
  };

  return (
    <div className="space-y-8">
      {/* Email Sequence Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Email Sequence Timing
        </h3>

        <div className="space-y-6">
          {[
            { key: 'email1Day', label: 'Email 1', description: 'First reminder' },
            { key: 'email2Day', label: 'Email 2', description: 'Follow-up' },
            { key: 'email3Day', label: 'Email 3', description: 'Escalation' },
            { key: 'email4Day', label: 'Email 4', description: 'Final notice' },
            { key: 'email5Day', label: 'Email 5', description: 'Account action' },
          ].map(({ key, label, description }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {data[key as keyof DunningPaymentPlansFormData]} days
                  </p>
                </div>
              </div>
              <input
                type="range"
                min="1"
                max="90"
                value={String(data[key as keyof DunningPaymentPlansFormData])}
                onChange={(e) => onChange(key, parseInt(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1 day</span>
                <span>90 days</span>
              </div>
            </div>
          ))}
        </div>

        {/* Validation Help Text */}
        <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-xs text-blue-700 dark:text-blue-400">
            💡 Tip: Ensure Email 1 &lt; Email 2 &lt; Email 3 &lt; Email 4 &lt; Email 5 for optimal progression
          </p>
        </div>
      </div>

      {/* Auto-Pause Section */}
      <div className="border-t border-gray-200 dark:border-white/[0.06] pt-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Automation Rules
        </h3>

        <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-white/[0.06] rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Auto-pause on reply
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Automatically stop dunning sequence if customer replies
            </p>
          </div>
          <button
            onClick={() => onChange('autoPauseOnReply', !data.autoPauseOnReply)}
            type="button"
            className={`relative w-11 h-6 rounded-full transition-colors ${
              data.autoPauseOnReply ? 'bg-blue-600' : 'bg-gray-300 dark:bg-white/[0.12]'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                data.autoPauseOnReply ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Payment Plan Splits Section */}
      <div className="border-t border-gray-200 dark:border-white/[0.06] pt-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Payment Plan Splits
        </h3>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Configure payment split percentages based on risk tier. Format: upfront/remaining (e.g., 50/50)
        </p>

        <div className="space-y-4">
          {[
            {
              key: 'lowRiskSplit',
              label: 'Low Risk',
              description: 'Invoices overdue &lt;15 days or high payment history',
            },
            {
              key: 'medRiskSplit',
              label: 'Medium Risk',
              description: 'Invoices overdue 15-30 days',
            },
            {
              key: 'highRiskSplit',
              label: 'High Risk',
              description: 'Invoices overdue &gt;30 days or payment issues',
            },
          ].map(({ key, label, description }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
                </div>
                <input
                  type="text"
                  value={String(data[key as keyof DunningPaymentPlansFormData])}
                  onChange={(e) => onChange(key, e.target.value)}
                  placeholder="50/50"
                  maxLength={8}
                  className={cn(
                    'w-20 px-3 py-2 border rounded-lg text-right',
                    'text-gray-900 dark:text-white',
                    'bg-white dark:bg-white/[0.03]',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors',
                    errors[key] ? 'border-red-500' : 'border-gray-300 dark:border-white/[0.08]'
                  )}
                />
              </div>
              {errors[key] && (
                <p className="text-xs text-red-500">{errors[key]}</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-xs text-blue-700 dark:text-blue-400">
            Example: 50/50 means customer pays 50% upfront, remaining 50% over time
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-white/[0.06] pt-8">
        <button
          className={cn(
            'px-4 py-2 rounded-lg font-medium transition-colors',
            'bg-gray-200 text-gray-900 dark:bg-white/[0.08] dark:text-white',
            'hover:bg-gray-300 dark:hover:bg-white/[0.12]',
            !isDirty && 'opacity-50 cursor-not-allowed'
          )}
          disabled={!isDirty || isSaving}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className={cn(
            'px-4 py-2 rounded-lg font-medium transition-colors',
            'bg-blue-600 text-white hover:bg-blue-700',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};
