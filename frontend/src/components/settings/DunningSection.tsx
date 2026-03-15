import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import { API_ENDPOINTS } from '../../lib/constants';
import { useNotification } from '../../hooks/useNotification';
import type { DunningStrategy } from '../../types';

interface DunningSectionProps {
  strategy: DunningStrategy;
  onSaved: () => void;
}

export const DunningSection: React.FC<DunningSectionProps> = ({ strategy, onSaved }) => {
  const { addToast } = useNotification();
  const [form, setForm] = useState({
    num_emails: strategy.num_emails || 5,
    days_between: strategy.days_between || 7,
    approval_required: strategy.approval_required || false,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(API_ENDPOINTS.settings.dunning, form);
      addToast({ type: 'success', message: 'Dunning settings saved' });
      onSaved();
    } catch (err: any) { addToast({ type: 'error', message: err.message || 'Failed to save' }); }
    finally { setSaving(false); }
  };

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Dunning Strategy</h3>
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Number of emails in sequence</label>
          <div className="flex items-center gap-4">
            <input type="range" min="1" max="10" value={form.num_emails}
              onChange={e => setForm({ ...form, num_emails: parseInt(e.target.value) })} className="flex-1 accent-blue-600" />
            <span className="text-lg font-bold text-gray-900 dark:text-white w-8 text-center">{form.num_emails}</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Days between emails</label>
          <input type="number" min="1" max="90" value={form.days_between}
            onChange={e => setForm({ ...form, days_between: parseInt(e.target.value) || 7 })}
            className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Require approval before sending</label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Emails need your review before being sent</p>
          </div>
          <button onClick={() => setForm({ ...form, approval_required: !form.approval_required })}
            className={`relative w-11 h-6 rounded-full transition-colors ${form.approval_required ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.approval_required ? 'translate-x-5' : ''}`} />
          </button>
        </div>
        <Button size="sm" onClick={handleSave} loading={saving}>Save Dunning Settings</Button>
      </div>
    </Card>
  );
};