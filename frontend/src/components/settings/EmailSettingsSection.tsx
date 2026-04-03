import React, { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { useNotification } from '../../hooks/useNotification';
import { api } from '../../lib/api';

interface EmailSettingsFormData {
  senderEmail: string;
  emailTone: string;
  customSignature: string;
}

interface EmailSettingsSectionProps {
  data: EmailSettingsFormData;
  onChange: (field: string, value: any) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
  isDirty: boolean;
  errors?: Record<string, string>;
}

interface SMTPStatus {
  configured: boolean;
  verified: boolean;
  fromEmail?: string;
  fromName?: string;
  host?: string;
  errorMessage?: string;
}

interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  dunningSenderName?: string;
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
  const { addToast } = useNotification();
  const [smtpStatus, setSMTPStatus] = useState<SMTPStatus | null>(null);
  const [smtpLoading, setSMTPLoading] = useState(true);
  const [showSMTPModal, setShowSMTPModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [useOwnDomain, setUseOwnDomain] = useState(false);

  const [smtpConfig, setSMTPConfig] = useState<SMTPConfig>({
    host: '',
    port: 587,
    username: '',
    password: '',
    fromEmail: '',
    fromName: '',
    dunningSenderName: '',
  });

  useEffect(() => {
    fetchSMTPStatus();
    fetchDunningSenderName();
  }, []);

  async function fetchDunningSenderName() {
    try {
      const response = await api.get('/api/settings/dunning-sender-name');
      if (response?.data?.senderName) {
        setSMTPConfig(prev => ({ ...prev, dunningSenderName: response.data.senderName }));
      }
    } catch (err: any) {
      if (err.status !== 401) {
        console.error('Failed to fetch dunning sender name:', err);
      }
    }
  }

  async function fetchSMTPStatus() {
    try {
      setSMTPLoading(true);
      const response = await api.get('/api/settings/smtp/status');
      setSMTPStatus(response);
      setUseOwnDomain(response.verified || false);
      if (response.configured) {
        setSMTPConfig({
          host: response.host || '',
          port: 587,
          username: '',
          password: '',
          fromEmail: response.fromEmail || '',
          fromName: response.fromName || '',
        });
      }
    } catch (err: any) {
      if (err.status !== 401) {
        console.error('Failed to fetch SMTP status:', err);
      }
    } finally {
      setSMTPLoading(false);
    }
  }

  async function handleSaveSMTP() {
    if (!smtpConfig.host || !smtpConfig.username || !smtpConfig.password || !smtpConfig.fromEmail) {
      addToast({ type: 'error', message: 'Please fill all required fields' });
      return;
    }

    try {
      setIsTesting(true);
      await api.post('/api/settings/smtp/configure', smtpConfig);

      // Save dunning sender name if provided
      if (smtpConfig.dunningSenderName?.trim()) {
        try {
          await api.put('/api/settings/dunning-sender-name', { senderName: smtpConfig.dunningSenderName });
        } catch (err) {
          console.error('Failed to save dunning sender name:', err);
        }
      }

      addToast({ type: 'success', message: 'SMTP config saved. Testing connection...' });
    } catch (err: any) {
      addToast({ type: 'error', message: err.response?.data?.error || 'Failed to save configuration' });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleTestSMTP() {
    try {
      setIsTesting(true);
      await api.post('/api/settings/smtp/test', smtpConfig);
      addToast({ type: 'success', message: 'SMTP verified! Emails will now come from your domain.' });
      await fetchSMTPStatus();
      setShowSMTPModal(false);
    } catch (err: any) {
      addToast({ type: 'error', message: err.response?.data?.error || 'SMTP connection failed' });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleDisableSMTP() {
    if (!confirm('Switch back to RecoverAI email? Your customers will see noreply@recoverai.com')) {
      return;
    }

    try {
      await api.post('/api/settings/smtp/disable');
      addToast({ type: 'success', message: 'SMTP disabled. Using RecoverAI email.' });
      await fetchSMTPStatus();
      setUseOwnDomain(false);
    } catch (err: any) {
      addToast({ type: 'error', message: 'Failed to disable SMTP' });
    }
  }

  const handleSave = async () => {
    await onSave();
  };

  return (
    <div className="space-y-8">
      {/* Email From Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Email From
        </h3>

        <div className="space-y-4">
          {/* Radio Selection */}
          <div className="space-y-3">
            {/* Option 1: RecoverAI */}
            <div
              onClick={() => {
                setUseOwnDomain(false);
                if (smtpStatus?.verified) handleDisableSMTP();
              }}
              className={cn(
                'p-4 border rounded-lg cursor-pointer transition-all',
                !useOwnDomain
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.1]'
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                    !useOwnDomain
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300 dark:border-white/[0.2]'
                  )}
                >
                  {!useOwnDomain && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">RecoverAI Domain</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    noreply@recoverai.com — instant setup, no configuration needed
                  </p>
                </div>
              </div>
            </div>

            {/* Option 2: Your Domain */}
            <div
              onClick={() => setUseOwnDomain(true)}
              className={cn(
                'p-4 border rounded-lg cursor-pointer transition-all',
                useOwnDomain
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.1]'
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                    useOwnDomain
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300 dark:border-white/[0.2]'
                  )}
                >
                  {useOwnDomain && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Your Domain</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    billing@yourcompany.com — better deliverability and customer trust
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SMTP Config When Selected */}
          {useOwnDomain && !smtpLoading && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] rounded-lg">
              {smtpStatus?.verified ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                      Connected & Verified
                    </p>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    <p><strong>From:</strong> {smtpStatus.fromName ? `${smtpStatus.fromName} <${smtpStatus.fromEmail}>` : smtpStatus.fromEmail}</p>
                    <p><strong>Server:</strong> {smtpStatus.host}</p>
                  </div>
                  <button
                    onClick={() => {
                      // Load saved config into form before opening modal
                      if (smtpStatus?.host) {
                        setSMTPConfig({
                          host: smtpStatus.host || '',
                          port: 587,
                          username: '',
                          password: '',
                          fromEmail: smtpStatus.fromEmail || '',
                          fromName: smtpStatus.fromName || '',
                        });
                      }
                      setShowSMTPModal(true);
                    }}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    Modify Settings
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSMTPModal(true)}
                  className="w-full px-3 py-2 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Configure SMTP
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SMTP Modal */}
      {showSMTPModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-white/[0.08]">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-white/[0.08] px-6 py-5 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  SMTP Configuration
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Send emails from your domain
                </p>
              </div>
              <button
                onClick={() => setShowSMTPModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-white/[0.08] rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    SMTP Host <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={smtpConfig.host}
                    onChange={(e) => setSMTPConfig({ ...smtpConfig, host: e.target.value })}
                    placeholder="smtp.gmail.com"
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                    Gmail: smtp.gmail.com | Outlook: smtp.office365.com | Custom: ask your provider
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Port <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={smtpConfig.port}
                    onChange={(e) => setSMTPConfig({ ...smtpConfig, port: parseInt(e.target.value) })}
                    placeholder="587"
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                    Usually 587 (TLS) — try 465 if 587 fails (SSL)
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={smtpConfig.username}
                  onChange={(e) => setSMTPConfig({ ...smtpConfig, username: e.target.value })}
                  placeholder="admin@gmail.com"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                  Your email account (e.g., billing@yourcompany.com)
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={smtpConfig.password}
                    onChange={(e) => setSMTPConfig({ ...smtpConfig, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs font-medium text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                  Gmail users: Create App Password in account settings
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    From Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={smtpConfig.fromEmail}
                    onChange={(e) => setSMTPConfig({ ...smtpConfig, fromEmail: e.target.value })}
                    placeholder="billing@yourcompany.com"
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                    What customers see in "From" field
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    From Name <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={smtpConfig.fromName}
                    onChange={(e) => setSMTPConfig({ ...smtpConfig, fromName: e.target.value })}
                    placeholder="Billing Team"
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                    Display name (e.g., "Billing Team")
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Dunning Sender Name <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={smtpConfig.dunningSenderName || ''}
                  onChange={(e) => setSMTPConfig({ ...smtpConfig, dunningSenderName: e.target.value })}
                  placeholder="e.g., Acme Corp Finance Team"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                  Who dunning emails come from (appears in email signature). If blank, uses "From Name" above.
                </p>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-900/30 rounded">
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  <strong>📖 Quick Help:</strong> Gmail users must create an App Password (not regular password). Go to myaccount.google.com → Security → App passwords
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-white/[0.08] px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowSMTPModal(false)}
                className="px-4 py-2 rounded-lg font-medium bg-gray-100 dark:bg-white/[0.08] text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-white/[0.12]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSMTP}
                disabled={isTesting || !smtpConfig.host || !smtpConfig.username || !smtpConfig.password || !smtpConfig.fromEmail}
                className="px-4 py-2 rounded-lg font-medium bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {isTesting ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleTestSMTP}
                disabled={isTesting || !smtpConfig.host || !smtpConfig.username || !smtpConfig.password || !smtpConfig.fromEmail}
                className="px-4 py-2 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isTesting ? 'Testing...' : 'Test & Enable'}
              </button>
            </div>
          </div>
        </div>
      )}

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
            placeholder="Best regards, Billing Team"
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