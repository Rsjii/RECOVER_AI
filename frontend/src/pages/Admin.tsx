import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { useNotification } from '../hooks/useNotification';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { cn } from '../lib/utils';
import { UsersTab } from '../components/admin/UsersTab';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UsageRow {
  service: string;
  period: string;
  usage_count: number;
  cost_usd: string;
  input_tokens: number;
  output_tokens: number;
}

interface EmailStats {
  sent: number;
  opened: number;
  clicked: number;
  failed: number;
  bounced: number;
  byType: { email_type: string; count: number }[];
}

interface ModelUsageRow {
  service: string;
  model: string;
  total_cost: string;
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
}

interface MetricsData {
  companies: { total: number; active: number; trialing: number; canceled: number; pastDue: number };
  recentCompanies: { id: string; name: string; email: string; subscription_status: string; created_at: string }[];
  users: { total: number; active7d: number; active30d: number };
  revenue: { totalBilled: number; paidCount: number };
  emailStats: EmailStats;
  emailVolumeByDay: { date: string; sent: number; opened: number }[];
  usageByMonth: UsageRow[];
  usageByModel: ModelUsageRow[];
  costBreakdown: Record<string, number>;
  callCounts: Record<string, number>;
  totalCostUsd: number;
  topCompaniesByCost: { company_name: string; company_email: string; total_cost: string; total_calls: number }[];
  queue: Record<string, number>;
  redisHistory: { date: string; commands: number; bandwidth_bytes: number }[];
}

type Tab = 'overview' | 'emails' | 'costs' | 'queue' | 'invoices' | 'users';

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_COLORS: Record<string, string> = {
  claude: '#7c3aed',
  openai: '#10a37f',
  resend: '#0ea5e9',
};

const STATUS_BADGE: Record<string, string> = {
  active:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  trialing:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  past_due:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  canceled:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: string | number; sub?: string; color?: string }> = ({
  label, value, sub, color,
}) => (
  <Card>
    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    <p className={cn('text-2xl font-bold mt-1', color ?? 'text-gray-900 dark:text-white')}>{value}</p>
    {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
  </Card>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const Admin: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  useEffect(() => {
    document.title = 'Admin — CashOS';
    api.get<{ data: MetricsData }>('/api/admin/metrics')
      .then(res => setMetrics((res as any).data || res))
      .catch((err: any) => {
        if (err?.status === 403) setForbidden(true);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" text="Loading platform metrics..." /></div>;

  if (forbidden) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Access Restricted</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">This page is only accessible to authorized platform administrators.</p>
      </div>
    );
  }

  if (!metrics) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'emails',    label: 'Emails' },
    { id: 'costs',     label: 'AI Costs' },
    { id: 'queue',     label: 'Queue' },
    { id: 'users',     label: '👥 Users' },
    { id: 'invoices',  label: '💳 Invoices' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Admin</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Aggregated data across all companies</p>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-gray-200 dark:border-white/[0.06]">
        <nav className="flex gap-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab: Overview ─────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <OverviewTab metrics={metrics} />
      )}

      {/* ── Tab: Emails ───────────────────────────────────────────────────────── */}
      {activeTab === 'emails' && (
        <EmailsTab metrics={metrics} />
      )}

      {/* ── Tab: AI Costs ─────────────────────────────────────────────────────── */}
      {activeTab === 'costs' && (
        <CostsTab metrics={metrics} />
      )}

      {/* ── Tab: Queue ────────────────────────────────────────────────────────── */}
      {activeTab === 'queue' && (
        <QueueTab metrics={metrics} />
      )}

      {/* ── Tab: Users ────────────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <UsersTab />
      )}

      {/* ── Tab: Invoices ─────────────────────────────────────────────────────── */}
      {activeTab === 'invoices' && (
        <InvoicesTab />
      )}

    </div>
  );
};

// ─── Overview Tab ─────────────────────────────────────────────────────────────

