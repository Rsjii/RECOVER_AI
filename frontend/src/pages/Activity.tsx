import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { formatDate, formatCurrency } from '../lib/utils';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';

type Tab = 'emails' | 'sms' | 'payments' | 'events';

const tabs: { id: Tab; label: string }[] = [
  { id: 'emails', label: 'Emails' },
  { id: 'sms', label: 'SMS' },
  { id: 'payments', label: 'Payments' },
  { id: 'events', label: 'Events' },
];

const statusIcon = (status: string) => {
  switch (status) {
    case 'opened': case 'clicked': return '✅';
    case 'bounced': case 'failed': return '❌';
    case 'delivered': return '📬';
    default: return '📧';
  }
};

const statusBadge = (status: string) =>
  ['opened', 'clicked'].includes(status)
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    : ['bounced', 'failed'].includes(status)
    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    : 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300';

function groupByDate<T extends { sent_at?: string; paid_at?: string; created_at?: string }>(
  items: T[],
  dateKey: keyof T = 'sent_at' as keyof T
): Array<{ dateLabel: string; items: T[] }> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const raw = item[dateKey] as string | undefined;
    if (!raw) continue;
    const d = new Date(raw); d.setHours(0, 0, 0, 0);
    let label: string;
    if (d.getTime() === today.getTime()) label = 'Today';
    else if (d.getTime() === yesterday.getTime()) label = 'Yesterday';
    else label = new Date(raw).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(item);
  }
  return Array.from(groups.entries()).map(([dateLabel, items]) => ({ dateLabel, items }));
}

