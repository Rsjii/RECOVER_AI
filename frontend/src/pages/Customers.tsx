import React, { useState, useCallback, useEffect } from 'react';
import { api } from '../lib/api';
import { API_ENDPOINTS, PAGINATION_LIMIT } from '../lib/constants';
import { useNotification } from '../hooks/useNotification';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { CustomerTable } from '../components/customers/CustomerTable';
import { CustomerModal } from '../components/customers/CustomerModal';
import { AddCustomerModal } from '../components/customers/AddCustomerModal';
import { ImportCustomersModal } from '../components/customers/ImportCustomersModal';
import { Button } from '../components/ui/Button';
import { formatCurrency } from '../lib/utils';
import type { Customer } from '../types';

const riskTiers = [
  { value: '', label: 'All' },
  { value: 'high', label: 'High Risk' },
  { value: 'medium', label: 'Medium Risk' },
  { value: 'low', label: 'Low Risk' },
  { value: 'none', label: 'No Risk' },
];

function exportCustomersCSV(customers: Customer[]) {
  const headers = ['Name', 'Email', 'Company', 'AR Balance', 'Risk Score', 'On-Time Rate', 'Last Payment', 'Total Invoices'];
  const rows = customers.map(c => [
    c.name,
    c.email,
    c.company_name ?? '',
    String(Number(c.total_ar_balance ?? 0).toFixed(2)),
    String(c.max_risk_score ?? ''),
    String(c.payment_history.on_time_rate) + '%',
    String(c.unpaid_invoice_count ?? 0),
    String(c.payment_history.total_invoices),
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const Customers: React.FC = () => {
  useEffect(() => {
    document.title = 'Customers — RecoverAI';
  }, []);
  const { addToast } = useNotification();
  const isDemo = typeof window !== 'undefined' && localStorage.getItem('isDemo') === 'true';
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [riskTier, setRiskTier] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string> | null>(null);
  const [selectAllPages, setSelectAllPages] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCustomers = useCallback(async (p: number, tier: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGINATION_LIMIT) });
      if (tier) params.set('riskTier', tier);
      const res = await api.get<{ data: Customer[]; total: number; page: number; totalPages: number }>(
        `${API_ENDPOINTS.customers.list}?${params}`
      );
      setCustomers(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setSelectedIds(new Set()); // Clear selection on fetch
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to load customers' });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const handleSelectAllPages = async () => {
    if (selectAllPages) {
      setSelectedIds(new Set());
      setSelectAllPages(false);
      return;
    }

    try {
      const res = await api.get<{ customerIds: string[] }>(`${API_ENDPOINTS.customers.list}/all-ids${riskTier ? `?riskTier=${riskTier}` : ''}`);
      setSelectedIds(new Set(res.customerIds));
      setSelectAllPages(true);
      addToast({ type: 'success', message: `Selected ${res.customerIds.length} customers` });
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to select all customers' });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setDeletingIds(selectedIds);
    try {
      await api.post(`${API_ENDPOINTS.customers.list}/bulk-delete`, {
        customerIds: Array.from(selectedIds),
      });
      addToast({ type: 'success', message: `Deleted ${selectedIds.size} customer${selectedIds.size !== 1 ? 's' : ''}` });
      setSelectedIds(new Set());
      setSelectAllPages(false);
      fetchCustomers(page, riskTier);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to delete customers' });
    } finally {
      setDeletingIds(null);
    }
  };

  const handleCustomerAdded = () => {
    fetchCustomers(page, riskTier);
  };

  useEffect(() => { fetchCustomers(page, riskTier); }, [page, riskTier]);

  const filtered = debouncedSearch
    ? customers.filter(
        (c) => c.name.toLowerCase().includes(debouncedSearch) || c.email.toLowerCase().includes(debouncedSearch)
      )
    : customers;

  const totalAR = filtered.reduce((sum, c) => sum + Number(c.total_ar_balance ?? 0), 0);
  const atRiskCount = filtered.filter(c => (c.customer_risk_score ?? 0) > 60).length;

  return (
    <>
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        title={`Delete ${selectedIds.size} customer${selectedIds.size !== 1 ? 's' : ''}?`}
        message="This action cannot be undone. The selected customers and their data will be permanently deleted."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDangerous={true}
        isLoading={deletingIds !== null}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <div className="space-y-6 pb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customers</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.size > 0 && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleBulkDelete}
              disabled={deletingIds !== null}
            >
              {deletingIds ? 'Deleting...' : `Delete ${selectedIds.size}`}
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)} disabled={isDemo}>
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Customer
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowImportModal(true)} disabled={isDemo}>
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Import CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => exportCustomersCSV(filtered)}>
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </Button>
          <div className="relative">
            <input type="text" placeholder="Search customers..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none w-56" />
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Risk tier filter pills */}
      <div className="flex gap-2 flex-wrap">
        {riskTiers.map((t) => (
          <button
            key={t.value}
            onClick={() => { setRiskTier(t.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              riskTier === t.value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/[0.1]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!loading && filtered.length > 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {filtered.length} customer{filtered.length !== 1 ? 's' : ''} &middot; {formatCurrency(totalAR)} total AR
          {atRiskCount > 0 && (
            <span className="ml-1 text-rose-500 font-medium">&middot; {atRiskCount} at risk</span>
          )}
        </div>
      )}

      {!loading && total === 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-8 text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No customers found</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {riskTier ? 'No customers match this risk tier filter.' : 'Customers will appear automatically after your first invoice sync.'}
          </p>
          {!riskTier && (
            <Button variant="outline" onClick={() => window.location.assign('/invoices')}>
              Go to Invoices
            </Button>
          )}
        </div>
      )}

      <CustomerTable
        customers={filtered}
        loading={loading}
        pagination={{ page, pages: totalPages, total, onPageChange: setPage }}
        onRowClick={setSelected}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        selectAllPages={selectAllPages}
        onSelectAllPages={handleSelectAllPages}
      />
      <CustomerModal customer={selected} isOpen={!!selected} onClose={() => setSelected(null)} />
      <AddCustomerModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCustomerAdded={handleCustomerAdded}
      />
      <ImportCustomersModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleCustomerAdded}
      />
      </div>
    </>
  );
};

export default Customers;
