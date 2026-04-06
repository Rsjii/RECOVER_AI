import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { api } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { logError } from '../utils/logger';
import type { AdminCompanyDetail, CompanyDetailData } from '../hooks/useAdminCompanies';

type Tab = 'overview' | 'ar-health' | 'customers' | 'invoices' | 'emails' | 'usage' | 'billing' | 'team' | 'activity';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'ar-health', label: 'AR Health', icon: '💰' },
  { id: 'customers', label: 'Customers', icon: '👥' },
  { id: 'invoices', label: 'Invoices', icon: '📄' },
  { id: 'emails', label: 'Emails', icon: '📧' },
  { id: 'usage', label: 'Usage', icon: '⚡' },
  { id: 'billing', label: 'Billing', icon: '💳' },
  { id: 'team', label: 'Team', icon: '👤' },
  { id: 'activity', label: 'Activity', icon: '📋' },
];

const AdminCompanyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [company, setCompany] = useState<AdminCompanyDetail | null>(null);
  const [detailData, setDetailData] = useState<CompanyDetailData>({
    detail: null,
    users: [],
    invoices: null,
    emails: null,
    stripe: [],
    activity: [],
  });

  useEffect(() => {
    if (!id) return;
    fetchCompanyDetail(id);
  }, [id]);

  const fetchCompanyDetail = async (companyId: string) => {
    setLoading(true);
    try {
      const [detailRes, usersRes, invoicesRes, emailsRes, stripeRes, activityRes] = await Promise.allSettled([
        api.get<any>(`/api/admin/companies/${companyId}`),
        api.get<any>(`/api/admin/companies/${companyId}/users`),
        api.get<any>(`/api/admin/companies/${companyId}/invoices`),
        api.get<any>(`/api/admin/companies/${companyId}/emails`),
        api.get<any>(`/api/admin/companies/${companyId}/stripe`),
        api.get<any>(`/api/admin/companies/${companyId}/activity`),
      ]);

      const detail = detailRes.status === 'fulfilled' ? detailRes.value?.data : null;
      const users = usersRes.status === 'fulfilled' ? (usersRes.value?.data || []) : [];
      const invoices = invoicesRes.status === 'fulfilled' ? invoicesRes.value?.data : null;
      const emails = emailsRes.status === 'fulfilled' ? emailsRes.value?.data : null;
      const stripe = stripeRes.status === 'fulfilled' ? (stripeRes.value?.data || []) : [];
      const activity = activityRes.status === 'fulfilled' ? (activityRes.value?.data || []) : [];

      setCompany(detail);
      setDetailData({ detail, users, invoices, emails, stripe, activity });
    } catch (err: any) {
      logError('AdminCompanyDetail', 'fetchDetail', 'Failed to fetch company', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAccountType = async (newType: string) => {
    if (!company?.id) return;
    setUpdating(true);
    try {
      await api.patch(`/api/admin/companies/${company.id}`, { account_type: newType });
      await fetchCompanyDetail(company.id);
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateBillingTier = async (newTier: string) => {
    if (!company?.id) return;
    setUpdating(true);
    try {
      await api.patch(`/api/admin/companies/${company.id}`, { billing_tier: newTier });
      await fetchCompanyDetail(company.id);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" text="Loading company details..." /></div>;
  }

  if (!company) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Company not found</p>
        <button
          onClick={() => navigate('/admin')}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Back to Admin
        </button>
      </div>
    );
  }

  const detail = detailData.detail ?? company;
  const { users, invoices, emails, activity } = detailData;

  // AR Health calcs
  const totalAr = invoices?.total_ar ?? 0;
  const recoveredAr = invoices?.recovered_ar ?? 0;
  const recoveryRate = totalAr > 0 ? ((recoveredAr / totalAr) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{company.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            ID: <span className="font-mono text-xs">{company.id}</span>
            {' · '}
            {detail.created_at ? format(parseISO(detail.created_at), 'MMM d, yyyy') : '—'}
          </p>
        </div>
        <button
          onClick={() => navigate('/admin')}
          className="px-4 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-white/5"
        >
          ← Back
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-white/10 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 border-b-2 transition font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Account Type</label>
                  <select
                    value={detail.account_type}
                    onChange={(e) => handleUpdateAccountType(e.target.value)}
                    disabled={updating}
                    className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-white disabled:opacity-50"
                  >
                    <option value="pilot">Pilot</option>
                    <option value="paid">Paid</option>
                    <option value="free">Free</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-600 dark:text-gray-400">Billing Tier</label>
                  <select
                    value={detail.billing_tier}
                    onChange={(e) => handleUpdateBillingTier(e.target.value)}
                    disabled={updating}
                    className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-white disabled:opacity-50"
                  >
                    <option value="starter">Starter</option>
                    <option value="growth">Growth</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                {detail.trial_status && (
                  <div>
                    <label className="text-sm text-gray-600 dark:text-gray-400">Trial Status</label>
                    <p className="mt-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm rounded-lg">
                      {detail.trial_status} until{' '}
                      {detail.trial_ends_at ? format(parseISO(detail.trial_ends_at), 'MMM dd, yyyy') : 'N/A'}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Company Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {[
                  ['Company ID', company.id],
                  ['Account Type', detail.account_type],
                  ['Billing Tier', detail.billing_tier],
                  ['Trial Status', detail.trial_status ?? 'None'],
                  ['Trial Ends', detail.trial_ends_at ? format(parseISO(detail.trial_ends_at), 'MMM d, yyyy') : '—'],
                  ['Created', detail.created_at ? format(parseISO(detail.created_at), 'MMM d, yyyy') : '—'],
                  ['Updated', detail.updated_at ? format(parseISO(detail.updated_at), 'MMM d, yyyy') : '—'],
                ].map(([k, v]) => (
                  <div key={String(k)}>
                    <p className="text-gray-500 dark:text-gray-400 mb-1">{k}</p>
                    <p className="font-mono text-xs text-gray-900 dark:text-white">{String(v)}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── AR HEALTH ── */}
        {activeTab === 'ar-health' && (
          <div className="space-y-6">
            {!invoices ? (
              <p className="text-gray-500 dark:text-gray-400">No AR data available.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Invoices', value: invoices.total_invoices ?? 0 },
                    { label: 'Recovery Rate', value: `${recoveryRate}%` },
                    { label: 'Total AR', value: `$${((totalAr) / 100).toLocaleString()}` },
                    { label: 'Recovered', value: `$${((recoveredAr) / 100).toLocaleString()}` },
                  ].map(({ label, value }) => (
                    <Card key={label} className="p-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                      <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">{value}</p>
                    </Card>
                  ))}
                </div>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">AR Breakdown</h3>
                  <div className="space-y-3">
                    {[
                      ['Total AR', `$${((invoices.total_ar ?? 0) / 100).toLocaleString()}`],
                      ['Recovered', `$${((invoices.recovered_ar ?? 0) / 100).toLocaleString()}`],
                      ['Pending', `$${((invoices.pending_ar ?? 0) / 100).toLocaleString()}`],
                      ['Overdue Invoices', invoices.overdue_count ?? 0],
                      ['Avg Days Overdue', `${invoices.avg_days_overdue ?? 0} days`],
                    ].map(([k, v]) => (
                      <div key={String(k)} className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">{k}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            )}
          </div>
        )}

        {/* ── CUSTOMERS ── */}
        {activeTab === 'customers' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Search customers by name/email..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5"
              />
              <select className="px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5">
                <option>All Status</option>
                <option>Active</option>
                <option>Overdue</option>
                <option>Paid</option>
              </select>
              <select className="px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5">
                <option>Sort: AR Amount (High to Low)</option>
                <option>Sort: AR Amount (Low to High)</option>
                <option>Sort: Name (A-Z)</option>
                <option>Sort: Name (Z-A)</option>
              </select>
            </div>
            <Card className="p-6">
              <p className="text-gray-500 dark:text-gray-400">Customer-level AR breakdown with filters coming soon.</p>
            </Card>
          </div>
        )}

        {/* ── INVOICES ── */}
        {activeTab === 'invoices' && (
          <div className="space-y-6">
            <div className="flex gap-3 flex-wrap">
              <input
                type="text"
                placeholder="Search invoice..."
                className="flex-1 min-w-40 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5"
              />
              <select className="px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5">
                <option>Status: All</option>
                <option>Status: Paid</option>
                <option>Status: Pending</option>
                <option>Status: Overdue</option>
                <option>Status: Void</option>
              </select>
              <select className="px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5">
                <option>Sort: Amount (High to Low)</option>
                <option>Sort: Amount (Low to High)</option>
                <option>Sort: Due Date (Newest)</option>
                <option>Sort: Due Date (Oldest)</option>
              </select>
            </div>
            {!invoices ? (
              <p className="text-gray-500">No invoice data.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Invoices', value: invoices.total_invoices ?? 0 },
                    { label: 'Total AR', value: `$${((invoices.total_ar ?? 0) / 100).toLocaleString()}` },
                    { label: 'Recovered', value: `$${((invoices.recovered_ar ?? 0) / 100).toLocaleString()}` },
                    { label: 'Pending', value: `$${((invoices.pending_ar ?? 0) / 100).toLocaleString()}` },
                  ].map(({ label, value }) => (
                    <Card key={label} className="p-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                      <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">{value}</p>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── EMAILS ── */}
        {activeTab === 'emails' && (
          <div className="space-y-6">
            <div className="flex gap-3 flex-wrap">
              <input
                type="text"
                placeholder="Search email logs..."
                className="flex-1 min-w-40 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5"
              />
              <select className="px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5">
                <option>Status: All</option>
                <option>Status: Delivered</option>
                <option>Status: Bounced</option>
                <option>Status: Opened</option>
                <option>Status: Clicked</option>
              </select>
              <select className="px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5">
                <option>Last 30 days</option>
                <option>Last 7 days</option>
                <option>Last 24 hours</option>
              </select>
            </div>
            {!emails ? (
              <p className="text-gray-500">No email data.</p>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Sent', value: (emails.total_sent ?? 0).toLocaleString() },
                  { label: 'Delivered', value: (emails.delivered ?? 0).toLocaleString() },
                  { label: 'Opened', value: (emails.opened ?? 0).toLocaleString() },
                  { label: 'Clicked', value: (emails.clicked ?? 0).toLocaleString() },
                  { label: 'Bounced', value: (emails.bounced ?? 0).toLocaleString() },
                  { label: 'Unsubscribed', value: (emails.unsubscribed ?? 0).toLocaleString() },
                ].map(({ label, value }) => (
                  <Card key={label} className="p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                    <p className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">{value}</p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── USAGE ── */}
        {activeTab === 'usage' && (
          <Card className="p-6">
            <p className="text-gray-500 dark:text-gray-400">API usage and token tracking coming soon.</p>
          </Card>
        )}

        {/* ── BILLING ── */}
        {activeTab === 'billing' && (
          <Card className="p-6">
            <p className="text-gray-500 dark:text-gray-400">Subscription & billing details coming soon.</p>
          </Card>
        )}

        {/* ── TEAM ── */}
        {activeTab === 'team' && (
          <div className="space-y-4">
            {users.length === 0 ? (
              <Card className="p-6">
                <p className="text-gray-500 dark:text-gray-400">No team members found.</p>
              </Card>
            ) : (
              users.map((user) => (
                <Card key={user.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                    </div>
                    <div className="text-right">
                      <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded font-mono">
                        {user.role}
                      </span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* ── ACTIVITY ── */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <input
                type="text"
                placeholder="Search by user email or action..."
                className="flex-1 min-w-40 px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5"
              />
              <select className="px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5">
                <option>Action: All</option>
                <option>Action: Created</option>
                <option>Action: Updated</option>
                <option>Action: Deleted</option>
              </select>
              <select className="px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5">
                <option>Last 30 days</option>
                <option>Last 7 days</option>
                <option>Last 24 hours</option>
              </select>
            </div>
            <div className="space-y-3">
              {activity.length === 0 ? (
                <Card className="p-6">
                  <p className="text-gray-500 dark:text-gray-400">No activity logs.</p>
                </Card>
              ) : (
                activity.map((log) => (
                  <div key={log.id} className="text-xs border-l-4 border-indigo-400 pl-4 py-2 bg-gray-50 dark:bg-white/5 p-3 rounded">
                    <p className="font-mono text-gray-900 dark:text-white">{log.action}</p>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      {log.user_email} · {log.created_at ? format(parseISO(log.created_at), 'MMm d HH:mm') : '—'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCompanyDetail;
