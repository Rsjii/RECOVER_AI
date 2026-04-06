import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Card } from '../ui/Card';

interface CompanyDetailTabsProps {
  data: any;
  loading: boolean;
}

type DetailTab = 'overview' | 'ar-health' | 'customers' | 'invoices' | 'emails' | 'usage' | 'billing' | 'team';

export const CompanyDetailTabs: React.FC<CompanyDetailTabsProps> = ({ data, loading }) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  if (loading) return <div className="p-6 text-center text-gray-500">Loading...</div>;

  const tabs: { id: DetailTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'ar-health', label: 'AR Health', icon: '💰' },
    { id: 'customers', label: 'Customers', icon: '👥' },
    { id: 'invoices', label: 'Invoices', icon: '📄' },
    { id: 'emails', label: 'Emails', icon: '📧' },
    { id: 'usage', label: 'Usage', icon: '⚡' },
    { id: 'billing', label: 'Billing', icon: '💳' },
    { id: 'team', label: 'Team', icon: '👤' },
  ];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="border-b border-gray-200 dark:border-white/10 overflow-x-auto">
        <div className="flex gap-2 sm:gap-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap pb-3 px-1 text-sm font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              <span className="mr-1">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && <OverviewTab data={data} />}
        {activeTab === 'ar-health' && <ArHealthTab data={data} />}
        {activeTab === 'customers' && <CustomersTab data={data} />}
        {activeTab === 'invoices' && <InvoicesTab data={data} />}
        {activeTab === 'emails' && <EmailsTab data={data} />}
        {activeTab === 'usage' && <UsageTab data={data} />}
        {activeTab === 'billing' && <BillingTab data={data} />}
        {activeTab === 'team' && <TeamTab data={data} />}
      </div>
    </div>
  );
};

const OverviewTab: React.FC<{ data: any }> = ({ data }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Total AR', value: `$${(data?.invoices?.total_ar || 0).toLocaleString()}` },
        { label: 'Recovered', value: `$${(data?.invoices?.recovered_ar || 0).toLocaleString()}` },
        { label: 'Recovery Rate', value: `${Math.round((data?.invoices?.recovered_ar || 0) / (data?.invoices?.total_ar || 1) * 100)}%` },
        { label: 'Customers', value: data?.users?.length || 0 },
      ].map(stat => (
        <Card key={stat.label} className="p-4 text-center">
          <p className="text-xs text-gray-600 dark:text-gray-400">{stat.label}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
        </Card>
      ))}
    </div>
  </div>
);

