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
              onChange={e => setForm({ ...form, num_emails: parseInt(e.target.value) })} className="flex-1 accent-brand-600" />
            <span className="text-lg font-bold text-gray-900 dark:text-white w-8 text-center">{form.num_emails}</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Days between emails</label>
          <input type="number" min="1" max="90" value={form.days_between}
            onChange={e => setForm({ ...form, days_between: parseInt(e.target.value) || 7 })}
            className="w-24 px-3 py-2 border border-gray-300 dark:border-white/[0.1] rounded-lg bg-white dark:bg-[#18181b] text-gray-900 dark:text-white text-sm" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Require approval before sending</label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Emails need your review before being sent</p>
          </div>
          <button onClick={() => setForm({ ...form, approval_required: !form.approval_required })}
            className={`relative w-11 h-6 rounded-full transition-colors ${form.approval_required ? 'bg-brand-600' : 'bg-gray-300 dark:bg-white/[0.12]'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.approval_required ? 'translate-x-5' : ''}`} />
          </button>
        </div>
        <Button size="sm" onClick={handleSave} loading={saving}>Save Dunning Settings</Button>
      </div>

      {/* Visual dunning pipeline */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-white/[0.06]">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Dunning Journey Preview</h4>
        <div className="flex flex-col items-start gap-0">
          {[
            { stage: 1, name: 'Friendly Reminder', day: 1 },
            { stage: 2, name: 'Second Follow-up', day: 1 + form.days_between },
            { stage: 3, name: 'Urgency Notice', day: 1 + form.days_between * 2 },
            { stage: 4, name: 'Escalation', day: 1 + form.days_between * 3 },
            { stage: 5, name: 'Account Action', day: 1 + form.days_between * 4 },
          ].slice(0, Math.min(form.num_emails, 5)).map((s, idx, arr) => (
            <div key={s.stage} className="flex flex-col items-start w-full">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {s.stage}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Day {s.day} overdue</p>
                </div>
              </div>
              {idx < arr.length - 1 && (
                <div className="flex items-center gap-3 my-1 ml-4">
                  <div className="w-px h-6 bg-gray-300 dark:bg-white/[0.12]" />
                  <span className="text-xs text-gray-400 dark:text-gray-500 -ml-2.5 pl-3">{form.days_between} days later</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};