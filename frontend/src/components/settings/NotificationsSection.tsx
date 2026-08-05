import React, { useState, useEffect } from 'react';
import { useNotification } from '../../hooks/useNotification';
import { api } from '../../lib/api';

interface NotificationPrefs {
  // P1 User-Customizable Notification Preferences
  notify_contact_invalid: boolean;       // Email hard bounce or SMS hard fail
  notify_payment_received: boolean;
  notify_emails_pending: boolean;
  // System alerts & trial ending are ALWAYS ON (not customizable)
}

export const NotificationsSection: React.FC = () => {
  const { addToast } = useNotification();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testingNotification, setTestingNotification] = useState(false);

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

  const handleTestNotification = async () => {
    setTestingNotification(true);
    try {
      await api.post('/api/notifications/test');
      addToast({ type: 'success', message: 'Test notification sent! Check the bell icon.' });
    } catch (err: any) {
      console.error('Failed to send test notification:', err);
      addToast({ type: 'error', message: 'Failed to send test notification' });
    } finally {
      setTestingNotification(false);
    }
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

      {/* Contact Info Issues (Email + SMS) */}
      <div className="border border-gray-200 dark:border-white/[0.08] rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">📧📱 Invalid Contact Info</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Notify when email bounces or SMS fails due to invalid address/phone number (requires contact update)
            </p>
          </div>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.notify_contact_invalid}
              onChange={() => handleToggle('notify_contact_invalid')}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Payment Received */}
      <div className="border border-gray-200 dark:border-white/[0.08] rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">💰 Payment Received</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Notify when a customer payment is detected (good news!)
            </p>
          </div>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.notify_payment_received}
              onChange={() => handleToggle('notify_payment_received')}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Emails Pending Approval */}
      <div className="border border-gray-200 dark:border-white/[0.08] rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">✉️ Emails Waiting for Approval</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Notify when emails are queued for your approval (Shadow mode)
            </p>
          </div>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.notify_emails_pending}
              onChange={() => handleToggle('notify_emails_pending')}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 cursor-pointer"
            />
          </label>
        </div>
      </div>


      {/* Save Button */}
      <div className="flex justify-between items-center">
        <button
          onClick={handleTestNotification}
          disabled={testingNotification}
          className="px-4 py-2.5 bg-gray-200 dark:bg-white/[0.08] hover:bg-gray-300 dark:hover:bg-white/[0.12] text-gray-900 dark:text-gray-300 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testingNotification ? 'Sending...' : '📬 Send Test Notification'}
        </button>
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
