import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { format, parseISO } from 'date-fns';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company_id: string;
  company_name: string;
  role: 'admin' | 'owner' | 'member';
  account_type: 'free' | 'pilot' | 'paid';
  status: 'active' | 'pending' | 'suspended' | 'churned';
  created_at: string;
  last_login: string | null;

  // Audit data
  audit_count: number;
  current_audit?: {
    id: string;
    status: string;
    created_at: string;
  };

  // Pilot data
  pilot_count: number;
  current_pilot?: {
    id: string;
    status: string;
    emails_sent: number;
    recovery_amount: number;
    started_at: string;
  };

  // Billing data
  plan_tier: number;
  mrr: number;
}

interface UsersStats {
  total: number;
  active: number;
  pilots: number;
  paid: number;
}

export const UsersTab: React.FC = () => {
  const { addToast } = useNotification();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UsersStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'pilot' | 'paid' | 'churned'>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [suspending, setSuspending] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [filterStatus]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ data: User[]; stats: UsersStats }>(
        `/api/admin/users?status=${filterStatus === 'all' ? '' : filterStatus}`
      );
      setUsers(response.data || []);
      setStats(response.stats || null);
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to load users',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Email', 'Name', 'Company', 'Account Type', 'Status', 'Created', 'Last Login', 'MRR'];
    const rows = users.map(u => [
      u.email,
      `${u.first_name} ${u.last_name}`,
      u.company_name,
      u.account_type,
      u.status,
      format(parseISO(u.created_at), 'MMM dd, yyyy'),
      u.last_login ? format(parseISO(u.last_login), 'MMM dd, yyyy') : 'Never',
      `$${u.mrr}`,
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const element = document.createElement('a');
    element.setAttribute('href', `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`);
    element.setAttribute('download', `users_${new Date().toISOString().split('T')[0]}.csv`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    addToast({ type: 'success', message: 'Users exported to CSV' });
  };

  const handleSuspend = async (userId: string) => {
    setSuspending(userId);
    try {
      await api.post(`/api/admin/users/${userId}/suspend`);
      addToast({ type: 'success', message: 'User suspended' });
      fetchUsers();
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to suspend user' });
    } finally {
      setSuspending(null);
    }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchEmail.toLowerCase()) ||
    u.company_name.toLowerCase().includes(searchEmail.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-gray-500 dark:text-gray-400">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-4 border border-gray-200 dark:border-white/[0.08]">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Users</div>
          </div>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-4 border border-gray-200 dark:border-white/[0.08]">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.active}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Active</div>
          </div>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-4 border border-gray-200 dark:border-white/[0.08]">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.pilots}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">In Pilot</div>
          </div>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-4 border border-gray-200 dark:border-white/[0.08]">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.paid}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Paid</div>
          </div>
        </div>
      )}

      {/* Filters & Actions */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-lg border border-gray-200 dark:border-white/[0.08] p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 w-full">
            <input
              type="text"
              placeholder="Search by email or company..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-white/[0.08] bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-white/[0.08] bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pilot">Pilot</option>
              <option value="paid">Paid</option>
              <option value="churned">Churned</option>
            </select>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCSV}
              className="whitespace-nowrap"
            >
              📥 Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      {filteredUsers.length === 0 ? (
        <div className="bg-white dark:bg-[#1a1a1a] rounded-lg border border-gray-200 dark:border-white/[0.08] p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No users found</p>
        </div>
      ) : (
        <div className="overflow-x-auto sm:scrollbar-show rounded-lg border border-gray-200 dark:border-white/[0.08]">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-white/[0.08]">
                <th className="text-left px-4 py-3 font-semibold text-sm text-gray-900 dark:text-gray-100">
                  Email
                </th>
                <th className="text-left px-4 py-3 font-semibold text-sm text-gray-900 dark:text-gray-100">
                  Company
                </th>
                <th className="text-left px-4 py-3 font-semibold text-sm text-gray-900 dark:text-gray-100">
                  Type
                </th>
                <th className="text-left px-4 py-3 font-semibold text-sm text-gray-900 dark:text-gray-100">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-semibold text-sm text-gray-900 dark:text-gray-100">
                  Created
                </th>
                <th className="text-left px-4 py-3 font-semibold text-sm text-gray-900 dark:text-gray-100">
                  MRR
                </th>
                <th className="text-right px-4 py-3 font-semibold text-sm text-gray-900 dark:text-gray-100">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-gray-200 dark:border-white/[0.08] hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {user.email}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {user.company_name}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        user.account_type === 'paid'
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                          : user.account_type === 'pilot'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {user.account_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        user.status === 'active'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : user.status === 'pending'
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                          : user.status === 'suspended'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {format(parseISO(user.created_at), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    ${user.mrr}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user);
                        setShowDetailModal(true);
                      }}
                      className="inline-block"
                    >
                      View
                    </Button>
                    {user.status === 'active' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={suspending === user.id}
                        onClick={() => handleSuspend(user.id)}
                        className="inline-block text-red-600 dark:text-red-400"
                      >
                        Suspend
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* User Detail Modal */}
      {showDetailModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="border-b border-gray-200 dark:border-white/[0.08] p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedUser.first_name} {selectedUser.last_name}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{selectedUser.email}</p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Account Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Account</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Company</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {selectedUser.company_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Account Type</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {selectedUser.account_type}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Plan Tier</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      Tier {selectedUser.plan_tier}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Monthly Recurring Revenue</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      ${selectedUser.mrr}
                    </p>
                  </div>
                </div>
              </div>

              {/* Audit Info */}
              {selectedUser.audit_count > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Audit History
                  </h3>
                  <div className="bg-gray-50 dark:bg-[#0a0a0a] rounded p-3">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {selectedUser.audit_count} audit{selectedUser.audit_count !== 1 ? 's' : ''}
                      {selectedUser.current_audit && ` • Current: ${selectedUser.current_audit.status}`}
                    </p>
                  </div>
                </div>
              )}

              {/* Pilot Info */}
              {selectedUser.pilot_count > 0 && selectedUser.current_pilot && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Pilot Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Status</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {selectedUser.current_pilot.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Emails Sent</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {selectedUser.current_pilot.emails_sent}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Recovery Amount</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        ${selectedUser.current_pilot.recovery_amount}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Status & Dates */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {selectedUser.status}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {format(parseISO(selectedUser.created_at), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 dark:border-white/[0.08] p-6 flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowDetailModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
