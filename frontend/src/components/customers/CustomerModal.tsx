import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { Badge } from '../ui/Badge';
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

export const CustomerModal: React.FC<CustomerModalProps> = ({ customer, isOpen, onClose, onUpdated }) => {
  const { addToast } = useNotification();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneOptIn, setPhoneOptIn] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => {
    if (customer && isOpen) {
      setPhone(customer.phone || '');
      setPhoneOptIn(customer.phone_opt_in ?? false);
      setEditingPhone(false);
      setLoading(true);
      api.get<{ data: { customer: Customer; invoices: Invoice[]; totalInvoices: number } }>(
        API_ENDPOINTS.customers.detail(customer.id)
      )
        .then(res => {
          setInvoices(res.data.invoices);
          const c = res.data.customer;
          setPhone(c.phone || '');
          setPhoneOptIn(c.phone_opt_in ?? false);
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

  if (!customer) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={customer.name} size="lg">
      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="space-y-6">
          {/* Customer Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Email</label>
              <p className="text-sm text-gray-900 dark:text-white">{customer.email}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Company</label>
              <p className="text-sm text-gray-900 dark:text-white">{customer.company_name || '—'}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">On-Time Rate</label>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{customer.payment_history.on_time_rate}%</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Total Invoices</label>
              <p className="text-sm text-gray-900 dark:text-white">{customer.payment_history.total_invoices}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Avg Days Late</label>
              <p className="text-sm text-gray-900 dark:text-white">{customer.payment_history.avg_days_late}d</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Industry</label>
              <p className="text-sm text-gray-900 dark:text-white">{customer.industry || '—'}</p>
            </div>
          </div>

          {/* SMS / Phone Section */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
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
                  <div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatCurrency(Number(inv.amount), inv.currency)}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">Due {formatDate(inv.due_date)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge value={inv.risk_score || 0} />
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                        style={{ backgroundColor: `${STATUS_COLORS[inv.status] || '#6b7280'}20`, color: STATUS_COLORS[inv.status] || '#6b7280' }}>
                        {inv.status}
                      </span>
                    </div>
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
