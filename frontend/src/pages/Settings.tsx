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

type SettingsTab = 'account' | 'notifications' | 'integrations' | 'automation' | 'security' | 'billing' | 'general';

const TABS: Array<{ id: SettingsTab; label: string; icon: React.ReactNode; description: string }> = [
  {
    id: 'account',
    label: 'Account',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    description: 'Manage profile and account settings',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
    description: 'Configure how you receive updates',
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    description: 'Connect external services',
  },
  {
    id: 'automation',
    label: 'Automation',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    description: 'Dunning strategy and automation',
  },
  {
    id: 'security',
    label: 'Security',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m7.773-4.3a10 10 0 10-.5.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    description: 'Sessions, API keys, and security',
  },
  {
    id: 'billing',
    label: 'Billing',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .672-3 1.5S10.343 11 12 11s3-.672 3-1.5S13.657 8 12 8z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11.5c0 2.485-3.134 4.5-7 4.5s-7-2.015-7-4.5m14 0V8.5C19 6.015 15.866 4 12 4S5 6.015 5 8.5v7c0 2.485 3.134 4.5 7 4.5s7-2.015 7-4.5v-4z" /></svg>,
    description: 'Plan, usage, and billing info',
  },
  {
    id: 'general',
    label: 'General',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    description: 'Timezone, currency, and preferences',
  },
];

