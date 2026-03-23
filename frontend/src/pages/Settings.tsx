import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { Spinner } from '../components/ui/Spinner';
import { ProfileSection } from '../components/settings/ProfileSection';
import { NotificationsSection } from '../components/settings/NotificationsSection';
import { IntegrationSection } from '../components/settings/IntegrationSection';
import { DunningSection } from '../components/settings/DunningSection';
import { SlackSection } from '../components/settings/SlackSection';
import { GeneralSection } from '../components/settings/GeneralSection';
import { cn } from '../lib/utils';
import type { CompanySettings } from '../types';

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
  useEffect(() => {
    document.title = 'Settings — RecoverAI';
  }, []);

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);

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
    } catch {
      /* handled by global interceptor */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" text="Loading settings..." /></div>;
  if (!settings) return <p className="text-red-500 text-center py-20">Failed to load settings</p>;

  const revokeSession = async (sessionId: string) => {
    setSessionLoading(true);
    try {
      try {
        await api.delete(API_ENDPOINTS.auth.revokeCompanySession(sessionId));
      } catch {
        await api.delete(API_ENDPOINTS.auth.revokeSession(sessionId));
      }
      await fetch();
    } finally {
      setSessionLoading(false);
    }
  };

  const revokeAllSessions = async () => {
    setSessionLoading(true);
    try {
      await api.post(API_ENDPOINTS.auth.revokeAllSessions);
      await fetch();
    } finally {
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
            </div>
          )}

          {/* Automation Tab */}
          {activeTab === 'automation' && (
            <div className="space-y-8">
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
                    {sessions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-5 rounded-xl border border-gray-200 dark:border-white/[0.06] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <span className="text-lg">💻</span>
                            {s.user_agent || 'Unknown device'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.ip_address || 'Unknown IP'}</p>
                        </div>
                        <button
                          onClick={() => revokeSession(s.id)}
                          disabled={sessionLoading}
                          className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-semibold disabled:opacity-50 transition-colors"
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
    </div>
  );
};

export default Settings;
