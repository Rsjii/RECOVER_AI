// EngineeringOS Phase 1.5 — Settings Page
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../config/axios';
import {
  CheckCircle, XCircle, Loader2, Send, Settings as SettingsIcon,
  Github, AlertTriangle, Copy,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

type Tab = 'brief' | 'slack' | 'jira' | 'github' | 'team-mapping';

interface BriefConfig {
  delivery_time: string;
  delivery_timezone: string;
  slack_enabled: boolean;
  email_enabled: boolean;
  stale_pr_days: number;
  sprint_risk_threshold: number;
  silent_engineer_days: number;
  weekly_report_enabled: boolean;
  weekly_report_day: string;
  weekly_report_time: string;
}

interface Mapping {
  id: string;
  github_login: string;
  jira_display_name: string | null;
  jira_account_id: string | null;
  is_confirmed: boolean;
}

interface SlackStatus { connected: boolean; channel_name: string | null }
interface JiraStatus  { connected: boolean; site_url: string | null }

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney',
];

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-800 bg-slate-900/40 p-5 ${className}`}>{children}</div>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-400 mb-1.5">{children}</label>;
}

function TextInput({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition ${className}`}
    />
  );
}

function SelectInput({ className = '', children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition ${className}`}
    >
      {children}
    </select>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-700'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </button>
  );
}

// ── GitHub Tab ────────────────────────────────────────────────────────────────
function GithubTab() {
  const { data } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: () => axios.get('/api/onboarding/status').then(r => r.data),
  });
  const connected = !!data?.step_github;
  return (
    <div className="space-y-4">
      <h2 className="text-slate-200 font-semibold">GitHub Connection</h2>
      <SectionCard>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
              <Github size={18} className="text-slate-300" />
            </div>
            <div>
              <p className="text-slate-200 text-sm font-semibold">GitHub App</p>
              <p className="text-slate-500 text-xs">{connected ? 'Connected · monitoring repositories' : 'Not connected'}</p>
            </div>
          </div>
          {connected ? <CheckCircle size={18} className="text-emerald-400" /> : <XCircle size={18} className="text-slate-600" />}
        </div>
      </SectionCard>
    </div>
  );
}

// ── Jira Tab ─────────────────────────────────────────────────────────────────
function JiraTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const { data: status } = useQuery<JiraStatus>({
    queryKey: ['jira-status'],
    queryFn: () => axios.get('/api/jira/status').then(r => r.data),
  });
  const disconnect = useMutation({
    mutationFn: () => axios.delete('/api/jira/disconnect'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jira-status'] }),
  });

  const webhookUrl = user?.org_id ? `${API_URL}/webhooks/jira?org=${user.org_id}` : null;
  const copyWebhookUrl = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-slate-200 font-semibold">Jira Connection</h2>
      <SectionCard>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/15 border border-blue-500/20 flex items-center justify-center text-base">🔵</div>
            <div>
              <p className="text-slate-200 text-sm font-semibold">Atlassian Jira</p>
              <p className="text-slate-500 text-xs">{status?.connected ? status.site_url || 'Connected' : 'Not connected'}</p>
            </div>
          </div>
          {status?.connected ? <CheckCircle size={18} className="text-emerald-400" /> : <XCircle size={18} className="text-slate-600" />}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-800/60">
          {status?.connected ? (
            <button
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
            >
              {disconnect.isPending && <Loader2 size={11} className="animate-spin" />}
              Disconnect
            </button>
          ) : (
            <a
              href={`${API_URL}/api/jira/connect`}
              className="inline-flex items-center gap-2 text-xs px-4 py-2 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 border border-blue-500/25 font-semibold transition-colors"
            >
              Connect Jira →
            </a>
          )}
        </div>
      </SectionCard>

      {status?.connected && webhookUrl && (
        <SectionCard>
          <p className="text-slate-200 text-sm font-semibold mb-1">Jira Webhook URL</p>
          <p className="text-slate-500 text-xs mb-3">
            Register this in Jira: <span className="text-slate-400">Settings → System → Webhooks → Create</span>
            <br />Events: Issue Created, Issue Updated, Sprint Started, Sprint Closed
          </p>
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
            <code className="text-xs text-blue-300 flex-1 truncate font-mono">{webhookUrl}</code>
            <button
              onClick={copyWebhookUrl}
              className="shrink-0 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Copy size={12} />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── Brief Config Tab ──────────────────────────────────────────────────────────
function BriefConfigTab() {
  const qc = useQueryClient();
  const { data: cfg } = useQuery<BriefConfig>({
    queryKey: ['brief-config'],
    queryFn: () => axios.get('/api/onboarding/config').then(r => r.data),
  });

  const [form, setForm] = useState<Partial<BriefConfig>>({});
  const effective: BriefConfig = {
    delivery_time: '08:00', delivery_timezone: 'UTC',
    slack_enabled: true, email_enabled: false,
    stale_pr_days: 3, sprint_risk_threshold: 40, silent_engineer_days: 3,
    weekly_report_enabled: true, weekly_report_day: 'friday', weekly_report_time: '17:00',
    ...cfg, ...form,
  };

  const save = useMutation({
    mutationFn: () => axios.post('/api/onboarding/configure', effective),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['brief-config'] }); setForm({}); },
  });

  const set = (k: keyof BriefConfig, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <h2 className="text-slate-200 font-semibold">Brief Configuration</h2>
      <SectionCard className="space-y-6">
        {/* Delivery schedule */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Delivery Schedule</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Delivery Time</FieldLabel>
              <TextInput type="time" value={effective.delivery_time} onChange={e => set('delivery_time', e.target.value)} />
              <p className="text-slate-600 text-[11px] mt-1">Time in your timezone below</p>
            </div>
            <div>
              <FieldLabel>Timezone</FieldLabel>
              <SelectInput value={effective.delivery_timezone} onChange={e => set('delivery_timezone', e.target.value)}>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
              </SelectInput>
            </div>
          </div>
        </div>

        {/* Thresholds */}
        <div className="border-t border-slate-800/60 pt-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Detection Thresholds</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Stale PR (days)</FieldLabel>
              <TextInput type="number" min={1} max={14} value={effective.stale_pr_days} onChange={e => set('stale_pr_days', +e.target.value)} />
              <p className="text-slate-600 text-[11px] mt-1">PRs open longer = alert</p>
            </div>
            <div>
              <FieldLabel>Sprint risk (%)</FieldLabel>
              <TextInput type="number" min={10} max={90} value={effective.sprint_risk_threshold} onChange={e => set('sprint_risk_threshold', +e.target.value)} />
              <p className="text-slate-600 text-[11px] mt-1">% incomplete at sprint end</p>
            </div>
            <div>
              <FieldLabel>Silent engineer (days)</FieldLabel>
              <TextInput type="number" min={1} max={14} value={effective.silent_engineer_days} onChange={e => set('silent_engineer_days', +e.target.value)} />
              <p className="text-slate-600 text-[11px] mt-1">Days without commits</p>
            </div>
          </div>
        </div>

        {/* Delivery channels */}
        <div className="border-t border-slate-800/60 pt-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Delivery Channels</p>
          <div className="space-y-3">
            {[
              { key: 'slack_enabled' as const,  label: 'Slack',  desc: 'Send brief to Slack channel' },
              { key: 'email_enabled' as const, label: 'Email',  desc: 'Send brief to your email' },
            ].map(ch => (
              <label key={ch.key} className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-slate-300 text-sm font-medium">{ch.label}</p>
                  <p className="text-slate-600 text-xs">{ch.desc}</p>
                </div>
                <Toggle checked={!!effective[ch.key]} onChange={v => set(ch.key, v)} />
              </label>
            ))}
          </div>
        </div>


        {/* Weekly report */}
        <div className="border-t border-slate-800/60 pt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Weekly Health Report</p>
            <Toggle checked={!!effective.weekly_report_enabled} onChange={v => set('weekly_report_enabled', v)} />
          </div>
          {effective.weekly_report_enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Delivery Day</FieldLabel>
                <SelectInput value={effective.weekly_report_day} onChange={e => set('weekly_report_day', e.target.value)}>
                  {['monday','tuesday','wednesday','thursday','friday'].map(d => (
                    <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                  ))}
                </SelectInput>
                <p className="text-slate-600 text-[11px] mt-1">Day to send weekly report</p>
              </div>
              <div>
                <FieldLabel>Delivery Time</FieldLabel>
                <TextInput type="time" value={effective.weekly_report_time} onChange={e => set('weekly_report_time', e.target.value)} />
                <p className="text-slate-600 text-[11px] mt-1">Time in your timezone</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-slate-800/60">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {save.isPending && <Loader2 size={13} className="animate-spin" />}
            Save Changes
          </button>
          {save.isSuccess && (
            <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
              <CheckCircle size={12} /> Saved!
            </span>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// ── Slack Tab ─────────────────────────────────────────────────────────────────
function SlackTab() {
  const qc = useQueryClient();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const { data: status } = useQuery<SlackStatus>({
    queryKey: ['slack-status'],
    queryFn: () => axios.get('/api/slack/status').then(r => r.data),
  });

  const connect = useMutation({
    mutationFn: () => axios.post('/api/slack/connect', { webhookUrl }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['slack-status'] }); setWebhookUrl(''); },
  });

  const disconnect = useMutation({
    mutationFn: () => axios.delete('/api/slack/disconnect'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['slack-status'] }),
  });

  const test = useMutation({
    mutationFn: () => axios.post('/api/slack/test'),
    onSuccess: () => setTestResult({ ok: true, msg: 'Test message sent successfully!' }),
    onError:   () => setTestResult({ ok: false, msg: 'Failed — check your webhook URL.' }),
  });

  const isValidUrl = webhookUrl.startsWith('https://hooks.slack.com/');

  return (
    <div className="space-y-4">
      <h2 className="text-slate-200 font-semibold">Slack Integration</h2>

      {status?.connected && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-400" />
              <div>
                <p className="text-emerald-300 text-sm font-semibold">Connected</p>
                {status.channel_name && <p className="text-emerald-600 text-xs">#{status.channel_name}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => test.mutate()}
                disabled={test.isPending}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                {test.isPending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                Test
              </button>
              <button
                onClick={() => disconnect.mutate()}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
          {testResult && (
            <p className={`text-xs mt-3 pt-3 border-t border-emerald-500/20 ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {testResult.msg}
            </p>
          )}
        </div>
      )}

      <SectionCard className="space-y-4">
        <div>
          <FieldLabel>Incoming Webhook URL</FieldLabel>
          <TextInput
            type="url"
            placeholder="https://hooks.slack.com/services/T.../B.../..."
            value={webhookUrl}
            onChange={e => { setWebhookUrl(e.target.value); setTestResult(null); }}
          />
          {webhookUrl && !isValidUrl && (
            <div className="flex items-center gap-1.5 mt-2 text-amber-400 text-xs">
              <AlertTriangle size={11} />
              URL must start with https://hooks.slack.com/
            </div>
          )}
          <p className="text-slate-600 text-[11px] mt-1.5">Slack → Apps → Incoming Webhooks → Add New</p>
        </div>
        <button
          onClick={() => connect.mutate()}
          disabled={!isValidUrl || connect.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-40 transition-colors"
        >
          {connect.isPending && <Loader2 size={13} className="animate-spin" />}
          {status?.connected ? 'Update Webhook' : 'Connect Slack'}
        </button>
      </SectionCard>
    </div>
  );
}

