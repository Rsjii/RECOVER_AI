import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { api } from '../../lib/api';
import { API_ENDPOINTS, STATUS_COLORS } from '../../lib/constants';
import { formatCurrency, formatDate } from '../../lib/utils';
import { useNotification } from '../../hooks/useNotification';
import type { Invoice, InvoiceDetail, InvoiceStatus } from '../../types';

interface InvoiceModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdate: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ invoice, isOpen, onClose, onStatusUpdate }) => {
  const { addToast } = useNotification();
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [tab, setTab] = useState<'details' | 'payments' | 'emails' | 'plan'>('details');

  // Plan creation state
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [planForm, setPlanForm] = useState({ installments: 3 });
  const [planSubmitting, setPlanSubmitting] = useState(false);

  useEffect(() => {
    if (invoice && isOpen) {
      setTab('details');
      setCreatingPlan(false);
      setLoading(true);
      api.get<{ data: InvoiceDetail }>(API_ENDPOINTS.invoices.detailFull(invoice.id))
        .then((res: any) => setDetail(res.data || res))
        .catch(() => addToast({ type: 'error', message: 'Failed to load invoice details' }))
        .finally(() => setLoading(false));
    }
  }, [invoice, isOpen]);

  const updateStatus = async (status: InvoiceStatus) => {
    if (!invoice) return;
    setUpdating(true);
    try {
      await api.put(API_ENDPOINTS.invoices.status(invoice.id), { status });
      addToast({ type: 'success', message: `Invoice marked as ${status}` });
      onStatusUpdate();
      onClose();
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
        numberOfInstallments: planForm.installments,
      });
      addToast({ type: 'success', message: `Payment plan created (${planForm.installments} installments)` });
      setCreatingPlan(false);
      // Reload detail
      const res: any = await api.get(API_ENDPOINTS.invoices.detailFull(invoice.id));
      setDetail(res.data || res);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to create plan' });
    } finally { setPlanSubmitting(false); }
  };

  if (!invoice) return null;

  const tabs = [
    { id: 'details' as const, label: 'Details' },
    { id: 'payments' as const, label: `Payments (${detail?.payments.length || 0})` },
    { id: 'emails' as const, label: `Emails (${detail?.emailLogs.length || 0})` },
    { id: 'plan' as const, label: 'Plan' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Invoice — ${invoice.customer_name || 'Unknown'}`} size="xl">
      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <div className="space-y-4">
          {/* View full page link */}
          <div className="flex justify-end">
            <Link
              to={`/invoices/${invoice.id}`}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              onClick={onClose}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open full page
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-white/[0.06] gap-1">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative px-4 py-2 text-sm font-medium transition-colors ${
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

          {/* Details Tab */}
          {tab === 'details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">Amount</label>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(Number(invoice.amount), invoice.currency)}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">Risk Score</label>
                  <Badge value={invoice.risk_score || 0} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">Due Date</label>
                  <p className="text-sm text-gray-900 dark:text-white">{formatDate(invoice.due_date)}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">Status</label>
                  <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize"
                    style={{ backgroundColor: `${STATUS_COLORS[invoice.status] || '#6b7280'}20`, color: STATUS_COLORS[invoice.status] || '#6b7280' }}>
                    {invoice.status}
                  </span>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">Source</label>
                  <p className="text-sm text-gray-900 dark:text-white capitalize">{invoice.source}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">Issued</label>
                  <p className="text-sm text-gray-900 dark:text-white">{formatDate(invoice.issued_date)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-white/[0.06]">
                {invoice.status === 'unpaid' && (
                  <>
                    <Button size="sm" onClick={() => updateStatus('paid')} loading={updating}>Mark Paid</Button>
                    <Button size="sm" variant="secondary" onClick={() => updateStatus('arranged')} loading={updating}>Mark Arranged</Button>
                    <Button size="sm" variant="ghost" onClick={sendEmail}>Send Email</Button>
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

          {/* Payments Tab */}
          {tab === 'payments' && (
            !detail?.payments.length
              ? <p className="text-gray-500 dark:text-gray-400 text-center py-6">No payments recorded</p>
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
                        <td className="px-4 py-2 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(Number(p.amount))}</td>
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

          {/* Emails Tab */}
          {tab === 'emails' && (
            !detail?.emailLogs.length
              ? <p className="text-gray-500 dark:text-gray-400 text-center py-6">No emails sent yet</p>
              : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {detail!.emailLogs.map(e => (
                    <div key={e.id} className="border border-gray-200 dark:border-white/[0.06] rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{e.subject}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          ['opened','clicked'].includes(e.status) ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                          ['bounced','failed'].includes(e.status) ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                          'bg-gray-100 text-gray-600 dark:bg-white/[0.03] dark:text-gray-300'}`}>
                          {e.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {e.email_type} • Sent {formatDate(e.sent_at)}
                        {e.opened_at && ` • Opened ${formatDate(e.opened_at)}`}
                      </p>
                    </div>
                  ))}
                </div>
              )
          )}

          {/* Plan Tab */}
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
                        <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-300">#</th>
                        <th className="px-4 py-2 text-right text-gray-600 dark:text-gray-300">Amount</th>
                        <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-300">Due</th>
                        <th className="px-4 py-2 text-center text-gray-600 dark:text-gray-300">Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.paymentPlan.installments.map((inst, i) => (
                        <tr key={i} className="border-t border-gray-100 dark:border-white/[0.06]">
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{i + 1}</td>
                          <td className="px-4 py-2 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(inst.amount)}</td>
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
                      value={planForm.installments}
                      onChange={(e) => setPlanForm({ installments: Number(e.target.value) })}
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
                    <Button size="sm" onClick={handleCreatePlan} loading={planSubmitting}>
                      Create Plan
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setCreatingPlan(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 space-y-3">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No payment plan created yet</p>
                  {invoice.status !== 'paid' && invoice.status !== 'uncollectable' && (
                    <Button size="sm" variant="secondary" onClick={() => setCreatingPlan(true)}>
                      Create Payment Plan
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
