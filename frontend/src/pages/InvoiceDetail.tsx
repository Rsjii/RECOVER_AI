import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { API_ENDPOINTS, STATUS_COLORS } from '../lib/constants';
import { formatCurrency, formatDate } from '../lib/utils';
import { useNotification } from '../hooks/useNotification';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { EmailPreviewModal } from '../components/invoices/EmailPreviewModal';
import type { Invoice, InvoiceDetail as InvoiceDetailType, InvoiceStatus, DunningStatus } from '../types';

const InvoiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useNotification();
  const isDemo = typeof window !== 'undefined' && localStorage.getItem('isDemo') === 'true';

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [detail, setDetail] = useState<InvoiceDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'details' | 'payments' | 'emails' | 'plan' | 'dunning'>('details');
  const [updating, setUpdating] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [planInstallments, setPlanInstallments] = useState(3);
  const [planSubmitting, setPlanSubmitting] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [dunningStatus, setDunningStatus] = useState<DunningStatus | null>(null);
  const [pauseDays, setPauseDays] = useState(7);
  const [dunningLoading, setDunningLoading] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [showStopDunningConfirm, setShowStopDunningConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedEmailType, setSelectedEmailType] = useState<string>('dunning_1');
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      api.get<any>(API_ENDPOINTS.invoices.detail(id)),
      api.get<any>(API_ENDPOINTS.invoices.detailFull(id)),
    ])
      .then(([invRes, detailRes]) => {
        setInvoice(invRes.data || invRes);
        setDetail(detailRes.data || detailRes);
        document.title = `Invoice — RecoverAI`;
      })
      .catch(() => {
        addToast({ type: 'error', message: 'Invoice not found' });
        navigate('/invoices');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (status: InvoiceStatus) => {
    if (!invoice) return;
    setUpdating(true);
    try {
      await api.put(API_ENDPOINTS.invoices.status(invoice.id), { status });
      addToast({ type: 'success', message: `Invoice marked as ${status}` });
      setInvoice({ ...invoice, status });
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Update failed' });
    } finally { setUpdating(false); }
  };

  const sendEmail = async (emailType?: string) => {
    if (!invoice) return;
    setSendingEmail(true);
    try {
      const res = await api.post<{ queued_for_review?: boolean }>(API_ENDPOINTS.email.sendNow, {
        invoiceId: invoice.id,
        emailType: emailType || selectedEmailType,
      });

      if (res.queued_for_review) {
        addToast({
          type: 'info',
          message: 'Email queued for review in Email Queue'
        });
      } else {
        addToast({
          type: 'success',
          message: 'Email sent successfully'
        });
      }
      setShowEmailPreview(false);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to send email' });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCreatePlan = async () => {
    if (!invoice) return;
    setPlanSubmitting(true);
    try {
      await api.post(API_ENDPOINTS.paymentPlans.create, {
        invoiceId: invoice.id,
        numberOfInstallments: planInstallments,
      });
      addToast({ type: 'success', message: `Payment plan created (${planInstallments} installments)` });
      setCreatingPlan(false);
      const res: any = await api.get(API_ENDPOINTS.invoices.detailFull(invoice.id));
      setDetail(res.data || res);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to create plan' });
    } finally { setPlanSubmitting(false); }
  };

  useEffect(() => {
    if (tab === 'dunning' && id) fetchDunningStatus();
  }, [tab]);

  const fetchDunningStatus = async () => {
    if (!id) return;
    try {
      const res: any = await api.get(`/api/invoices/${id}/dunning-status`);
      setDunningStatus(res.data || res);
    } catch { /* silently fail */ }
  };

  const handlePause = async () => {
    if (!invoice) return;
    setDunningLoading(true);
    try {
      await api.post(`/api/invoices/${invoice.id}/dunning/pause`, { days: pauseDays });
      addToast({ type: 'success', message: `Dunning paused for ${pauseDays} days` });
      await fetchDunningStatus();
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to pause dunning' });
    } finally { setDunningLoading(false); }
  };

  const handleResume = async () => {
    if (!invoice) return;
    setDunningLoading(true);
    try {
      await api.post(`/api/invoices/${invoice.id}/dunning/resume`, {});
      addToast({ type: 'success', message: 'Dunning resumed' });
      await fetchDunningStatus();
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to resume dunning' });
    } finally { setDunningLoading(false); }
  };

  const handleStop = async () => {
    if (!invoice) return;
    setShowStopDunningConfirm(true);
  };

  const confirmStopDunning = async () => {
    if (!invoice) return;
    setDunningLoading(true);
    try {
      await api.delete(`/api/invoices/${invoice.id}/dunning`);
      addToast({ type: 'success', message: 'Dunning stopped permanently' });
      await fetchDunningStatus();
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to stop dunning' });
    } finally { setDunningLoading(false); }
  };

  const handleDelete = async () => {
    if (!invoice) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!invoice) return;
    setUpdating(true);
    try {
      await api.delete(`/api/invoices/${invoice.id}`);
      addToast({ type: 'success', message: 'Invoice deleted successfully' });
      navigate('/invoices');
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to delete invoice' });
      setUpdating(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!invoice) return;
    if (!emailInput || emailInput.trim() === '') {
      addToast({ type: 'error', message: 'Email cannot be empty' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      addToast({ type: 'error', message: 'Invalid email format' });
      return;
    }

    setUpdatingEmail(true);
    try {
      await api.put(`/api/customers/${invoice.customer_id}`, { email: emailInput });
      setInvoice({ ...invoice, customer_email: emailInput });
      setEditingEmail(false);
      addToast({ type: 'success', message: 'Email updated successfully' });
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to update email' });
    } finally { setUpdatingEmail(false); }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20"><Spinner size="lg" text="Loading invoice..." /></div>
    );
  }

  if (!invoice) return null;

  const tabs = [
    { id: 'details' as const, label: 'Details' },
    { id: 'payments' as const, label: `Payments (${detail?.payments.length || 0})` },
    { id: 'emails' as const, label: `Emails (${detail?.emailLogs.length || 0})` },
    { id: 'plan' as const, label: 'Plan' },
    { id: 'dunning' as const, label: 'Dunning' },
  ];

  return (
    <>
      <ConfirmationModal
        isOpen={showStopDunningConfirm}
        title="Stop dunning?"
        message="Stop all future dunning emails for this invoice? This action cannot be undone."
        confirmLabel="Stop"
        cancelLabel="Cancel"
        isDangerous={true}
        isLoading={dunningLoading}
        onConfirm={confirmStopDunning}
        onCancel={() => setShowStopDunningConfirm(false)}
      />

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        title="Delete invoice?"
        message="This action cannot be undone. The invoice will be permanently deleted."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDangerous={true}
        isLoading={updating}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <div className="space-y-6">
        {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/invoices')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-500 dark:text-gray-400"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {invoice.customer_name || 'Unknown Customer'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {invoice.customer_email} · {invoice.source} invoice
          </p>
        </div>
        <span
          className="px-3 py-1 rounded-full text-sm font-medium capitalize"
          style={{
            backgroundColor: `${STATUS_COLORS[invoice.status] || '#6b7280'}20`,
            color: STATUS_COLORS[invoice.status] || '#6b7280',
          }}
        >
          {invoice.status}
        </span>
        <button
          onClick={handleDelete}
          disabled={updating}
          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 disabled:opacity-50"
          title="Delete invoice"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <p className="text-xs text-gray-500 dark:text-gray-400">Invoice Amount</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {formatCurrency(Number(invoice.amount), invoice.currency)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 dark:text-gray-400">Due Date</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {formatDate(invoice.due_date)}
          </p>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <div className="flex border-b border-gray-200 dark:border-white/[0.06] gap-1 -mt-2 -mx-1 mb-4">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t.label}
              {tab === t.id && (
                <span className="absolute left-0 right-0 -bottom-[1px] h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Details */}
        {tab === 'details' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div><span className="text-gray-500 dark:text-gray-400 block mb-1">Customer</span><span className="text-gray-900 dark:text-white font-medium">{invoice.customer_name}</span></div>
              <div className="relative group">
                <span className="text-gray-500 dark:text-gray-400 block mb-1">Email</span>
                {editingEmail ? (
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-300 dark:border-white/[0.08] rounded bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleUpdateEmail}
                      disabled={updatingEmail}
                      className="px-2 py-1 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 disabled:opacity-50"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => {
                        setEditingEmail(false);
                        setEmailInput('');
                      }}
                      className="px-2 py-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      setEditingEmail(true);
                      setEmailInput(invoice.customer_email || '');
                    }}
                    className="flex items-center gap-2 cursor-pointer group/email"
                  >
                    <span className="text-gray-900 dark:text-white">{invoice.customer_email}</span>
                    <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 opacity-0 group-hover/email:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </div>
                )}
              </div>
              <div><span className="text-gray-500 dark:text-gray-400 block mb-1">Issued</span><span className="text-gray-900 dark:text-white">{formatDate(invoice.issued_date)}</span></div>
              <div><span className="text-gray-500 dark:text-gray-400 block mb-1">Source</span><span className="text-gray-900 dark:text-white capitalize">{invoice.source}</span></div>
            </div>

            <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-white/[0.06]">
              {invoice.status === 'unpaid' && (
                <>
                  <Button size="sm" onClick={() => updateStatus('paid')} disabled={isDemo} loading={updating}>Mark Paid</Button>
                  <Button size="sm" variant="secondary" onClick={() => updateStatus('arranged')} disabled={isDemo} loading={updating}>Mark Arranged</Button>
                  <Button size="sm" variant="ghost" onClick={sendEmail}>Send Dunning Email</Button>
                </>
              )}
              {invoice.status === 'arranged' && (
                <Button size="sm" onClick={() => updateStatus('paid')} disabled={isDemo} loading={updating}>Mark Paid</Button>
              )}
              {invoice.status !== 'uncollectable' && invoice.status !== 'paid' && (
                <Button size="sm" variant="danger" onClick={() => updateStatus('uncollectable')} disabled={isDemo} loading={updating}>Write Off</Button>
              )}
            </div>
          </div>
        )}

        {/* Payments */}
        {tab === 'payments' && (
          !detail?.payments.length
            ? <p className="text-gray-500 dark:text-gray-400 text-center py-8">No payments recorded</p>
            : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-white/[0.04]">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-300">Date</th>
                    <th className="px-4 py-2 text-right text-gray-600 dark:text-gray-300">Amount</th>
                    <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-300">Method</th>
                    <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-300">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detail!.payments.map(p => (
                    <tr key={p.id} className="border-t border-gray-100 dark:border-white/[0.06]">
                      <td className="px-4 py-2 text-gray-900 dark:text-white">{formatDate(p.paid_at)}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatCurrency(Number(p.amount))}</td>
                      <td className="px-4 py-2 capitalize text-gray-600 dark:text-gray-300">{p.payment_method}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs font-medium ${p.status === 'succeeded' ? 'text-green-600' : p.status === 'failed' ? 'text-red-600' : 'text-yellow-600'}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
        )}

        {/* Emails */}
        {tab === 'emails' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Email History</h3>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email Type
                  </label>
                  <select
                    value={selectedEmailType}
                    onChange={(e) => setSelectedEmailType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.08] rounded text-sm bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white"
                  >
                    <option value="dunning_1">Dunning Email 1 (Friendly)</option>
                    <option value="dunning_2">Dunning Email 2</option>
                    <option value="dunning_3">Dunning Email 3</option>
                    <option value="dunning_4">Dunning Email 4 (Urgent)</option>
                    <option value="dunning_5">Dunning Email 5 (Final Notice)</option>
                    <option value="payment_plan_offer">Payment Plan Offer</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setShowEmailPreview(true)}>
                    Preview Email
                  </Button>
                  <Button size="sm" onClick={() => sendEmail()} loading={sendingEmail}>
                    Send Email
                  </Button>
                </div>
              </div>
            </div>
            {!detail?.emailLogs.length
              ? <p className="text-gray-500 dark:text-gray-400 text-center py-8">No emails sent yet</p>
              : (
                <div className="space-y-3">
                  {detail!.emailLogs.map(e => (
                    <div key={e.id} className="border border-gray-200 dark:border-white/[0.06] rounded-lg p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{e.subject}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          ['opened','clicked'].includes(e.status) ? 'bg-green-100 text-green-700' :
                          ['bounced','failed'].includes(e.status) ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'}`}>
                          {e.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {e.email_type} · Sent {formatDate(e.sent_at)}
                        {e.opened_at && ` · Opened ${formatDate(e.opened_at)}`}
                      </p>
                    </div>
                  ))}
                </div>
              )
            }
            {showEmailPreview && invoice && (
              <EmailPreviewModal
                invoiceId={invoice.id}
                emailType={selectedEmailType}
                daysOverdue={invoice.days_overdue || 0}
                onClose={() => setShowEmailPreview(false)}
                onApprove={() => sendEmail(selectedEmailType)}
              />
            )}
          </div>
        )}

        {/* Plan */}
        {tab === 'plan' && (
          <div className="space-y-4">
            {detail?.paymentPlan ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Status:</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                    detail.paymentPlan.status === 'active' ? 'bg-blue-100 text-blue-700' :
                    detail.paymentPlan.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {detail.paymentPlan.status}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-white/[0.04]">
                    <tr>
                      <th className="px-4 py-2 text-left">#</th>
                      <th className="px-4 py-2 text-right">Amount</th>
                      <th className="px-4 py-2 text-left">Due</th>
                      <th className="px-4 py-2 text-center">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.paymentPlan.installments.map((inst, i) => (
                      <tr key={i} className="border-t border-gray-100 dark:border-white/[0.06]">
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{i + 1}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatCurrency(inst.amount)}</td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{formatDate(inst.due_date)}</td>
                        <td className="px-4 py-2 text-center">{inst.paid ? '✅' : '⏳'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : creatingPlan ? (
              <div className="space-y-4 p-4 border border-gray-200 dark:border-white/[0.06] rounded-lg">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Create Payment Plan</h4>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Number of installments
                  </label>
                  <select
                    value={planInstallments}
                    onChange={(e) => setPlanInstallments(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.08] rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[2, 3, 4, 6, 9, 12].map(n => (
                      <option key={n} value={n}>
                        {n} payments of {formatCurrency(Number(invoice.amount) / n)} each
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreatePlan} loading={planSubmitting}>Create Plan</Button>
                  <Button size="sm" variant="ghost" onClick={() => setCreatingPlan(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 space-y-3">
                <p className="text-gray-500 dark:text-gray-400">No payment plan created yet</p>
                {invoice.status !== 'paid' && invoice.status !== 'uncollectable' && (
                  <Button variant="secondary" onClick={() => setCreatingPlan(true)}>
                    Create Payment Plan
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Dunning */}
        {tab === 'dunning' && (
          <div className="space-y-4">
            {/* Status banner */}
            {dunningStatus?.isStopped && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                All dunning emails stopped permanently for this invoice.
              </div>
            )}
            {!dunningStatus?.isStopped && dunningStatus?.isPaused && (
              <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Dunning paused until {formatDate(dunningStatus.pausedUntil!)}.
              </div>
            )}
            {!dunningStatus?.isStopped && !dunningStatus?.isPaused && dunningStatus?.nextEmailType && (
              <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-400">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Next: <span className="font-medium">{dunningStatus.nextEmailType}</span>
                {dunningStatus.nextScheduledDate && <> — scheduled {formatDate(dunningStatus.nextScheduledDate)}</>}
              </div>
            )}

            {/* Action buttons */}
            {!dunningStatus?.isStopped && (
              <div className="flex flex-wrap gap-2">
                {dunningStatus?.isPaused ? (
                  <Button size="sm" variant="secondary" onClick={handleResume} loading={dunningLoading}>
                    Resume Dunning
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      value={pauseDays}
                      onChange={e => setPauseDays(Number(e.target.value))}
                      className="px-2 py-1.5 text-sm border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white"
                    >
                      {[7, 14, 30].map(d => <option key={d} value={d}>Pause {d} days</option>)}
                    </select>
                    <Button size="sm" variant="secondary" onClick={handlePause} loading={dunningLoading}>
                      Pause
                    </Button>
                  </div>
                )}
                <Button size="sm" variant="danger" onClick={handleStop} loading={dunningLoading}>
                  Stop All
                </Button>
              </div>
            )}

            {/* Email history */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Email History</h4>
              {(dunningStatus?.history?.length ?? 0) === 0 ? (
                <p className="text-sm text-gray-400">No dunning emails sent yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-white/[0.04]">
                    <tr>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-left">Sent</th>
                      <th className="px-4 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dunningStatus!.history.map((log) => (
                      <tr key={log.id} className="border-t border-gray-100 dark:border-white/[0.06]">
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300 capitalize">{log.email_type.replace('_', ' ')}</td>
                        <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{formatDate(log.sent_at)}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                            log.status === 'clicked' ? 'bg-green-100 text-green-700' :
                            log.status === 'opened' ? 'bg-blue-100 text-blue-700' :
                            log.status === 'bounced' || log.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{log.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </Card>
      </div>
    </>
  );
};

export default InvoiceDetail;
