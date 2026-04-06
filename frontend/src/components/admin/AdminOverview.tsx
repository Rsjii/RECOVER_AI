import React from 'react';
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { Card } from '../ui/Card';
import { cn } from '../../lib/utils';

interface MetricsData {
  companies: { total: number; active: number; trialing: number; canceled: number; pastDue: number };
  recentCompanies: { id: string; name: string; email: string; subscription_status: string; created_at: string }[];
  users: { total: number; active7d: number; active30d: number };
  revenue: { totalBilled: number; paidCount: number };
  usageByMonth: any[];
  costBreakdown: Record<string, number>;
  totalCostUsd: number;
  topCompaniesByCost: { company_name: string; company_email: string; total_cost: string; total_calls: number }[];
}

const STATUS_BADGE: Record<string, string> = {
  active:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  trialing:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  past_due:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  canceled:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const StatCard: React.FC<{ label: string; value: string | number; sub?: string; color?: string }> = ({
  label, value, sub, color,
}) => (
  <Card className="p-4">
    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    <p className={cn('text-2xl font-bold mt-1', color ?? 'text-gray-900 dark:text-white')}>{value}</p>
    {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
  </Card>
);

export const AdminOverview: React.FC<{ metrics: MetricsData }> = ({ metrics }) => {
  const companies = metrics?.companies ?? { total: 0, active: 0, trialing: 0, canceled: 0, pastDue: 0 };
  const users = metrics?.users ?? { total: 0, active7d: 0, active30d: 0 };
  const revenue = metrics?.revenue ?? { totalBilled: 0, paidCount: 0 };
  const recentCompanies = metrics?.recentCompanies ?? [];
  const churned = (companies?.canceled ?? 0) + (companies?.pastDue ?? 0);

  // Prepare cost data for chart
  const costData = Object.entries(metrics?.costBreakdown || {}).map(([service, cost]) => ({
    name: service,
    cost: parseFloat(cost.toString()),
  }));

  return (
    <div className="space-y-6">
      {/* Company stats */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Companies</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Companies" value={(companies?.total ?? 0).toLocaleString()} />
          <StatCard label="Active" value={(companies?.active ?? 0).toLocaleString()} color="text-green-600 dark:text-green-400" />
          <StatCard label="Trialing" value={(companies?.trialing ?? 0).toLocaleString()} color="text-blue-600 dark:text-blue-400" />
          <StatCard label="Churned / Past Due" value={churned.toLocaleString()} color={churned > 0 ? 'text-red-600 dark:text-red-400' : undefined} />
        </div>
      </div>

      {/* User + Revenue stats */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Users &amp; Revenue</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Total Users" value={(users?.total ?? 0).toLocaleString()} />
          <StatCard label="Active (last 7d)" value={(users?.active7d ?? 0).toLocaleString()} sub={`${(users?.active30d ?? 0).toLocaleString()} in last 30d`} />
          <StatCard
            label="Total Billed"
            value={`$${(revenue?.totalBilled ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            sub={`${revenue?.paidCount ?? 0} invoices paid`}
          />
        </div>
      </div>

      {/* Recent signups */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Recent Signups</h3>
        {recentCompanies.length === 0 ? (
          <p className="text-sm text-gray-400">No companies yet.</p>
        ) : (
          <div className="overflow-x-auto sm:scrollbar-show">
            <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-white/[0.04]">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Company</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Email</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Signed Up</th>
              </tr>
            </thead>
            <tbody>
              {recentCompanies.map(c => (
                <tr key={c.id} className="border-t border-gray-100 dark:border-white/[0.06]">
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{c.name}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{c.email}</td>
                  <td className="px-4 py-2">
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize',
                      STATUS_BADGE[c.subscription_status] ?? 'bg-gray-100 text-gray-600')}>
                      {c.subscription_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs">
                    {format(parseISO(c.created_at), 'MMM d, yyyy')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
            </div>
        )}
      </Card>

      {/* AI Costs */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">AI Costs by Service</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Total: ${metrics?.totalCostUsd?.toFixed(2) || '0.00'}</p>
        {costData.length === 0 ? (
          <p className="text-sm text-gray-400">No usage data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={costData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="cost" fill="#7c3aed" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Top companies by cost */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Top Companies by Cost</h3>
        {(metrics?.topCompaniesByCost || []).length === 0 ? (
          <p className="text-sm text-gray-400">No data yet.</p>
        ) : (
          <div className="overflow-x-auto sm:scrollbar-show">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-white/[0.04]">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Company</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Email</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Cost</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Calls</th>
                </tr>
              </thead>
              <tbody>
                {(metrics?.topCompaniesByCost || []).map(c => (
                  <tr key={c.company_name} className="border-t border-gray-100 dark:border-white/[0.06]">
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{c.company_name}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs">{c.company_email}</td>
                    <td className="px-4 py-2 text-right text-gray-900 dark:text-white">${parseFloat(c.total_cost).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">{c.total_calls.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
