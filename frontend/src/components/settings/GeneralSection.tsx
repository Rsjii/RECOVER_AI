import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import { API_ENDPOINTS } from '../../lib/constants';
import { useNotification } from '../../hooks/useNotification';

interface GeneralSectionProps {
  timezone: string;
  preferredCurrency: string;
  onSaved: () => void;
}

const timezones = ['UTC','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Europe/London','Europe/Paris','Asia/Tokyo','Asia/Shanghai','Asia/Kolkata','Australia/Sydney'];
const currencies = ['USD','EUR','GBP','CAD','AUD','JPY','INR'];

export const GeneralSection: React.FC<GeneralSectionProps> = ({ timezone, preferredCurrency, onSaved }) => {
  const { addToast } = useNotification();
  const [form, setForm] = useState({ timezone, preferredCurrency });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(API_ENDPOINTS.settings.general, form);
      addToast({ type: 'success', message: 'General settings saved' });
      onSaved();
    } catch (err: any) { addToast({ type: 'error', message: err.message || 'Failed to save' }); }
    finally { setSaving(false); }
  };

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">General Settings</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Timezone</label>
          <select value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.1] rounded-lg bg-white dark:bg-white/[0.06] text-gray-900 dark:text-white text-sm">
            {timezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Preferred Currency</label>
          <select value={form.preferredCurrency} onChange={e => setForm({ ...form, preferredCurrency: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.1] rounded-lg bg-white dark:bg-white/[0.06] text-gray-900 dark:text-white text-sm">
            {currencies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <Button size="sm" onClick={handleSave} loading={saving}>Save General Settings</Button>
      </div>
    </Card>
  );
};