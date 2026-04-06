import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Spinner } from '../components/ui/Spinner';
import { Card } from '../components/ui/Card';
import { AdminOverview } from '../components/admin/AdminOverview';
import { AdminCompanies } from '../components/admin/AdminCompanies';
import { ErrorLogsTab } from '../components/admin/ErrorLogsTab';
import { logError } from '../utils/logger';

interface MetricsData {
  companies: { total: number; active: number; trialing: number; canceled: number; pastDue: number };
  recentCompanies: { id: string; name: string; email: string; subscription_status: string; created_at: string }[];
  users: { total: number; active7d: number; active30d: number };
  revenue: { totalBilled: number; paidCount: number };
  emailStats: any;
  emailVolumeByDay: any[];
  usageByMonth: any[];
  usageByModel: any[];
  costBreakdown: Record<string, number>;
  callCounts: Record<string, number>;
  totalCostUsd: number;
  topCompaniesByCost: any[];
  queue: Record<string, number>;
  redisHistory: any[];
}

type Section = 'overview' | 'operations' | 'companies' | 'system';
type OpsTab = 'emails' | 'ai-costs' | 'infrastructure';
type SysTab = 'errors' | 'security' | 'performance';

// ── Operations sub-section ─────────────────────────────────────────
const OperationsSection: React.FC<{ metrics: MetricsData }> = ({ metrics }) => {
  const [tab, setTab] = useState<OpsTab>('emails');

  const emailStats = metrics?.emailStats ?? {};
  const emailVolume = metrics?.emailVolumeByDay ?? [];
  const usageByModel = metrics?.usageByModel ?? [];
  const queue = metrics?.queue ?? {};
  const redisHistory = metrics?.redisHistory ?? [];
  const costBreakdown = metrics?.costBreakdown ?? {};
  const callCounts = metrics?.callCounts ?? {};

  // AI cost data for chart
  const modelCostData = usageByModel.map((m: any) => ({
    name: m.model ?? m.name ?? 'unknown',
    cost: parseFloat(m.total_cost ?? m.cost ?? 0),
    calls: m.total_calls ?? m.calls ?? 0,
  })).filter((x: any) => x.cost > 0 || x.calls > 0);

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-white/10">
        {([
          { id: 'emails' as OpsTab, label: '📧 Emails' },
          { id: 'ai-costs' as OpsTab, label: '🤖 AI Costs' },
          { id: 'infrastructure' as OpsTab, label: '🔧 Infrastructure' },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Emails ── */}
      {tab === 'emails' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total Sent', value: (emailStats.total_sent ?? 0).toLocaleString(), color: 'text-gray-900 dark:text-white' },
              { label: 'Delivered', value: (emailStats.delivered ?? 0).toLocaleString(), color: 'text-green-600 dark:text-green-400' },
              { label: 'Opened', value: (emailStats.opened ?? 0).toLocaleString(), color: 'text-blue-600 dark:text-blue-400' },
              { label: 'Clicked', value: (emailStats.clicked ?? 0).toLocaleString(), color: 'text-indigo-600 dark:text-indigo-400' },
              { label: 'Bounced', value: (emailStats.bounced ?? 0).toLocaleString(), color: 'text-red-600 dark:text-red-400' },
              { label: 'Unsubscribed', value: (emailStats.unsubscribed ?? 0).toLocaleString(), color: 'text-amber-600 dark:text-amber-400' },
            ].map(({ label, value, color }) => (
              <Card key={label} className="p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
              </Card>
            ))}
          </div>

          {emailVolume.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Email Volume (last 30 days)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={emailVolume} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="sent" fill="#6366f1" name="Sent" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      )}

      {/* ── AI Costs ── */}
      {tab === 'ai-costs' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total AI Spend</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                ${(metrics?.totalCostUsd ?? 0).toFixed(2)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total API Calls</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Object.values(callCounts).reduce((a, b) => a + (b as number), 0).toLocaleString()}
              </p>
            </Card>
          </div>

          {Object.keys(costBreakdown).length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Cost by Service</h3>
              <div className="space-y-2">
                {Object.entries(costBreakdown).map(([service, cost]) => (
                  <div key={service} className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400 capitalize">{service}</span>
                    <span className="font-medium text-gray-900 dark:text-white">${parseFloat(String(cost)).toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {modelCostData.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Cost by Model</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={modelCostData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="cost" fill="#7c3aed" name="Cost ($)" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {(metrics?.topCompaniesByCost ?? []).length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Top Companies by Cost</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 dark:text-gray-400">
                      <th className="text-left pb-2">Company</th>
                      <th className="text-right pb-2">Cost</th>
                      <th className="text-right pb-2">Calls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.topCompaniesByCost.map((c: any) => (
                      <tr key={c.company_name} className="border-t border-gray-100 dark:border-white/[0.05]">
                        <td className="py-2 text-gray-900 dark:text-white">{c.company_name}</td>
                        <td className="py-2 text-right text-gray-900 dark:text-white">${parseFloat(c.total_cost).toFixed(2)}</td>
                        <td className="py-2 text-right text-gray-500 dark:text-gray-400">{c.total_calls.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Infrastructure ── */}
      {tab === 'infrastructure' && (
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Job Queues</h3>
            {Object.keys(queue).length === 0 ? (
              <p className="text-sm text-gray-400">No queue data available.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(queue).map(([qName, count]) => (
                  <div key={qName} className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400 font-mono text-xs">{qName}</span>
                    <span className={`font-medium ${(count as number) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                      {String(count)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {redisHistory.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Redis Event History</h3>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {redisHistory.map((entry: any, i: number) => (
                  <div key={i} className="text-xs border-l-2 border-gray-300 dark:border-gray-700 pl-3 py-1">
                    <p className="font-mono text-gray-900 dark:text-white">{entry.event ?? entry.type ?? JSON.stringify(entry)}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

// ── System sub-section ─────────────────────────────────────────────
const SystemSection: React.FC = () => {
  const [tab, setTab] = useState<SysTab>('errors');

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-white/10">
        {([
          { id: 'errors' as SysTab, label: '🚨 Error Logs' },
          { id: 'security' as SysTab, label: '🔒 Security' },
          { id: 'performance' as SysTab, label: '⚡ Performance' },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
              tab === t.id
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'errors' && <ErrorLogsTab />}
      {tab === 'security' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Security Events</h3>
          <div className="space-y-3">
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                placeholder="Search security events..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400"
              />
              <select className="px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-white">
                <option>Last 24 hours</option>
                <option>Last 7 days</option>
                <option>Last 30 days</option>
              </select>
            </div>
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p className="mb-2">🔒 Security Monitoring</p>
              <p className="text-sm">Failed login attempts, suspicious activities, API access logs coming soon</p>
            </div>
          </div>
        </Card>
      )}
      {tab === 'performance' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">System Performance</h3>
          <div className="space-y-3">
            <div className="flex gap-3 mb-4">
              <select className="flex-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-white">
                <option>API Performance</option>
                <option>Database Performance</option>
                <option>Redis Performance</option>
                <option>Job Queue Performance</option>
              </select>
              <select className="px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-white">
                <option>Last 24 hours</option>
                <option>Last 7 days</option>
                <option>Last 30 days</option>
              </select>
            </div>
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p className="mb-2">⚡ Performance Metrics</p>
              <p className="text-sm">Latency, throughput, error rates, and system resource usage coming soon</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

// ── Main Admin page ────────────────────────────────────────────────
const Admin: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('overview');

  useEffect(() => {
    document.title = 'Admin — RecoverAI';
    api.get<any>('/api/admin/metrics')
      .then((res: any) => {
        const data = res.data ?? res;
        setMetrics(data as MetricsData);
      })
      .catch((err: any) => {
        if (err?.status === 403) setForbidden(true);
        logError('Admin', 'loadMetrics', 'Failed to load metrics', err);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" text="Loading platform metrics..." /></div>;
  }

  if (forbidden) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Access Restricted</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">This page is only accessible to authorized platform administrators.</p>
      </div>
    );
  }

  if (!metrics) {
    return <div className="flex justify-center py-20"><Spinner size="lg" text="Loading..." /></div>;
  }

  const sections: { id: Section; label: string; icon: string }[] = [
    { id: 'overview',    label: 'Overview',    icon: '📊' },
    { id: 'operations',  label: 'Operations',  icon: '⚙️' },
    { id: 'companies',   label: 'Companies',   icon: '🏢' },
    { id: 'system',      label: 'System',      icon: '🔧' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Admin</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Platform metrics and management</p>
      </div>

      {/* Top-level section tabs */}
      <div className="border-b border-gray-200 dark:border-white/10">
        <div className="flex gap-6 overflow-x-auto">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeSection === section.id
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
              }`}
            >
              <span className="mr-1">{section.icon}</span>
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeSection === 'overview'   && <AdminOverview metrics={metrics} />}
      {activeSection === 'operations' && <OperationsSection metrics={metrics} />}
      {activeSection === 'companies'  && <AdminCompanies />}
      {activeSection === 'system'     && <SystemSection />}
    </div>
  );
};

export default Admin;