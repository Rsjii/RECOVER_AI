import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AdminCompanyRow } from '../../hooks/useAdminCompanies';
import { Card } from '../ui/Card';
import { CompanyFilters } from './CompanyFilters';
import { CompanyListTable } from './CompanyListTable';
import { useAdminCompanies } from '../../hooks/useAdminCompanies';

export const AdminCompanies: React.FC = () => {
  const navigate = useNavigate();
  const {
    companies, total, loading, fetchCompanies,
  } = useAdminCompanies();

  const [search, setSearch] = useState('');
  const [accountType, setAccountType] = useState('');
  const [billingTier, setBillingTier] = useState('');
  const [trialStatus, setTrialStatus] = useState('');
  const [minUsers, setMinUsers] = useState('');
  const [minAR, setMinAR] = useState('');
  const [stripeStatus, setStripeStatus] = useState('');
  const [hasInvoices, setHasInvoices] = useState('');
  const [activeUsers, setActiveUsers] = useState('');
  const [recoveryRate, setRecoveryRate] = useState('');
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  useEffect(() => {
    fetchCompanies(search, accountType, LIMIT, offset);
  }, [search, accountType, offset, fetchCompanies]);

  const handleSelectCompany = (company: AdminCompanyRow) => {
    navigate(`/admin/companies/${company.id}`);
  };

  // Apply client-side filters
  const filteredCompanies = companies.filter(company => {
    if (billingTier && company.billing_tier !== billingTier) return false;
    if (trialStatus === 'active' && company.trial_status !== 'active') return false;
    if (trialStatus === 'expired' && company.trial_status !== 'expired') return false;
    if (trialStatus === 'none' && company.trial_status !== null) return false;
    if (minUsers && company.user_count < parseInt(minUsers)) return false;
    if (minAR && company.total_ar < parseFloat(minAR)) return false;
    if (stripeStatus === 'yes' && !company.has_stripe) return false;
    if (stripeStatus === 'no' && company.has_stripe) return false;
    if (hasInvoices === 'yes' && company.invoice_count === 0) return false;
    if (hasInvoices === 'no' && company.invoice_count > 0) return false;
    if (activeUsers === 'yes' && company.user_count === 0) return false;
    if (activeUsers === 'no' && company.user_count > 0) return false;
    if (recoveryRate) {
      const recoveryPercent = company.total_ar > 0 ? (company.recovered_ar / company.total_ar) * 100 : 0;
      if (recoveryRate === 'high' && recoveryPercent <= 50) return false;
      if (recoveryRate === 'med' && (recoveryPercent < 20 || recoveryPercent > 50)) return false;
      if (recoveryRate === 'low' && recoveryPercent >= 20) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Companies</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {filteredCompanies.length} of {total} companies
            </p>
          </div>
        </div>
        <CompanyFilters
          search={search}
          accountType={accountType}
          onSearchChange={(s) => { setSearch(s); setOffset(0); }}
          onAccountTypeChange={(t) => { setAccountType(t); setOffset(0); }}
          onBillingTierChange={(t) => setBillingTier(t)}
          onTrialStatusChange={(t) => setTrialStatus(t)}
          onMinUsersChange={(min) => setMinUsers(min)}
          onMinARChange={(min) => setMinAR(min)}
          onStripeChange={(status) => setStripeStatus(status)}
          onHasInvoicesChange={(status) => setHasInvoices(status)}
          onActiveUsersChange={(status) => setActiveUsers(status)}
          onRecoveryRateChange={(rate) => setRecoveryRate(rate)}
          onRefresh={() => fetchCompanies(search, accountType, LIMIT, offset)}
          loading={loading}
        />
      </Card>

      <Card className="p-6">
        <CompanyListTable
          companies={filteredCompanies}
          onSelectCompany={handleSelectCompany}
          loading={loading}
        />

        {total > LIMIT && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-white/10">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                disabled={offset === 0}
                className="px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm disabled:opacity-40"
              >Previous</button>
              <button
                onClick={() => setOffset(offset + LIMIT)}
                disabled={(offset + LIMIT) >= total}
                className="px-3 py-2 border border-gray-300 dark:border-white/10 rounded-lg text-sm disabled:opacity-40"
              >Next</button>
            </div>
          </div>
        )}
      </Card>

    </div>
  );
};