const Activity: React.FC = () => {
  useEffect(() => { document.title = 'Activity — CashOS'; }, []);

  const [activeTab, setActiveTab] = useState<Tab>('emails');
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [smsActivity, setSmsActivity] = useState<any[]>([]);
  const [paymentEvents, setPaymentEvents] = useState<any[]>([]);
  const [queueStats, setQueueStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        api.get<{ data: any[] }>(API_ENDPOINTS.email.logs),
        api.get<{ data: any }>(API_ENDPOINTS.email.stats).catch(() => ({ data: null })),
      ]);
      setEmailLogs(logsRes.data || []);
      setQueueStats(statsRes.data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  const fetchSms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: any[] }>('/api/dashboard/sms-activity');
      setSmsActivity(res.data || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: any[] }>('/api/dashboard/payment-events');
      setPaymentEvents(res.data || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'emails') fetchEmails();
    else if (activeTab === 'sms') fetchSms();
    else if (activeTab === 'payments') fetchPayments();
    else setLoading(false);
  }, [activeTab]);

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agent Activity</h1>
        {queueStats && activeTab === 'emails' && (
          <div className="flex gap-4 text-sm">
            <span className="text-gray-500">Queue: <span className="font-medium text-gray-900 dark:text-white">{queueStats.waiting || 0} waiting</span></span>
            <span className="text-gray-500">Active: <span className="font-medium text-green-600">{queueStats.active || 0}</span></span>
          </div>
        )}
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-white/[0.08]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t.id
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" text="Loading..." /></div>
      ) : (
        <>
          {/* Emails Tab */}
          {activeTab === 'emails' && (
            <Card>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Recent Emails</h3>
              {emailLogs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No emails sent yet. Start the dunning agent from the Invoices page.</p>
              ) : (
                <>
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg mb-4 text-sm text-blue-700 dark:text-blue-300">
                    All emails include a CAN-SPAM compliant unsubscribe link. Replies and opt-outs are tracked automatically.
                  </div>
                  <div className="space-y-1 max-h-[600px] overflow-y-auto">
                    {groupByDate(emailLogs, 'sent_at').map(({ dateLabel, items }) => (
                      <div key={dateLabel}>
                        <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 py-2 px-1 sticky top-0 bg-white dark:bg-[#09090b] z-10">
                          {dateLabel}
                        </div>
                        <div className="space-y-2">
                          {items.map((log: any) => (
                            <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-white/[0.04] rounded-lg">
                              <span className="text-lg mt-0.5">{statusIcon(log.status)}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{log.subject}</p>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2 ${statusBadge(log.status)}`}>{log.status}</span>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  To: {log.recipient_email} · {log.email_type} · {formatDate(log.sent_at)}
                                </p>
                                {log.opened_at && (
                                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Opened {formatDate(log.opened_at)}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          )}

          {/* SMS Tab */}
          {activeTab === 'sms' && (
            <Card>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">SMS Messages Sent</h3>
              {smsActivity.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">No SMS messages sent yet.</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">SMS is triggered automatically after 2+ emails and 7+ days overdue (for opted-in customers).</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {smsActivity.map((item: any) => (
                    <div key={item.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-white/[0.04] rounded-lg">
                      <span className="text-lg mt-0.5">💬</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{item.customer_name}</p>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{item.sms_count} SMS sent</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {item.customer_phone} · {formatCurrency(Number(item.amount), item.currency)} overdue · Last: {formatDate(item.last_sms_sent_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Payments Tab */}
          {activeTab === 'payments' && (
            <Card>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Payment Events</h3>
              {paymentEvents.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No payment events recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="border-b border-gray-200 dark:border-white/[0.08]">
                      <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        <th className="pb-3 font-medium">Customer</th>
                        <th className="pb-3 font-medium">Amount</th>
                        <th className="pb-3 font-medium">Method</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                      {paymentEvents.map((p: any) => (
                        <tr key={p.id}>
                          <td className="py-3">
                            <div className="font-medium text-gray-900 dark:text-white">{p.customer_name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{p.customer_email}</div>
                          </td>
                          <td className="py-3 font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(Number(p.amount), p.currency)}</td>
                          <td className="py-3 text-gray-600 dark:text-gray-300 capitalize">{p.payment_method}</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              p.status === 'succeeded' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                              p.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            }`}>{p.status}</span>
                          </td>
                          <td className="py-3 text-gray-500 dark:text-gray-400">{formatDate(p.paid_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* Events Tab */}
          {activeTab === 'events' && (
            <Card>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">System Events</h3>
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 dark:bg-white/[0.04] rounded-lg flex items-start gap-3">
                  <span className="text-lg">🤖</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Agent runs automatically</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">The dunning agent evaluates all unpaid invoices and queues emails. Use the Dashboard to trigger a manual run or preview what would happen.</p>
                  </div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-white/[0.04] rounded-lg flex items-start gap-3">
                  <span className="text-lg">📊</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Risk scores updated daily</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Customer risk scores are recalculated based on payment history, card status, and invoice aging. High-risk customers are prioritized in the dunning queue.</p>
                  </div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-white/[0.04] rounded-lg flex items-start gap-3">
                  <span className="text-lg">🔄</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Invoice sync from integrations</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">New invoices sync automatically from Stripe, QuickBooks, and Chargebee. Manual syncs can be triggered from the Invoices page.</p>
                  </div>
                </div>
                {queueStats && (
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                    <p className="text-sm font-medium text-indigo-900 dark:text-indigo-300">Current Queue Status</p>
                    <div className="flex gap-6 mt-2 text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Waiting: <span className="font-semibold text-gray-900 dark:text-white">{queueStats.waiting || 0}</span></span>
                      <span className="text-gray-600 dark:text-gray-400">Active: <span className="font-semibold text-emerald-600">{queueStats.active || 0}</span></span>
                      <span className="text-gray-600 dark:text-gray-400">Completed: <span className="font-semibold text-gray-900 dark:text-white">{queueStats.completed || 0}</span></span>
                      <span className="text-gray-600 dark:text-gray-400">Failed: <span className="font-semibold text-rose-600">{queueStats.failed || 0}</span></span>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default Activity;
