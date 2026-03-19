import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import { API_ENDPOINTS } from '../../lib/constants';
import { useNotification } from '../../hooks/useNotification';

interface SlackSectionProps {
  connected: boolean;
  onSaved: () => void;
}

export const SlackSection: React.FC<SlackSectionProps> = ({ connected, onSaved }) => {
  const { addToast } = useNotification();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!webhookUrl.trim()) { addToast({ type: 'error', message: 'Enter a Slack webhook URL' }); return; }
    setSaving(true);
    try {
      await api.put(API_ENDPOINTS.settings.slack, { webhookUrl });
      addToast({ type: 'success', message: 'Slack webhook saved' });
      setWebhookUrl('');
      onSaved();
    } catch (err: any) { addToast({ type: 'error', message: err.message || 'Failed to save' }); }
    finally { setSaving(false); }
  };

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Slack Notifications</h3>
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">Get daily digest and real-time payment alerts in your Slack channel.</p>
        {connected && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <p className="text-sm text-green-700 dark:text-green-300">✓ Slack webhook is configured. Daily digests will be sent at 8 AM UTC.</p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{connected ? 'Update webhook URL' : 'Webhook URL'}</label>
          <input type="url" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.1] rounded-lg bg-white dark:bg-white/[0.06] text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none" />
          <p className="text-xs text-gray-500 mt-1">Create an Incoming Webhook at api.slack.com/apps</p>
        </div>
        <Button size="sm" onClick={handleSave} loading={saving}>{connected ? 'Update Webhook' : 'Save Webhook'}</Button>
      </div>
    </Card>
  );
};