const Settings: React.FC = () => {
  useEffect(() => {
    document.title = 'Settings — RecoverAI';
  }, []);

  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
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
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-64 flex-shrink-0">
        <div className="sticky top-20 space-y-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'w-full flex flex-col gap-1 px-4 py-3 rounded-lg transition-all duration-150 text-left',
                activeTab === tab.id
                  ? 'bg-brand-50 dark:bg-brand-600/[0.12]'
                  : 'hover:bg-gray-50 dark:hover:bg-white/[0.04]'
              )}
            >
              <div className="flex items-center gap-3">
                <span className={cn('text-gray-400 transition-colors', activeTab === tab.id && 'text-brand-600 dark:text-brand-400')}>
                  {tab.icon}
                </span>
                <div className="flex-1">
                  <p className={cn('font-medium text-sm', activeTab === tab.id ? 'text-brand-600 dark:text-brand-400' : 'text-gray-700 dark:text-gray-300')}>
                    {tab.label}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Header */}
        <div className="mb-8 border-b border-gray-200 dark:border-white/[0.06] pb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {TABS.find((t) => t.id === activeTab)?.label}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                {TABS.find((t) => t.id === activeTab)?.description}
              </p>
            </div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="space-y-6 max-w-2xl">
          {/* Account Tab */}
          {activeTab === 'account' && (
            <>
              <ProfileSection onUpdated={fetch} />
              <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Company Info</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name</label>
                    <p className="text-gray-900 dark:text-white font-medium">{settings.companyName || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Plan Type</label>
                    <p className="text-gray-900 dark:text-white font-medium">Starter / Growth / Enterprise</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <>
              <NotificationsSection slackConnected={settings.integrations.slack} onUpdated={fetch} />
              <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notification Frequency</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.02] cursor-pointer">
                    <input type="radio" name="frequency" className="accent-brand-600" defaultChecked />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Instant</p>
                      <p className="text-xs text-gray-500">Get notified immediately</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.02] cursor-pointer">
                    <input type="radio" name="frequency" className="accent-brand-600" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Daily Digest</p>
                      <p className="text-xs text-gray-500">Daily summary at 9 AM</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.02] cursor-pointer">
                    <input type="radio" name="frequency" className="accent-brand-600" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Weekly Digest</p>
                      <p className="text-xs text-gray-500">Weekly summary every Monday</p>
                    </div>
                  </label>
                </div>
              </div>
            </>
          )}

          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <IntegrationSection
              stripeConnected={settings.integrations.stripe}
              stripeLastSyncedAt={(settings.integrations as any).stripeLastSyncedAt || null}
              slackConnected={settings.integrations.slack}
              quickbooksConnected={!!(settings.integrations as any).quickbooks}
              chargebeeConnected={!!(settings.integrations as any).chargebee}
              onRefresh={fetch}
            />
          )}

          {/* Automation Tab */}
          {activeTab === 'automation' && (
            <>
              <DunningSection
                strategy={settings.dunningStrategy || { num_emails: 5, days_between: 7, approval_required: false }}
                onSaved={fetch}
              />
              <SlackSection connected={settings.integrations.slack} onSaved={fetch} />
              <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Email Templates</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  Customize the email templates sent during dunning campaigns. Email templates feature coming soon.
                </p>
                <button className="text-sm text-brand-600 hover:text-brand-700 dark:hover:text-brand-400 font-medium">
                  Edit templates →
                </button>
              </div>
            </>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <>
              <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Sessions</h2>
                  <button
                    type="button"
                    className="text-sm text-red-600 hover:text-red-700 dark:hover:text-red-400 font-medium disabled:opacity-50"
                    disabled={sessionLoading}
                    onClick={revokeAllSessions}
                  >
                    Revoke all
                  </button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {sessions.length === 0 ? 'No active sessions.' : `You have ${sessions.length} active session${sessions.length !== 1 ? 's' : ''}.`}
                </p>
                {sessions.length > 0 && (
                  <div className="space-y-2">
                    {sessions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.05]">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{s.user_agent || 'Unknown device'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{s.ip_address || 'Unknown IP'}</div>
                        </div>
                        <button
                          type="button"
                          className="text-sm text-red-600 hover:text-red-700 dark:hover:text-red-400 font-medium disabled:opacity-50"
                          disabled={sessionLoading}
                          onClick={() => revokeSession(s.id)}
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">API Keys</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Manage API keys for programmatic access to RecoverAI. API key management coming soon.
                </p>
                <button className="text-sm text-brand-600 hover:text-brand-700 dark:hover:text-brand-400 font-medium">
                  Create API key →
                </button>
              </div>
              <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Webhooks</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Set up webhooks to receive real-time events about payments and recovery. Webhooks coming soon.
                </p>
                <button className="text-sm text-brand-600 hover:text-brand-700 dark:hover:text-brand-400 font-medium">
                  Configure webhooks →
                </button>
              </div>
            </>
          )}

          {/* Billing Tab */}
          {activeTab === 'billing' && (
            <>
              <div className="bg-brand-50 dark:bg-brand-600/[0.08] border border-brand-200 dark:border-brand-500/[0.2] rounded-xl p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-brand-900 dark:text-brand-100 mb-2">Current Plan</h3>
                    <p className="text-sm text-brand-800 dark:text-brand-200">Growth • $999/month + 0.75% recovery fee</p>
                  </div>
                  <span className="px-3 py-1 bg-brand-600 text-white text-xs font-medium rounded-full">Active</span>
                </div>
              </div>
              <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Usage This Month</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Emails Sent</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">1,234</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Recovered</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">$12.5k</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Recovery Rate</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">23%</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Billing History</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Invoices and billing history coming soon.</p>
              </div>
            </>
          )}

          {/* General Tab */}
          {activeTab === 'general' && (
            <>
              <GeneralSection
                timezone={settings.timezone}
                preferredCurrency={settings.preferredCurrency}
                onSaved={fetch}
              />
              <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Data & Privacy</h3>
                <div className="space-y-3">
                  <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <p className="font-medium text-gray-900 dark:text-white">Export Data</p>
                    <p className="text-xs text-gray-500 mt-0.5">Download all your data as CSV</p>
                  </button>
                  <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <p className="font-medium text-gray-900 dark:text-white">GDPR Request</p>
                    <p className="text-xs text-gray-500 mt-0.5">Submit a data access or deletion request</p>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Settings;
