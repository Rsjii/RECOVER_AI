import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { Spinner } from '../components/ui/Spinner';
import { Modal } from '../components/ui/Modal';
import { ProfileSection } from '../components/settings/ProfileSection';
import { NotificationsSection } from '../components/settings/NotificationsSection';
import { IntegrationSection } from '../components/settings/IntegrationSection';
import { cn } from '../lib/utils';
import type { CompanySettings } from '../types';

type SettingsTab = 'profile' | 'integrations' | 'security';

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
    id: 'security',
    label: 'Security & Account',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  },
];

const SettingsTrial: React.FC = () => {
  useEffect(() => {
    document.title = 'Settings — CashOS';
  }, []);

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

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

  const revokeSession = async (sessionId: string, isCurrentSession = false) => {
    setSessionLoading(true);
    setConfirmRevokeId(null);
    try {
      await api.delete(API_ENDPOINTS.auth.revokeSession(sessionId));
      if (isCurrentSession) {
        setTimeout(() => {
          window.location.href = '/login';
        }, 800);
      } else {
        await fetch();
      }
    } finally {
      if (!isCurrentSession) setSessionLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" text="Loading settings..." /></div>;
  if (!settings) return <p className="text-red-500 text-center py-20">Failed to load settings</p>;

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
          {/* === PROFILE TAB === */}
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
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">Trial</p>
                      <span className="text-xs bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full font-medium">Active</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* === INTEGRATIONS TAB === */}
          {activeTab === 'integrations' && (
            <div className="space-y-8">
              <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Connected Services</h2>
                  <span className="text-xs bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full font-medium">
                    🔒 Read-Only
                  </span>
                </div>

                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>Stripe is connected.</strong> During trial, view connected services. Upgrade to manage QB, Slack, and Twilio integrations.
                  </p>
                </div>

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

          {/* === SECURITY & ACCOUNT TAB === */}
          {activeTab === 'security' && (
            <div className="space-y-8">
              {/* Email Notifications */}
              <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Email Notifications</h2>
                <NotificationsSection slackConnected={settings.integrations.slack} onUpdated={fetch} />
              </div>

              {/* Active Sessions */}
              <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Active Sessions</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Logout from other devices</p>
                  </div>
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

              {/* Data & Privacy */}
              <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Data & Privacy</h2>
                <div className="space-y-3">
                  <button className="w-full text-left px-5 py-4 rounded-xl border border-gray-200 dark:border-white/[0.06] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                    <p className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">📊 Export Your Data</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Download all your company data as CSV</p>
                  </button>
                  <button className="w-full text-left px-5 py-4 rounded-xl border border-gray-200 dark:border-white/[0.06] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                    <p className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">⚖️ GDPR Data Request</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Submit a data access or deletion request</p>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Revoke Modal */}
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
            This action cannot be undone. You'll need to log in again.
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

export default SettingsTrial;
