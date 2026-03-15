import React, { useState, useCallback, useEffect } from 'react';
import { api } from '../lib/api';
import { API_ENDPOINTS, PAGINATION_LIMIT } from '../lib/constants';
import { useNotification } from '../hooks/useNotification';
import { FilterBar } from '../components/invoices/FilterBar';
import { InvoiceTable } from '../components/invoices/InvoiceTable';
import { InvoiceModal } from '../components/invoices/InvoiceModal';
import { BulkActions } from '../components/invoices/BulkActions';
import { ManualInvoiceModal } from '../components/invoices/ManualInvoiceModal';
import { CSVUploadModal } from '../components/invoices/CSVUploadModal';
import { Button } from '../components/ui/Button';
import type { Invoice } from '../types';

const Invoices: React.FC = () => {
  const { addToast } = useNotification();

  useEffect(() => {
    document.title = 'Invoices — RecoverAI';
  }, []);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const fetchInvoices = useCallback(async (p: number, s: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGINATION_LIMIT) });
      if (s) params.set('status', s);
      const res = await api.get<{ data: Invoice[]; total: number; page: number; totalPages: number }>(
        `${API_ENDPOINTS.invoices.list}?${params}`
      );
      setInvoices(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to load invoices' });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchInvoices(page, status); }, [page, status]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post(API_ENDPOINTS.stripe.sync);
      addToast({ type: 'success', message: 'Invoices synced from Stripe' });
      fetchInvoices(1, status);
      setPage(1);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Sync failed' });
    } finally { setSyncing(false); }
  };

  const handleSchedule = async () => {
    try {
      await api.post(API_ENDPOINTS.email.schedule);
      addToast({ type: 'success', message: 'Dunning agent started — emails will be sent for overdue invoices' });
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Schedule failed' });
    }
  };

  const filtered = debouncedSearch
    ? invoices.filter((inv) =>
        inv.customer_name?.toLowerCase().includes(debouncedSearch) ||
        inv.customer_email?.toLowerCase().includes(debouncedSearch)
      )
    : invoices;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoices</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowCSVModal(true)}>
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            Import CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowCreateModal(true)}>
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Invoice
          </Button>
          <BulkActions onSync={handleSync} onScheduleEmails={handleSchedule} syncing={syncing} />
        </div>
      </div>
      <FilterBar status={status} onStatusChange={(s) => { setStatus(s); setPage(1); }}
        search={search} onSearchChange={setSearch}
        onRefresh={() => fetchInvoices(page, status)} loading={loading} />

      {!loading && total === 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-8 text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No invoices yet</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Sync Stripe invoices or create a manual invoice to get started.
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="primary" onClick={handleSync} loading={syncing}>Sync from Stripe</Button>
            <Button variant="secondary" onClick={() => setShowCreateModal(true)}>Create Manual</Button>
          </div>
        </div>
      )}

      <InvoiceTable invoices={filtered} loading={loading}
        pagination={{ page, pages: totalPages, limit: PAGINATION_LIMIT, total, onPageChange: setPage }}
        onRowClick={setSelected} />
      <InvoiceModal invoice={selected} isOpen={!!selected}
        onClose={() => setSelected(null)} onStatusUpdate={() => fetchInvoices(page, status)} />
      <ManualInvoiceModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}
        onCreated={() => fetchInvoices(1, status)} />
      <CSVUploadModal isOpen={showCSVModal} onClose={() => setShowCSVModal(false)}
        onSuccess={() => fetchInvoices(1, status)} />
    </div>
  );
};

export default Invoices;
