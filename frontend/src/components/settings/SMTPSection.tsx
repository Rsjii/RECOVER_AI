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
  const [showForm, setShowForm] = useState(false);
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
    } catch (err) {
      console.error('Failed to fetch SMTP status:', err);
      addToast({ type: 'error', message: 'Failed to load SMTP configuration' });
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
      setShowForm(false);
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
      setShowForm(false);
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
      setShowForm(false);
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
    <div className="space-y-8">
      {/* Status Card */}
      <div className="border border-gray-200 dark:border-white/[0.06] rounded-lg p-6 bg-gray-50 dark:bg-white/[0.02]">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Email Sender Configuration
        </h3>

        {status?.verified ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                Connected & Verified
              </span>
            </div>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>
                <span className="text-gray-900 dark:text-white font-medium">From Email:</span> {status.fromEmail}
              </p>
              <p>
                <span className="text-gray-900 dark:text-white font-medium">From Name:</span> {status.fromName}
              </p>
              <p>
                <span className="text-gray-900 dark:text-white font-medium">Server:</span> {status.host}
              </p>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowForm(!showForm)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Modify
              </button>
              <button
                onClick={handleDisableSMTP}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-200 text-gray-900 dark:bg-white/[0.08] dark:text-white hover:bg-gray-300 dark:hover:bg-white/[0.12] transition-colors"
              >
                Disable
              </button>
            </div>
            <div className="mt-4 p-3 bg-white dark:bg-white/[0.03] border border-green-200 dark:border-green-900/30 rounded text-xs text-green-700 dark:text-green-400">
              ✓ Emails will be sent FROM <strong>{status.fromEmail}</strong> (your domain)
            </div>
          </div>
        ) : status?.configured ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                Fallback to RecoverAI
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              SMTP is configured but not verified. Click "Test Connection" to enable.
            </p>
            {status.errorMessage && (
              <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded text-xs text-red-700 dark:text-red-400">
                <p className="font-medium">Last error:</p>
                <p>{status.errorMessage}</p>
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowForm(!showForm)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                {showForm ? 'Hide Form' : 'Configure SMTP'}
              </button>
              <button
                onClick={handleDisableSMTP}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-200 text-gray-900 dark:bg-white/[0.08] dark:text-white hover:bg-gray-300 dark:hover:bg-white/[0.12] transition-colors"
              >
                Clear Config
              </button>
            </div>
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/30 rounded text-xs text-yellow-700 dark:text-yellow-400">
              ⚠️ Emails will be sent FROM <strong>RecoverAI</strong> until SMTP is verified
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Not Configured
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Emails are currently sent from RecoverAI's domain. Configure SMTP to use your own email domain for better deliverability.
            </p>
            <button
              onClick={() => setShowForm(!showForm)}
              className="mt-4 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              {showForm ? 'Hide Form' : 'Setup SMTP'}
            </button>
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30 rounded text-xs text-blue-700 dark:text-blue-400">
              📧 By adding SMTP, customers will see emails from <strong>your domain</strong> instead of RecoverAI's
            </div>
          </div>
        )}
      </div>

      {/* Configuration Form */}
      {showForm && (
        <div className="border border-gray-200 dark:border-white/[0.06] rounded-lg p-6 bg-white dark:bg-white/[0.02]">
          <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">
            SMTP Configuration
          </h4>

          <div className="space-y-4">
            {/* Host */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                SMTP Host <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={config.host}
                onChange={(e) => setConfig({ ...config, host: e.target.value })}
                placeholder="e.g., smtp.gmail.com"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Your SMTP server address (e.g., smtp.gmail.com, mail.yourdomain.com)
              </p>
            </div>

            {/* Port */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Port <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={config.port}
                onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) })}
                placeholder="587"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Usually 587 (TLS) or 465 (SSL)
              </p>
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={config.username}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
                placeholder="e.g., admin@gmail.com"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={config.password}
                  onChange={(e) => setConfig({ ...config, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                For Gmail, use an App Password (not your regular password)
              </p>
            </div>

            {/* From Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                From Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={config.fromEmail}
                onChange={(e) => setConfig({ ...config, fromEmail: e.target.value })}
                placeholder="e.g., billing@yourcompany.com"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                This is what customers will see in the "From" field
              </p>
            </div>

            {/* From Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                From Name <span className="text-gray-500 text-xs">(Optional)</span>
              </label>
              <input
                type="text"
                value={config.fromName}
                onChange={(e) => setConfig({ ...config, fromName: e.target.value })}
                placeholder="e.g., Billing Team"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Display name in emails (e.g., "Billing Team &lt;billing@yourcompany.com&gt;")
              </p>
            </div>

            {/* Email Preview */}
            <div className="mt-6 p-4 bg-gray-100 dark:bg-white/[0.05] rounded-lg border border-gray-200 dark:border-white/[0.06]">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                Email Preview:
              </p>
              <div className="bg-white dark:bg-white/[0.02] rounded p-3 space-y-2 text-sm border border-gray-300 dark:border-white/[0.08]">
                <p className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium">From:</span> {config.fromName ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail}
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium">To:</span> customer@example.com
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Subject:</span> Payment reminder for Invoice #123
                </p>
                <div className="border-t border-gray-200 dark:border-white/[0.08] pt-2 mt-2">
                  <p className="text-gray-700 dark:text-gray-300">Hi there,</p>
                  <p className="text-gray-700 dark:text-gray-300">We noticed your invoice is overdue...</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-white/[0.06]">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg font-medium bg-gray-200 text-gray-900 dark:bg-white/[0.08] dark:text-white hover:bg-gray-300 dark:hover:bg-white/[0.12] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={isTesting}
                className="px-4 py-2 rounded-lg font-medium bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isTesting ? 'Saving...' : 'Save Config'}
              </button>
              <button
                onClick={handleTestConnection}
                disabled={isTesting || !config.host || !config.username || !config.password || !config.fromEmail}
                className="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isTesting ? 'Testing...' : 'Test & Enable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};