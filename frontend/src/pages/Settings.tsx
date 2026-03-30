import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { Spinner } from '../components/ui/Spinner';
import { Modal } from '../components/ui/Modal';
import { useNotification } from '../hooks/useNotification';
import { useAuth } from '../hooks/useAuth';
import { ProfileSection } from '../components/settings/ProfileSection';
import { NotificationsSection } from '../components/settings/NotificationsSection';
import { IntegrationSection } from '../components/settings/IntegrationSection';
import { DunningSection } from '../components/settings/DunningSection';
import { SlackSection } from '../components/settings/SlackSection';
import { GeneralSection } from '../components/settings/GeneralSection';
import { cn } from '../lib/utils';
import type { CompanySettings } from '../types';
import SettingsTrial from './Settings_trial';

type SettingsTab = 'profile' | 'integrations' | 'automation' | 'advanced';

const TABS: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
  {
    id: 'profile',
    label: 'Profile',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  },
  {
    id: 'automation',
    label: 'Automation',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  },
  {
    id: 'advanced',
    label: 'Advanced',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
];

const EMAIL_TEMPLATES = [
  { id: 'dunning_1', name: 'First Reminder', delay: 'Day 1 past due', desc: 'Friendly payment reminder' },
  { id: 'dunning_2', name: 'Second Follow-up', delay: 'Day 8 past due', desc: 'Escalated tone with payment link' },
  { id: 'dunning_3', name: 'Urgent Notice', delay: 'Day 15 past due', desc: 'Urgency + payment plan offer' },
  { id: 'dunning_4', name: 'Final Warning', delay: 'Day 22 past due', desc: 'Final notice before action' },
  { id: 'dunning_5', name: 'Account Action', delay: 'Day 30 past due', desc: 'Service suspension warning' },
];

