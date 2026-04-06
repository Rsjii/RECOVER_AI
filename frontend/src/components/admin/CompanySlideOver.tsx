import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { AdminCompanyDetail, CompanyDetailData } from '../../hooks/useAdminCompanies';
import { Card } from '../ui/Card';

interface CompanySlideOverProps {
  open: boolean;
  company: AdminCompanyDetail | null;
  detailData: CompanyDetailData;
  loading: boolean;
  onClose: () => void;
  onUpdate: (companyId: string, updates: any) => Promise<void>;
}

const TABS = [
  { id: 'overview',   label: '📊 Overview' },
  { id: 'ar-health',  label: '💰 AR Health' },
  { id: 'customers',  label: '👥 Customers' },
  { id: 'invoices',   label: '📄 Invoices' },
  { id: 'emails',     label: '📧 Emails' },
  { id: 'usage',      label: '⚡ Usage' },
  { id: 'billing',    label: '💳 Billing' },
  { id: 'team',       label: '👤 Team' },
  { id: 'activity',   label: '📋 Activity' },
];

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-gray-600 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color ?? 'text-gray-900 dark:text-white'}`}>{value}</p>
    </Card>
  );
}

export const CompanySlideOver: React.FC<CompanySlideOverProps> = ({
  open,
  company,
  detailData,
  loading,
  onClose,
  onUpdate,
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [updating, setUpdating] = useState(false);

  if (!open || !company) return null;

  // Use freshly-fetched detail if available, otherwise fall back to list-row company
  const detail = detailData.detail ?? company;
  const { users, invoices, emails, stripe, activity } = detailData;

  const handleUpdateAccountType = async (newType: string) => {
    setUpdating(true);
    try { await onUpdate(company.id, { account_type: newType }); }
    finally { setUpdating(false); }
  };

  const handleUpdateBillingTier = async (newTier: string) => {
    setUpdating(true);
    try { await onUpdate(company.id, { billing_tier: newTier }); }
    finally { setUpdating(false); }
  };

  // AR Health calcs
  const totalAr = invoices?.total_ar ?? 0;
  const recoveredAr = invoices?.recovered_ar ?? 0;
  const pendingAr = invoices?.pending_ar ?? 0;
  const recoveryRate = totalAr > 0 ? ((recoveredAr / totalAr) * 100).toFixed(1) : '0.0';

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity z-40"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white dark:bg-gray-900 shadow-xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex-none bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-white/10 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{company.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              ID: <span className="font-mono text-xs">{company.id}</span>
              {' · '}
              {detail.created_at ? format(parseISO(detail.created_at), 'MMM d, yyyy') : '—'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl leading-none"
          >✕</button>
        </div>

        {/* Tabs */}
        <div className="flex-none border-b border-gray-200 dark:border-white/10 overflow-x-auto">
          <div className="flex gap-0 min-w-max">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 border-b-2 transition font-medium text-xs whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading company data...</div>
          ) : (
            <>
              {/* ── OVERVIEW ── */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <Card className="p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Account Settings</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm text-gray-600 dark:text-gray-400">Account Type</label>
                        <select
                          value={detail.account_type}
                          onChange={(e) => handleUpdateAccountType(e.target.value)}
                          disabled={updating}
                          className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-white disabled:opacity-50"
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
                          className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-gray-900 dark:text-white disabled:opacity-50"
                        >
                          <option value="starter">Starter</option>
                          <option value="growth">Growth</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                      </div>
                      {detail.trial_status && (
                        <div>
                          <label className="text-sm text-gray-600 dark:text-gray-400">Trial Status</label>
                          <p className="mt-1 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm rounded-lg">
                            {detail.trial_status} until{' '}
                            {detail.trial_ends_at ? format(parseISO(detail.trial_ends_at), 'MMM dd, yyyy') : 'N/A'}
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Company Info</h3>
                    <div className="space-y-2 text-sm">
                      {[
                        ['Company ID', company.id],
                        ['Account Type', detail.account_type],
                        ['Billing Tier', detail.billing_tier],
                        ['Trial Status', detail.trial_status ?? 'None'],
                        ['Trial Started', detail.trial_started_at ? format(parseISO(detail.trial_started_at), 'MMM d, yyyy') : '—'],
                        ['Trial Ends', detail.trial_ends_at ? format(parseISO(detail.trial_ends_at), 'MMM d, yyyy') : '—'],
                        ['Created', detail.created_at ? format(parseISO(detail.created_at), 'MMM d, yyyy') : '—'],
                        ['Last Updated', detail.updated_at ? format(parseISO(detail.updated_at), 'MMM d, yyyy') : '—'],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4">
                          <span className="text-gray-500 dark:text-gray-400 shrink-0">{k}</span>
                          <span className="text-gray-900 dark:text-white font-mono text-xs text-right break-all">{v}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}

              {/* ── AR HEALTH ── */}
              {activeTab === 'ar-health' && (
                <div className="space-y-4">
                  {!invoices ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No AR data available.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <StatCard label="Total Invoices" value={invoices.total_invoices ?? 0} />
                        <StatCard label="Recovery Rate" value={`${recoveryRate}%`} color="text-indigo-600 dark:text-indigo-400" />
                        <StatCard label="Total AR" value={`$${((totalAr) / 100).toLocaleString()}`} />
                        <StatCard label="Recovered" value={`$${((recoveredAr) / 100).toLocaleString()}`} color="text-green-600 dark:text-green-400" />
                        <StatCard label="Pending" value={`$${((pendingAr) / 100).toLocaleString()}`} color="text-orange-600 dark:text-orange-400" />
                        {invoices.overdue_count != null && (
                          <StatCard label="Overdue" value={invoices.overdue_count} color="text-red-600 dark:text-red-400" />
                        )}
                      </div>

                      {invoices.avg_days_overdue != null && (
                        <Card className="p-4">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Aging</h3>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400">Avg Days Overdue</span>
                            <span className="font-medium text-gray-900 dark:text-white">{Math.round(invoices.avg_days_overdue)} days</span>
                          </div>
                        </Card>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── CUSTOMERS ── */}
              {activeTab === 'customers' && (
                <div className="space-y-4">
                  <Card className="p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Customer-level AR breakdown coming soon. Use the Invoices tab for AR totals.
                    </p>
                  </Card>
                </div>
              )}

              {/* ── INVOICES ── */}
              {activeTab === 'invoices' && (
                <div className="space-y-4">
                  {!invoices ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No invoice data available.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <StatCard label="Total Invoices" value={invoices.total_invoices ?? 0} />
                        <StatCard label="Total AR" value={`$${((invoices.total_ar ?? 0) / 100).toLocaleString()}`} />
                        <StatCard label="Recovered" value={`$${((invoices.recovered_ar ?? 0) / 100).toLocaleString()}`} color="text-green-600 dark:text-green-400" />
                        <StatCard label="Pending" value={`$${((invoices.pending_ar ?? 0) / 100).toLocaleString()}`} color="text-orange-600 dark:text-orange-400" />
                      </div>

                      {invoices.by_status && (
                        <Card className="p-4">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">By Status</h3>
                          <div className="space-y-2">
                            {Object.entries(invoices.by_status).map(([status, count]) => (
                              <div key={status} className="flex justify-between text-sm">
                                <span className="text-gray-500 dark:text-gray-400 capitalize">{status}</span>
                                <span className="font-medium text-gray-900 dark:text-white">{String(count)}</span>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── EMAILS ── */}
              {activeTab === 'emails' && (
                <div className="space-y-4">
                  {!emails ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No email data available.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <StatCard label="Total Sent" value={emails.total_sent ?? 0} />
                        <StatCard label="Delivered" value={emails.delivered ?? 0} color="text-green-600 dark:text-green-400" />
                        <StatCard label="Opened" value={emails.opened ?? 0} color="text-blue-600 dark:text-blue-400" />
                        <StatCard label="Clicked" value={emails.clicked ?? 0} color="text-indigo-600 dark:text-indigo-400" />
                      </div>

                      <Card className="p-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Rates</h3>
                        <div className="space-y-2 text-sm">
                          {[
                            ['Open Rate', emails.total_sent ? `${((emails.opened / emails.total_sent) * 100).toFixed(1)}%` : '—'],
                            ['Click Rate', emails.total_sent ? `${((emails.clicked / emails.total_sent) * 100).toFixed(1)}%` : '—'],
                            ['Delivery Rate', emails.total_sent ? `${((emails.delivered / emails.total_sent) * 100).toFixed(1)}%` : '—'],
                            ['Bounced', emails.bounced ?? 0],
                            ['Unsubscribed', emails.unsubscribed ?? 0],
                          ].map(([k, v]) => (
                            <div key={String(k)} className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">{k}</span>
                              <span className="font-medium text-gray-900 dark:text-white">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </Card>
                    </>
                  )}
                </div>
              )}

              {/* ── USAGE ── */}
              {activeTab === 'usage' && (
                <div className="space-y-4">
                  <Card className="p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Per-company API usage and token tracking coming soon.
                    </p>
                  </Card>
                </div>
              )}

              {/* ── BILLING / STRIPE ── */}
              {activeTab === 'billing' && (
                <div className="space-y-3">
                  {stripe.length === 0 ? (
                    <Card className="p-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">No Stripe accounts connected.</p>
                    </Card>
                  ) : (
                    stripe.map((acc) => (
                      <Card key={acc.id} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-mono text-sm text-gray-900 dark:text-white">{acc.stripe_account_id}</p>
                          <span className={`px-2 py-1 text-xs rounded font-medium ${
                            acc.is_active
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                          }`}>
                            {acc.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        {acc.label && <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{acc.label}</p>}
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Connected: {acc.connected_at ? format(parseISO(acc.connected_at), 'MMM d, yyyy') : '—'}
                        </p>
                      </Card>
                    ))
                  )}
                </div>
              )}

              {/* ── TEAM ── */}
              {activeTab === 'team' && (
                <div className="space-y-3">
                  {users.length === 0 ? (
                    <Card className="p-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">No team members found.</p>
                    </Card>
                  ) : (
                    users.map((user) => (
                      <Card key={user.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white text-sm">
                              {user.first_name} {user.last_name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 ml-3">
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded font-mono">
                              {user.role}
                            </span>
                            {user.created_at && (
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                {format(parseISO(user.created_at), 'MMM d, yyyy')}
                              </span>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              )}

              {/* ── ACTIVITY ── */}
              {activeTab === 'activity' && (
                <div className="space-y-2">
                  {activity.length === 0 ? (
                    <Card className="p-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">No activity logs.</p>
                    </Card>
                  ) : (
                    activity.map((log) => (
                      <div key={log.id} className="text-xs border-l-2 border-indigo-300 dark:border-indigo-700 pl-3 py-2">
                        <p className="font-mono text-gray-900 dark:text-white">{log.action}</p>
                        <p className="text-gray-500 dark:text-gray-400 mt-0.5">
                          {log.user_email} · {log.created_at ? format(parseISO(log.created_at), 'MMM d HH:mm') : '—'}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};