import React, { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { useNotification } from '../../hooks/useNotification';
import { api } from '../../lib/api';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { logError, logWarn } from '../../utils/logger';

interface EmailSettingsFormData {
  senderEmail: string;
  emailTone: string;
  customSignature: string;
}

interface EmailSettingsSectionProps {
  data?: EmailSettingsFormData;
  onChange?: (field: string, value: any) => void;
  onSave?: () => Promise<void>;
  isSaving?: boolean;
  isDirty?: boolean;
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

export const EmailSettingsSection: React.FC<EmailSettingsSectionProps> = () => {
  const { addToast } = useNotification();
  const [smtpStatus, setSMTPStatus] = useState<SMTPStatus | null>(null);
  const [showSMTPModal, setShowSMTPModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [useOwnDomain, setUseOwnDomain] = useState(false);
  const [showDisableSMTPConfirm, setShowDisableSMTPConfirm] = useState(false);
  const [isDisablingSmtp, setIsDisablingSmtp] = useState(false);

  // NEW: Agent & Dunning Control states
  const [pilotMode, setPilotMode] = useState<string>('auto');
  const [replyToEmail, setReplyToEmail] = useState<string>('');
  const [smtpFallbackToResend, setSmtpFallbackToResend] = useState<boolean>(false);
  const [dunnTone, setDunningTone] = useState<string>('standard');
  const [pauseDunningUntil, setPauseDunningUntil] = useState<string>('');
  const [pausedCustomers, setPausedCustomers] = useState<string>('');
  const [aggressiveMode, setAggressiveMode] = useState<boolean>(false);
  const [isLoadingAgentSettings, setIsLoadingAgentSettings] = useState(true);

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
    fetchAgentSettings();
  }, []);

  async function fetchDunningSenderName() {
    try {
      const response = await api.get('/api/settings/dunning-sender-name');
      if (response?.data?.senderName) {
        setSMTPConfig(prev => ({
          ...prev,
          dunningSenderName: response.data.senderName || ''
        }));
      }
    } catch (err: any) {
      if (err.status !== 401) {
        logError('EmailSettings', 'fetchDunningSenderName', 'Failed to fetch dunning sender name', err);
      }
    }
  }

  // NEW: Fetch all agent settings
  async function fetchAgentSettings() {
    try {
      setIsLoadingAgentSettings(true);
      const response = await api.get('/api/settings');
      if (response) {
        setPilotMode(response.pilotMode || 'auto');
        setDunningTone(response.dunningTone || 'standard');
        setReplyToEmail(response.replyToEmail || '');
        setSmtpFallbackToResend(response.smtpFallbackToResend || false);
        setPauseDunningUntil(response.pauseDunningUntil || '');
        setPausedCustomers(response.pausedCustomers?.join(', ') || '');
        setAggressiveMode(response.aggressiveEnabled || false);
      }
    } catch (err: any) {
      if (err.status !== 401) {
        logError('EmailSettings', 'fetchAgentSettings', 'Failed to fetch agent settings', err);
      }
    } finally {
      setIsLoadingAgentSettings(false);
    }
  }

  async function fetchSMTPStatus() {
    try {
      const response = await api.get('/api/settings/smtp/status');
      setSMTPStatus(response);
      setUseOwnDomain(response.verified || false);
      if (response.configured) {
        try {
          const fullConfig = await api.get('/api/settings/smtp/config');
          setSMTPConfig({
            host: fullConfig.host || response.host || '',
            port: fullConfig.port || 587,
            username: fullConfig.username || '',
            password: '',  // Always empty (password not returned, for security)
            fromEmail: fullConfig.fromEmail || response.fromEmail || '',
            fromName: fullConfig.fromName || response.fromName || '',
            dunningSenderName: fullConfig.dunningSenderName || '',
          });
        } catch (err) {
          logWarn('EmailSettings', 'useEffect', 'Could not fetch full SMTP config, using status fallback');
          setSMTPConfig({
            host: response.host || '',
            port: 587,
            username: '',
            password: response.password ? '••••••••' : '',  // Show placeholder if password exists
            fromEmail: response.fromEmail || '',
            fromName: response.fromName || '',
            dunningSenderName: '',
          });
        }
      }
    } catch (err: any) {
      if (err.status !== 401) {
        logError('EmailSettings', 'fetchSMTPStatus', 'Failed to fetch SMTP status', err);
      }
    }
  }

  async function handleSaveSMTP() {
    if (!smtpConfig.host || !smtpConfig.username || !smtpConfig.fromEmail) {
      addToast({ type: 'error', message: 'Please fill all required fields (Host, Username, From Email)' });
      return;
    }

    // Password: if blank, keep existing. If filled, use new one.
    // Frontend always allows blank (backend will check if it's NEW config vs EXISTING)
    const hasNewPassword = smtpConfig.password && smtpConfig.password.trim().length > 0;

    try {
      setIsTesting(true);

      const configToSave = {
        ...smtpConfig,
        password: hasNewPassword ? smtpConfig.password : '',  // Blank = keep existing
      };

      await api.post('/api/settings/smtp/configure', configToSave);

      if (smtpConfig.dunningSenderName?.trim()) {
        try {
          await api.put('/api/settings/dunning-sender-name', { senderName: smtpConfig.dunningSenderName });
        } catch (err) {
          logError('EmailSettings', 'handleSaveDunningSenderName', 'Failed to save dunning sender name', err);
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

      // If password is blank, use existing. If filled, use new one.
      const hasNewPassword = smtpConfig.password && smtpConfig.password.trim().length > 0;
      const configToTest = {
        ...smtpConfig,
        password: hasNewPassword ? smtpConfig.password : '',  // Blank = keep existing
      };

      await api.post('/api/settings/smtp/test', configToTest);
      addToast({ type: 'success', message: 'SMTP verified! Emails will now come from your domain.' });
      await fetchSMTPStatus();
      setShowSMTPModal(false);
    } catch (err: any) {
      addToast({ type: 'error', message: err.response?.data?.error || 'SMTP connection failed' });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleConfirmDisableSMTP() {
    setIsDisablingSmtp(true);
    try {
      await api.post('/api/settings/smtp/disable');
      addToast({ type: 'success', message: 'SMTP disabled. Using RecoverAI email.' });
      await fetchSMTPStatus();
      setUseOwnDomain(false);
    } catch (err: any) {
      addToast({ type: 'error', message: 'Failed to disable SMTP' });
    } finally {
      setIsDisablingSmtp(false);
    }
  }

  function handleDisableSMTP() {
    setShowDisableSMTPConfirm(true);
  }

  // NEW: API handlers for agent settings
  async function handlePilotModeChange(mode: string) {
    try {
      await api.put('/api/settings/pilot-mode', { pilot_mode: mode });
      setPilotMode(mode);
      addToast({ type: 'success', message: `Pilot mode changed to ${mode}` });
    } catch (err: any) {
      addToast({ type: 'error', message: 'Failed to update pilot mode' });
    }
  }

  async function handleDunningToneChange(tone: string) {
    try {
      await api.put('/api/settings/dunning-tone', { dunning_tone: tone });
      setDunningTone(tone);
      addToast({ type: 'success', message: `Dunning tone changed to ${tone}` });
    } catch (err: any) {
      addToast({ type: 'error', message: 'Failed to update dunning tone' });
    }
  }

  async function handleSmtpFallbackChange(enabled: boolean) {
    try {
      await api.put('/api/settings/smtp-fallback', { smtp_fallback_to_resend: enabled });
      setSmtpFallbackToResend(enabled);
      addToast({ type: 'success', message: 'SMTP fallback setting updated' });
    } catch (err: any) {
      addToast({ type: 'error', message: 'Failed to update SMTP fallback setting' });
    }
  }

  async function handleReplyToEmailChange(email: string) {
    try {
      await api.put('/api/settings/general', { reply_to_email: email });
      setReplyToEmail(email);
      addToast({ type: 'success', message: 'Reply-to email updated' });
    } catch (err: any) {
      addToast({ type: 'error', message: 'Failed to update reply-to email' });
    }
  }

  async function handlePauseDunningChange(date: string) {
    try {
      await api.put('/api/settings/pause-dunning', { pause_dunning_until: date });
      setPauseDunningUntil(date);
      addToast({ type: 'success', message: 'Pause dunning date updated' });
    } catch (err: any) {
      addToast({ type: 'error', message: 'Failed to update pause dunning date' });
    }
  }

  async function handlePausedCustomersChange(customers: string) {
    try {
      const emailList = customers.split(',').map(e => e.trim()).filter(e => e);
      await api.put('/api/settings/pause-customer', { paused_customers: emailList });
      setPausedCustomers(customers);
      addToast({ type: 'success', message: 'Paused customers list updated' });
    } catch (err: any) {
      addToast({ type: 'error', message: 'Failed to update paused customers' });
    }
  }

  async function handleAggressiveModeChange(enabled: boolean) {
    try {
      await api.put('/api/settings/aggressive-mode', { aggressive_enabled: enabled });
      setAggressiveMode(enabled);
      addToast({ type: 'success', message: 'Aggressive mode updated' });
    } catch (err: any) {
      addToast({ type: 'error', message: 'Failed to update aggressive mode' });
    }
  }

  if (isLoadingAgentSettings) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ===== SECTION 1: CONSOLIDATED EMAIL CONFIGURATION (TOP LEVEL) ===== */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-200 dark:border-blue-800/30 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              📧 Email Configuration
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 break-words">
              {useOwnDomain && smtpStatus?.verified
                ? `Sending from your domain • ${smtpStatus.fromName ? smtpStatus.fromName : 'Billing'} <${smtpStatus.fromEmail}> • Reply-to: ${replyToEmail || 'not set'}`
                : useOwnDomain
                ? 'Your Domain setup pending'
                : `Sending from RecoverAI • noreply@recoverai.com • Reply-to: ${replyToEmail || 'not set'}`
              }
            </p>

            {/* Status Badge */}
            <div className="flex items-center gap-2 mb-4">
              {useOwnDomain && smtpStatus?.verified ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-xs font-medium text-green-700 dark:text-green-400">Connected & Verified</span>
                </>
              ) : useOwnDomain ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">Pending Configuration</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Active</span>
                </>
              )}
            </div>
          </div>

          {/* Configure Button */}
          <button
            onClick={() => setShowSMTPModal(true)}
            className="w-full sm:w-auto px-5 sm:px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm sm:text-base transition-all shadow-lg hover:shadow-xl flex-shrink-0"
          >
            Configure
          </button>
        </div>
      </div>

      {/* CONSOLIDATED EMAIL CONFIGURATION MODAL */}
      {showSMTPModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-y-auto border border-gray-200 dark:border-white/[0.08]">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 border-b border-gray-200 dark:border-white/[0.08] px-6 py-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  📧 Email Configuration
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Control how dunning emails are sent
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
            <div className="p-6 space-y-6">
              {/* STEP 1: Email Source Selection */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">Step 1: Choose Email Source</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* RecoverAI Option */}
                  <div
                    onClick={() => {
                      setUseOwnDomain(false);
                      if (smtpStatus?.verified) handleDisableSMTP();
                    }}
                    className={cn(
                      'p-5 border-2 rounded-xl cursor-pointer transition-all',
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
                        <p className="text-sm font-bold text-gray-900 dark:text-white">RecoverAI Domain</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Instant setup, no config needed
                        </p>
                        <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-2 bg-gray-100 dark:bg-white/[0.05] px-2 py-1 rounded inline-block">
                          noreply@recoverai.com
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Your Domain Option */}
                  <div
                    onClick={() => setUseOwnDomain(true)}
                    className={cn(
                      'p-5 border-2 rounded-xl cursor-pointer transition-all',
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
                        <p className="text-sm font-bold text-gray-900 dark:text-white">Your Domain</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Better deliverability & trust
                        </p>
                        <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-2 bg-gray-100 dark:bg-white/[0.05] px-2 py-1 rounded inline-block">
                          billing@yourcompany.com
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 2: Configuration */}
              {!useOwnDomain ? (
                /* RecoverAI Configuration (Minimal) */
                <div className="border-t border-gray-200 dark:border-white/[0.06] pt-6 space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">Step 2: Email Routing (Optional)</h3>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        📧 Reply-To Email Address <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                      </label>
                      <input
                        type="email"
                        value={replyToEmail}
                        onChange={(e) => handleReplyToEmailChange(e.target.value)}
                        placeholder="finance@company.com"
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                        Where customer replies will be sent. Leave blank to disable.
                      </p>
                    </div>
                  </div>

                  {/* Email Preview for RecoverAI */}
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                      📧 Preview: How your emails will look
                    </p>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 p-5 space-y-3 text-xs">
                      <div className="border-b border-gray-300 dark:border-gray-700 pb-3">
                        <div className="text-gray-600 dark:text-gray-400 space-y-1 font-mono">
                          <div className="flex justify-between">
                            <span>From:</span>
                            <span className="text-right text-gray-900 dark:text-white">RecoverAI &lt;noreply@recoverai.com&gt;</span>
                          </div>
                          <div className="flex justify-between">
                            <span>To:</span>
                            <span className="text-right text-gray-900 dark:text-white">customer@company.com</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Subject:</span>
                            <span className="text-right text-gray-900 dark:text-white">Payment reminder: Invoice #INV-001</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-gray-700 dark:text-gray-300 leading-relaxed space-y-2">
                        <p>Hi there,</p>
                        <p>Invoice #INV-001 ($5,000) is now 15 days overdue. Could you prioritize this payment?</p>
                        <p>→ <span className="text-blue-600 dark:text-blue-400">Pay now</span></p>
                        <p className="pt-2">Best regards,<br/><strong>RecoverAI Collections</strong></p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* SMTP Configuration (Full) */
                <div className="border-t border-gray-200 dark:border-white/[0.06] pt-6 space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">Step 2: SMTP Settings</h3>

                    {/* SMTP Credentials */}
                    <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    placeholder="Enter new password to change, or leave blank to keep existing"
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
                  ✓ Password already saved. Leave blank to keep current password. Enter new one to change.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                    {/* Step 3: Email Routing & Fallback */}
                    <div className="border-t border-gray-200 dark:border-white/[0.06] pt-6 space-y-4">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">Step 3: Email Routing & Backup</h3>

                      <div>
                        <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                          📧 Reply-To Email Address <span className="text-gray-500 text-xs font-normal">(Optional)</span>
                        </label>
                        <input
                          type="email"
                          value={replyToEmail}
                          onChange={(e) => handleReplyToEmailChange(e.target.value)}
                          placeholder="finance@company.com"
                          className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                          Where customer replies will be sent. Leave blank to use sender email.
                        </p>
                      </div>

                      <label className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 dark:border-white/[0.06] cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                        <input
                          type="checkbox"
                          checked={smtpFallbackToResend}
                          onChange={(e) => handleSmtpFallbackChange(e.target.checked)}
                          className="mt-1 w-4 h-4 rounded"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">
                            Allow Resend as Fallback if SMTP Fails
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            If your SMTP server fails, emails will be sent via Resend as backup
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Default: OFF (explicit opt-in required)
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Email Preview */}
                    <div className="border-t border-gray-200 dark:border-white/[0.06] pt-6">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                        📧 Preview: How your emails will look
                      </p>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 p-5 space-y-3 text-xs">
                        <div className="border-b border-gray-300 dark:border-gray-700 pb-3">
                          <div className="text-gray-600 dark:text-gray-400 space-y-1 font-mono">
                            <div className="flex justify-between">
                              <span>From:</span>
                              <span className="text-right text-gray-900 dark:text-white">
                                {smtpConfig.fromName ? `${smtpConfig.fromName} <${smtpConfig.fromEmail || 'billing@company.com'}>` : smtpConfig.fromEmail || 'billing@company.com'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>To:</span>
                              <span className="text-right text-gray-900 dark:text-white">customer@company.com</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Subject:</span>
                              <span className="text-right text-gray-900 dark:text-white">Payment reminder: Invoice #INV-001</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-gray-700 dark:text-gray-300 leading-relaxed space-y-2">
                          <p>Hi there,</p>
                          <p>Invoice #INV-001 ($5,000) is now 15 days overdue. Could you prioritize this payment?</p>
                          <p>→ <span className="text-blue-600 dark:text-blue-400">Pay now</span></p>
                          <p className="pt-2">Best regards,<br/><strong>{smtpConfig.dunningSenderName || smtpConfig.fromName || 'Billing Team'}</strong></p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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

      {/* ===== SECTION 2: AGENT MODE (SEXY REDESIGN) ===== */}
      <div className="border-t border-gray-200 dark:border-white/[0.06] pt-8">
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            🎛️ Agent Mode
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            How should the AI handle dunning emails?
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              id: 'auto',
              icon: '⚡',
              label: 'Auto Mode',
              desc: 'Send automatically',
              detail: 'No approval needed',
              color: 'from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-700'
            },
            {
              id: 'shadow',
              icon: '🔍',
              label: 'Shadow Mode',
              desc: 'Review first',
              detail: 'Queue for approval',
              color: 'from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-200 dark:border-blue-700'
            },
            {
              id: 'paused',
              icon: '⏸️',
              label: 'Paused',
              desc: 'All actions paused',
              detail: 'No emails sent',
              color: 'from-gray-50 to-slate-50 dark:from-gray-800/20 dark:to-slate-800/20 border-gray-300 dark:border-gray-600'
            },
          ].map((mode) => (
            <label
              key={mode.id}
              className={`relative p-5 rounded-xl border-2 cursor-pointer transition-all ${mode.color} ${pilotMode === mode.id ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-900' : 'hover:border-opacity-70'}`}
            >
              <input
                type="radio"
                name="pilotMode"
                value={mode.id}
                checked={pilotMode === mode.id}
                onChange={(e) => handlePilotModeChange(e.target.value)}
                className="absolute opacity-0"
              />
              <div className="text-center">
                <p className="text-3xl mb-2">{mode.icon}</p>
                <p className="font-bold text-gray-900 dark:text-white">{mode.label}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{mode.desc}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 font-medium">{mode.detail}</p>
                {pilotMode === mode.id && (
                  <div className="mt-3 inline-block px-3 py-1 bg-blue-600 text-white text-xs rounded-full font-semibold">
                    ✓ Active
                  </div>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* ===== SECTION 3: DUNNING STRATEGY (SEXY REDESIGN) ===== */}
      <div className="border-t border-gray-200 dark:border-white/[0.06] pt-8">
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            📊 Dunning Strategy
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Fine-tune how and when emails are sent
          </p>
        </div>

        {/* Email Tone - Grid Cards */}
        <div className="mb-10 p-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 rounded-xl border border-indigo-200 dark:border-indigo-800/30">
          <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4">🎯 Email Tone</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Choose how assertive your collection emails should be
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { id: 'gentle', icon: '🤝', label: 'Gentle', desc: 'Kind & supportive', impact: 'Lower response' },
              { id: 'standard', icon: '💼', label: 'Standard', desc: 'Professional & firm', impact: 'Balanced' },
              { id: 'aggressive', icon: '⚠️', label: 'Aggressive', desc: 'Direct & urgent', impact: 'Higher response' },
            ].map((tone) => (
              <label
                key={tone.id}
                className={`relative p-5 rounded-lg border-2 cursor-pointer transition-all ${dunnTone === tone.id ? 'border-purple-500 bg-white dark:bg-purple-900/20 ring-2 ring-purple-500/20' : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600'}`}
              >
                <input
                  type="radio"
                  name="dunningTone"
                  value={tone.id}
                  checked={dunnTone === tone.id}
                  onChange={(e) => handleDunningToneChange(e.target.value)}
                  className="absolute opacity-0"
                />
                <div className="text-center">
                  <p className="text-2xl mb-2">{tone.icon}</p>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{tone.label}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{tone.desc}</p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-2 font-medium">{tone.impact}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Pause Controls - Split into 2 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Pause Until */}
          <div className="p-5 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-200 dark:border-orange-800/30">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <span>⏱️ Pause Until Date</span>
            </h4>
            <input
              type="date"
              value={pauseDunningUntil}
              onChange={(e) => handlePauseDunningChange(e.target.value)}
              className="w-full px-4 py-3 border border-orange-300 dark:border-orange-700 rounded-lg bg-white dark:bg-orange-900/20 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
            />
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-3">
              All emails paused until this date, then resume automatically
            </p>
          </div>

          {/* Aggressive Mode Toggle */}
          <div className="p-5 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800/30">
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="flex-1">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
                  ⚡ Aggressive Override
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Force all emails to aggressive tone, overriding risk levels
                </p>
              </div>
              <input
                type="checkbox"
                checked={aggressiveMode}
                onChange={(e) => handleAggressiveModeChange(e.target.checked)}
                className="mt-1 w-5 h-5 rounded accent-red-600"
              />
            </label>
            {aggressiveMode && (
              <div className="mt-3 p-2 bg-red-100 dark:bg-red-900/30 rounded text-xs text-red-800 dark:text-red-200 font-medium">
                🔥 Aggressive mode ACTIVE
              </div>
            )}
          </div>
        </div>

        {/* Paused Customers */}
        <div className="p-6 bg-slate-50 dark:bg-slate-900/10 rounded-xl border border-slate-200 dark:border-slate-800/30">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <span>👥 Skip These Customers</span>
          </h4>
          <textarea
            value={pausedCustomers}
            onChange={(e) => handlePausedCustomersChange(e.target.value)}
            placeholder="john@company.com, mary@business.com, admin@corp.io"
            rows={4}
            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900/20 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-500 resize-none font-mono text-sm"
          />
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-3">
            Comma-separated list of emails to exclude from all dunning campaigns
          </p>
          {pausedCustomers && (
            <div className="mt-3 text-xs text-slate-600 dark:text-slate-400 font-medium">
              ✓ {pausedCustomers.split(',').filter(e => e.trim()).length} customer(s) on skiplist
            </div>
          )}
        </div>
      </div>

      {/* ===== FUTURE FEATURES (Month 2+) ===== */}
      {/*
      ==================== FUTURE (Month 2 - Based on Customer Feedback) ====================

      EMAIL TONE FIELD (COMMENTED OUT - Duplicate of Dunning Tone)
      - Reason: dunning_tone already controls email strategy above. This was redundant.
      - Status: Not in schema form, will not be saved. Use Dunning Tone instead.

      CUSTOM SIGNATURE (COMMENTED OUT - NOT USED)
      - Reason: Users customize via SMTP fromName + Dunning Sender Name in SMTP config above.
      - Location: SMTP modal (lines 478-492) where dunningSenderName is already configurable
      - Status: Not in DB, not connected to email sending pipeline.

      EMAIL DAY SCHEDULING (COMMENTED OUT - HARDCODED)
      - Current implementation: DUNNING_DECISION_TREE in agentLoop.ts has fixed schedule
        * Day 1 → dunning_1
        * Day 7 → dunning_2
        * Day 14 → dunning_3
        * Day 30 → dunning_4
        * Day 60 → dunning_5
      - Future: Make configurable via PUT /api/settings/dunning-schedule (Month 2)
      - Status: Not in DB, not user-configurable yet.

      AUTO-PAUSE ON REPLY (COMMENTED OUT - NOT IMPLEMENTED)
      - Requires: Email reply tracking system
      - Current: No mechanism to detect customer replies
      - Future: Implement in Month 2 after building reply detection
      - Status: Not in DB, no backend implementation yet.

      PAYMENT PLAN SPLITS (COMMENTED OUT - NOT IMPLEMENTED)
      - Fields: lowRiskSplit, medRiskSplit, highRiskSplit (e.g., "50/50", "40/60")
      - Purpose: Risk-based email throttling (send different volumes by customer risk)
      - Future: Implement in Month 2 based on customer requests
      - Status: Not in DB, no backend implementation yet.
      */}

      {/* Disable SMTP Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDisableSMTPConfirm}
        title="Disable Custom Email Domain?"
        message="Your customers will receive emails from noreply@recoverai.com instead of your domain. This may reduce deliverability and customer trust. Are you sure?"
        confirmLabel="Switch to RecoverAI Email"
        cancelLabel="Cancel"
        isDangerous={true}
        isLoading={isDisablingSmtp}
        onConfirm={handleConfirmDisableSMTP}
        onCancel={() => setShowDisableSMTPConfirm(false)}
      />
    </div>
  );
};