const Settings: React.FC = () => {
  const { addToast } = useNotification();
  const { company } = useAuth();
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  // Check if user is in trial
  const isTrial = company?.onboardingStage === 'trial_active';

  // Render trial version if user is in trial
  if (isTrial) {
    return <SettingsTrial />;
  }

  useEffect(() => {
    document.title = 'Settings — CashOS';
  }, []);
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [agentMode, setAgentMode] = useState<string | null>(null);
  const [savingMode, setSavingMode] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: CompanySettings }>(API_ENDPOINTS.settings.get);
      let sessionsRes: { data: any[] } = { data: [] };
      try {
        sessionsRes = await api.get<{ data: any[] }>(API_ENDPOINTS.auth.companySessions);
      } catch {
        sessionsRes = await api.get<{ data: any[] }>(API_ENDPOINTS.auth.sessions);
      }
      setSettings(res.data);
      setSessions(sessionsRes.data || []);
      // Load pilot mode from settings
      setAgentMode((res.data as any).pilotMode || 'auto');
    } catch {
      /* handled by global interceptor */
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMode = async (mode: string) => {
    setSavingMode(true);
    try {
      await api.patch('/api/settings/pilot-mode', { mode });
      setAgentMode(mode);
      addToast({
        type: 'success',
        message: `Agent mode changed to ${mode}`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to save mode',
      });
    } finally {
      setSavingMode(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" text="Loading settings..." /></div>;
  if (!settings) return <p className="text-red-500 text-center py-20">Failed to load settings</p>;

  const revokeSession = async (sessionId: string, isCurrentSession = false) => {
    setSessionLoading(true);
    setConfirmRevokeId(null);
    try {
      await api.delete(API_ENDPOINTS.auth.revokeSession(sessionId));

      if (isCurrentSession) {
        // Current session was revoked — hard refresh to clear all state and cookies
        addToast({
          type: 'warning',
          message: 'Session revoked. Logging out...'
        });
        setTimeout(() => {
          window.location.href = '/login';
        }, 800);
      } else {
        addToast({
          type: 'success',
          message: 'Session revoked successfully'
        });
        await fetch();
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.response?.data?.error || 'Failed to revoke session'
      });
    } finally {
      if (!isCurrentSession) setSessionLoading(false);
    }
  };

  const revokeAllSessions = async () => {
    setSessionLoading(true);
    try {
      await api.post(API_ENDPOINTS.auth.revokeAllSessions);
      addToast({
        type: 'warning',
        message: 'All sessions revoked. Logging out...'
      });
      // Hard refresh after revoking all sessions
      setTimeout(() => {
        window.location.href = '/login';
      }, 1000);
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.response?.data?.error || 'Failed to revoke all sessions'
      });
      setSessionLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#09090b]">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-6 sm:px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#111113] sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <div className="flex gap-2 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 py-4 px-4 font-medium text-sm border-b-2 transition-all duration-200 whitespace-nowrap',
                  activeTab === tab.id
                    ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-300'
                )}
              >
                <span className="w-5 h-5">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 sm:px-8 py-8">
        <div className="max-w-3xl">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-8">
              {/* Profile Section */}
              <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Profile</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage your account information</p>
                  </div>
                </div>
                <ProfileSection onUpdated={fetch} />
              </div>

              {/* Company Info Section */}
              <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Company Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Company Name</label>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{settings.companyName || '—'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Plan</label>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">Growth</p>
                      <span className="text-xs bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-full font-medium">Active</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notifications Section */}
              <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Notifications</h2>
                <NotificationsSection slackConnected={settings.integrations.slack} onUpdated={fetch} />
              </div>
            </div>
          )}

          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <div className="space-y-8">
              <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Connected Services</h2>
                <IntegrationSection
                  stripeConnected={settings.integrations.stripe}
                  stripeLastSyncedAt={(settings.integrations as any).stripeLastSyncedAt || null}
                  slackConnected={settings.integrations.slack}
                  quickbooksConnected={!!(settings.integrations as any).quickbooks}
                  chargebeeConnected={!!(settings.integrations as any).chargebee}
                  twilioConfigured={!!(settings.integrations as any).twilioConfigured}
                  onRefresh={fetch}
                />
              </div>

              {/* Razorpay Billing Configuration */}
              <RazorpaySettingsSection />

              {/* Twilio Voice Calling Configuration */}
              <TwilioSettingsSection />

              {/* Payment Plans Configuration */}
              <PaymentPlansSettingsSection />
            </div>
          )}

          {/* Automation Tab */}
          {activeTab === 'automation' && (
            <div className="space-y-8">
              {/* Agent Mode */}
              <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Agent Mode</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Control how dunning emails are handled</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      value: 'shadow',
                      label: 'Shadow Mode (Review)',
                      description: 'All emails queued for your approval before sending',
                    },
                    {
                      value: 'auto',
                      label: 'Auto Mode (Recommended)',
                      description: 'Emails sent automatically based on dunning schedule',
                    },
                    {
                      value: 'paused',
                      label: 'Paused',
                      description: 'All communications temporarily stopped',
                    },
                  ].map((mode) => (
                    <label key={mode.value} className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 dark:border-white/[0.08] hover:bg-gray-50 dark:hover:bg-white/[0.02] cursor-pointer transition-all">
                      <input
                        type="radio"
                        name="agentMode"
                        value={mode.value}
                        checked={agentMode === mode.value}
                        onChange={(e) => handleSaveMode(e.target.value)}
                        disabled={savingMode}
                        className="mt-1 w-4 h-4"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{mode.label}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{mode.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Dunning Strategy */}
              <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Dunning Strategy</h2>
                <DunningSection
                  strategy={settings.dunningStrategy || { num_emails: 5, days_between: 7, approval_required: false }}
                  onSaved={fetch}
                />
              </div>

              {/* Slack Integration */}
              <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Slack Notifications</h2>
                <SlackSection connected={settings.integrations.slack} onSaved={fetch} />
              </div>

              {/* Email Templates */}
              <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Email Templates</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">AI-generated for each customer</p>
                  </div>
                  <span className="text-xs bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full font-semibold">AI-Powered</span>
                </div>
                <div className="space-y-4">
                  {EMAIL_TEMPLATES.map((tpl, idx) => (
                    <div key={tpl.id} className="group relative p-5 rounded-xl border border-gray-200 dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.12] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-all duration-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-sm font-semibold">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">{tpl.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{tpl.delay}</p>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 ml-11">{tpl.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-6 italic">
                  💡 Each email is personalized by AI using customer name, invoice amount, payment history, and risk profile.
                </p>
              </div>
            </div>
          )}

          {/* Advanced Tab */}
          {activeTab === 'advanced' && (
            <div className="space-y-8">
              {/* Sessions */}
              <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Active Sessions</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage your login sessions</p>
                  </div>
                  {sessions.length > 0 && (
                    <button
                      onClick={revokeAllSessions}
                      disabled={sessionLoading}
                      className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-semibold disabled:opacity-50 transition-colors"
                    >
                      Revoke All
                    </button>
                  )}
                </div>

                {sessions.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">🔒</div>
                    <p className="text-gray-600 dark:text-gray-400 font-medium">No active sessions</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((s: any) => (
                      <div key={s.id} className={cn(
                        "flex items-center justify-between p-5 rounded-xl border transition-colors",
                        s.isCurrent
                          ? "border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10"
                          : "border-gray-200 dark:border-white/[0.06] hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                      )}>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <span className="text-lg">💻</span>
                            {s.user_agent || 'Unknown device'}
                            {s.isCurrent && (
                              <span className="text-xs bg-blue-600 dark:bg-blue-500 text-white px-2 py-0.5 rounded-full font-medium">
                                Current
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.ip_address || 'Unknown IP'}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Created {new Date(s.created_at).toLocaleDateString()} at {new Date(s.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            if (s.isCurrent) {
                              setConfirmRevokeId(s.id);
                            } else {
                              revokeSession(s.id, false);
                            }
                          }}
                          disabled={sessionLoading}
                          className={cn(
                            "text-sm font-semibold disabled:opacity-50 transition-colors",
                            s.isCurrent
                              ? "text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300"
                              : "text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                          )}
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* General Settings */}
              <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">General Preferences</h2>
                <GeneralSection
                  timezone={settings.timezone}
                  preferredCurrency={settings.preferredCurrency}
                  onSaved={fetch}
                />
              </div>

              {/* API Costs */}
              <ApiCostsSection />

              {/* API Keys */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-white/[0.03] dark:to-white/[0.01] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8 opacity-60">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">API Keys</h2>
                  <span className="text-xs bg-gray-100 dark:bg-white/[0.08] text-gray-700 dark:text-gray-300 px-3 py-1 rounded-full font-semibold">Enterprise</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Programmatic access for custom integrations and automation. Coming soon for enterprise customers.</p>
              </div>

              {/* Webhooks */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-white/[0.03] dark:to-white/[0.01] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8 opacity-60">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Webhooks</h2>
                  <span className="text-xs bg-gray-100 dark:bg-white/[0.08] text-gray-700 dark:text-gray-300 px-3 py-1 rounded-full font-semibold">Enterprise</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Real-time events for payments, recoveries, and alerts. Coming soon for enterprise customers.</p>
              </div>

              {/* Data & Privacy */}
              <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Data & Privacy</h2>
                <div className="space-y-3">
                  <button className="w-full text-left px-5 py-4 rounded-xl border border-gray-200 dark:border-white/[0.06] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                    <p className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">📊 Export Data</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Download all your data as CSV</p>
                  </button>
                  <button className="w-full text-left px-5 py-4 rounded-xl border border-gray-200 dark:border-white/[0.06] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                    <p className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">⚖️ GDPR Request</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Submit a data access or deletion request</p>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Revoke Current Session Modal */}
      <Modal
        isOpen={!!confirmRevokeId}
        onClose={() => setConfirmRevokeId(null)}
        size="md"
        title="Revoke Current Session?"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            You're about to revoke <strong>your current session</strong>. You will be logged out immediately.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This action cannot be undone. You'll need to log in again to access your account.
          </p>
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setConfirmRevokeId(null)}
              disabled={sessionLoading}
              className="flex-1 px-4 py-2 text-sm font-medium border border-gray-300 dark:border-white/[0.1] rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => confirmRevokeId && revokeSession(confirmRevokeId, true)}
              disabled={sessionLoading}
              className="flex-1 px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {sessionLoading ? 'Revoking...' : 'Yes, Revoke & Logout'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// ─── Razorpay Settings Section ────────────────────────────────────────────────

const RazorpaySettingsSection: React.FC = () => {
  const { addToast } = useNotification();
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const handleSave = async () => {
    if (!keyId.trim() || !keySecret.trim()) {
      addToast({ type: 'error', message: 'Both Key ID and Key Secret are required' });
      return;
    }
    setSaving(true);
    try {
      await api.post(API_ENDPOINTS.settings.general, {
        razorpay_key_id: keyId.trim(),
        razorpay_key_secret: keySecret.trim(),
      });
      addToast({ type: 'success', message: 'Razorpay credentials saved' });
      setKeySecret('');
    } catch {
      addToast({ type: 'error', message: 'Failed to save Razorpay credentials' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">💳</span>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Razorpay Billing</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Used to generate payment links and collect subscription fees from your clients
          </p>
        </div>
        <span className="ml-auto text-xs bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-full font-semibold">
          Required for billing
        </span>
      </div>

      <div className="space-y-4 max-w-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Razorpay Key ID
          </label>
          <input
            type="text"
            value={keyId}
            onChange={e => setKeyId(e.target.value)}
            placeholder="rzp_live_xxxxxxxxxxxx"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Razorpay Key Secret
          </label>
          <div className="relative">
            <input
              type={showSecret ? 'text' : 'password'}
              value={keySecret}
              onChange={e => setKeySecret(e.target.value)}
              placeholder="••••••••••••••••"
              className="w-full px-4 py-2.5 pr-16 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showSecret ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
          >
            {saving ? <Spinner size="sm" /> : null}
            {saving ? 'Saving...' : 'Save Credentials'}
          </button>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Keys are encrypted at rest. Get them from your{' '}
            <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noopener noreferrer" className="underline">
              Razorpay dashboard
            </a>.
          </p>
        </div>

        <div className="mt-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
          <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-1">How it works</p>
          <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
            <li>• Base subscription fee auto-charged on 1st of each month</li>
            <li>• Recovery % calculated at month-end → payment link sent</li>
            <li>• Clients pay in their currency (USD, EUR, INR, etc.)</li>
            <li>• Money lands in your Indian bank account</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const TwilioSettingsSection: React.FC = () => {
  return (
    <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">🎙️</span>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Voice Calling (Twilio)</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Auto-call Tier 4 customers (90+ days overdue) with payment plan offers
          </p>
        </div>
        <span className="ml-auto text-xs bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 px-3 py-1 rounded-full font-semibold">
          Phase 5
        </span>
      </div>

      <div className="space-y-4 max-w-2xl">
        <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-4 border border-gray-200 dark:border-white/[0.06]">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">How It Works</h3>
          <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside">
            <li>Tier 4 customers 90+ days overdue → Auto-call via Twilio</li>
            <li>IVR script: Press 1 to accept payment plan, 2 for operator, 9 to hang up</li>
            <li>Press 1 → Auto-generate 3-month payment plan + SMS confirmation</li>
            <li>Voice call stats tracked on Dashboard</li>
          </ol>
        </div>

        <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4 border border-blue-100 dark:border-blue-500/20">
          <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-2">Status</p>
          <p className="text-sm text-blue-600 dark:text-blue-400">
            ✓ Voice calling enabled | Expected acceptance rate: 60-70%
          </p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-4 border border-amber-100 dark:border-amber-500/20">
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium mb-2">Configuration</p>
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Twilio credentials are managed by the admin. Contact support if you need to update phone number or IVR settings.
          </p>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p className="font-medium text-gray-900 dark:text-white mb-2">Phone Number Configured:</p>
          <p className="text-gray-500 dark:text-gray-500 text-xs">Will display actual Twilio number when configured</p>
        </div>

        <div className="bg-green-50 dark:bg-green-500/10 rounded-xl p-4 border border-green-100 dark:border-green-500/20">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked={true}
              className="mt-1 w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <div>
              <p className="text-sm font-medium text-green-900 dark:text-green-100">Allow Voice Calling</p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                By enabling this, you consent to have CashOS make automated outbound calls to Tier 4 customers (90+ days overdue) in accordance with TCPA regulations.
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};

const PaymentPlansSettingsSection: React.FC = () => {
  return (
    <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">📋</span>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Payment Plans</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Auto-generate flexible payment plans for hard-declined invoices
          </p>
        </div>
        <span className="ml-auto text-xs bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 px-3 py-1 rounded-full font-semibold">
          Phase 4
        </span>
      </div>

      <div className="space-y-4 max-w-2xl">
        <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-4 border border-gray-200 dark:border-white/[0.06]">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">How It Works</h3>
          <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside">
            <li>Hard decline detected (e.g., card expired, invalid) → Auto-offer payment plan</li>
            <li>Customer receives email with plan details (3-6 month installments)</li>
            <li>One-click acceptance with secure token link</li>
            <li>Automatic monthly charges via Razorpay on due dates</li>
            <li>Plan completion tracked on Dashboard</li>
          </ol>
        </div>

        <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4 border border-blue-100 dark:border-blue-500/20">
          <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-2">Status</p>
          <p className="text-sm text-blue-600 dark:text-blue-400">
            ✓ Payment plans enabled | Expected acceptance rate: 50-60%
          </p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-4 border border-amber-100 dark:border-amber-500/20">
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium mb-2">Installment Configuration</p>
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Installments are calculated by risk tier:
          </p>
          <ul className="text-sm text-amber-600 dark:text-amber-400 mt-2 space-y-1 ml-4">
            <li>• Tier 1 (Low risk): 3 months</li>
            <li>• Tier 2 (Medium risk): 4 months</li>
            <li>• Tier 3 (High risk): 5 months</li>
            <li>• Tier 4 (Critical): 6 months</li>
          </ul>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p className="font-medium text-gray-900 dark:text-white mb-2">Auto-Charge Settings:</p>
          <p className="text-gray-500 dark:text-gray-400 text-xs">Charges are automatically created daily at 09:00 UTC for all due installments. Razorpay payment links are sent to customers via email.</p>
        </div>
      </div>
    </div>
  );
};

// ─── API Costs Section ────────────────────────────────────────────────────────

const ApiCostsSection: React.FC = () => {
  const [costs, setCosts] = useState<{
    resend?: { emails_sent: number; cost: number };
    redis?: { commands: number; cost: number };
    total_cost: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCosts = async () => {
      try {
        const res = await api.get(API_ENDPOINTS.settings.costs);
        setCosts(res.data?.data || null);
      } catch (err) {
        setCosts(null);
      } finally {
        setLoading(false);
      }
    };
    fetchCosts();
    const interval = setInterval(fetchCosts, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">💰 API Usage Costs</h2>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-400">Loading costs...</div>
        </div>
      ) : costs ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {/* Resend Emails */}
            {costs.resend && (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-500/10 dark:to-blue-500/5 rounded-xl p-4 border border-blue-200 dark:border-blue-500/20">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Resend (Emails)</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-2">${costs.resend.cost.toFixed(2)}</p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">{costs.resend.emails_sent} emails</p>
              </div>
            )}

            {/* Redis Commands */}
            {costs.redis && (
              <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-500/10 dark:to-purple-500/5 rounded-xl p-4 border border-purple-200 dark:border-purple-500/20">
                <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Redis (Commands)</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 mt-2">${costs.redis.cost.toFixed(2)}</p>
                <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">{costs.redis.commands.toLocaleString()} cmds</p>
              </div>
            )}

            {/* Total */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-white/[0.08] dark:to-white/[0.02] rounded-xl p-4 border border-gray-700 dark:border-white/[0.1]">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total (30 days)</p>
              <p className="text-2xl font-bold text-white mt-2">${costs.total_cost.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">This month</p>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-6">
            💡 Costs calculated for the last 30 days. Resend: $0.25 per 1000 emails. Redis: Free up to 500K commands/month, then $0.20 per 100K.
          </p>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Unable to fetch cost data. Try refreshing the page.
        </div>
      )}
    </div>
  );
};

export default Settings;
