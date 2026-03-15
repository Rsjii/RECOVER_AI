import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { API_ENDPOINTS, STATUS_COLORS } from '../lib/constants';
import { formatCurrency, formatDate } from '../lib/utils';
import { useNotification } from '../hooks/useNotification';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { EmailPreviewModal } from '../components/invoices/EmailPreviewModal';
import type { Invoice, InvoiceDetail as InvoiceDetailType, InvoiceStatus } from '../types';

const InvoiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useNotification();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [detail, setDetail] = useState<InvoiceDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'details' | 'payments' | 'emails' | 'plan'>('details');
  const [updating, setUpdating] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [planInstallments, setPlanInstallments] = useState(3);
  const [planSubmitting, setPlanSubmitting] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);

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

  const sendEmail = async () => {
    if (!invoice) return;
    try {
      await api.post(API_ENDPOINTS.email.sendNow, { invoiceId: invoice.id });
      addToast({ type: 'success', message: 'Dunning email queued' });
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to send email' });
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
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/invoices')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
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
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
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
        <Card>
          <p className="text-xs text-gray-500 dark:text-gray-400">Risk Score</p>
          <div className="mt-1"><Badge value={invoice.risk_score || 0} /></div>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <div className="flex border-b border-gray-200 dark:border-gray-700 gap-1 -mt-2 -mx-1 mb-4">
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
              <div><span className="text-gray-500 dark:text-gray-400 block mb-1">Email</span><span className="text-gray-900 dark:text-white">{invoice.customer_email}</span></div>
              <div><span className="text-gray-500 dark:text-gray-400 block mb-1">Issued</span><span className="text-gray-900 dark:text-white">{formatDate(invoice.issued_date)}</span></div>
              <div><span className="text-gray-500 dark:text-gray-400 block mb-1">Source</span><span className="text-gray-900 dark:text-white capitalize">{invoice.source}</span></div>
            </div>

            <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              {invoice.status === 'unpaid' && (
                <>
                  <Button size="sm" onClick={() => updateStatus('paid')} loading={updating}>Mark Paid</Button>
                  <Button size="sm" variant="secondary" onClick={() => updateStatus('arranged')} loading={updating}>Mark Arranged</Button>
                  <Button size="sm" variant="ghost" onClick={sendEmail}>Send Dunning Email</Button>
                </>
              )}
              {invoice.status === 'arranged' && (
                <Button size="sm" onClick={() => updateStatus('paid')} loading={updating}>Mark Paid</Button>
              )}
              {invoice.status !== 'uncollectable' && invoice.status !== 'paid' && (
                <Button size="sm" variant="danger" onClick={() => updateStatus('uncollectable')} loading={updating}>Write Off</Button>
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
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-300">Date</th>
                    <th className="px-4 py-2 text-right text-gray-600 dark:text-gray-300">Amount</th>
                    <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-300">Method</th>
                    <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-300">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detail!.payments.map(p => (
                    <tr key={p.id} className="border-t border-gray-100 dark:border-gray-700">
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
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setShowEmailPreview(true)}>
                  Preview Next Email
                </Button>
                <Button size="sm" onClick={sendEmail}>Send Email</Button>
              </div>
            </div>
            {!detail?.emailLogs.length
              ? <p className="text-gray-500 dark:text-gray-400 text-center py-8">No emails sent yet</p>
              : (
                <div className="space-y-3">
                  {detail!.emailLogs.map(e => (
                    <div key={e.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
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
                emailType="dunning_1"
                onClose={() => setShowEmailPreview(false)}
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
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-2 text-left">#</th>
                      <th className="px-4 py-2 text-right">Amount</th>
                      <th className="px-4 py-2 text-left">Due</th>
                      <th className="px-4 py-2 text-center">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.paymentPlan.installments.map((inst, i) => (
                      <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
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
              <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Create Payment Plan</h4>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Number of installments
                  </label>
                  <select
                    value={planInstallments}
                    onChange={(e) => setPlanInstallments(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
      </Card>
    </div>
  );
};

export default InvoiceDetail;
