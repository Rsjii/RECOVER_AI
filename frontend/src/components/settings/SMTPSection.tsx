import React, { useEffect, useState } from 'react';
import { useNotification } from '../../hooks/useNotification';
import { api } from '../../lib/api';

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
}

export const SMTPSection: React.FC = () => {
  const { addToast } = useNotification();
  const [status, setStatus] = useState<SMTPStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [config, setConfig] = useState<SMTPConfig>({
    host: '',
    port: 587,
    username: '',
    password: '',
    fromEmail: '',
    fromName: '',
  });

  // Fetch SMTP status on mount
  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      setIsLoading(true);
      const response = await api.get('/api/settings/smtp/status');
      setStatus(response);
      if (response.configured) {
        setConfig({
          host: response.host || '',
          port: 587,
          username: '',
          password: '',
          fromEmail: response.fromEmail || '',
          fromName: response.fromName || '',
        });
      }
    } catch (err: any) {
      console.error('Failed to fetch SMTP status:', err);
      // If 401, user will be redirected to login by the API interceptor
      // Don't show error toast for 401 as login redirect will handle it
      if (err.status !== 401) {
        addToast({ type: 'error', message: 'Failed to load SMTP configuration' });
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveConfig() {
    if (!config.host || !config.username || !config.password || !config.fromEmail) {
      addToast({ type: 'error', message: 'Please fill all required fields' });
      return;
    }

    try {
      setIsTesting(true);
      await api.post('/api/settings/smtp/configure', config);
      addToast({ type: 'success', message: 'SMTP configuration saved. Click "Test Connection" to verify.' });
    } catch (err: any) {
      addToast({ type: 'error', message: err.response?.data?.error || 'Failed to save configuration' });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleTestConnection() {
    try {
      setIsTesting(true);
      const response = await api.post('/api/settings/smtp/test', config);
      addToast({ type: 'success', message: response.message || 'SMTP connection successful!' });
      await fetchStatus();
      setShowModal(false);
    } catch (err: any) {
      addToast({ type: 'error', message: err.response?.data?.error || 'SMTP connection failed' });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleDisableSMTP() {
    if (!confirm('Disable SMTP and revert to RecoverAI email? Emails will still work but from recoverai.com')) {
      return;
    }

    try {
      await api.post('/api/settings/smtp/disable');
      addToast({ type: 'success', message: 'SMTP disabled. Using Resend for emails.' });
      await fetchStatus();
      setShowModal(false);
    } catch (err: any) {
      addToast({ type: 'error', message: 'Failed to disable SMTP' });
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      {/* Status Card */}
      <div className="border border-gray-200 dark:border-white/[0.06] rounded-lg p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-white/[0.02] dark:to-white/[0.01]">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Email Sender Configuration
        </h3>

        {status?.verified ? (
          <div className="space-y-5">
            {/* Success State */}
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                Connected & Verified ✓
              </span>
            </div>

            {/* Config Summary */}
            <div className="space-y-3 bg-white dark:bg-white/[0.03] rounded-lg p-4 border border-green-200 dark:border-green-900/20">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">From Email</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{status.fromEmail}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">From Name</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{status.fromName || '—'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Server</p>
                  <p className="text-sm font-mono text-gray-900 dark:text-white mt-1">{status.host}</p>
                </div>
              </div>
            </div>

            {/* Success Message */}
            <div className="p-3 bg-green-50 dark:bg-green-900/15 border border-green-200 dark:border-green-900/30 rounded-lg">
              <p className="text-xs text-green-700 dark:text-green-400">
                ✓ Customers will receive emails from <strong>{status.fromEmail}</strong> (your domain)
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setShowModal(true);
                  setShowPassword(false);
                }}
                className="flex-1 px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Modify
              </button>
              <button
                onClick={handleDisableSMTP}
                className="px-4 py-2 rounded-lg font-medium bg-gray-200 text-gray-900 dark:bg-white/[0.08] dark:text-white hover:bg-gray-300 dark:hover:bg-white/[0.12] transition-colors"
              >
                Disable
              </button>
            </div>
          </div>
        ) : status?.configured ? (
          <div className="space-y-5">
            {/* Fallback State */}
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                Fallback to RecoverAI
              </span>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400">
              SMTP is configured but not verified. Click "Test Connection" to enable.
            </p>

            {status.errorMessage && (
              <div className="p-3 bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-900/30 rounded-lg">
                <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">Last error:</p>
                <p className="text-xs text-red-600 dark:text-red-400 font-mono">{status.errorMessage}</p>
              </div>
            )}

            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/15 border border-yellow-200 dark:border-yellow-900/30 rounded-lg">
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                ⚠️ Emails will be sent from <strong>RecoverAI</strong> until SMTP is verified
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowModal(true);
                  setShowPassword(false);
                }}
                className="flex-1 px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Test Connection
              </button>
              <button
                onClick={handleDisableSMTP}
                className="px-4 py-2 rounded-lg font-medium bg-gray-200 text-gray-900 dark:bg-white/[0.08] dark:text-white hover:bg-gray-300 dark:hover:bg-white/[0.12] transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Not Configured State */}
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                Not Configured
              </span>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400">
              Emails are currently sent from RecoverAI's domain. Add SMTP to use your own email domain for better deliverability and trust.
            </p>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-900/30 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                <span className="font-semibold">📧 Better Deliverability</span>
                <br />
                <span className="text-xs mt-1 block">
                  Customers will see emails from <strong>your domain</strong> instead of RecoverAI's. This increases open rates and trust.
                </span>
              </p>
            </div>

            <button
              onClick={() => {
                setShowModal(true);
                setShowPassword(false);
              }}
              className="w-full px-4 py-3 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Setup SMTP
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-white/[0.08]">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-white/[0.08] px-6 py-5 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  SMTP Configuration
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Send emails from your own domain
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-white/[0.08] rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Host */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  SMTP Host <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={config.host}
                  onChange={(e) => setConfig({ ...config, host: e.target.value })}
                  placeholder="e.g., smtp.gmail.com"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  Your SMTP server address (e.g., smtp.gmail.com, mail.yourdomain.com)
                </p>
              </div>

              {/* Port & Username Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Port <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={config.port}
                    onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) })}
                    placeholder="587"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  />
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    587 (TLS) or 465 (SSL)
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={config.username}
                    onChange={(e) => setConfig({ ...config, username: e.target.value })}
                    placeholder="admin@gmail.com"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={config.password}
                    onChange={(e) => setConfig({ ...config, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  For Gmail, use an <strong>App Password</strong> (not your regular password)
                </p>
              </div>

              {/* From Email & Name Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    From Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={config.fromEmail}
                    onChange={(e) => setConfig({ ...config, fromEmail: e.target.value })}
                    placeholder="billing@yourcompany.com"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    From Name <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={config.fromName}
                    onChange={(e) => setConfig({ ...config, fromName: e.target.value })}
                    placeholder="e.g., Billing Team"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  />
                </div>
              </div>

              {/* Email Preview */}
              <div className="border border-gray-200 dark:border-white/[0.06] rounded-lg p-4 bg-gray-50 dark:bg-white/[0.02]">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                  Preview
                </p>
                <div className="bg-white dark:bg-white/[0.03] rounded p-4 border border-gray-300 dark:border-white/[0.08] space-y-2 text-sm">
                  <p className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">From:</span> {config.fromName ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail || '(no email)'}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">To:</span> customer@example.com
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-gray-900 dark:text-white">Subject:</span> Payment reminder for Invoice #123
                  </p>
                  <div className="border-t border-gray-200 dark:border-white/[0.08] pt-3 mt-3">
                    <p className="text-gray-700 dark:text-gray-300">Hi there,</p>
                    <p className="text-gray-700 dark:text-gray-300 mt-1">We noticed your invoice is overdue...</p>
                  </div>
                </div>
              </div>

              {/* Info Box */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-900/30 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  <span className="font-semibold">💡 Tip:</span> After saving, click "Test & Enable" to verify SMTP works and send a test email.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-white/[0.08] px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 rounded-lg font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-white/[0.08] hover:bg-gray-200 dark:hover:bg-white/[0.12] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={isTesting || !config.host || !config.username || !config.password || !config.fromEmail}
                className="px-6 py-2 rounded-lg font-medium bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isTesting ? 'Saving...' : 'Save Config'}
              </button>
              <button
                onClick={handleTestConnection}
                disabled={isTesting || !config.host || !config.username || !config.password || !config.fromEmail}
                className="px-6 py-2 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isTesting ? 'Testing...' : 'Test & Enable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};