const ArHealthTab: React.FC<{ data: any }> = ({ data }) => {
  const arHealth = data?.ar_health;
  if (!arHealth) return <p className="text-gray-500">No AR data</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Total AR', value: `$${(arHealth.total_ar || 0).toLocaleString()}` },
          { label: 'Recovered', value: `$${(arHealth.recovered || 0).toLocaleString()}` },
          { label: 'Recovery Rate', value: `${Math.round(arHealth.recovery_rate || 0)}%` },
          { label: 'Avg DSO', value: `${arHealth.avg_dso || 0} days` },
          { label: 'Overdue', value: arHealth.overdue_count || 0 },
          { label: 'At-Risk Customer', value: arHealth.most_at_risk_customer?.name || 'N/A' },
        ].map(stat => (
          <Card key={stat.label} className="p-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">{stat.label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Aging buckets */}
      <Card className="p-4">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Aging Buckets</h4>
        <div className="grid grid-cols-5 gap-2 text-center text-sm">
          {[
            { name: 'Current', value: arHealth.aging_buckets?.current || 0 },
            { name: '0-30d', value: arHealth.aging_buckets?.days_0_30 || 0 },
            { name: '31-60d', value: arHealth.aging_buckets?.days_31_60 || 0 },
            { name: '61-90d', value: arHealth.aging_buckets?.days_61_90 || 0 },
            { name: '90d+', value: arHealth.aging_buckets?.days_90_plus || 0 },
          ].map(bucket => (
            <div key={bucket.name}>
              <p className="text-gray-600 dark:text-gray-400 text-xs">{bucket.name}</p>
              <p className="font-bold text-lg text-gray-900 dark:text-white">{bucket.value}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

const CustomersTab: React.FC<{ data: any }> = ({ data }) => {
  const customers = data?.customers || [];
  if (customers.length === 0) return <p className="text-gray-500">No customers</p>;

  return (
    <Card className="p-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-white/5">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Name</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">AR</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Risk</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Stage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-white/10">
          {customers.slice(0, 10).map((c: any) => (
            <tr key={c.id}>
              <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{c.name}</td>
              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">${(c.total_ar || 0).toLocaleString()}</td>
              <td className="px-3 py-2">
                <span className={`text-xs font-bold ${(c.risk_score || 0) > 75 ? 'text-red-600' : 'text-yellow-600'}`}>
                  {c.risk_score || 0}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{c.dunning_stage || 'none'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};

const InvoicesTab: React.FC<{ data: any }> = ({ data }) => {
  const invoices = data?.invoices_detailed || [];
  if (invoices.length === 0) return <p className="text-gray-500">No invoices</p>;

  return (
    <Card className="p-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-white/5">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">#</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Customer</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">Amount</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Status</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Overdue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-white/10">
          {invoices.slice(0, 10).map((i: any) => (
            <tr key={i.id}>
              <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">{i.invoice_number}</td>
              <td className="px-3 py-2 text-gray-900 dark:text-white">{i.customer}</td>
              <td className="px-3 py-2 text-right font-bold text-gray-900 dark:text-white">${(i.amount_due || 0).toLocaleString()}</td>
              <td className="px-3 py-2">
                <span className={`text-xs px-2 py-1 rounded font-medium ${
                  i.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                  i.status === 'overdue' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                  'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                }`}>{i.status}</span>
              </td>
              <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">{Math.floor(i.days_overdue || 0)}d</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};

const EmailsTab: React.FC<{ data: any }> = ({ data }) => {
  const emails = data?.emails || [];
  if (emails.length === 0) return <p className="text-gray-500">No emails sent</p>;

  const summary = data?.email_summary;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Sent', value: summary?.total_sent || 0 },
          { label: 'Opened', value: summary?.opened || 0 },
          { label: 'Clicked', value: summary?.clicked || 0 },
          { label: 'Bounced', value: summary?.bounced || 0 },
          { label: 'Failed', value: summary?.failed || 0 },
        ].map(stat => (
          <Card key={stat.label} className="p-3 text-center">
            <p className="text-xs text-gray-600 dark:text-gray-400">{stat.label}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
};

const UsageTab: React.FC<{ data: any }> = ({ data }) => {
  const summary = data?.usage_summary;
  if (!summary) return <p className="text-gray-500">No usage data</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Calls', value: (summary.total_calls || 0).toLocaleString() },
          { label: 'Total Tokens', value: (summary.total_input_tokens || 0 + summary.total_output_tokens || 0).toLocaleString() },
          { label: 'Total Cost', value: `$${(summary.total_cost_usd || 0).toFixed(2)}` },
          { label: 'Days Active', value: summary.days_active || 0 },
        ].map(stat => (
          <Card key={stat.label} className="p-3 text-center">
            <p className="text-xs text-gray-600 dark:text-gray-400">{stat.label}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
};

const BillingTab: React.FC<{ data: any }> = () => (
  <Card className="p-6">
    <p className="text-gray-600 dark:text-gray-400">Billing information (coming soon)</p>
  </Card>
);

const TeamTab: React.FC<{ data: any }> = ({ data }) => {
  const users = data?.users || [];
  if (users.length === 0) return <p className="text-gray-500">No team members</p>;

  return (
    <Card className="p-4 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-white/5">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Name</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Email</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Role</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-white/10">
          {users.map((u: any) => (
            <tr key={u.id}>
              <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{u.first_name} {u.last_name}</td>
              <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">{u.email}</td>
              <td className="px-3 py-2"><span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded font-mono">{u.role}</span></td>
              <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{format(parseISO(u.created_at), 'MMM dd')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};
