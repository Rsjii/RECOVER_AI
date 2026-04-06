import { useState, useCallback } from 'react';
import { api } from '../lib/api';
import { logError } from '../utils/logger';

export interface AdminCompanyRow {
  id: string;
  name: string;
  account_type: string;
  billing_tier: string;
  trial_status: string | null;
  trial_ends_at: string | null;
  created_at: string;
  user_count: number;
  customer_count: number;
  invoice_count: number;
  total_ar: number;
  recovered_ar: number;
  email_count: number;
  has_stripe: boolean;
  stripe_account_id: string | null;
  last_activity: string | null;
}

export interface AdminCompanyDetail {
  id: string;
  name: string;
  account_type: string;
  billing_tier: string;
  trial_status: string | null;
  trial_ends_at: string | null;
  trial_started_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyDetailData {
  detail: AdminCompanyDetail | null;
  users: any[];
  invoices: any;
  emails: any;
  stripe: any[];
  activity: any[];
}

export function useAdminCompanies() {
  const [companies, setCompanies] = useState<AdminCompanyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<AdminCompanyDetail | null>(null);
  const [companyDetailData, setCompanyDetailData] = useState<CompanyDetailData>({
    detail: null, users: [], invoices: null, emails: null, stripe: [], activity: [],
  });
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchCompanies = useCallback(async (search = '', accountType = '', limit = 50, offset = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (search) params.set('search', search);
      if (accountType) params.set('accountType', accountType);

      const res = await api.get<any>(`/api/admin/companies?${params}`);
      setCompanies(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch (err: any) {
      logError('useAdminCompanies', 'fetchCompanies', 'Failed to fetch companies', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCompanyDetail = useCallback(async (companyId: string) => {
    setDetailLoading(true);
    try {
      const [detailRes, usersRes, invoicesRes, emailsRes, stripeRes, activityRes] = await Promise.allSettled([
        api.get<{ data: AdminCompanyDetail }>(`/api/admin/companies/${companyId}`),
        api.get<{ data: any[] }>(`/api/admin/companies/${companyId}/users`),
        api.get<{ data: any }>(`/api/admin/companies/${companyId}/invoices`),
        api.get<{ data: any }>(`/api/admin/companies/${companyId}/emails`),
        api.get<{ data: any[] }>(`/api/admin/companies/${companyId}/stripe`),
        api.get<{ data: any[] }>(`/api/admin/companies/${companyId}/activity`),
      ]);

      // Use Promise.allSettled so partial failures don't crash everything
      const detail = detailRes.status === 'fulfilled' ? (detailRes.value as any).data : null;
      const users = usersRes.status === 'fulfilled' ? ((usersRes.value as any).data || []) : [];
      const invoices = invoicesRes.status === 'fulfilled' ? (invoicesRes.value as any).data : null;
      const emails = emailsRes.status === 'fulfilled' ? (emailsRes.value as any).data : null;
      const stripe = stripeRes.status === 'fulfilled' ? ((stripeRes.value as any).data || []) : [];
      const activity = activityRes.status === 'fulfilled' ? ((activityRes.value as any).data || []) : [];

      setSelectedCompany(detail);
      setCompanyDetailData({ detail, users, invoices, emails, stripe, activity });
    } catch (err: any) {
      logError('useAdminCompanies', 'fetchCompanyDetail', 'Failed to fetch company detail', err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const updateCompanySettings = useCallback(async (companyId: string, updates: any) => {
    try {
      await api.patch(`/api/admin/companies/${companyId}`, updates);
      await fetchCompanyDetail(companyId);
    } catch (err: any) {
      logError('useAdminCompanies', 'updateCompanySettings', 'Failed to update company', err);
      throw err;
    }
  }, [fetchCompanyDetail]);

  return {
    companies,
    total,
    loading,
    fetchCompanies,
    selectedCompany,
    companyDetailData,
    detailLoading,
    fetchCompanyDetail,
    setSelectedCompany,
    updateCompanySettings,
  };
}