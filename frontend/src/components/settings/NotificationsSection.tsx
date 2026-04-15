import React, { useState, useEffect } from 'react';
import { useNotification } from '../../hooks/useNotification';
import { api } from '../../lib/api';

interface NotificationPrefs {
  id: string;
  company_id: string;
  system_alerts: boolean;
  daily_actions: boolean;
  daily_actions_email: boolean;
  daily_actions_time: string;
  agent_activity: boolean;
  agent_activity_email: boolean;
  payment_received: boolean;
  payment_received_email: boolean;
  weekly_digest: boolean;
  weekly_digest_day: string;
  weekly_digest_time: string;
  monthly_report: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  created_at: string;
  updated_at: string;
}

export const NotificationsSection: React.FC = () => {
  const { addToast } = useNotification();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setLoading(true);
        const response = await api.get('/api/settings/notifications');
        setPrefs(response.data);
      } catch (err: any) {
        console.error('Failed to load preferences:', err);
        addToast({ type: 'error', message: 'Failed to load preferences' });
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [addToast]);

  const handleSave = async () => {
    if (!prefs) return;

    setSaving(true);
    try {
      const response = await api.patch('/api/settings/notifications', prefs);
      setPrefs(response.data);
      addToast({ type: 'success', message: 'Notification preferences saved!' });
    } catch (err: any) {
      console.error('Failed to save preferences:', err);
      addToast({ type: 'error', message: 'Failed to save preferences' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof NotificationPrefs) => {
    if (!prefs) return;
    setPrefs(prev => prev ? { ...prev, [key]: !prev[key] } : null);
  };

  const handleChange = (key: keyof NotificationPrefs, value: string) => {
    if (!prefs) return;
    setPrefs(prev => prev ? { ...prev, [key]: value } : null);
  };

  if (loading || !prefs) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-white/[0.08] rounded w-1/3" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-white/[0.08] rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Notification Preferences
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Control what notifications you receive and how often
        </p>
      </div>

      {/* System Alerts */}
      <div className="border border-gray-200 dark:border-white/[0.08] rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">System Alerts</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Critical alerts (Stripe, Email, Trial). <span className="text-red-600 dark:text-red-400">Cannot disable</span>
            </p>
          </div>
          <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
            Always On
          </span>
        </div>
      </div>

      {/* Daily Actions */}
      <div className="border border-gray-200 dark:border-white/[0.08] rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">Daily Actions</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Get your recommended "Your Turn" actions daily
            </p>
          </div>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.daily_actions}
              onChange={() => handleToggle('daily_actions')}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 cursor-pointer"
            />
          </label>
        </div>

        {prefs.daily_actions && (
          <div className="space-y-4 mt-4 pt-4 border-t border-gray-200 dark:border-white/[0.06]">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.daily_actions_email}
                onChange={() => handleToggle('daily_actions_email')}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 cursor-pointer"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Send email daily at</span>
              {prefs.daily_actions_email && (
                <input
                  type="time"
                  value={prefs.daily_actions_time}
                  onChange={(e) => handleChange('daily_actions_time', e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 dark:border-white/[0.12] rounded-lg bg-white dark:bg-white/[0.05] text-sm text-gray-900 dark:text-white"
                />
              )}
            </label>
          </div>
        )}
      </div>

      {/* Agent Activity */}
      <div className="border border-gray-200 dark:border-white/[0.08] rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">Agent Activity</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Emails sent, payments received, dunning changes
            </p>
          </div>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.agent_activity}
              onChange={() => handleToggle('agent_activity')}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 cursor-pointer"
            />
          </label>
        </div>

        {prefs.agent_activity && (
          <div className="space-y-3 mt-4 pt-4 border-t border-gray-200 dark:border-white/[0.06]">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.agent_activity_email}
                onChange={() => handleToggle('agent_activity_email')}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 cursor-pointer"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Email when agent sends dunning</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.payment_received_email}
                onChange={() => handleToggle('payment_received_email')}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 cursor-pointer"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Email when payment received</span>
            </label>
          </div>
        )}
      </div>

      {/* Weekly & Monthly */}
      <div className="border border-gray-200 dark:border-white/[0.08] rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">Weekly & Monthly Insights</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Recovery summary, DSO trend, metrics
            </p>
          </div>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.weekly_digest}
              onChange={() => handleToggle('weekly_digest')}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 cursor-pointer"
            />
          </label>
        </div>

        {prefs.weekly_digest && (
          <div className="space-y-4 mt-4 pt-4 border-t border-gray-200 dark:border-white/[0.06]">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700 dark:text-gray-300">Weekly summary every</label>
              <select
                value={prefs.weekly_digest_day}
                onChange={(e) => handleChange('weekly_digest_day', e.target.value)}
                className="px-3 py-1.5 border border-gray-300 dark:border-white/[0.12] rounded-lg bg-white dark:bg-white/[0.05] text-sm text-gray-900 dark:text-white"
              >
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
                  <option key={day}>{day}</option>
                ))}
              </select>
              <label className="text-sm text-gray-700 dark:text-gray-300">at</label>
              <input
                type="time"
                value={prefs.weekly_digest_time}
                onChange={(e) => handleChange('weekly_digest_time', e.target.value)}
                className="px-3 py-1.5 border border-gray-300 dark:border-white/[0.12] rounded-lg bg-white dark:bg-white/[0.05] text-sm text-gray-900 dark:text-white"
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.monthly_report}
                onChange={() => handleToggle('monthly_report')}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 cursor-pointer"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Monthly deep-dive report (1st Monday)</span>
            </label>
          </div>
        )}
      </div>

      {/* Quiet Hours */}
      <div className="border border-gray-200 dark:border-white/[0.08] rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">Quiet Hours</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Don't send emails during these hours
            </p>
          </div>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.quiet_hours_enabled}
              onChange={() => handleToggle('quiet_hours_enabled')}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 cursor-pointer"
            />
          </label>
        </div>

        {prefs.quiet_hours_enabled && (
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-white/[0.06]">
            <label className="text-sm text-gray-700 dark:text-gray-300">Don't email between</label>
            <input
              type="time"
              value={prefs.quiet_hours_start}
              onChange={(e) => handleChange('quiet_hours_start', e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-white/[0.12] rounded-lg bg-white dark:bg-white/[0.05] text-sm text-gray-900 dark:text-white"
            />
            <label className="text-sm text-gray-700 dark:text-gray-300">and</label>
            <input
              type="time"
              value={prefs.quiet_hours_end}
              onChange={(e) => handleChange('quiet_hours_end', e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-white/[0.12] rounded-lg bg-white dark:bg-white/[0.05] text-sm text-gray-900 dark:text-white"
            />
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
};
