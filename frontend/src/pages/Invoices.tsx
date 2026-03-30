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
import { formatCurrency } from '../lib/utils';
import type { Invoice } from '../types';

const Invoices: React.FC = () => {
  const { addToast } = useNotification();

  useEffect(() => {
    document.title = 'Invoices — CashOS';
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
  const [agingBucket, setAgingBucket] = useState('');
  const [dunningStageFilter, setDunningStageFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const fetchInvoices = useCallback(async (p: number, s: string, bucket: string, dunningStage: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGINATION_LIMIT) });
      if (s) params.set('status', s);
      if (bucket) params.set('agingBucket', bucket);
      if (dunningStage) params.set('dunningStage', dunningStage);
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

  useEffect(() => {
    fetchInvoices(page, status, agingBucket, dunningStageFilter);
  }, [page, status, agingBucket, dunningStageFilter]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post(API_ENDPOINTS.stripe.sync);
      addToast({ type: 'success', message: 'Invoices synced from Stripe' });
      fetchInvoices(1, status, agingBucket, dunningStageFilter);
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

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (agingBucket) params.set('agingBucket', agingBucket);
    if (dunningStageFilter) params.set('dunningStage', dunningStageFilter);
    if (debouncedSearch) params.set('search', debouncedSearch);
    const url = `/api/invoices/export?${params}`;
    window.open(url, '_blank');
  };

  const filtered = debouncedSearch
    ? invoices.filter((inv) =>
        inv.customer_name?.toLowerCase().includes(debouncedSearch) ||
        inv.customer_email?.toLowerCase().includes(debouncedSearch)
      )
    : invoices;

  const totalAR = filtered.reduce((sum, inv) => {
    if (inv.status !== 'paid' && inv.status !== 'uncollectable') return sum + Number(inv.amount);
    return sum;
  }, 0);

  const handleMarkPaid = async () => {
    if (selectedIds.size === 0) return;
    try {
      await Promise.all([...selectedIds].map(id => api.put(`/api/invoices/${id}/status`, { status: 'paid' })));
      addToast({ type: 'success', message: `${selectedIds.size} invoice(s) marked as paid` });
      setSelectedIds(new Set());
      fetchInvoices(page, status, agingBucket, dunningStageFilter);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to mark as paid' });
    }
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoices</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={handleExportCSV}>
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </Button>
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
          <BulkActions
            onSync={handleSync}
            onScheduleEmails={handleSchedule}
            syncing={syncing}
            selectedCount={selectedIds.size}
            onMarkPaid={handleMarkPaid}
            onClearSelection={() => setSelectedIds(new Set())}
          />
        </div>
      </div>

      <FilterBar
        status={status}
        onStatusChange={(s) => { setStatus(s); setPage(1); }}
        agingBucket={agingBucket}
        onAgingBucketChange={(b) => { setAgingBucket(b); setPage(1); }}
        dunningStage={dunningStageFilter}
        onDunningStageChange={(s) => { setDunningStageFilter(s); setPage(1); }}
        search={search}
        onSearchChange={setSearch}
        onRefresh={() => fetchInvoices(page, status, agingBucket, dunningStageFilter)}
        loading={loading}
      />

      {!loading && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Showing {filtered.length} invoice{filtered.length !== 1 ? 's' : ''} &middot; {formatCurrency(totalAR)} total AR
          {selectedIds.size > 0 && (
            <span className="ml-2 text-indigo-600 dark:text-indigo-400 font-medium">
              · {selectedIds.size} selected
            </span>
          )}
        </div>
      )}

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

      <InvoiceTable
        invoices={filtered}
        loading={loading}
        pagination={{ page, pages: totalPages, limit: PAGINATION_LIMIT, total, onPageChange: setPage }}
        onRowClick={setSelected}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />
      <InvoiceModal invoice={selected} isOpen={!!selected}
        onClose={() => setSelected(null)} onStatusUpdate={() => fetchInvoices(page, status, agingBucket, dunningStageFilter)} />
      <ManualInvoiceModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}
        onCreated={() => fetchInvoices(1, status, agingBucket, dunningStageFilter)} />
      <CSVUploadModal isOpen={showCSVModal} onClose={() => setShowCSVModal(false)}
        onSuccess={() => fetchInvoices(1, status, agingBucket, dunningStageFilter)} />
    </div>
  );
};

export default Invoices;
