import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { API_ENDPOINTS, STATUS_COLORS } from '../lib/constants';
import { formatCurrency, formatDate, calculateDaysOverdue } from '../lib/utils';
import { useNotification } from '../hooks/useNotification';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { Card } from '../components/ui/Card';
import { DetailPageSkeleton } from '../components/ui/Skeleton';
import type { CustomerDetail as CustomerDetailType } from '../types';

const CustomerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useNotification();

  const [detail, setDetail] = useState<CustomerDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'invoices' | 'emails' | 'plans'>('overview');
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pausingDunning, setPausingDunning] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get<{ data: CustomerDetailType }>(API_ENDPOINTS.customers.detail(id))
      .then((res) => {
        const data = res.data || res;
        setDetail(data);
        setEmailInput(data.customer.email);
        document.title = `${data.customer.name} — RecoverAI`;
      })
      .catch(() => {
        addToast({ type: 'error', message: 'Customer not found' });
        navigate('/customers');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleUpdateEmail = async () => {
    if (!detail || !emailInput.trim()) {
      addToast({ type: 'error', message: 'Email cannot be empty' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      addToast({ type: 'error', message: 'Invalid email format' });
      return;
    }

    setUpdatingEmail(true);
    try {
      const res = await api.put(`/api/customers/${id}`, { email: emailInput.trim() });
      setDetail({ ...detail, customer: res.data });
      setEditingEmail(false);
      addToast({ type: 'success', message: 'Email updated successfully' });
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to update email' });
    } finally {
      setUpdatingEmail(false);
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await api.post(`/api/customers/bulk-delete`, { customerIds: [id] });
      addToast({ type: 'success', message: 'Customer deleted successfully' });
      navigate('/customers');
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to delete customer' });
    } finally {
      setDeleting(false);
    }
  };

  const handlePauseDunning = async (days: number | null) => {
    if (!id) return;
    setPausingDunning(true);
    try {
      await api.put(`/api/settings/pause-customer`, { customerId: id, action: days === null ? 'remove' : 'add' });
      // Refresh customer data
      const res = await api.get<{ data: CustomerDetailType }>(API_ENDPOINTS.customers.detail(id));
      setDetail(res.data || res);
      addToast({
        type: 'success',
        message: days === null ? 'Dunning resumed for this customer' : `Dunning paused for ${days} days`
      });
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to update dunning status' });
    } finally {
      setPausingDunning(false);
    }
  };

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (!detail) return null;

  const customer = detail.customer;
  const stats = detail.stats;
  const paidInvoices = detail.invoices.filter(inv => inv.status === 'paid');

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'invoices' as const, label: `Invoices (${detail.invoices.length})` },
    { id: 'emails' as const, label: `Emails (${detail.emailLogs.length})` },
    { id: 'plans' as const, label: `Plans (${detail.paymentPlans.length})` },
  ];

  return (
    <>
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        title="Delete customer?"
        message="This action cannot be undone. The customer and all their data will be permanently deleted."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDangerous={true}
        isLoading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/customers')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-500 dark:text-gray-400"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{customer.name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{customer.email} · {customer.company_name || 'N/A'}</p>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 disabled:opacity-50"
            title="Delete customer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* High-Risk Alert */}
        {stats.riskScore >= 80 && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
            <div className="flex-shrink-0 text-2xl">🚨</div>
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 dark:text-red-300">High-Risk Customer</h3>
              <p className="text-sm text-red-800 dark:text-red-400 mt-1">
                This customer has a payment risk score of {stats.riskScore}/100. Consider escalating dunning or reviewing payment history.
              </p>
            </div>
          </div>
        )}

        {/* KPI Row */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Invoices</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalInvoices}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 dark:text-gray-400">Unpaid AR</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{formatCurrency(stats.unpaidAR, 'USD')}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 dark:text-gray-400">On-Time Rate</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{stats.onTimeRate}%</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 dark:text-gray-400">Risk Score</p>
            <p className={`text-2xl font-bold mt-1 ${
              stats.riskScore >= 80 ? 'text-red-600 dark:text-red-400' :
              stats.riskScore >= 50 ? 'text-orange-600 dark:text-orange-400' :
              'text-green-600 dark:text-green-400'
            }`}>{stats.riskScore}/100</p>
          </Card>
        </div>

        {/* Dunning Controls */}
        <Card>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Dunning Controls</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handlePauseDunning(7)}
              disabled={pausingDunning}
              className="px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 rounded-lg font-medium text-sm disabled:opacity-50"
            >
              ⏸️ Pause 7 days
            </button>
            <button
              onClick={() => handlePauseDunning(30)}
              disabled={pausingDunning}
              className="px-4 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 rounded-lg font-medium text-sm disabled:opacity-50"
            >
              ⏸️ Pause 30 days
            </button>
            <button
              onClick={() => handlePauseDunning(null)}
              disabled={pausingDunning}
              className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 rounded-lg font-medium text-sm disabled:opacity-50"
            >
              ▶️ Resume dunning
            </button>
            <button
              onClick={() => navigate(`/invoices?customerId=${id}`)}
              className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg font-medium text-sm"
            >
              📧 View invoices
            </button>
          </div>
        </Card>

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

          {/* Overview Tab */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Profile Information</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Name</label>
                    <p className="text-sm text-gray-900 dark:text-white">{customer.name}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Company</label>
                    <p className="text-sm text-gray-900 dark:text-white">{customer.company_name || '—'}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Email</label>
                    {editingEmail ? (
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={handleUpdateEmail}
                          disabled={updatingEmail}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                        >
                          {updatingEmail ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingEmail(false);
                            setEmailInput(customer.email);
                          }}
                          className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-900 dark:text-white">{customer.email}</p>
                        <button
                          onClick={() => setEditingEmail(true)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                  {customer.phone && (
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Phone</label>
                      <p className="text-sm text-gray-900 dark:text-white">{customer.phone}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-white/[0.06] pt-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Payment Behavior</h3>
                <div className="grid grid-cols-3 gap-6 text-sm">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Avg Days Late</label>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{stats.avgDaysLate}d</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Total Paid</label>
                    <p className="text-lg font-semibold text-green-600 dark:text-green-400">{paidInvoices.length}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Last Activity</label>
                    <p className="text-sm text-gray-900 dark:text-white">{customer.last_activity_at ? formatDate(customer.last_activity_at) : '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Invoices Tab */}
          {tab === 'invoices' && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {detail.invoices.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No invoices</p>
              ) : (
                detail.invoices.map(inv => {
                  const days = calculateDaysOverdue(inv.due_date);
                  const color = STATUS_COLORS[inv.status as keyof typeof STATUS_COLORS] || '#6b7280';
                  return (
                    <div
                      key={inv.id}
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                      className="p-4 border border-gray-200 dark:border-white/[0.06] rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(inv.amount, inv.currency)}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Due {formatDate(inv.due_date)}</p>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                            style={{ backgroundColor: `${color}20`, color }}>
                            {inv.status}
                          </span>
                          {days > 0 && <p className="text-xs text-red-500 font-medium mt-1">{days}d overdue</p>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Emails Tab */}
          {tab === 'emails' && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {detail.emailLogs.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No emails sent</p>
              ) : (
                detail.emailLogs.map(log => (
                  <div key={log.id} className="p-3 border border-gray-200 dark:border-white/[0.06] rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm text-gray-900 dark:text-white">{log.subject}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{log.email_type} • {log.recipient_email}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                        log.status === 'opened' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        log.status === 'clicked' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        log.status === 'bounced' || log.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                      }`}>
                        {log.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Sent {formatDate(log.sent_at)}
                      {log.opened_at && ` • Opened ${formatDate(log.opened_at)}`}
                      {log.clicked_at && ` • Clicked ${formatDate(log.clicked_at)}`}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Plans Tab */}
          {tab === 'plans' && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {detail.paymentPlans.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">No payment plans</p>
              ) : (
                detail.paymentPlans.map(plan => (
                  <div key={plan.id} className="p-4 border border-gray-200 dark:border-white/[0.06] rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-medium text-gray-900 dark:text-white">{plan.installments?.length || 0} installments</p>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        plan.status === 'active' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        plan.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {plan.status}
                      </span>
                    </div>
                    {plan.installments && (
                      <div className="space-y-2">
                        {plan.installments.map((inst, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-white/[0.03] rounded">
                            <span className="text-gray-600 dark:text-gray-400">Installment {idx + 1}: {formatCurrency(inst.amount, 'USD')}</span>
                            <span className={`text-xs font-medium ${inst.paid ? 'text-green-600' : 'text-gray-500'}`}>
                              {inst.paid ? '✓ Paid' : `Due ${formatDate(inst.due_date)}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  );
};

export default CustomerDetail;
