import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { api } from '../../lib/api';
import { API_ENDPOINTS, STATUS_COLORS } from '../../lib/constants';
import { formatCurrency, formatDate } from '../../lib/utils';
import { useNotification } from '../../hooks/useNotification';
import type { Customer, Invoice } from '../../types';

interface CustomerModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: (customer: Customer) => void;
}

interface CustomerStats {
  totalInvoices: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  onTimeRate: number;
  avgDaysLate: number;
  riskScore: number;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({ customer, isOpen, onClose, onUpdated }) => {
  const navigate = useNavigate();
  const { addToast } = useNotification();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<CustomerStats>({
    totalInvoices: 0,
    totalAmount: 0,
    paidAmount: 0,
    unpaidAmount: 0,
    onTimeRate: 0,
    avgDaysLate: 0,
    riskScore: 0,
  });
  const [loading, setLoading] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneOptIn, setPhoneOptIn] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);

  // Full profile edit mode
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (customer && isOpen) {
      setPhone(customer.phone || '');
      setPhoneOptIn(customer.phone_opt_in ?? false);
      setEditingPhone(false);
      setIsEditingProfile(false);
      setEditForm({ name: customer.name, email: customer.email });
      setLoading(true);
      api.get<{ data: { customer: Customer; invoices: Invoice[]; stats: CustomerStats } }>(
        API_ENDPOINTS.customers.detail(customer.id)
      )
        .then(res => {
          setInvoices(res.data.invoices);
          setStats(res.data.stats);
          const c = res.data.customer;
          setPhone(c.phone || '');
          setPhoneOptIn(c.phone_opt_in ?? false);
          setEditForm({ name: c.name, email: c.email });
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [customer, isOpen]);

  const savePhone = async () => {
    if (!customer) return;
    setSavingPhone(true);
    try {
      const res = await api.put<{ data: Customer }>(
        API_ENDPOINTS.customers.detail(customer.id),
        { phone: phone.trim() || null, phone_opt_in: phoneOptIn }
      );
      setPhone(res.data.phone || '');
      setPhoneOptIn(res.data.phone_opt_in ?? false);
      setEditingPhone(false);
      addToast({ type: 'success', message: 'Phone updated' });
      onUpdated?.(res.data);
    } catch {
      addToast({ type: 'error', message: 'Failed to update phone' });
    } finally {
      setSavingPhone(false);
    }
  };

  const saveProfileEdit = async () => {
    if (!customer) return;
    setSavingEdit(true);
    try {
      const payload: any = {};
      if (editForm.email !== customer.email) {
        payload.email = editForm.email;
      }
      if (editForm.name !== customer.name) {
        // Note: backend doesn't have endpoint to update name yet, would need to add
        addToast({ type: 'info', message: 'Name updates not yet supported' });
        return;
      }

      if (Object.keys(payload).length === 0) {
        addToast({ type: 'info', message: 'No changes made' });
        setIsEditingProfile(false);
        return;
      }

      const res = await api.put<{ data: Customer }>(
        API_ENDPOINTS.customers.detail(customer.id),
        payload
      );
      setEditForm({ name: res.data.name, email: res.data.email });
      setIsEditingProfile(false);
      addToast({ type: 'success', message: 'Profile updated' });
      onUpdated?.(res.data);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to update profile' });
    } finally {
      setSavingEdit(false);
    }
  };

  if (!customer) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={customer.name}
      size="lg"
      headerAction={
        <button
          onClick={() => {
            navigate(`/customers/${customer.id}`);
            onClose();
          }}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          View Full
        </button>
      }
    >
      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="space-y-6">
          {/* Profile Edit Button */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Profile</h3>
            {!isEditingProfile && (
              <button
                onClick={() => setIsEditingProfile(true)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            )}
          </div>

          {/* Customer Info Grid */}
          {isEditingProfile ? (
            <div className="space-y-4 p-4 border border-blue-200 dark:border-blue-900/30 rounded-lg bg-blue-50 dark:bg-blue-900/10">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.08] rounded-lg text-sm text-gray-500 bg-gray-100 dark:bg-white/[0.02] cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Name updates not yet supported</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.08] rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={saveProfileEdit}
                  disabled={savingEdit}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setIsEditingProfile(false);
                    setEditForm({ name: customer.name, email: customer.email });
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Name</label>
                <p className="text-sm text-gray-900 dark:text-white">{customer.name}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Email</label>
                <p className="text-sm text-gray-900 dark:text-white">{customer.email}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Company</label>
                <p className="text-sm text-gray-900 dark:text-white">{customer.company_name || '—'}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Industry</label>
                <p className="text-sm text-gray-900 dark:text-white">{customer.industry || '—'}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">On-Time Rate</label>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{stats.onTimeRate}%</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Total Invoices</label>
                <p className="text-sm text-gray-900 dark:text-white">{stats.totalInvoices}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Avg Days Late</label>
                <p className="text-sm text-gray-900 dark:text-white">{stats.avgDaysLate}d</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Risk Score</label>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{stats.riskScore} / 100</p>
              </div>
            </div>
          )}

          {/* SMS / Phone Section */}
          <div className="border border-gray-200 dark:border-white/[0.06] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">SMS Outreach</h4>
              {!editingPhone && (
                <button
                  onClick={() => setEditingPhone(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {phone ? 'Edit' : 'Add phone'}
                </button>
              )}
            </div>

            {editingPhone ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Phone number (E.164 format, e.g. +12125551234)</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+12125551234"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.08] rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={phoneOptIn}
                    onChange={e => setPhoneOptIn(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Customer has consented to receive SMS (TCPA opt-in)
                  </span>
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={savePhone}
                    disabled={savingPhone}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg disabled:opacity-50"
                  >
                    {savingPhone ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditingPhone(false); setPhone(customer.phone || ''); setPhoneOptIn(customer.phone_opt_in ?? false); }}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">Phone</label>
                  <p className="text-sm text-gray-900 dark:text-white">{phone || '—'}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">SMS Opt-In</label>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`inline-block w-2 h-2 rounded-full ${phoneOptIn ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className="text-sm text-gray-900 dark:text-white">
                      {phoneOptIn ? 'Opted in' : phone ? 'Not opted in' : 'No phone'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Invoices */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Invoices ({invoices.length})</h4>
            {invoices.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No invoices found</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {invoices.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/[0.04] rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatCurrency(Number(inv.amount), inv.currency)}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">Due {formatDate(inv.due_date)}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                      style={{ backgroundColor: `${STATUS_COLORS[inv.status] || '#6b7280'}20`, color: STATUS_COLORS[inv.status] || '#6b7280' }}>
                      {inv.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};
