import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from '../../config/axios';
import { Loader2 } from 'lucide-react';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney',
];

interface Props {
  onNext: () => void;
}

export default function Step4Configure({ onNext }: Props) {
  const [form, setForm] = useState({
    delivery_time: '08:00',
    delivery_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    slack_webhook_url: '',
    slack_enabled: true,
    email_enabled: false,
    stale_pr_days: 3,
    sprint_risk_threshold: 40,
    silent_engineer_days: 3,
  });

  const save = useMutation({
    mutationFn: () => axios.post('/api/onboarding/configure', form),
    onSuccess: onNext,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white text-lg font-semibold">Configure Your Brief</h2>
        <p className="text-slate-500 text-sm mt-1">Set when and how you want to receive your daily engineering brief.</p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Daily delivery time</label>
            <input
              type="time"
              value={form.delivery_time}
              onChange={e => setForm(f => ({ ...f, delivery_time: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Timezone</label>
            <select
              value={form.delivery_timezone}
              onChange={e => setForm(f => ({ ...f, delivery_timezone: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1.5">
            Slack webhook URL <span className="text-slate-600">(optional — get from Slack Apps)</span>
          </label>
          <input
            type="url"
            placeholder="https://hooks.slack.com/services/..."
            value={form.slack_webhook_url}
            onChange={e => setForm(f => ({ ...f, slack_webhook_url: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 text-sm placeholder:text-slate-600"
          />
        </div>

        <div className="border-t border-slate-800 pt-4">
          <p className="text-xs text-slate-400 font-medium mb-3 uppercase tracking-widest">Pattern Thresholds</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Stale PR (days)</label>
              <input
                type="number" min={1} max={14}
                value={form.stale_pr_days}
                onChange={e => setForm(f => ({ ...f, stale_pr_days: +e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Sprint risk (%)</label>
              <input
                type="number" min={10} max={90}
                value={form.sprint_risk_threshold}
                onChange={e => setForm(f => ({ ...f, sprint_risk_threshold: +e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Silent eng. (days)</label>
              <input
                type="number" min={1} max={14}
                value={form.silent_engineer_days}
                onChange={e => setForm(f => ({ ...f, silent_engineer_days: +e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-200 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium"
      >
        {save.isPending && <Loader2 size={14} className="animate-spin" />}
        Save & Continue →
      </button>
    </div>
  );
}
