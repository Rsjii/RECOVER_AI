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

// Strip HTML tags for plain text display
function stripHtml(html: string): string {
  if (!html) return '';
  const tmp = document.createElement('DIV');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
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

  // Filters for Sent & Tracked section
  const [statusFilter, setStatusFilter] = useState<string>('all'); // all | sent | opened | clicked | bounced | failed
  const [searchCustomer, setSearchCustomer] = useState<string>('');

  // Filters for Pending Approval section
  const [pendingChannelFilter, setPendingChannelFilter] = useState<string>('all'); // all | email | sms
  const [pendingEmailTypeFilter, setPendingEmailTypeFilter] = useState<string>('all');
  const [pendingDaysOverdueFilter, setPendingDaysOverdueFilter] = useState<string>('all'); // all | 0-30 | 30-60 | 60+

  // Multi-select for bulk operations
  const [selectedPendingIds, setSelectedPendingIds] = useState<Set<string>>(new Set());
  const [selectedRejectedIds, setSelectedRejectedIds] = useState<Set<string>>(new Set());
  const [bulkOperating, setBulkOperating] = useState(false);

  // Queued emails (pending approval & rejected)
  const [queuedEmails, setQueuedEmails] = useState<any[]>([]);
  const [rejectedEmails, setRejectedEmails] = useState<any[]>([]);
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
      // Fetch pending emails (required)
      const pendingRes = await api.get<{ data: any[] }>('/api/pilot-queue');
      setQueuedEmails(pendingRes?.data || []);

      // Fetch rejected emails separately (optional - don't crash if fails)
      try {
        const rejectedRes = await api.get<{ data: any[] }>('/api/pilot-queue?status=rejected');
        setRejectedEmails(rejectedRes?.data || []);
      } catch {
        // Rejected emails endpoint might not return data - silently continue
        setRejectedEmails([]);
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to load pending emails',
      });
      // Still set empty arrays so component doesn't break
      setQueuedEmails([]);
      setRejectedEmails([]);
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
    setEditBody(email.body || email.email_body || '');
    setShowEditModal(true);
  };

  const saveEmailChanges = async () => {
    if (!selectedEmail) return;
    setUpdatingEmail(true);
    try {
      // Check if email is from pending queue or sent logs
      // Pending emails have attempt_number field, or status='pending'
      const isPending = queuedEmails.some(e => e.id === selectedEmail.id) || selectedEmail.status === 'pending';

      if (isPending) {
        // Update pending item (email or SMS) via pilot-queue endpoint
        if (selectedEmail.type === 'sms') {
          // Update SMS message
          await api.put(`/api/pilot-queue/${selectedEmail.id}`, {
            message_full: editBody,
            message_preview: editBody.slice(0, 160),
          });
          addToast({ type: 'success', message: 'SMS message updated successfully' });
        } else {
          // Update email
          await api.put(`/api/pilot-queue/${selectedEmail.id}`, {
            subject: editSubject,
            body: editBody,
          });
          addToast({ type: 'success', message: 'Email updated successfully' });
        }
        setShowEditModal(false);
        fetchQueuedEmails();
      } else {
        // Update sent email via email-logs endpoint
        await api.put(`/api/email-logs/${selectedEmail.id}`, {
          subject: editSubject,
          email_body: editBody,
        });
        addToast({ type: 'success', message: 'Email updated successfully' });
        setShowEditModal(false);
        fetchEmails();
      }
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
      const item = queuedEmails.find(e => e.id === id);
      const itemType = item?.type === 'sms' ? 'SMS' : 'Email';
      await api.post(`/api/pilot-queue/${id}/approve`);
      addToast({
        type: 'success',
        message: `${itemType} approved and sent`,
      });
      fetchQueuedEmails();
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to approve item',
      });
    } finally {
      setApprovingQueue(null);
    }
  };

  const handleRejectQueuedEmail = async (id: string) => {
    setApprovingQueue(id);
    try {
      const item = queuedEmails.find(e => e.id === id);
      const itemType = item?.type === 'sms' ? 'SMS' : 'Email';
      await api.post(`/api/pilot-queue/${id}/reject`);
      addToast({
        type: 'success',
        message: `${itemType} rejected`,
      });
      fetchQueuedEmails();
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to reject item',
      });
    } finally {
      setApprovingQueue(null);
    }
  };

  // Move rejected email back to pending approval (SHADOW mode only)
  const handleMoveToPending = async (id: string) => {
    setApprovingQueue(id);
    try {
      await api.post(`/api/pilot-queue/${id}/move-to-pending`);
      addToast({
        type: 'success',
        message: 'Email moved to Pending Approval. You can now edit and approve it.',
      });
      fetchQueuedEmails();
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to move email to pending',
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
        message: `${res.sent_count} items sent${res.failed_count > 0 ? `, ${res.failed_count} failed` : ''}`,
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

  const handleBulkApproveSelected = async () => {
    if (selectedPendingIds.size === 0) return;
    setBulkOperating(true);
    try {
      const ids = Array.from(selectedPendingIds);
      const res = await api.post<{ sent_count: number; failed_count: number }>(
        `/api/pilot-queue/bulk/approve-selected`,
        { ids }
      );
      addToast({
        type: 'success',
        message: `${res.sent_count} items approved${res.failed_count > 0 ? `, ${res.failed_count} failed` : ''}`,
      });
      setSelectedPendingIds(new Set());
      fetchQueuedEmails();
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to approve items',
      });
    } finally {
      setBulkOperating(false);
    }
  };

  const handleBulkRejectSelected = async () => {
    if (selectedPendingIds.size === 0) return;
    setBulkOperating(true);
    try {
      const ids = Array.from(selectedPendingIds);
      const res = await api.post<{ rejected_count: number; failed_count: number }>(
        `/api/pilot-queue/bulk/reject-selected`,
        { ids }
      );
      addToast({
        type: 'success',
        message: `${res.rejected_count} items rejected${res.failed_count > 0 ? `, ${res.failed_count} failed` : ''}`,
      });
      setSelectedPendingIds(new Set());
      fetchQueuedEmails();
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to reject items',
      });
    } finally {
      setBulkOperating(false);
    }
  };

  const handlePreviewQueuedEmail = async (email: any) => {
    setPreviewQueueEmail(email);
    // Handle both email and SMS previews
    if (email.type === 'sms') {
      // SMS preview
      setPreviewQueueData({
        subject: `SMS to ${email.phone_number}`,
        body: email.message_full || email.message_preview || '',
      });
      setPreviewQueueLoading(false);
    } else if (email.subject && email.body) {
      // Email preview from stored data
      setPreviewQueueData({ subject: email.subject, body: email.body });
      setPreviewQueueLoading(false);
    } else {
      // Fallback: fetch from API if not stored (shouldn't happen)
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
          message: err.message || 'Failed to load preview',
        });
      } finally {
        setPreviewQueueLoading(false);
      }
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
                    {/* Filters for Pending Approval */}
                    <div className="mb-4 flex flex-col sm:flex-row gap-3">
                      {/* Channel Filter */}
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Channel</label>
                        <select
                          value={pendingChannelFilter}
                          onChange={(e) => setPendingChannelFilter(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white"
                        >
                          <option value="all">All Channels</option>
                          <option value="email">📧 Email</option>
                          <option value="sms">📱 SMS</option>
                        </select>
                      </div>

                      {/* Dunning Stage Filter - Dynamic */}
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Stage</label>
                        <select
                          value={pendingEmailTypeFilter}
                          onChange={(e) => setPendingEmailTypeFilter(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white"
                        >
                          <option value="all">All Stages</option>
                          {Array.from(new Set(queuedEmails.map((e: any) => e.email_type)))
                            .sort()
                            .map((type: string) => (
                              <option key={type} value={type}>
                                {type.replace(/_/g, ' ').charAt(0).toUpperCase() + type.replace(/_/g, ' ').slice(1)}
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Days Overdue Filter */}
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Days Overdue</label>
                        <select
                          value={pendingDaysOverdueFilter}
                          onChange={(e) => setPendingDaysOverdueFilter(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white"
                        >
                          <option value="all">All Ages</option>
                          <option value="0-30">0-30 days</option>
                          <option value="30-60">30-60 days</option>
                          <option value="60+">60+ days</option>
                        </select>
                      </div>
                    </div>

                    {/* Bulk Action Buttons */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleApproveAllQueued}
                        loading={approvingAllQueue}
                      >
                        Approve All ({queuedEmails.length})
                      </Button>
                      {selectedPendingIds.size > 0 && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={handleBulkApproveSelected}
                            loading={bulkOperating}
                          >
                            ✓ Approve Selected ({selectedPendingIds.size})
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleBulkRejectSelected}
                            loading={bulkOperating}
                            disabled={bulkOperating}
                          >
                            ✕ Reject Selected ({selectedPendingIds.size})
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedPendingIds(new Set())}
                            disabled={bulkOperating}
                          >
                            Clear Selection
                          </Button>
                        </>
                      )}
                    </div>

                    {/* Queue Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02]">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                              <input
                                type="checkbox"
                                checked={selectedPendingIds.size === queuedEmails.length && queuedEmails.length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPendingIds(new Set(queuedEmails.map((email: any) => email.id)));
                                  } else {
                                    setSelectedPendingIds(new Set());
                                  }
                                }}
                                className="rounded"
                              />
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Customer</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Amount</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Days Overdue</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Type</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-white/[0.06]">
                          {queuedEmails
                            .filter((email: any) => {
                              // Filter by channel (email vs sms)
                              if (pendingChannelFilter !== 'all' && email.type !== pendingChannelFilter) {
                                return false;
                              }
                              // Filter by dunning stage/email_type
                              if (pendingEmailTypeFilter !== 'all' && email.email_type !== pendingEmailTypeFilter) {
                                return false;
                              }
                              // Filter by days overdue
                              if (pendingDaysOverdueFilter !== 'all') {
                                if (pendingDaysOverdueFilter === '0-30' && email.days_overdue > 30) return false;
                                if (pendingDaysOverdueFilter === '30-60' && (email.days_overdue < 30 || email.days_overdue > 60)) return false;
                                if (pendingDaysOverdueFilter === '60+' && email.days_overdue < 60) return false;
                              }
                              return true;
                            })
                            .map((email: any) => (
                            <tr key={email.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedPendingIds.has(email.id)}
                                  onChange={(e) => {
                                    const newSelected = new Set(selectedPendingIds);
                                    if (e.target.checked) {
                                      newSelected.add(email.id);
                                    } else {
                                      newSelected.delete(email.id);
                                    }
                                    setSelectedPendingIds(newSelected);
                                  }}
                                  className="rounded"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white text-sm">{email.customer_name}</p>
                                  {email.type === 'sms' ? (
                                    <>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">📱 {email.phone_number ? `${email.phone_number.slice(0, -4)}****` : 'N/A'}</p>
                                      {email.message_preview && (
                                        <p className="text-xs text-gray-600 dark:text-gray-500 truncate mt-1">"{email.message_preview.slice(0, 50)}..."</p>
                                      )}
                                    </>
                                  ) : (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{email.recipient_email}</p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900 dark:text-white text-sm">${email.invoice_amount.toLocaleString()}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-gray-700 dark:text-gray-300 text-sm">{email.days_overdue}d</p>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  email.type === 'sms'
                                    ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                                    : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                                }`}>
                                  {email.type === 'sms' ? '📱 SMS' : `📧 ${email.email_type.replace(/_/g, ' ')}`}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-2 flex-wrap">
                                  <button
                                    onClick={() => handlePreviewQueuedEmail(email)}
                                    className="text-xs px-2.5 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                  >
                                    👁 Preview
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedEmail(email);
                                      // For SMS: edit message_full, for Email: edit subject/body
                                      if (email.type === 'sms') {
                                        setEditSubject('SMS Message');
                                        setEditBody(email.message_full || email.message_preview || '');
                                      } else {
                                        setEditSubject(email.subject || '');
                                        setEditBody(email.body || '');
                                      }
                                      setShowEditModal(true);
                                    }}
                                    className="text-xs px-2.5 py-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                                  >
                                    ✏️ Edit
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

              {/* SECTION 1B: REJECTED EMAILS */}
              {rejectedEmails.length > 0 && (
                <Card>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">⚠️ Rejected Emails</h3>
                    <div className="bg-red-100 dark:bg-red-500/20 text-red-900 dark:text-red-200 px-3 py-1 rounded-full font-medium text-sm">
                      {rejectedEmails.length} rejected
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400">These emails were rejected and won't be queued again for 7 days. You can approve them below to send immediately.</p>

                    {/* Bulk Actions for Rejected */}
                    {selectedRejectedIds.size > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={async () => {
                            setBulkOperating(true);
                            try {
                              const ids = Array.from(selectedRejectedIds);
                              const res = await api.post<{ sent_count: number; failed_count: number }>(
                                `/api/pilot-queue/bulk/approve-selected`,
                                { ids }
                              );
                              addToast({
                                type: 'success',
                                message: `${res.sent_count} emails approved${res.failed_count > 0 ? `, ${res.failed_count} failed` : ''}`,
                              });
                              setSelectedRejectedIds(new Set());
                              fetchQueuedEmails();
                            } catch (err: any) {
                              addToast({
                                type: 'error',
                                message: err.message || 'Failed to approve emails',
                              });
                            } finally {
                              setBulkOperating(false);
                            }
                          }}
                          loading={bulkOperating}
                        >
                          ✓ Approve Selected ({selectedRejectedIds.size})
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={async () => {
                            setBulkOperating(true);
                            try {
                              const ids = Array.from(selectedRejectedIds);
                              const res = await api.post<{ moved_count: number; failed_count: number }>(
                                `/api/pilot-queue/bulk/move-to-pending-selected`,
                                { ids }
                              );
                              addToast({
                                type: 'success',
                                message: `${res.moved_count} emails moved to Pending Approval${res.failed_count > 0 ? `, ${res.failed_count} failed` : ''}`,
                              });
                              setSelectedRejectedIds(new Set());
                              fetchQueuedEmails();
                            } catch (err: any) {
                              addToast({
                                type: 'error',
                                message: err.message || 'Failed to move emails to pending',
                              });
                            } finally {
                              setBulkOperating(false);
                            }
                          }}
                          loading={bulkOperating}
                          disabled={bulkOperating}
                        >
                          ↩️ Move to Pending ({selectedRejectedIds.size})
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedRejectedIds(new Set())}
                          disabled={bulkOperating}
                        >
                          Clear Selection
                        </Button>
                      </div>
                    )}

                    {/* Rejected Emails Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02]">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                              <input
                                type="checkbox"
                                checked={selectedRejectedIds.size === rejectedEmails.length && rejectedEmails.length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedRejectedIds(new Set(rejectedEmails.map((email: any) => email.id)));
                                  } else {
                                    setSelectedRejectedIds(new Set());
                                  }
                                }}
                                className="rounded"
                              />
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Customer</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Amount</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Days Overdue</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Type</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-white/[0.06]">
                          {rejectedEmails.map((email: any) => (
                            <tr key={email.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedRejectedIds.has(email.id)}
                                  onChange={(e) => {
                                    const newSelected = new Set(selectedRejectedIds);
                                    if (e.target.checked) {
                                      newSelected.add(email.id);
                                    } else {
                                      newSelected.delete(email.id);
                                    }
                                    setSelectedRejectedIds(newSelected);
                                  }}
                                  className="rounded"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white text-sm">{email.customer_name}</p>
                                  {email.type === 'sms' ? (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">📱 {email.phone_number ? `${email.phone_number.slice(0, -4)}****` : 'N/A'}</p>
                                  ) : (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{email.recipient_email}</p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900 dark:text-white text-sm">${email.invoice_amount.toLocaleString()}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-gray-700 dark:text-gray-300 text-sm">{email.days_overdue}d</p>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  email.type === 'sms'
                                    ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                                    : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                                }`}>
                                  {email.type === 'sms' ? '📱 SMS' : `📧 ${email.email_type.replace(/_/g, ' ')}`}
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
                                  <button
                                    onClick={() => handleMoveToPending(email.id)}
                                    className="text-xs px-2.5 py-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                                    disabled={approvingQueue !== null}
                                  >
                                    ↩️ Move to Pending
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
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Card>
              )}

              {/* SECTION 2: SENT & TRACKED EMAILS */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">✅ Sent & Tracked</h3>
                </div>

                {/* Filters for Sent & Tracked */}
                <div className="mb-4 flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white"
                    >
                      <option value="all">All Statuses</option>
                      <option value="sent">Sent</option>
                      <option value="opened">Opened</option>
                      <option value="clicked">Clicked</option>
                      <option value="bounced">Bounced</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Customer Email</label>
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchCustomer}
                      onChange={(e) => setSearchCustomer(e.target.value.toLowerCase())}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400"
                    />
                  </div>
                </div>

                {emailLogs.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No emails sent yet. Start the dunning agent from the Invoices page.</p>
                ) : (
                  <>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg mb-4 text-sm text-blue-700 dark:text-blue-300">
                      All emails include a CAN-SPAM compliant unsubscribe link. Replies and opt-outs are tracked automatically.
                    </div>
                  <div className="space-y-1 max-h-[600px] overflow-y-auto">
                    {groupByDate(
                      emailLogs.filter((log: any) => {
                        // Filter out 'skipped' status (legacy entries)
                        if (log.status === 'skipped') return false;
                        // Filter by status
                        if (statusFilter !== 'all' && log.status !== statusFilter) return false;
                        // Filter by customer email
                        if (searchCustomer && !log.recipient_email.toLowerCase().includes(searchCustomer)) return false;
                        return true;
                      }),
                      'sent_at'
                    ).map(({ dateLabel, items }) => (
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
                                    {/* Preview: Show for all emails */}
                                    <button
                                      onClick={() => {
                                        setSelectedEmail(log);
                                        setShowPreview(true);
                                      }}
                                      className="text-xs px-2.5 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                    >
                                      👁️ Preview
                                    </button>
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
                    {stripHtml(selectedEmail.body || selectedEmail.email_body || '(No message content)')}
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
                      {stripHtml(previewQueueData.body)}
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