const OverviewTab: React.FC<{ metrics: MetricsData }> = ({ metrics }) => {
  const companies = metrics?.companies ?? { total: 0, active: 0, trialing: 0, canceled: 0, pastDue: 0 };
  const users = metrics?.users ?? { total: 0, active7d: 0, active30d: 0 };
  const revenue = metrics?.revenue ?? { totalBilled: 0, paidCount: 0 };
  const recentCompanies = metrics?.recentCompanies ?? [];
  const churned = (companies?.canceled ?? 0) + (companies?.pastDue ?? 0);

  return (
    <div className="space-y-6">
      {/* Company stats */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Companies</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Companies" value={(companies?.total ?? 0).toLocaleString()} />
          <StatCard label="Active" value={(companies?.active ?? 0).toLocaleString()} color="text-green-600 dark:text-green-400" />
          <StatCard label="Trialing" value={(companies?.trialing ?? 0).toLocaleString()} color="text-blue-600 dark:text-blue-400" />
          <StatCard label="Churned / Past Due" value={churned.toLocaleString()} color={churned > 0 ? 'text-red-600 dark:text-red-400' : undefined} />
        </div>
      </div>

      {/* User + Revenue stats */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Users &amp; Revenue</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Total Users" value={(users?.total ?? 0).toLocaleString()} />
          <StatCard label="Active (last 7d)" value={(users?.active7d ?? 0).toLocaleString()} sub={`${(users?.active30d ?? 0).toLocaleString()} in last 30d`} />
          <StatCard
            label="Total Billed"
            value={`$${(revenue?.totalBilled ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            sub={`${revenue?.paidCount ?? 0} invoices paid`}
          />
        </div>
      </div>

      {/* Recent signups */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Recent Signups</h3>
        {recentCompanies.length === 0 ? (
          <p className="text-sm text-gray-400">No companies yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-white/[0.04]">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Company</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Email</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Signed Up</th>
              </tr>
            </thead>
            <tbody>
              {recentCompanies.map(c => (
                <tr key={c.id} className="border-t border-gray-100 dark:border-white/[0.06]">
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{c.name}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{c.email}</td>
                  <td className="px-4 py-2">
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize',
                      STATUS_BADGE[c.subscription_status] ?? 'bg-gray-100 text-gray-600')}>
                      {c.subscription_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs">
                    {format(parseISO(c.created_at), 'MMM d, yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
};

// ─── Emails Tab ───────────────────────────────────────────────────────────────

interface EmailLog {
  id: string;
  sent_at: string;
  company_id: string;
  company_name: string;
  recipient_email: string;
  email_type: string;
  status: string;
  subject: string;
  opened_at: string | null;
  clicked_at: string | null;
}

type EmailSubtab = 'stats' | 'logs';

const EmailsTab: React.FC<{ metrics: MetricsData }> = ({ metrics }) => {
  const [emailSubtab, setEmailSubtab] = useState<EmailSubtab>('stats');
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [emailLogsLoading, setEmailLogsLoading] = useState(false);
  const [emailStatusFilter, setEmailStatusFilter] = useState<string>('');
  const [emailCompanyFilter, setEmailCompanyFilter] = useState<string>('');
  const [emailOffset, setEmailOffset] = useState(0);

  const loadEmailLogs = React.useCallback(async () => {
    setEmailLogsLoading(true);
    try {
      const params = new URLSearchParams();
      if (emailStatusFilter) params.append('status', emailStatusFilter);
      if (emailCompanyFilter) params.append('companyId', emailCompanyFilter);
      params.append('limit', '50');
      params.append('offset', emailOffset.toString());

      const res = await api.get(`/api/admin/email-logs?${params.toString()}`);
      setEmailLogs((res as any).data || []);
    } catch (err) {
      console.error('Failed to load email logs:', err);
    } finally {
      setEmailLogsLoading(false);
    }
  }, [emailStatusFilter, emailCompanyFilter, emailOffset]);

  React.useEffect(() => {
    if (emailSubtab === 'logs') {
      loadEmailLogs();
    }
  }, [emailSubtab, emailStatusFilter, emailCompanyFilter, emailOffset, loadEmailLogs]);

  const emailStats = metrics?.emailStats ?? { sent: 0, opened: 0, clicked: 0, failed: 0, bounced: 0, byType: [] };
  const byType = emailStats?.byType ?? [];
  const openRate  = (emailStats?.sent ?? 0) > 0 ? Math.round(((emailStats?.opened ?? 0)  / (emailStats?.sent ?? 0)) * 100) : 0;
  const clickRate = (emailStats?.sent ?? 0) > 0 ? Math.round(((emailStats?.clicked ?? 0) / (emailStats?.sent ?? 0)) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Email subtabs */}
      <div className="border-b border-gray-200 dark:border-white/[0.06]">
        <nav className="flex gap-6">
          {['stats', 'logs'].map(subtab => (
            <button
              key={subtab}
              onClick={() => {
                setEmailSubtab(subtab as EmailSubtab);
                setEmailOffset(0);
              }}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 transition-colors capitalize',
                emailSubtab === subtab
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              {subtab}
            </button>
          ))}
        </nav>
      </div>

      <div className="space-y-6">
      {emailSubtab === 'stats' && (
        <>
          {/* Funnel */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Delivery Funnel (all time, all companies)</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">{openRate}% open rate · {clickRate}% click rate</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              {[
                { label: 'Sent',    value: emailStats?.sent ?? 0,    color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
                { label: 'Opened',  value: emailStats?.opened ?? 0,  color: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
                { label: 'Clicked', value: emailStats?.clicked ?? 0, color: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
                { label: 'Bounced', value: emailStats?.bounced ?? 0, color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
                { label: 'Failed',  value: emailStats?.failed ?? 0,  color: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
              ].map(({ label, value, color }) => (
                <div key={label} className={cn('rounded-lg px-3 py-3', color)}>
                  <p className="text-xl font-bold">{value.toLocaleString()}</p>
                  <p className="text-xs mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Daily volume line chart */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Daily Email Volume (last 30 days)</h3>
            {(metrics?.emailVolumeByDay ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={metrics.emailVolumeByDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip labelFormatter={d => `Date: ${d}`} />
                  <Legend />
                  <Line type="monotone" dataKey="sent"   name="Sent"   stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="opened" name="Opened" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* By type */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Emails by Type</h3>
            {(byType?.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-400">No emails sent yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-white/[0.04]">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Email Type</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Count</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(byType ?? []).map(row => (
                    <tr key={row.email_type} className="border-t border-gray-100 dark:border-white/[0.06]">
                      <td className="px-4 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">{row.email_type}</td>
                      <td className="px-4 py-2 text-right text-gray-900 dark:text-white">{row.count.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">
                        {(emailStats?.sent ?? 0) > 0 ? Math.round((row.count / (emailStats?.sent ?? 0)) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}

      {emailSubtab === 'logs' && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Email Logs</h3>

          {/* Filters */}
          <div className="mb-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Status</label>
                <select
                  value={emailStatusFilter}
                  onChange={(e) => {
                    setEmailStatusFilter(e.target.value);
                    setEmailOffset(0);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="sent">Sent</option>
                  <option value="opened">Opened</option>
                  <option value="clicked">Clicked</option>
                  <option value="failed">Failed</option>
                  <option value="bounced">Bounced</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Company</label>
                <input
                  type="text"
                  placeholder="Filter by company ID..."
                  value={emailCompanyFilter}
                  onChange={(e) => {
                    setEmailCompanyFilter(e.target.value);
                    setEmailOffset(0);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          {emailLogsLoading ? (
            <Spinner size="sm" text="Loading..." />
          ) : emailLogs.length === 0 ? (
            <p className="text-sm text-gray-400">No emails found.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-white/[0.04]">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Company</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Recipient</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailLogs.map(log => (
                      <tr key={log.id} className="border-t border-gray-100 dark:border-white/[0.06]">
                        <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">{format(parseISO(log.sent_at), 'MMM d, HH:mm')}</td>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">{log.company_name}</td>
                        <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{log.recipient_email}</td>
                        <td className="px-4 py-2 text-xs"><span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded">{log.email_type}</span></td>
                        <td className="px-4 py-2 text-xs">
                          <span className={cn(
                            'px-2 py-1 rounded',
                            log.status === 'sent' || log.status === 'delivered' || log.status === 'opened' || log.status === 'clicked' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : '',
                            log.status === 'bounced' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : '',
                            log.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : ''
                          )}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-gray-500 dark:text-gray-400">Showing {emailLogs.length} logs</p>
                <div className="space-x-2">
                  <button
                    onClick={() => setEmailOffset(Math.max(0, emailOffset - 50))}
                    disabled={emailOffset === 0}
                    className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-white/[0.08] disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-white/[0.06]"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setEmailOffset(emailOffset + 50)}
                    disabled={emailLogs.length < 50}
                    className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-white/[0.08] disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-white/[0.06]"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </Card>
      )}
      </div>
    </div>
  );
};

// ─── AI Costs Tab ─────────────────────────────────────────────────────────────

const MODEL_COLORS: Record<string, string> = {
  'claude-haiku':      '#7c3aed',
  'claude-sonnet':     '#4f46e5',
  'claude-opus':       '#1d4ed8',
  'gpt-4o-mini':       '#10a37f',
  'gpt-4o':            '#0ea5e9',
  unknown:             '#9ca3af',
};

function modelColor(model: string): string {
  const key = Object.keys(MODEL_COLORS).find(k => model.toLowerCase().includes(k));
  return key ? MODEL_COLORS[key] : MODEL_COLORS.unknown;
}

function shortModel(model: string): string {
  // Turn 'claude-haiku-4-5-20251001' → 'claude-haiku-4-5'
  return model.replace(/-\d{8}$/, '').replace('claude-', 'claude-');
}

const CostsTab: React.FC<{ metrics: MetricsData }> = ({ metrics }) => {
  const usageByMonth = metrics?.usageByMonth ?? [];
  const costBreakdown = metrics?.costBreakdown ?? {};
  const callCounts = metrics?.callCounts ?? {};
  const totalCostUsd = metrics?.totalCostUsd ?? 0;
  const topCompaniesByCost = metrics?.topCompaniesByCost ?? [];
  const usageByModel = metrics?.usageByModel ?? [];

  // Build monthly chart data
  const monthMap: Record<string, Record<string, number>> = {};
  for (const row of usageByMonth) {
    const label = format(parseISO(row.period), 'MMM yyyy');
    if (!monthMap[label]) monthMap[label] = {};
    monthMap[label][row.service] = (monthMap[label][row.service] ?? 0) + parseFloat(row.cost_usd);
  }
  const chartData = Object.entries(monthMap).map(([month, costs]) => ({ month, ...costs }));

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Cost (6mo)" value={`$${(totalCostUsd ?? 0).toFixed(4)}`} />
        <StatCard label="Claude Calls" value={(callCounts?.['claude'] ?? 0).toLocaleString()} />
        <StatCard label="OpenAI Calls" value={(callCounts?.['openai'] ?? 0).toLocaleString()} />
        <StatCard label="Emails (Resend)" value={(callCounts?.['resend'] ?? 0).toLocaleString()} />
      </div>

      {/* Chart + breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Cost by Service</h3>
          <div className="space-y-2">
            {Object.entries(costBreakdown).map(([svc, cost]) => (
              <div key={svc} className="flex justify-between items-center text-sm">
                <span className="capitalize text-gray-700 dark:text-gray-300">{svc}</span>
                <span className="font-medium text-gray-900 dark:text-white">${cost.toFixed(4)}</span>
              </div>
            ))}
            {Object.keys(costBreakdown).length === 0 && (
              <p className="text-sm text-gray-400">No cost data yet.</p>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Monthly Cost by Service ($)</h3>
          {chartData.length === 0 ? (
            <p className="text-sm text-gray-400">No usage data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [`$${Number(v).toFixed(4)}`, '']} />
                <Legend />
                {['claude', 'openai', 'resend'].map(svc => (
                  <Bar key={svc} dataKey={svc} name={svc} fill={SERVICE_COLORS[svc]} radius={[2, 2, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Per-model breakdown */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Cost by Model (6mo)</h3>
        {usageByModel.length === 0 ? (
          <p className="text-sm text-gray-400">No data yet. Will populate after first AI call.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-white/[0.04]">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Model</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Calls</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Input Tokens</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Output Tokens</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Cost</th>
              </tr>
            </thead>
            <tbody>
              {usageByModel.map((row, i) => (
                <tr key={i} className="border-t border-gray-100 dark:border-white/[0.06]">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: modelColor(row.model) }} />
                      <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{shortModel(row.model)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">{row.total_calls.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{Number(row.total_input_tokens).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{Number(row.total_output_tokens).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white">${parseFloat(row.total_cost).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Monthly breakdown table */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Monthly Usage Breakdown (All Companies)</h3>
        {usageByMonth.length === 0 ? (
          <p className="text-sm text-gray-400">No usage tracked yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-white/[0.04]">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Month</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Service</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Calls</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Input Tokens</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Output Tokens</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Cost</th>
              </tr>
            </thead>
            <tbody>
              {usageByMonth.map((row, i) => (
                <tr key={i} className="border-t border-gray-100 dark:border-white/[0.06]">
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{format(parseISO(row.period), 'MMM yyyy')}</td>
                  <td className="px-4 py-2 capitalize text-gray-700 dark:text-gray-300">{row.service}</td>
                  <td className="px-4 py-2 text-right">{row.usage_count.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{row.input_tokens.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{row.output_tokens.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-medium">${parseFloat(row.cost_usd).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Top companies by cost */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Top Companies by Cost (last 6mo)</h3>
        {topCompaniesByCost.length === 0 ? (
          <p className="text-sm text-gray-400">No data yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-white/[0.04]">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Company</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Email</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Total Calls</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {topCompaniesByCost.map((row, i) => (
                <tr key={i} className="border-t border-gray-100 dark:border-white/[0.06]">
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{row.company_name}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{row.company_email}</td>
                  <td className="px-4 py-2 text-right">{row.total_calls.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-medium">${parseFloat(row.total_cost).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
};

// ─── Queue Tab ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const QueueTab: React.FC<{ metrics: MetricsData }> = ({ metrics }) => {
  const queue = metrics?.queue ?? {};
  const waiting  = queue['waiting']   ?? 0;
  const active   = queue['active']    ?? 0;
  const completed= queue['completed'] ?? 0;
  const failed   = queue['failed']    ?? 0;
  const delayed  = queue['delayed']   ?? 0;

  const healthColor =
    failed > 10          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800' :
    waiting >= 50        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800' :
                           'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800';
  const healthLabel = failed > 10 ? 'Degraded' : waiting >= 50 ? 'Backlogged' : 'Healthy';

  return (
    <div className="space-y-6">
      {/* Health banner */}
      <div className={cn('rounded-lg border px-4 py-3 flex items-center gap-3', healthColor)}>
        <div className={cn('w-2.5 h-2.5 rounded-full', failed > 10 ? 'bg-red-500' : waiting >= 50 ? 'bg-amber-500' : 'bg-green-500')} />
        <div>
          <p className="text-sm font-semibold">Queue Status: {healthLabel}</p>
          <p className="text-xs mt-0.5 opacity-80">BullMQ dunning job queue via Upstash Redis</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Waiting"   value={waiting.toLocaleString()}   color="text-gray-900 dark:text-white" />
        <StatCard label="Active"    value={active.toLocaleString()}    color="text-blue-600 dark:text-blue-400" />
        <StatCard label="Completed" value={completed.toLocaleString()} color="text-green-600 dark:text-green-400" />
        <StatCard label="Failed"    value={failed.toLocaleString()}    color={failed > 0 ? 'text-red-600 dark:text-red-400' : undefined} />
        <StatCard label="Delayed"   value={delayed.toLocaleString()}   color="text-amber-600 dark:text-amber-400" />
      </div>

      {/* Redis daily command chart */}
      {(() => {
        const history = metrics?.redisHistory ?? [];
        const todayEntry = history[history.length - 1];
        const totalCmds = history.reduce((s, r) => s + (r.commands ?? 0), 0);
        const todayBw = todayEntry?.bandwidth_bytes ?? 0;
        return (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard label="Today's Commands" value={(todayEntry?.commands ?? 0).toLocaleString()} sub="Via Redis INFO stats" />
              <StatCard label="30-day Commands" value={totalCmds.toLocaleString()} sub="Cumulative (BullMQ + all ops)" />
              <StatCard label="Today's Bandwidth" value={formatBytes(todayBw)} sub="Via Upstash REST API" />
            </div>
            <Card>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Redis Commands / Day (last 30 days)</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Tracked via Redis INFO stats snapshot · includes all BullMQ + admin calls</p>
              {history.length === 0 ? (
                <p className="text-sm text-gray-400">No data yet. Snapshots run daily at server boot (production only).</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={history} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => [Number(v).toLocaleString(), 'Commands']} labelFormatter={d => `Date: ${d}`} />
                    <Bar dataKey="commands" name="Commands" fill="#6366f1" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </>
        );
      })()}

      <Card>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">About This Queue</h3>
        <div className="space-y-1 text-sm text-gray-500 dark:text-gray-400">
          <p><span className="font-medium text-gray-700 dark:text-gray-300">Waiting</span> — jobs ready to process, pending a free worker slot</p>
          <p><span className="font-medium text-gray-700 dark:text-gray-300">Active</span> — jobs currently being processed by a worker</p>
          <p><span className="font-medium text-gray-700 dark:text-gray-300">Completed</span> — jobs that finished successfully (emails sent)</p>
          <p><span className="font-medium text-gray-700 dark:text-gray-300">Failed</span> — jobs that errored after all retries (Resend error / bad address)</p>
          <p><span className="font-medium text-gray-700 dark:text-gray-300">Delayed</span> — jobs scheduled for a future time (payment plan reminders)</p>
        </div>
      </Card>
    </div>
  );
};

// ─── InvoicesTab ──────────────────────────────────────────────────────────────

interface InvoiceResult {
  companyId: string;
  companyName: string;
  invoiceNumber: string;
  totalUsd: number;
  paymentLinkUrl: string;
  status: 'generated' | 'skipped' | 'error';
  error?: string;
}

const InvoicesTab: React.FC = () => {
  const { addToast } = useNotification();
  const now = new Date();
  const prevMonth = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth();
  const prevYear  = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();

  const [year, setYear]   = useState(prevYear);
  const [month, setMonth] = useState(prevMonth);
  const [results, setResults] = useState<InvoiceResult[]>([]);
  const [generating, setGenerating] = useState(false);

  // Single company override
  const [singleMode, setSingleMode] = useState(false);
  const [singleCompanyId, setSingleCompanyId] = useState('');
  const [singleBaseFee, setSingleBaseFee] = useState(2500);
  const [singleRecoveryPct, setSingleRecoveryPct] = useState(1.2);

  const handleGenerateAll = async () => {
    setGenerating(true);
    setResults([]);
    try {
      const res = await api.post(API_ENDPOINTS.billing.razorpayGenerateInvoices, { year, month });
      setResults((res as any).data ?? []);
      addToast({ type: 'success', message: `Generated ${(res as any).summary?.generated ?? 0} invoices` });
    } catch {
      addToast({ type: 'error', message: 'Failed to generate invoices' });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateSingle = async () => {
    if (!singleCompanyId.trim()) { addToast({ type: 'error', message: 'Company ID required' }); return; }
    setGenerating(true);
    setResults([]);
    try {
      const res = await api.post(API_ENDPOINTS.billing.razorpayGenerateInvoice(singleCompanyId.trim()), {
        baseFeeUsd: singleBaseFee,
        recoveryPercentage: singleRecoveryPct,
        year,
        month,
      });
      setResults([{ ...(res as any).data, status: 'generated', companyName: 'Custom', companyId: singleCompanyId }]);
      addToast({ type: 'success', message: 'Invoice generated' });
    } catch {
      addToast({ type: 'error', message: 'Failed to generate invoice' });
    } finally {
      setGenerating(false);
    }
  };

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Razorpay Invoice Generator</h2>

        {/* Period Selector */}
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Month</label>
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white"
            >
              {MONTHS.map((m, i) => (
                <option key={i+1} value={i+1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Year</label>
            <input
              type="number"
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm w-24 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white"
            />
          </div>
          <button
            onClick={() => setSingleMode(!singleMode)}
            className="text-xs text-blue-600 dark:text-blue-400 underline self-end pb-1.5"
          >
            {singleMode ? '← All companies' : 'Single company →'}
          </button>
        </div>

        {/* Single company mode */}
        {singleMode && (
          <div className="flex flex-wrap gap-3 items-end mb-4 p-3 bg-gray-50 dark:bg-white/[0.03] rounded-lg">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Company ID</label>
              <input
                value={singleCompanyId}
                onChange={e => setSingleCompanyId(e.target.value)}
                placeholder="uuid..."
                className="border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm w-64 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Base Fee (USD)</label>
              <input
                type="number"
                value={singleBaseFee}
                onChange={e => setSingleBaseFee(Number(e.target.value))}
                className="border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm w-28 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Recovery %</label>
              <input
                type="number"
                step="0.1"
                value={singleRecoveryPct}
                onChange={e => setSingleRecoveryPct(Number(e.target.value))}
                className="border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm w-20 bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white"
              />
            </div>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={singleMode ? handleGenerateSingle : handleGenerateAll}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {generating ? <Spinner size="sm" /> : '⚡'}
          {generating ? 'Generating...' : singleMode ? 'Generate Invoice' : 'Generate All Invoices'}
        </button>
      </Card>

      {/* Results Table */}
      {results.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Results — {MONTHS[month-1]} {year}
            </h3>
            <span className="text-xs text-gray-500">
              {results.filter(r => r.status === 'generated').length} generated ·{' '}
              {results.filter(r => r.status === 'error').length} errors
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-white/[0.06]">
                  <th className="text-left pb-2 font-medium">Company</th>
                  <th className="text-left pb-2 font-medium">Invoice #</th>
                  <th className="text-right pb-2 font-medium">Total</th>
                  <th className="text-left pb-2 font-medium">Status</th>
                  <th className="text-left pb-2 font-medium">Payment Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                {results.map((r, i) => (
                  <tr key={i} className="text-gray-700 dark:text-gray-300">
                    <td className="py-2.5 font-medium">{r.companyName}</td>
                    <td className="py-2.5 font-mono text-xs">{r.invoiceNumber || '—'}</td>
                    <td className="py-2.5 text-right font-semibold">
                      {r.totalUsd > 0 ? `$${r.totalUsd.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-2.5">
                      <span className={cn(
                        'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                        r.status === 'generated' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        r.status === 'error'     ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                   'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      )}>
                        {r.status}
                      </span>
                      {r.error && <p className="text-xs text-red-500 mt-0.5 truncate max-w-xs">{r.error}</p>}
                    </td>
                    <td className="py-2.5">
                      {r.paymentLinkUrl ? (
                        <a
                          href={r.paymentLinkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline text-xs truncate block max-w-[180px]"
                        >
                          Open link ↗
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Admin;
