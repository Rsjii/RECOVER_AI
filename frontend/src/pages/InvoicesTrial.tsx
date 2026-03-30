import React, { useState, useCallback, useEffect } from 'react';
import { api } from '../lib/api';
import { API_ENDPOINTS, PAGINATION_LIMIT } from '../lib/constants';
import { useNotification } from '../hooks/useNotification';
import { FilterBarTrial } from '../components/invoices/FilterBarTrial';
import { InvoiceTable } from '../components/invoices/InvoiceTable';
import { InvoiceModal } from '../components/invoices/InvoiceModal';
import { Button } from '../components/ui/Button';
import { formatCurrency } from '../lib/utils';
import type { Invoice } from '../types';

const InvoicesTrial: React.FC = () => {
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
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const fetchInvoices = useCallback(async (p: number, s: string, bucket: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGINATION_LIMIT) });
      if (s) params.set('status', s);
      if (bucket) params.set('agingBucket', bucket);
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
    fetchInvoices(page, status, agingBucket);
  }, [page, status, agingBucket, fetchInvoices]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post(API_ENDPOINTS.stripe.sync);
      addToast({ type: 'success', message: 'Invoices synced from Stripe' });
      fetchInvoices(1, status, agingBucket);
      setPage(1);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Sync failed' });
    } finally { setSyncing(false); }
  };

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (agingBucket) params.set('agingBucket', agingBucket);
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

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoices</h1>
          <span className="text-xs bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full font-medium">
            🔒 Read-Only (Trial)
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={handleExportCSV}>
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSync}
            loading={syncing}
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync from Stripe
          </Button>
          <div title="Upgrade to paid to import invoices">
            <Button
              variant="secondary"
              size="sm"
              disabled
              className="opacity-50 cursor-not-allowed"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Import CSV
            </Button>
          </div>
          <div title="Upgrade to paid to create invoices">
            <Button
              variant="secondary"
              size="sm"
              disabled
              className="opacity-50 cursor-not-allowed"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Invoice
            </Button>
          </div>
        </div>
      </div>

      <FilterBarTrial
        status={status}
        onStatusChange={(s: string) => { setStatus(s); setPage(1); }}
        agingBucket={agingBucket}
        onAgingBucketChange={(b: string) => { setAgingBucket(b); setPage(1); }}
        search={search}
        onSearchChange={setSearch}
        onRefresh={() => fetchInvoices(page, status, agingBucket)}
        loading={loading}
      />

      {!loading && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Showing {filtered.length} invoice{filtered.length !== 1 ? 's' : ''} &middot; {formatCurrency(totalAR)} total AR
        </div>
      )}

      {!loading && total === 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-8 text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No invoices yet</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Sync Stripe invoices to get started.
          </p>
          <Button variant="primary" onClick={handleSync} loading={syncing}>Sync from Stripe</Button>
        </div>
      )}

      <InvoiceTable
        invoices={filtered}
        loading={loading}
        pagination={{ page, pages: totalPages, limit: PAGINATION_LIMIT, total, onPageChange: setPage }}
        onRowClick={setSelected}
        selectedIds={new Set()}
        onSelectionChange={() => {}}
      />
      <InvoiceModal invoice={selected} isOpen={!!selected}
        onClose={() => setSelected(null)} onStatusUpdate={() => fetchInvoices(page, status, agingBucket)} />
    </div>
  );
};

export default InvoicesTrial;
