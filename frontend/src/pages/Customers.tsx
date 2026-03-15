import React, { useState, useCallback, useEffect } from 'react';
import { api } from '../lib/api';
import { API_ENDPOINTS, PAGINATION_LIMIT } from '../lib/constants';
import { useNotification } from '../hooks/useNotification';
import { CustomerTable } from '../components/customers/CustomerTable';
import { CustomerModal } from '../components/customers/CustomerModal';
import { Button } from '../components/ui/Button';
import type { Customer } from '../types';

const Customers: React.FC = () => {
  useEffect(() => {
    document.title = 'Customers — RecoverAI';
  }, []);
  const { addToast } = useNotification();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCustomers = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Customer[]; total: number; page: number; totalPages: number }>(
        `${API_ENDPOINTS.customers.list}?page=${p}&limit=${PAGINATION_LIMIT}`
      );
      setCustomers(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to load customers' });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchCustomers(page); }, [page]);

  const filtered = debouncedSearch
    ? customers.filter(
        (c) => c.name.toLowerCase().includes(debouncedSearch) || c.email.toLowerCase().includes(debouncedSearch)
      )
    : customers;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Customers</h1>
        <div className="relative">
          <input type="text" placeholder="Search customers..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none w-64" />
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {!loading && total === 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-8 text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No customers yet</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Customers will appear automatically after your first invoice sync.
          </p>
          <Button variant="outline" onClick={() => window.location.assign('/invoices')}>
            Go to Invoices
          </Button>
        </div>
      )}

      <CustomerTable customers={filtered} loading={loading}
        pagination={{ page, pages: totalPages, total, onPageChange: setPage }}
        onRowClick={setSelected} />
      <CustomerModal customer={selected} isOpen={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default Customers;