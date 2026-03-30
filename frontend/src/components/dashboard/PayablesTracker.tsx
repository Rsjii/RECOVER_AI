import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/utils';
import { useNotification } from '../../hooks/useNotification';
import { Button } from '../ui/Button';

export interface Payable {
  id: string;
  company_id: string;
  vendor_name: string;
  amount: number;
  due_date: string;
  category: 'payroll' | 'rent' | 'cloud' | 'marketing' | 'other';
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface PayablesTrackerProps {
  loading?: boolean;
}

export const PayablesTracker: React.FC<PayablesTrackerProps> = ({ loading = false }) => {
  const [payables, setPayables] = useState<Payable[]>([]);
  const [isLoading, setIsLoading] = useState(loading);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    vendor_name: string;
    amount: string;
    due_date: string;
    category: 'payroll' | 'rent' | 'cloud' | 'marketing' | 'other';
    notes: string;
  }>({
    vendor_name: '',
    amount: '',
    due_date: '',
    category: 'other',
    notes: '',
  });
  const { addToast } = useNotification();

  useEffect(() => {
    fetchPayables();
  }, []);

  const fetchPayables = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{ data: Payable[] }>('/api/payables');
      setPayables(res.data || []);
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to load payables',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddClick = () => {
    setEditingId(null);
    setFormData({
      vendor_name: '',
      amount: '',
      due_date: '',
      category: 'other' as const,
      notes: '',
    });
    setShowForm(true);
  };

  const handleEditClick = (payable: Payable) => {
    setEditingId(payable.id);
    setFormData({
      vendor_name: payable.vendor_name,
      amount: String(payable.amount),
      due_date: payable.due_date,
      category: payable.category as 'payroll' | 'rent' | 'cloud' | 'marketing' | 'other',
      notes: payable.notes || '',
    });
    setShowForm(true);
  };

  const handleDeleteClick = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payable?')) return;

    try {
      await api.delete(`/api/payables/${id}`);
      setPayables(prev => prev.filter(p => p.id !== id));
      addToast({
        type: 'success',
        message: 'Payable deleted',
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to delete payable',
      });
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(formData.amount);
    if (!formData.vendor_name || isNaN(amount) || !formData.due_date) {
      addToast({
        type: 'error',
        message: 'Please fill in all required fields',
      });
      return;
    }

    try {
      if (editingId) {
        // Update
        const res = await api.put<{ data: Payable }>(`/api/payables/${editingId}`, {
          vendor_name: formData.vendor_name,
          amount,
          due_date: formData.due_date,
          category: formData.category,
          notes: formData.notes || undefined,
        });
        setPayables(prev => prev.map(p => (p.id === editingId ? res.data : p)));
        addToast({
          type: 'success',
          message: 'Payable updated',
        });
      } else {
        // Create
        const res = await api.post<{ data: Payable }>('/api/payables', {
          vendor_name: formData.vendor_name,
          amount,
          due_date: formData.due_date,
          category: formData.category,
          notes: formData.notes || undefined,
        });
        setPayables(prev => [...prev, res.data]);
        addToast({
          type: 'success',
          message: 'Payable added',
        });
      }
      setShowForm(false);
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to save payable',
      });
    }
  };

  const categories = ['payroll', 'rent', 'cloud', 'marketing', 'other'] as const;
  const categoryColors: Record<typeof categories[number], string> = {
    payroll: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    rent: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
    cloud: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
    marketing: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    other: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300',
  };

  const sortedPayables = [...payables].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  const totalAmount = payables.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bills & Payables</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Track upcoming vendor payments ({payables.length} bills, {formatCurrency(totalAmount)} total)
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleAddClick}
          disabled={isLoading}
        >
          + Add Bill
        </Button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editingId ? 'Edit Bill' : 'Add New Bill'}
            </h3>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Vendor Name *
                </label>
                <input
                  type="text"
                  value={formData.vendor_name}
                  onChange={e => setFormData(prev => ({ ...prev, vendor_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Stripe, AWS, Salary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Amount (USD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={e => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={e => setFormData(prev => ({ ...prev, category: e.target.value as 'payroll' | 'rent' | 'cloud' | 'marketing' | 'other' }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
                  placeholder="Add notes..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                >
                  {editingId ? 'Update' : 'Add'} Bill
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payables Table */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="text-gray-500 dark:text-gray-400">Loading payables...</div>
        </div>
      ) : payables.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-500 dark:text-gray-400">No bills added yet. Start tracking your payables.</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Vendor</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Category</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Amount</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Due Date</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedPayables.map(payable => {
                const dueDate = new Date(payable.due_date);
                const today = new Date();
                const isOverdue = dueDate < today;
                const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                return (
                  <tr
                    key={payable.id}
                    className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${isOverdue ? 'bg-red-50 dark:bg-red-900/10' : ''}`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900 dark:text-white">{payable.vendor_name}</div>
                      {payable.notes && (
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{payable.notes}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryColors[payable.category]}`}>
                        {payable.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(payable.amount)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-gray-900 dark:text-white">{formatDate(payable.due_date)}</div>
                      <div className={`text-xs font-medium mt-1 ${isOverdue ? 'text-red-600 dark:text-red-400' : daysUntilDue <= 7 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400'}`}>
                        {isOverdue ? `${Math.abs(daysUntilDue)} days overdue` : daysUntilDue === 0 ? 'Due today' : `${daysUntilDue} days remaining`}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditClick(payable)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClick(payable.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
