import React from 'react';
import { cn } from '../../lib/utils';
import type { EmailSettingsFormData } from '../../types/settings';

interface EmailSettingsSectionProps {
  data: EmailSettingsFormData;
  onChange: (field: string, value: any) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
  isDirty: boolean;
  errors?: Record<string, string>;
}

const TONE_OPTIONS = [
  {
    id: 'friendly',
    label: 'Friendly',
    description: 'Warm and supportive',
    example: 'Hi there! We noticed an outstanding invoice...',
  },
  {
    id: 'professional',
    label: 'Professional',
    description: 'Business-like and formal',
    example: 'Dear valued customer, We are writing regarding your outstanding invoice...',
  },
  {
    id: 'aggressive',
    label: 'Aggressive',
    description: 'Direct and firm',
    example: 'Your account is overdue. Immediate payment required...',
  },
];

export const EmailSettingsSection: React.FC<EmailSettingsSectionProps> = ({
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
      {/* Sender Email Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Sender Information
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Sender Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={data.senderEmail}
            onChange={(e) => onChange('senderEmail', e.target.value)}
            placeholder="noreply@company.com"
            className={cn(
              'w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white',
              'bg-white dark:bg-white/[0.03]',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors',
              errors.senderEmail ? 'border-red-500' : 'border-gray-300 dark:border-white/[0.08]'
            )}
          />
          {errors.senderEmail && (
            <p className="mt-1 text-sm text-red-500">{errors.senderEmail}</p>
          )}
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            All dunning emails will be sent from this address
          </p>
        </div>
      </div>

      {/* Email Tone Section */}
      <div className="border-t border-gray-200 dark:border-white/[0.06] pt-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Email Tone
        </h3>

        <div className="space-y-3">
          {TONE_OPTIONS.map((tone) => (
            <div
              key={tone.id}
              onClick={() => onChange('emailTone', tone.id)}
              className={cn(
                'p-4 border rounded-lg cursor-pointer transition-all',
                data.emailTone === tone.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.1]'
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                    data.emailTone === tone.id
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300 dark:border-white/[0.2]'
                  )}
                >
                  {data.emailTone === tone.id && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{tone.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{tone.description}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 italic">
                    "{tone.example}"
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Signature Section */}
      <div className="border-t border-gray-200 dark:border-white/[0.06] pt-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Email Signature
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Custom Signature <span className="text-gray-500 text-xs">(Optional)</span>
          </label>
          <textarea
            value={data.customSignature}
            onChange={(e) => onChange('customSignature', e.target.value)}
            placeholder="Best regards, AR Team"
            maxLength={500}
            rows={4}
            className={cn(
              'w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white',
              'bg-white dark:bg-white/[0.03]',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors',
              'resize-none',
              errors.customSignature ? 'border-red-500' : 'border-gray-300 dark:border-white/[0.08]'
            )}
          />
          {errors.customSignature && (
            <p className="mt-1 text-sm text-red-500">{errors.customSignature}</p>
          )}
          <div className="mt-2 flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <p>Appears at the end of every email</p>
            <p>{data.customSignature.length}/500</p>
          </div>
        </div>

        {/* Preview */}
        {data.customSignature && (
          <div className="mt-4 p-4 bg-gray-100 dark:bg-white/[0.05] rounded-lg">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Preview:</p>
            <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
              {data.customSignature}
            </div>
          </div>
        )}
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
