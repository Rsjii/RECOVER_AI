import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import { API_ENDPOINTS } from '../../lib/constants';
import { useNotification } from '../../hooks/useNotification';
import { validateEmail } from '../../lib/utils';

interface ManualInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export const ManualInvoiceModal: React.FC<ManualInvoiceModalProps> = ({ isOpen, onClose, onCreated }) => {
  const { addToast } = useNotification();
  const [form, setForm] = useState({
    customerName: '',
    customerEmail: '',
    amount: '',
    currency: 'USD',
    dueDate: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.customerName.trim()) e.customerName = 'Required';
    if (!form.customerEmail.trim()) e.customerEmail = 'Required';
    else if (!validateEmail(form.customerEmail)) e.customerEmail = 'Invalid email';
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) e.amount = 'Enter a valid amount';
    if (!form.dueDate) e.dueDate = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await api.post(API_ENDPOINTS.invoices.manual, {
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim(),
        amount: Number(form.amount),
        currency: form.currency,
        dueDate: form.dueDate,
        notes: form.notes.trim() || undefined,
      });
      addToast({ type: 'success', message: 'Invoice created successfully' });
      setForm({ customerName: '', customerEmail: '', amount: '', currency: 'USD', dueDate: '', notes: '' });
      onCreated();
      onClose();
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to create invoice' });
    } finally {
      setSubmitting(false);
    }
  };

  const field = (label: string, key: keyof typeof form, props?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
      <input
        {...props}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className={`w-full px-4 py-2.5 border rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
          errors[key] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
        }`}
      />
      {errors[key] && <p className="mt-1 text-xs text-red-500">{errors[key]}</p>}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Manual Invoice" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {field('Customer Name', 'customerName', { placeholder: 'Acme Corp' })}
        {field('Customer Email', 'customerEmail', { type: 'email', placeholder: 'billing@acme.com' })}
        <div className="grid grid-cols-2 gap-3">
          {field('Amount', 'amount', { type: 'number', min: '0.01', step: '0.01', placeholder: '1000.00' })}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Currency</label>
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        {field('Due Date', 'dueDate', { type: 'date' })}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            placeholder="Any notes about this invoice..."
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={submitting}>Create Invoice</Button>
        </div>
      </form>
    </Modal>
  );
};