// ── Team Mapping Tab ──────────────────────────────────────────────────────────
function TeamMappingTab() {
  const qc = useQueryClient();
  const { data: mappings = [] } = useQuery<Mapping[]>({
    queryKey: ['team-mappings'],
    queryFn: () => axios.get('/api/team-mapping').then(r => r.data),
  });

  const confirmMapping = useMutation({
    mutationFn: (id: string) => axios.post(`/api/team-mapping/${id}/confirm`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-mappings'] }),
  });

  const unconfirmed = mappings.filter(m => m.jira_account_id && !m.is_confirmed);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-slate-200 font-semibold">GitHub ↔ Jira Team Mapping</h2>
        {unconfirmed.length > 0 && (
          <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded-full px-2.5 py-1 font-semibold">
            {unconfirmed.length} need review
          </span>
        )}
      </div>

      {mappings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center">
          <p className="text-slate-600 text-sm">No mappings yet. Run the historical index to auto-map team members.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-900/60 border-b border-slate-800">
              <tr>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">GitHub</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Jira</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {mappings.map(m => (
                <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <img src={`https://github.com/${m.github_login}.png?size=24`} className="w-6 h-6 rounded-full ring-1 ring-slate-700" alt="" />
                      <span className="text-slate-300 text-sm font-medium">{m.github_login}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-sm">
                    {m.jira_display_name ?? <span className="text-slate-600 italic text-xs">Not mapped</span>}
                  </td>
                  <td className="px-4 py-3">
                    {m.jira_account_id
                      ? m.is_confirmed
                        ? <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">Confirmed</span>
                        : <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5">Needs Review</span>
                      : <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-0.5">Unmatched</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.jira_account_id && !m.is_confirmed && (
                      <button
                        onClick={() => confirmMapping.mutate(m.id)}
                        disabled={confirmMapping.isPending}
                        className="text-xs px-3 py-1 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 border border-emerald-500/20 transition-colors"
                      >
                        Confirm
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Settings() {
  const [tab, setTab] = useState<Tab>('brief');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'brief',        label: 'Brief Config' },
    { id: 'slack',        label: 'Slack' },
    { id: 'jira',         label: 'Jira' },
    { id: 'github',       label: 'GitHub' },
    { id: 'team-mapping', label: 'Team Mapping' },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <SettingsIcon size={18} className="text-indigo-400" />
          <h1 className="text-white text-xl font-bold">Settings</h1>
        </div>
        <p className="text-slate-500 text-sm">Configure integrations and brief delivery preferences</p>
      </div>

      {/* Pill tab bar */}
      <div className="flex gap-1 mb-6 p-1 bg-slate-900/60 rounded-xl border border-slate-800">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              tab === t.id
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'brief'        && <BriefConfigTab />}
      {tab === 'slack'        && <SlackTab />}
      {tab === 'jira'         && <JiraTab />}
      {tab === 'github'       && <GithubTab />}
      {tab === 'team-mapping' && <TeamMappingTab />}
    </div>
  );
}
