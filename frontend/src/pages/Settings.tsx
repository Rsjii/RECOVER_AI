import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { Spinner } from '../components/ui/Spinner';
import { IntegrationSection } from '../components/settings/IntegrationSection';
import { DunningSection } from '../components/settings/DunningSection';
import { SlackSection } from '../components/settings/SlackSection';
import { GeneralSection } from '../components/settings/GeneralSection';
import type { CompanySettings } from '../types';

const Settings: React.FC = () => {
  useEffect(() => {
    document.title = 'Settings — RecoverAI';
  }, []);
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
    } catch { /* handled by global interceptor */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

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
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
      <IntegrationSection
      stripeConnected={settings.integrations.stripe}
      stripeLastSyncedAt={(settings.integrations as any).stripeLastSyncedAt || null}
      slackConnected={settings.integrations.slack}
      quickbooksConnected={!!(settings.integrations as any).quickbooks}
      chargebeeConnected={!!(settings.integrations as any).chargebee}
      onRefresh={fetch} />
      <DunningSection strategy={settings.dunningStrategy || { num_emails: 5, days_between: 7, approval_required: false }} onSaved={fetch} />
      <SlackSection connected={settings.integrations.slack} onSaved={fetch} />
      <GeneralSection timezone={settings.timezone} preferredCurrency={settings.preferredCurrency} onSaved={fetch} />
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Sessions</h2>
          <button
            type="button"
            className="text-sm text-red-600 hover:underline disabled:opacity-50"
            disabled={sessionLoading}
            onClick={revokeAllSessions}
          >
            Revoke all
          </button>
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No active sessions.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-900 p-2 rounded">
                <div>
                  <div className="text-gray-700 dark:text-gray-200">{s.user_agent || 'Unknown device'}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{s.ip_address || 'Unknown IP'}</div>
                </div>
                <button
                  type="button"
                  className="text-red-600 hover:underline disabled:opacity-50"
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
    </div>
  );
};

export default Settings;