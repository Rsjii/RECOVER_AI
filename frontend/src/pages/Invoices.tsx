import React, { useState, useCallback, useEffect } from 'react';
import { api } from '../lib/api';
import { logError } from '../utils/logger';
import { API_ENDPOINTS, PAGINATION_LIMIT } from '../lib/constants';
import { useNotification } from '../hooks/useNotification';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { FilterPanel } from '../components/invoices/FilterPanel';
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
  const isDemo = typeof window !== 'undefined' && localStorage.getItem('isDemo') === 'true';

  useEffect(() => {
    document.title = 'Invoices — RecoverAI';
  }, []);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState('unpaid');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [agingBucket, setAgingBucket] = useState('');
  const [dunningStageFilter, setDunningStageFilter] = useState('');
  const [sortBy, setSortBy] = useState('days_overdue_desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{ status: 'processing' | 'done' | 'error'; created: number; skipped: number; duplicates: number; total: number; error?: string } | null>(null);
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<{ status: 'processing' | 'done' | 'error'; deleted: number; total: number; error?: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Poll for import status
  useEffect(() => {
    if (!importJobId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await api.get(`/api/invoices/csv-import-status/${importJobId}`);
        const status = res.data;
        setImportStatus(status);

        if (status.status === 'done' || status.status === 'error') {
          clearInterval(pollInterval);
          if (status.status === 'done') {
            addToast({
              type: 'success',
              message: `✅ Import complete: ${status.created} created${status.duplicates > 0 ? `, ${status.duplicates} duplicates skipped` : ''}`
            });
            fetchInvoices(1, '', '', '', '');
          } else {
            addToast({ type: 'error', message: `Import failed: ${status.error}` });
          }
          setTimeout(() => {
            setImportJobId(null);
            setImportStatus(null);
            setShowCSVModal(false);
          }, 1500);
        }
      } catch (err: any) {
        logError('Component', 'handler', 'Failed to poll import status:', err);
      }
    }, 2000);  // ✅ Performance: Reduced from 1s to 2s (50% fewer API calls)

    return () => clearInterval(pollInterval);
  }, [importJobId, addToast]);

  // Poll for delete status
  useEffect(() => {
    if (!deleteJobId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await api.get(`/api/invoices/batch-delete-status/${deleteJobId}`);
        const status = res.data;
        setDeleteStatus(status);

        if (status.status === 'done' || status.status === 'error') {
          clearInterval(pollInterval);
          if (status.status === 'done') {
            addToast({
              type: 'success',
              message: `✅ Deleted ${status.deleted} invoices`
            });
            fetchInvoices(1, '', '', '', '');
          } else {
            addToast({ type: 'error', message: `Delete failed: ${status.error}` });
          }
          setTimeout(() => {
            setDeleteJobId(null);
            setDeleteStatus(null);
          }, 1500);
        }
      } catch (err: any) {
        logError('Component', 'handler', 'Failed to poll delete status:', err);
      }
    }, 2000);  // ✅ Performance: Reduced from 1s to 2s (50% fewer API calls)

    return () => clearInterval(pollInterval);
  }, [deleteJobId, addToast]);

  const fetchInvoices = useCallback(async (p: number, s: string, bucket: string, dunningStage: string, sort: string = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGINATION_LIMIT) });
      if (s) params.set('status', s);
      if (bucket) params.set('agingBucket', bucket);
      if (dunningStage) params.set('dunningStage', dunningStage);
      if (sort) params.set('sort', sort);
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
    fetchInvoices(page, status, agingBucket, dunningStageFilter, sortBy);
  }, [page, status, agingBucket, dunningStageFilter, sortBy]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post(API_ENDPOINTS.stripe.sync);
      addToast({ type: 'success', message: 'Invoices synced from Stripe' });
      fetchInvoices(1, status, agingBucket, dunningStageFilter, sortBy);
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

  const handleSelectAllPages = async () => {
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (agingBucket) params.append('agingBucket', agingBucket);
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (dunningStageFilter) params.append('dunningStage', dunningStageFilter);

      const queryString = params.toString();
      const url = queryString ? `/api/invoices/all-ids?${queryString}` : '/api/invoices/all-ids';
      const res = await api.get<{ ids: string[] }>(url);

      setSelectedIds(new Set(res.ids));
      addToast({ type: 'success', message: `Selected all ${res.ids.length} invoice(s)` });
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to select all invoices' });
    }
  };

  const handleMarkPaid = async () => {
    if (selectedIds.size === 0) return;

    const ids = [...selectedIds];
    const batchSize = 5;

    try {
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        await Promise.allSettled(batch.map(id => api.put(`/api/invoices/${id}/status`, { status: 'paid' })));
      }

      addToast({ type: 'success', message: `${selectedIds.size} invoice(s) marked as paid` });
      setSelectedIds(new Set());
      fetchInvoices(page, status, agingBucket, dunningStageFilter, sortBy);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to mark as paid' });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    const ids = [...selectedIds];

    try {
      const res = await api.post('/api/invoices/batch-delete', { invoiceIds: ids });
      const newJobId = res.data.jobId;
      setDeleteJobId(newJobId);
      setDeleteStatus({ status: 'processing', deleted: 0, total: ids.length });
      setSelectedIds(new Set());
      addToast({ type: 'info', message: `Deleting ${ids.length} invoice(s)... You can access other tabs while this completes.` });
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to delete invoices' });
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    try {
      await api.delete(`/api/invoices/${invoiceId}`);
      addToast({ type: 'success', message: 'Invoice deleted successfully' });
      setSelected(null);
      fetchInvoices(page, status, agingBucket, dunningStageFilter);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to delete invoice' });
    }
  };

  return (
    <>
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        title={`Delete ${selectedIds.size} invoice(s)?`}
        message="This action cannot be undone. The selected invoices will be permanently deleted."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDangerous={true}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <div className="pb-6">
        {/* TOP BANNER - Shows when import/delete in progress, ABOVE everything else */}
      {(importJobId || deleteJobId) && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 border-3 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
            </div>
            <div className="flex-1 min-w-0">
              {importJobId && importStatus && (
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-300 text-sm">Importing {importStatus.total} invoices...</h3>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="text-blue-700 dark:text-blue-300">
                      <span className="block font-medium">{importStatus.created}</span>
                      <span className="text-blue-600 dark:text-blue-400">Created</span>
                    </div>
                    <div className="text-blue-700 dark:text-blue-300">
                      <span className="block font-medium">{importStatus.duplicates}</span>
                      <span className="text-blue-600 dark:text-blue-400">Skipped</span>
                    </div>
                    <div className="text-blue-700 dark:text-blue-300">
                      <span className="block font-medium">{Math.round((importStatus.created + importStatus.duplicates) / importStatus.total * 100)}%</span>
                      <span className="text-blue-600 dark:text-blue-400">Progress</span>
                    </div>
                  </div>
                </div>
              )}
              {deleteJobId && deleteStatus && (
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-300 text-sm">Deleting {deleteStatus.total} invoices...</h3>
                  <div className="mt-2 flex items-center gap-4 text-xs">
                    <div className="text-blue-700 dark:text-blue-300">
                      <span className="block font-medium">{deleteStatus.deleted} / {deleteStatus.total}</span>
                      <span className="text-blue-600 dark:text-blue-400">Deleted</span>
                    </div>
                    <div className="text-blue-700 dark:text-blue-300">
                      <span className="block font-medium">{Math.round(deleteStatus.deleted / deleteStatus.total * 100)}%</span>
                      <span className="text-blue-600 dark:text-blue-400">Progress</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoices</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={handleExportCSV}>
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowCSVModal(true)}>
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            <span className="hidden sm:inline">Import CSV</span>
            <span className="sm:hidden">Import</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowCreateModal(true)}>
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">New Invoice</span>
            <span className="sm:hidden">New</span>
          </Button>
          <BulkActions
            onSync={handleSync}
            onScheduleEmails={handleSchedule}
            syncing={syncing}
            selectedCount={selectedIds.size}
            onMarkPaid={handleMarkPaid}
            onDeleteSelected={handleDeleteSelected}
            onClearSelection={() => setSelectedIds(new Set())}
          />
        </div>
      </div>

      <FilterPanel
        status={status}
        onStatusChange={(s: string) => { setStatus(s); setPage(1); }}
        agingBucket={agingBucket}
        onAgingBucketChange={(b: string) => { setAgingBucket(b); setPage(1); }}
        dunningStage={dunningStageFilter}
        onDunningStageChange={(s: string) => { setDunningStageFilter(s); setPage(1); }}
        sortBy={sortBy}
        onSortChange={(s: string) => { setSortBy(s); setPage(1); }}
        search={search}
        onSearchChange={setSearch}
        onRefresh={() => fetchInvoices(page, status, agingBucket, dunningStageFilter, sortBy)}
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
            <Button variant="primary" onClick={handleSync} loading={syncing} disabled={isDemo}>Sync from Stripe</Button>
            <Button variant="secondary" onClick={() => setShowCreateModal(true)} disabled={isDemo}>Create Manual</Button>
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
        onDelete={handleDeleteInvoice}
        totalCount={total}
        onSelectAllPages={handleSelectAllPages}
      />
      <InvoiceModal invoice={selected} isOpen={!!selected}
        onClose={() => setSelected(null)} onStatusUpdate={() => fetchInvoices(page, status, agingBucket, dunningStageFilter)} />
      <ManualInvoiceModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}
        onCreated={() => fetchInvoices(1, status, agingBucket, dunningStageFilter)} />
      <CSVUploadModal isOpen={showCSVModal} onClose={() => setShowCSVModal(false)}
        setImportJobId={setImportJobId} />
      </div>
      </div>
    </>
  );
};

export default Invoices;
