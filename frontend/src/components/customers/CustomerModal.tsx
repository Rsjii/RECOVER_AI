import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { Badge } from '../ui/Badge';
import { api } from '../../lib/api';
import { API_ENDPOINTS, STATUS_COLORS } from '../../lib/constants';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { Customer, Invoice } from '../../types';

interface CustomerModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({ customer, isOpen, onClose }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (customer && isOpen) {
      setLoading(true);
      api.get<{ data: { customer: Customer; invoices: Invoice[]; totalInvoices: number } }>(
        API_ENDPOINTS.customers.detail(customer.id)
      )
        .then(res => setInvoices(res.data.invoices))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [customer, isOpen]);

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