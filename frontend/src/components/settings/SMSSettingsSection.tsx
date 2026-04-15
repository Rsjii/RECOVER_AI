import React, { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import { useNotification } from '../../hooks/useNotification';
import { logError } from '../../utils/logger';

export const SMSSettingsSection: React.FC = () => {
  const { addToast } = useNotification();
  const [settings, setSettings] = useState({
    sms_enabled: true,
    sms_tone: 'professional',
    sms_day_threshold: 7,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Twilio config state
  const [useTwilioMode, setUseTwilioMode] = useState<'recoverai' | 'custom'>('recoverai');
  const [twilioConfig, setTwilioConfig] = useState({
    configured: false,
    phoneNumber: '',
    lastVerifiedAt: null as string | null,
  });
  const [twilioForm, setTwilioForm] = useState({
    accountSid: '',
    authToken: '',
    phoneNumber: '',
  });
  const [testingTwilio, setTestingTwilio] = useState(false);
  const [showTwilioModal, setShowTwilioModal] = useState(false);

  // Fetch current SMS settings
  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const [smsRes, twilioRes] = await Promise.all([
          api.get('/api/settings/sms'),
          api.get('/api/settings/twilio'),
        ]);

        if (smsRes.data) {
          setSettings(smsRes.data);
        }

        if (twilioRes.data) {
          setTwilioConfig(twilioRes.data);
          if (twilioRes.data.configured) {
            setUseTwilioMode('custom');
          }
        }
      } catch (error) {
        logError('SMSSettingsSection', 'fetchSettings', 'Failed to load SMS settings', error);
        addToast({
          type: 'error',
          message: 'Failed to load SMS settings',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [addToast]);

  const handleToggle = () => {
    setSettings(prev => ({
      ...prev,
      sms_enabled: !prev.sms_enabled,
    }));
  };

  const handleToneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSettings(prev => ({
      ...prev,
      sms_tone: e.target.value,
    }));
  };

  const handleDayThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(1, Math.min(90, parseInt(e.target.value) || 7));
    setSettings(prev => ({
      ...prev,
      sms_day_threshold: value,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.patch('/api/settings/sms', {
        sms_enabled: settings.sms_enabled,
        sms_tone: settings.sms_tone,
        sms_day_threshold: settings.sms_day_threshold,
      });

      addToast({
        type: 'success',
        message: 'SMS settings saved successfully!',
      });
    } catch (error: any) {
      logError('SMSSettingsSection', 'handleSave', 'Failed to save SMS settings', error);
      addToast({
        type: 'error',
        message: error.message || 'Failed to save SMS settings',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTwilioFormChange = (field: string, value: string) => {
    setTwilioForm(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleTestTwilio = async () => {
    if (!twilioForm.accountSid || !twilioForm.authToken || !twilioForm.phoneNumber) {
      addToast({
        type: 'error',
        message: 'Please fill in all Twilio credentials',
      });
      return;
    }

    setTestingTwilio(true);
    try {
      const response = await api.post('/api/settings/twilio/test', {
        accountSid: twilioForm.accountSid,
        authToken: twilioForm.authToken,
        phoneNumber: twilioForm.phoneNumber,
      });

      if (response.data.valid) {
        addToast({
          type: 'success',
          message: 'Twilio credentials are valid!',
        });
      }
    } catch (error: any) {
      logError('SMSSettingsSection', 'handleTestTwilio', 'Twilio test failed', error);
      addToast({
        type: 'error',
        message: error.message || 'Twilio credentials are invalid',
      });
    } finally {
      setTestingTwilio(false);
    }
  };

  const handleSaveTwilio = async () => {
    if (!twilioForm.accountSid || !twilioForm.authToken || !twilioForm.phoneNumber) {
      addToast({
        type: 'error',
        message: 'Please fill in all Twilio credentials',
      });
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/api/settings/twilio/configure', {
        accountSid: twilioForm.accountSid,
        authToken: twilioForm.authToken,
        phoneNumber: twilioForm.phoneNumber,
      });

      setTwilioConfig({
        configured: true,
        phoneNumber: twilioForm.phoneNumber,
        lastVerifiedAt: new Date().toISOString(),
      });

      setTwilioForm({
        accountSid: '',
        authToken: '',
        phoneNumber: '',
      });

      setShowTwilioModal(false);

      addToast({
        type: 'success',
        message: 'Twilio configuration saved successfully!',
      });
    } catch (error: any) {
      logError('SMSSettingsSection', 'handleSaveTwilio', 'Failed to save Twilio config', error);
      addToast({
        type: 'error',
        message: error.message || 'Failed to save Twilio configuration',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnectTwilio = async () => {
    if (!confirm('Are you sure you want to disconnect your Twilio account? SMS will fall back to RecoverAI\'s number.')) {
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/api/settings/twilio/disconnect');

      setTwilioConfig({
        configured: false,
        phoneNumber: '',
        lastVerifiedAt: null,
      });

      setUseTwilioMode('recoverai');
      setShowTwilioModal(false);

      addToast({
        type: 'success',
        message: 'Twilio configuration removed',
      });
    } catch (error: any) {
      logError('SMSSettingsSection', 'handleDisconnectTwilio', 'Failed to disconnect Twilio', error);
      addToast({
        type: 'error',
        message: error.message || 'Failed to disconnect Twilio',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* SMS Dunning Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 border border-blue-200 dark:border-white/[0.08] rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">📱 SMS Dunning</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Automatically send SMS reminders to customers with overdue invoices
            </p>

            {/* Enable Toggle */}
            <div className="mt-4">
              <label className="flex items-center cursor-pointer gap-3">
                <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 dark:bg-gray-700 transition-colors" style={{ backgroundColor: settings.sms_enabled ? '#2563eb' : undefined }}>
                  <input
                    type="checkbox"
                    checked={settings.sms_enabled}
                    onChange={handleToggle}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      settings.sms_enabled ? 'translate-x-5' : 'translate-x-1'
                    )}
                  />
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {settings.sms_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/[0.05] rounded-lg border border-gray-200 dark:border-white/[0.1]">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Active</span>
          </div>
        </div>
      </div>

      {/* Settings Cards */}
      {settings.sms_enabled && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-white/[0.08] p-6 space-y-6">
          {/* SMS Tone */}
          <div>
            <label htmlFor="sms_tone" className="block text-sm font-bold text-gray-900 dark:text-white mb-3 uppercase tracking-wide">
              Message Tone
            </label>
            <select
              id="sms_tone"
              value={settings.sms_tone}
              onChange={handleToneChange}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="friendly">😊 Friendly - Soft, gentle reminders</option>
              <option value="professional">💼 Professional - Standard business tone</option>
              <option value="stern">⚡ Stern - Urgent, firm tone</option>
            </select>
          </div>

          {/* SMS Day Threshold */}
          <div>
            <label htmlFor="sms_day_threshold" className="block text-sm font-bold text-gray-900 dark:text-white mb-3 uppercase tracking-wide">
              Send SMS Timing
            </label>
            <div className="flex items-center gap-4">
              <input
                id="sms_day_threshold"
                type="number"
                value={settings.sms_day_threshold}
                onChange={handleDayThresholdChange}
                min={1}
                max={90}
                className="w-20 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Day <span className="font-semibold text-gray-900 dark:text-white">{settings.sms_day_threshold}</span> of overdue invoice
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Sends after 2+ email attempts
            </p>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Twilio Configuration Card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-white/[0.08] p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">📞 SMS Phone Number</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Control which number your SMS messages come from
            </p>
          </div>
          <button
            onClick={() => setShowTwilioModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            Configure
          </button>
        </div>

        {/* Current Status */}
        {twilioConfig.configured ? (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                  Connected: {twilioConfig.phoneNumber}
                </p>
                {twilioConfig.lastVerifiedAt && (
                  <p className="text-xs text-green-800 dark:text-green-200 mt-1">
                    Verified {new Date(twilioConfig.lastVerifiedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm text-amber-900 dark:text-amber-100">
              Using RecoverAI's shared SMS number. Configure your own for better delivery.
            </p>
          </div>
        )}
      </div>

      {/* Twilio Configuration Modal */}
      {showTwilioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-y-auto border border-gray-200 dark:border-white/[0.08]">
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 border-b border-gray-200 dark:border-white/[0.08] px-6 py-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  📱 SMS Configuration
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Choose which phone number sends your SMS messages
                </p>
              </div>
              <button
                onClick={() => setShowTwilioModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-white/[0.08] rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Step 1: Mode Selection */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">
                  Step 1: Choose SMS Source
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* RecoverAI Option */}
                  <div
                    onClick={() => setUseTwilioMode('recoverai')}
                    className={cn(
                      'p-5 border-2 rounded-xl cursor-pointer transition-all',
                      useTwilioMode === 'recoverai'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.1]'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                          useTwilioMode === 'recoverai'
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300 dark:border-white/[0.2]'
                        )}
                      >
                        {useTwilioMode === 'recoverai' && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">RecoverAI Number</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Use RecoverAI's shared SMS number
                        </p>
                        <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-2 bg-gray-100 dark:bg-white/[0.05] px-2 py-1 rounded inline-block">
                          Shared number
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                          Lower delivery rate — your number recommended
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Your Twilio Option */}
                  <div
                    onClick={() => setUseTwilioMode('custom')}
                    className={cn(
                      'p-5 border-2 rounded-xl cursor-pointer transition-all',
                      useTwilioMode === 'custom'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.1]'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                          useTwilioMode === 'custom'
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300 dark:border-white/[0.2]'
                        )}
                      >
                        {useTwilioMode === 'custom' && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">Your Twilio Number</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Connect your own Twilio account
                        </p>
                        <p className="text-xs font-mono text-blue-600 dark:text-blue-400 mt-2 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded inline-block">
                          Recommended ⭐
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                          Higher delivery rate — customers recognize your number
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Twilio Form (if custom selected) */}
              {useTwilioMode === 'custom' && (
                <>
                  <div className="border-t border-gray-200 dark:border-white/[0.06] pt-6">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">
                      Step 2: Enter Twilio Credentials
                    </h3>

                    {/* Status if already configured */}
                    {twilioConfig.configured && (
                      <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <p className="text-sm text-green-900 dark:text-green-100">
                          ✓ Already connected: {twilioConfig.phoneNumber}
                        </p>
                      </div>
                    )}

                    <div className="space-y-4">
                      {/* Account SID */}
                      <div>
                        <label htmlFor="account_sid" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                          Twilio Account SID
                        </label>
                        <input
                          id="account_sid"
                          type="text"
                          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          value={twilioForm.accountSid}
                          onChange={(e) => handleTwilioFormChange('accountSid', e.target.value)}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                          Find in <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Twilio Console</a>: Account → Settings
                        </p>
                      </div>

                      {/* Auth Token */}
                      <div>
                        <label htmlFor="auth_token" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                          Twilio Auth Token
                        </label>
                        <input
                          id="auth_token"
                          type="password"
                          placeholder="••••••••••••••••••••••••••••••••"
                          value={twilioForm.authToken}
                          onChange={(e) => handleTwilioFormChange('authToken', e.target.value)}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                          Keep this secret! Find in Twilio Console: Account → Settings
                        </p>
                      </div>

                      {/* Phone Number */}
                      <div>
                        <label htmlFor="phone_number" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                          Twilio Phone Number
                        </label>
                        <input
                          id="phone_number"
                          type="tel"
                          placeholder="+1-415-XXX-XXXX"
                          value={twilioForm.phoneNumber}
                          onChange={(e) => handleTwilioFormChange('phoneNumber', e.target.value)}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                          Format: +1-XXX-XXX-XXXX (or any E.164 format)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="border-t border-gray-200 dark:border-white/[0.06] pt-6 flex gap-3 justify-end">
                    {twilioConfig.configured && (
                      <button
                        onClick={handleDisconnectTwilio}
                        disabled={isSaving}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                      >
                        Disconnect
                      </button>
                    )}
                    <button
                      onClick={handleTestTwilio}
                      disabled={testingTwilio || isSaving}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
                    >
                      {testingTwilio ? 'Testing...' : 'Test Connection'}
                    </button>
                    <button
                      onClick={handleSaveTwilio}
                      disabled={isSaving || testingTwilio}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                    >
                      {isSaving ? 'Saving...' : 'Save Twilio'}
                    </button>
                  </div>
                </>
              )}

              {/* Close button at bottom for mobile */}
              <div className="border-t border-gray-200 dark:border-white/[0.06] pt-6 flex justify-end">
                <button
                  onClick={() => setShowTwilioModal(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          <strong>💡 How SMS dunning works:</strong> The agent automatically sends SMS reminders to customers who opt-in, starting on your configured day (default: day 7) after 2+ failed email attempts. SMS increases payment recovery by 15-25% compared to email alone.
        </p>
      </div>

      {/* Example Messages */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-white/[0.08] p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">📝 Example Messages</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">😊 Friendly</p>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400 border-l-4 border-green-500">
              "Hi John, just a friendly reminder that your $5,000 invoice is overdue. Could you arrange payment when you get a chance? Reply STOP to opt out."
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">💼 Professional</p>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400 border-l-4 border-blue-500">
              "Hi John, your $5,000 invoice is now overdue. Please arrange payment as soon as possible. Reply STOP to opt out."
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">⚡ Stern</p>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400 border-l-4 border-red-500">
              "URGENT: Your $5,000 invoice is overdue. Immediate payment required. Reply STOP to opt out."
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
