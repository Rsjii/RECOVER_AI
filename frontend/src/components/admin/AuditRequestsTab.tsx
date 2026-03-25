import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { useNotification } from '../../hooks/useNotification';

interface AuditRequest {
  id: string;
  token: string;
  company_name: string;
  email: string;
  status: string;
  created_at: string;
}

interface AuditRequestsStats {
  pending: number;
  approved: number;
  rejected: number;
  converted: number;
  total: number;
}

export const AuditRequestsTab: React.FC = () => {
  const { addToast } = useNotification();
  const [requests, setRequests] = useState<AuditRequest[]>([]);
  const [stats, setStats] = useState<AuditRequestsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/audit-requests?status=pending&limit=50');
      setRequests(response.data || []);
      setStats(response.stats || null);
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to load audit requests',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (email: string) => {
    setApproving(email);
    try {
      await api.post(`/api/audit-requests/${email}/approve`);
      addToast({
        type: 'success',
        message: `Approved: Audit link sent to ${email}`,
      });
      // Remove from pending list
      setRequests(requests.filter(r => r.email !== email));
      // Refresh stats
      fetchRequests();
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to approve request',
      });
    } finally {
      setApproving(null);
    }
  };

  const handleReject = async (email: string) => {
    setRejecting(email);
    try {
      await api.post(`/api/audit-requests/${email}/reject`);
      addToast({
        type: 'success',
        message: `Request from ${email} rejected`,
      });
      // Remove from pending list
      setRequests(requests.filter(r => r.email !== email));
      // Refresh stats
      fetchRequests();
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to reject request',
      });
    } finally {
      setRejecting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-gray-500 dark:text-gray-400">Loading audit requests...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-4 border border-gray-200 dark:border-white/[0.08]">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pending}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Pending</div>
          </div>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-4 border border-gray-200 dark:border-white/[0.08]">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.approved}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Approved</div>
          </div>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-4 border border-gray-200 dark:border-white/[0.08]">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.rejected}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Rejected</div>
          </div>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-4 border border-gray-200 dark:border-white/[0.08]">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.converted}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Converted</div>
          </div>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-lg p-4 border border-gray-200 dark:border-white/[0.08]">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total</div>
          </div>
        </div>
      )}

      {/* Requests Table */}
      {requests.length === 0 ? (
        <div className="bg-white dark:bg-[#1a1a1a] rounded-lg border border-gray-200 dark:border-white/[0.08] p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No pending audit requests</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/[0.08]">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-white/[0.08]">
                <th className="text-left px-4 py-3 font-semibold text-sm text-gray-900 dark:text-gray-100">
                  Company
                </th>
                <th className="text-left px-4 py-3 font-semibold text-sm text-gray-900 dark:text-gray-100">
                  Email
                </th>
                <th className="text-left px-4 py-3 font-semibold text-sm text-gray-900 dark:text-gray-100">
                  Submitted
                </th>
                <th className="text-right px-4 py-3 font-semibold text-sm text-gray-900 dark:text-gray-100">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr
                  key={request.id}
                  className="border-b border-gray-200 dark:border-white/[0.08] hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {request.company_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {request.email}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(request.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button
                      variant="primary"
                      size="sm"
                      loading={approving === request.email}
                      onClick={() => handleApprove(request.email)}
                      className="inline-block"
                    >
                      ✓ Approve
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={rejecting === request.email}
                      onClick={() => handleReject(request.email)}
                      className="inline-block"
                    >
                      ✕ Reject
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
