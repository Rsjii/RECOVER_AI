import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { useNotification } from '../../hooks/useNotification';

interface NotificationPreferences {
  email_payment_received?: boolean;
  email_invoice_overdue?: boolean;
  email_agent_action?: boolean;
  email_weekly_summary?: boolean;
  slack_payment_received?: boolean;
  slack_invoice_overdue?: boolean;
  slack_agent_action?: boolean;
}

interface NotificationsSectionProps {
  slackConnected?: boolean;
  onUpdated?: () => void;
}

export const NotificationsSection: React.FC<NotificationsSectionProps> = ({ slackConnected = false, onUpdated }) => {
  const { addToast } = useNotification();
  const [loading, setLoading] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    email_payment_received: true,
    email_invoice_overdue: true,
    email_agent_action: true,
    email_weekly_summary: false,
    slack_payment_received: false,
    slack_invoice_overdue: false,
    slack_agent_action: false,
  });

  useEffect(() => {
    // Load from localStorage or API in future
    const stored = localStorage.getItem('notificationPrefs');
    if (stored) {
      try {
        setPrefs(JSON.parse(stored));
      } catch {}
    }
  }, []);

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Save to API endpoint (will be added to backend)
      localStorage.setItem('notificationPrefs', JSON.stringify(prefs));
      addToast({ type: 'success', message: 'Notification preferences saved' });
      onUpdated?.();
    } catch (err: any) {
      addToast({ type: 'error', message: 'Failed to save preferences' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Choose how you want to receive updates</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Email Notifications */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Email notifications</h3>
          <div className="space-y-3">
            {[
              { key: 'email_payment_received', label: 'Payment received', desc: 'When a customer pays an invoice' },
              { key: 'email_invoice_overdue', label: 'Invoice overdue alert', desc: 'When invoices reach overdue thresholds' },
              { key: 'email_agent_action', label: 'Agent actions', desc: 'When RecoverAI sends emails or offers payment plans' },
              { key: 'email_weekly_summary', label: 'Weekly summary', desc: 'Every Monday at 9am with recovery stats' },
            ].map(({ key, label, desc }) => (
              <label key={key} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs[key as keyof NotificationPreferences] || false}
                  onChange={() => handleToggle(key as keyof NotificationPreferences)}
                  className="w-5 h-5 mt-0.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Slack Notifications */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Slack notifications</h3>
            {!slackConnected && (
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/[0.06] px-2 py-1 rounded">
                Configure Slack integration first
              </span>
            )}
          </div>
          <div className="space-y-3 opacity-50 pointer-events-none" style={{ opacity: slackConnected ? 1 : 0.5, pointerEvents: slackConnected ? 'auto' : 'none' }}>
            {[
              { key: 'slack_payment_received', label: 'Payment received', desc: 'Slack notification when a customer pays' },
              { key: 'slack_invoice_overdue', label: 'Invoice overdue alert', desc: 'Slack notification for overdue invoices' },
              { key: 'slack_agent_action', label: 'Agent actions', desc: 'Slack notification when RecoverAI takes action' },
            ].map(({ key, label, desc }) => (
              <label key={key} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs[key as keyof NotificationPreferences] || false}
                  onChange={() => handleToggle(key as keyof NotificationPreferences)}
                  disabled={!slackConnected}
                  className="w-5 h-5 mt-0.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="pt-4">
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
            loading={loading}
          >
            Save preferences
          </Button>
        </div>
      </form>
    </div>
  );
};
