import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { useNotification } from '../hooks/useNotification';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { formatDate } from '../lib/utils';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ActivitySkeleton } from '../components/ui/Skeleton';
import { Spinner } from '../components/ui/Spinner';

type Tab = 'emails'; // SMS, Payments, Events hidden (not in use yet)

const tabs: { id: Tab; label: string }[] = [
  { id: 'emails', label: 'Emails' },
  // { id: 'sms', label: 'SMS' },              // ❌ HIDDEN: SMS not in use (re-enable in Month 2)
  // { id: 'payments', label: 'Payments' },    // ❌ HIDDEN: Payments not in use (re-enable in Month 3)
  // { id: 'events', label: 'Events' },        // ❌ REMOVED: Internal noise in pilot (re-add as "Agent Decisions" in Month 2+ if needed)
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
  useEffect(() => { document.title = 'Activity — RecoverAI'; }, []);

  const { addToast } = useNotification();
  const [activeTab, setActiveTab] = useState<Tab>('emails');
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  // const [smsActivity, setSmsActivity] = useState<any[]>([]);           // ❌ HIDDEN
  // const [paymentEvents, setPaymentEvents] = useState<any[]>([]);       // ❌ HIDDEN
  const [queueStats, setQueueStats] = useState<any>(null);
  const [pilotMode, setPilotMode] = useState<string>('auto');

  // Queued emails (pending approval)
  const [queuedEmails, setQueuedEmails] = useState<any[]>([]);
  const [approvingQueue, setApprovingQueue] = useState<string | null>(null);
  const [approvingAllQueue, setApprovingAllQueue] = useState(false);
  const [previewQueueEmail, setPreviewQueueEmail] = useState<any>(null);
  const [previewQueueLoading, setPreviewQueueLoading] = useState(false);
  const [previewQueueData, setPreviewQueueData] = useState<{ subject: string; body: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [updatingEmail, setUpdatingEmail] = useState(false);

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

  const fetchQueuedEmails = useCallback(async () => {
    try {
      const res = await api.get<{ data: any[] }>('/api/pilot-queue');
      setQueuedEmails(res.data || []);
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to load queued emails',
      });
    }
  }, [addToast]);

  // ❌ HIDDEN: SMS fetcher (not in use, re-enable in future)
  // const fetchSms = useCallback(async () => {
  //   setLoading(true);
  //   try {
  //     const res = await api.get<{ data: any[] }>('/api/dashboard/sms-activity');
  //     setSmsActivity(res.data || []);
  //   } catch {}
  //   finally { setLoading(false); }
  // }, []);

  // ❌ HIDDEN: Payments fetcher (not in use, re-enable in future)
  // const fetchPayments = useCallback(async () => {
  //   setLoading(true);
  //   try {
  //     const res = await api.get<{ data: any[] }>('/api/dashboard/payment-events');
  //     setPaymentEvents(res.data || []);
  //   } catch {}
  //   finally { setLoading(false); }
  // }, []);

  useEffect(() => {
    if (activeTab === 'emails') {
      fetchEmails();
      fetchQueuedEmails();
    } else {
      // SMS & Payments tabs are hidden
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get<{ data: any }>('/api/settings');
        if (res.data?.pilotMode) {
          setPilotMode(res.data.pilotMode);
        }
      } catch {
        // Non-critical: use default
      }
    };
    fetchSettings();
  }, []);

  const handleEditEmail = (email: any) => {
    setSelectedEmail(email);
    setEditSubject(email.subject || '');
    setEditBody(email.email_body || '');
    setShowEditModal(true);
  };

  const saveEmailChanges = async () => {
    if (!selectedEmail) return;
    setUpdatingEmail(true);
    try {
      await api.put(`/api/email-logs/${selectedEmail.id}`, {
        subject: editSubject,
        email_body: editBody,
      });
      addToast({ type: 'success', message: 'Email updated successfully' });
      setShowEditModal(false);
      fetchEmails();
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to update email' });
    } finally {
      setUpdatingEmail(false);
    }
  };

  const deleteEmail = async () => {
    if (!selectedEmail) return;
    setUpdatingEmail(true);
    try {
      await api.delete(`/api/email-logs/${selectedEmail.id}`);
      addToast({ type: 'success', message: 'Email deleted' });
      setShowDeleteConfirm(false);
      setSelectedEmail(null);
      fetchEmails();
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to delete email' });
    } finally {
      setUpdatingEmail(false);
    }
  };

  const resendEmail = async (email: any) => {
    try {
      await api.post(`/api/email-logs/${email.id}/resend`);
      addToast({ type: 'success', message: 'Email queued for resending' });
      fetchEmails();
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to resend email' });
    }
  };

  // ============ QUEUED EMAIL HANDLERS (from EmailQueue) ============
  const handleApproveQueuedEmail = async (id: string) => {
    setApprovingQueue(id);
    try {
      await api.post(`/api/pilot-queue/${id}/approve`);
      addToast({
        type: 'success',
        message: 'Email approved and sent',
      });
      fetchQueuedEmails();
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to approve email',
      });
    } finally {
      setApprovingQueue(null);
    }
  };

  const handleRejectQueuedEmail = async (id: string) => {
    setApprovingQueue(id);
    try {
      await api.post(`/api/pilot-queue/${id}/reject`);
      addToast({
        type: 'success',
        message: 'Email rejected',
      });
      fetchQueuedEmails();
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to reject email',
      });
    } finally {
      setApprovingQueue(null);
    }
  };

  const handleApproveAllQueued = async () => {
    setApprovingAllQueue(true);
    try {
      const res = await api.post<{ sent_count: number; failed_count: number }>(
        `/api/pilot-queue/approve-all`
      );
      addToast({
        type: 'success',
        message: `${res.sent_count} emails sent${res.failed_count > 0 ? `, ${res.failed_count} failed` : ''}`,
      });
      fetchQueuedEmails();
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to approve emails',
      });
    } finally {
      setApprovingAllQueue(false);
    }
  };

  const handlePreviewQueuedEmail = async (email: any) => {
    setPreviewQueueEmail(email);
    setPreviewQueueLoading(true);
    setPreviewQueueData(null);
    try {
      const res = await api.get<{ data: { subject: string; body: string } }>(
        `/api/email/preview?invoiceId=${email.invoice_id}&emailType=${email.email_type}`
      );
      setPreviewQueueData(res.data);
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to load email preview',
      });
    } finally {
      setPreviewQueueLoading(false);
    }
  };

  const getModeColor = () => {
    if (pilotMode === 'shadow') return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-900 dark:text-yellow-200';
    if (pilotMode === 'paused') return 'bg-red-100 dark:bg-red-500/20 text-red-900 dark:text-red-200';
    return 'bg-green-100 dark:bg-green-500/20 text-green-900 dark:text-green-200';
  };

  const getModeLabel = () => {
    if (pilotMode === 'shadow') return '🔍 Shadow Mode (Review)';
    if (pilotMode === 'paused') return '⏸ Paused';
    return '✨ Auto Mode';
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agent Activity</h1>
          <span className={`px-3 py-1 rounded-full font-medium text-xs ${getModeColor()}`}>
            {getModeLabel()}
          </span>
        </div>
        {queueStats && activeTab === 'emails' && (
          <div className="flex gap-4 text-sm flex-wrap">
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
        <ActivitySkeleton />
      ) : (
        <>
          {/* Emails Tab */}
          {activeTab === 'emails' && (
            <div className="space-y-6">
              {/* SECTION 1: PENDING APPROVAL QUEUE */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">📬 Pending Approval</h3>
                  <div className="bg-blue-100 dark:bg-blue-500/20 text-blue-900 dark:text-blue-200 px-3 py-1 rounded-full font-medium text-sm">
                    {queuedEmails.length} pending
                  </div>
                </div>

                {queuedEmails.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No emails awaiting approval. All emails have been reviewed or sent.</p>
                ) : (
                  <div className="space-y-3">
                    {/* Approve All Button */}
                    {queuedEmails.length > 0 && (
                      <div className="flex gap-2 mb-4">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleApproveAllQueued}
                          loading={approvingAllQueue}
                        >
                          Approve All ({queuedEmails.length})
                        </Button>
                      </div>
                    )}

                    {/* Queue Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02]">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Customer</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Amount</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Days Overdue</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Email Type</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-white/[0.06]">
                          {queuedEmails.map((email: any) => (
                            <tr key={email.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white text-sm">{email.customer_name}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{email.recipient_email}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900 dark:text-white text-sm">${email.invoice_amount.toLocaleString()}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-gray-700 dark:text-gray-300 text-sm">{email.days_overdue}d</p>
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
                                  {email.email_type.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handlePreviewQueuedEmail(email)}
                                    className="text-xs px-2.5 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                  >
                                    👁 Preview
                                  </button>
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleApproveQueuedEmail(email.id)}
                                    loading={approvingQueue === email.id}
                                    disabled={approvingQueue !== null}
                                  >
                                    ✓ Approve
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleRejectQueuedEmail(email.id)}
                                    loading={approvingQueue === email.id}
                                    disabled={approvingQueue !== null}
                                  >
                                    ✕ Reject
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>

              {/* SECTION 2: SENT & TRACKED EMAILS */}
              <Card>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">✅ Sent & Tracked</h3>
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
                            <div key={log.id} className="p-4 bg-gray-50 dark:bg-white/[0.04] rounded-lg border border-gray-200 dark:border-white/[0.06]">
                              <div className="flex items-start gap-3">
                                <span className="text-lg mt-0.5">{statusIcon(log.status)}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-900 dark:text-white break-words">{log.subject}</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        To: <span className="font-mono">{log.recipient_email}</span> · {log.email_type} · {formatDate(log.sent_at)}
                                      </p>
                                      {log.opened_at && (
                                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Opened {formatDate(log.opened_at)}</p>
                                      )}
                                    </div>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${statusBadge(log.status)}`}>{log.status}</span>
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex gap-2 mt-3 flex-wrap">
                                    {/* Preview: Show only for shadow/pending emails (not sent) */}
                                    {log.status !== 'sent' && (
                                      <button
                                        onClick={() => {
                                          setSelectedEmail(log);
                                          setShowPreview(true);
                                        }}
                                        className="text-xs px-2.5 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                      >
                                        👁️ Preview
                                      </button>
                                    )}
                                    {/* Edit: Show only for shadow/pending emails (not sent) */}
                                    {log.status !== 'sent' && (
                                      <button
                                        onClick={() => handleEditEmail(log)}
                                        className="text-xs px-2.5 py-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                                      >
                                        ✏️ Edit
                                      </button>
                                    )}
                                    {['draft', 'failed'].includes(log.status) && (
                                      <button
                                        onClick={() => resendEmail(log)}
                                        className="text-xs px-2.5 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                                      >
                                        🔄 Send
                                      </button>
                                    )}
                                    {log.status !== 'sent' && (
                                      <button
                                        onClick={() => {
                                          setSelectedEmail(log);
                                          setShowDeleteConfirm(true);
                                        }}
                                        className="text-xs px-2.5 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                      >
                                        🗑️ Delete
                                      </button>
                                    )}
                                  </div>
                                </div>
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
            </div>
          )}

          {/* ❌ HIDDEN: SMS Tab (commented out - not in use) */}
          {/* {activeTab === 'sms' && (
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
          )} */}

          {/* ❌ HIDDEN: Payments Tab (commented out - not in use) */}
          {/* {activeTab === 'payments' && (
            <Card>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Payment Events</h3>
              {paymentEvents.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No payment events recorded yet.</p>
              ) : (
                <div className="overflow-x-auto sm:scrollbar-show">
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
          )} */}

          {/* ❌ HIDDEN: Events Tab (internal noise, re-add as "Agent Decisions" in Month 2 if needed) */}
          {/* {activeTab === 'events' && (
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-xs sm:text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Waiting: <span className="font-semibold text-gray-900 dark:text-white">{queueStats.waiting || 0}</span></span>
                      <span className="text-gray-600 dark:text-gray-400">Active: <span className="font-semibold text-emerald-600">{queueStats.active || 0}</span></span>
                      <span className="text-gray-600 dark:text-gray-400">Completed: <span className="font-semibold text-gray-900 dark:text-white">{queueStats.completed || 0}</span></span>
                      <span className="text-gray-600 dark:text-gray-400">Failed: <span className="font-semibold text-rose-600">{queueStats.failed || 0}</span></span>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )} */}
        </>
      )}

      {/* Email Preview Modal */}
      {showPreview && selectedEmail && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-white/[0.06] p-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Email Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">To:</label>
                <p className="text-sm text-gray-900 dark:text-white font-mono mt-1">{selectedEmail.recipient_email}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Subject:</label>
                <p className="text-sm text-gray-900 dark:text-white mt-1">{selectedEmail.subject}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Email Type:</label>
                <p className="text-sm text-gray-900 dark:text-white capitalize mt-1">{selectedEmail.email_type}</p>
              </div>

              <div className="border-t border-gray-200 dark:border-white/[0.06] pt-4">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Message:</label>
                <div className="mt-3 p-4 bg-gray-50 dark:bg-white/[0.03] rounded-lg border border-gray-200 dark:border-white/[0.06]">
                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {selectedEmail.body || selectedEmail.email_body || '(No message content)'}
                  </div>
                </div>
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-white/[0.06] pt-4">
                Sent: {formatDate(selectedEmail.sent_at)} · Status: {selectedEmail.status}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Edit Modal */}
      {showEditModal && selectedEmail && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-white/[0.06] p-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Email</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Recipient:</label>
                <p className="text-sm text-gray-900 dark:text-white font-mono">{selectedEmail.recipient_email}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Subject</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Message</label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-white/[0.06]">
                <Button
                  variant="primary"
                  onClick={saveEmailChanges}
                  loading={updatingEmail}
                  className="flex-1"
                >
                  Save Changes
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowEditModal(false)}
                  disabled={updatingEmail}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Queued Email Preview Modal */}
      {previewQueueEmail && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-white/[0.06] p-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Email Preview</h3>
              <button
                onClick={() => {
                  setPreviewQueueEmail(null);
                  setPreviewQueueData(null);
                }}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Customer:</p>
                <p className="text-gray-900 dark:text-white">{previewQueueEmail.customer_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{previewQueueEmail.recipient_email}</p>
              </div>

              {previewQueueLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner text="Generating preview..." />
                </div>
              ) : previewQueueData ? (
                <div className="space-y-4 bg-gray-50 dark:bg-white/[0.03] rounded-lg p-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide">
                      Subject
                    </label>
                    <div className="bg-white dark:bg-white/[0.05] rounded px-3 py-2 text-sm text-gray-900 dark:text-white font-medium">
                      {previewQueueData.subject}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide">
                      Body
                    </label>
                    <div className="bg-white dark:bg-white/[0.05] rounded px-3 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                      {previewQueueData.body}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex gap-3 justify-end mt-6 p-6 border-t border-gray-200 dark:border-white/[0.06]">
              <Button
                variant="secondary"
                onClick={() => {
                  setPreviewQueueEmail(null);
                  setPreviewQueueData(null);
                }}
              >
                Close
              </Button>
              {previewQueueData && (
                <Button
                  variant="primary"
                  onClick={() => {
                    handleApproveQueuedEmail(previewQueueEmail.id);
                    setPreviewQueueEmail(null);
                    setPreviewQueueData(null);
                  }}
                  loading={approvingQueue === previewQueueEmail.id}
                  disabled={approvingQueue !== null}
                >
                  Approve & Send
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        title="Delete email?"
        message="This email will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDangerous={true}
        isLoading={updatingEmail}
        onConfirm={deleteEmail}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setSelectedEmail(null);
        }}
      />
    </div>
  );
};

export default Activity;
