import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useNotification } from '../hooks/useNotification';
import { Spinner } from '../components/ui/Spinner';

interface QueuedEmail {
  id: string;
  invoice_id: string;
  customer_id: string;
  recipient_email: string;
  customer_name: string;
  invoice_amount: number;
  days_overdue: number;
  email_type: string;
  attempt_number: number;
  queued_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'sent';
  due_date?: string;
}

const EmailQueue: React.FC = () => {
  const { addToast } = useNotification();
  const [emails, setEmails] = useState<QueuedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [previewEmail, setPreviewEmail] = useState<QueuedEmail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    document.title = 'Email Queue — RecoverAI';
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: QueuedEmail[] }>('/api/pilot-queue');
      setEmails(res.data || []);
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to load email queue',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveEmail = async (id: string) => {
    setApproving(id);
    try {
      await api.post(`/api/pilot-queue/${id}/approve`);
      addToast({
        type: 'success',
        message: 'Email approved and sent',
      });
      fetchEmails();
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to approve email',
      });
    } finally {
      setApproving(null);
    }
  };

  const handleRejectEmail = async (id: string) => {
    setApproving(id);
    try {
      await api.post(`/api/pilot-queue/${id}/reject`);
      addToast({
        type: 'success',
        message: 'Email rejected',
      });
      fetchEmails();
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to reject email',
      });
    } finally {
      setApproving(null);
    }
  };

  const handleApproveAll = async () => {
    setApprovingAll(true);
    try {
      // Call bulk approve endpoint (sends all pending emails atomically)
      const res = await api.post<{ sent_count: number; failed_count: number }>(
        `/api/pilot-queue/approve-all`
      );
      addToast({
        type: 'success',
        message: `${res.sent_count} emails sent${res.failed_count > 0 ? `, ${res.failed_count} failed` : ''}`,
      });
      fetchEmails();
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to approve emails',
      });
    } finally {
      setApprovingAll(false);
    }
  };

  const handlePreviewEmail = async (email: QueuedEmail) => {
    setPreviewEmail(email);
    setPreviewLoading(true);
    setPreview(null);
    try {
      const res = await api.get<{ data: { subject: string; body: string } }>(
        `/api/email/preview?invoiceId=${email.invoice_id}&emailType=${email.email_type}`
      );
      setPreview(res.data);
      setEditedSubject(res.data.subject);
      setEditedBody(res.data.body);
      setIsEditing(false);
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to load email preview',
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!previewEmail) return;
    setSavingEdit(true);
    try {
      await api.put(`/api/pilot-queue/${previewEmail.id}`, {
        subject: editedSubject,
        body: editedBody,
      });
      setIsEditing(false);
      addToast({ type: 'success', message: 'Email saved — edits will be used when sent' });
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to save edits' });
    } finally {
      setSavingEdit(false);
    }
  };

  const pendingEmails = emails.filter((e) => e.status === 'pending');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#09090b]">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="mb-8">
            <div className="h-8 w-40 bg-gray-200 dark:bg-white/10 rounded animate-pulse" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-white dark:bg-[#111113] rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090b] py-8">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Email Queue</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Review and approve dunning emails before sending
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 dark:bg-blue-500/20 text-blue-900 dark:text-blue-200 px-3 py-1 rounded-full font-medium text-sm">
              {pendingEmails.length} pending
            </div>
            {pendingEmails.length > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleApproveAll}
                loading={approvingAll}
              >
                Approve All
              </Button>
            )}
          </div>
        </div>

        {/* Empty State */}
        {emails.length === 0 ? (
          <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6 sm:p-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-500/20 mb-4">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No emails queued</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Switch to Auto Mode in Settings to send emails automatically, or manually trigger the agent.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] overflow-hidden">
            {/* Table */}
            <div className="overflow-x-auto sm:scrollbar-show">
              <table className="w-full">
                <thead className="border-b border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02]">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Customer</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Amount</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Days Overdue</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Email Type</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Queued</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/[0.06]">
                  {emails.map((email) => (
                    <tr
                      key={email.id}
                      className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {email.customer_name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {email.recipient_email}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900 dark:text-white">
                          ${email.invoice_amount.toLocaleString()}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-700 dark:text-gray-300">{email.days_overdue}d</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
                          {email.email_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(email.queued_at).toLocaleDateString()} {new Date(email.queued_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {email.status === 'pending' ? (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handlePreviewEmail(email)}
                              >
                                👁 Preview
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleApproveEmail(email.id)}
                                loading={approving === email.id}
                                disabled={approving !== null}
                              >
                                ✓ Approve
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleRejectEmail(email.id)}
                                loading={approving === email.id}
                                disabled={approving !== null}
                              >
                                ✕ Reject
                              </Button>
                            </>
                          ) : (
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                              email.status === 'sent'
                                ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
                                : email.status === 'rejected'
                                ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300'
                                : 'bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300'
                            }`}>
                              {email.status.charAt(0).toUpperCase() + email.status.slice(1)}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Email Preview Modal */}
        {previewEmail && (
          <Modal
            size="lg"
            isOpen={!!previewEmail}
            onClose={() => {
              setPreviewEmail(null);
              setPreview(null);
            }}
            title="Email Preview"
          >
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Customer:</p>
                <p className="text-gray-900 dark:text-white">{previewEmail.customer_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{previewEmail.recipient_email}</p>
              </div>

              {previewLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner text="Generating preview..." />
                </div>
              ) : preview ? (
                <div className="space-y-4 bg-gray-50 dark:bg-white/[0.03] rounded-lg p-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide">
                      Subject
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editedSubject}
                        onChange={(e) => setEditedSubject(e.target.value)}
                        className="w-full bg-white dark:bg-white/[0.05] rounded px-3 py-2 text-sm text-gray-900 dark:text-white font-medium border border-indigo-300 dark:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    ) : (
                      <div className="bg-white dark:bg-white/[0.05] rounded px-3 py-2 text-sm text-gray-900 dark:text-white font-medium">
                        {editedSubject || preview.subject}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wide">
                      Body
                    </label>
                    {isEditing ? (
                      <textarea
                        value={editedBody}
                        onChange={(e) => setEditedBody(e.target.value)}
                        className="w-full bg-white dark:bg-white/[0.05] rounded px-3 py-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed h-96 resize-none border border-indigo-300 dark:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    ) : (
                      <div className="bg-white dark:bg-white/[0.05] rounded px-3 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                        {editedBody || preview.body}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <Button
                variant="secondary"
                onClick={() => {
                  setPreviewEmail(null);
                  setPreview(null);
                  setIsEditing(false);
                }}
              >
                Close
              </Button>
              {preview && !isEditing && (
                <Button
                  variant="secondary"
                  onClick={() => setIsEditing(true)}
                >
                  Edit Email
                </Button>
              )}
              {preview && isEditing && (
                <Button
                  variant="secondary"
                  onClick={handleSaveEdit}
                  loading={savingEdit}
                >
                  Save Edits
                </Button>
              )}
              {preview && !isEditing && (
                <Button
                  variant="primary"
                  onClick={() => {
                    handleApproveEmail(previewEmail.id);
                    setPreviewEmail(null);
                    setPreview(null);
                  }}
                  loading={approving === previewEmail.id}
                  disabled={approving !== null}
                >
                  Approve & Send
                </Button>
              )}
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
};

export default EmailQueue;
