import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { Card } from '../ui/Card';

interface AuditRequest {
  id: string;
  email: string;
  company_name: string;
  status: 'pending' | 'verified' | 'approved' | 'rejected' | 'expired';
  submission_method: 'email_otp' | 'google_oauth' | 'invite';
  email_verified_at?: string;
  created_at: string;
  reviewed_at?: string;
  setup_url?: string;
  invite_token?: string;
  approval_link: string;
  rejection_link: string;
}

export const PublicAuditRequestsTab: React.FC = () => {
  const { addToast } = useNotification();
  const [requests, setRequests] = useState<AuditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [approvalLink, setApprovalLink] = useState<{ url: string; token: string } | null>(null);

  useEffect(() => {
    loadRequests();
  }, [filter]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const url = filter === 'all'
        ? '/api/audits/requests'
        : `/api/audits/requests?status=${filter}`;

      const response: any = await api.get(url);
      if (response?.data?.requests && Array.isArray(response.data.requests)) {
        setRequests(response.data.requests);
      }
    } catch (err: any) {
      console.error('Failed to load requests:', err);
      addToast({
        type: 'error',
        message: 'Failed to load audit requests',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(id);
      const response: any = await api.post(`/api/audits/requests/${id}/approve`, {});

      // Show approval link
      if (response?.data?.setup_url && response?.data?.invite_token) {
        setApprovalLink({
          url: response.data.setup_url,
          token: response.data.invite_token,
        });
      }

      addToast({
        type: 'success',
        message: 'Audit request approved! Setup link copied to clipboard.',
      });

      // Auto-copy link to clipboard
      if (response?.data?.setup_url) {
        await navigator.clipboard.writeText(response.data.setup_url);
      }

      await loadRequests();
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err?.message || 'Failed to approve request',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string, reason?: string) => {
    try {
      setActionLoading(id);
      await api.post(`/api/audits/requests/${id}/reject`, { reason });
      addToast({
        type: 'success',
        message: 'Audit request rejected.',
      });
      await loadRequests();
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err?.message || 'Failed to reject request',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string, verified?: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      pending: {
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        label: verified ? 'Email Verified ✓' : 'Pending'
      },
      verified: {
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        label: 'Email Verified'
      },
      approved: {
        color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        label: 'Approved'
      },
      rejected: {
        color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        label: 'Rejected'
      },
      expired: {
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
        label: 'Expired'
      },
    };

    const badge = badges[status] || badges.pending;
    return badge;
  };

  const getMethodBadge = (method: string) => {
    const methods: Record<string, { icon: string; label: string; color: string }> = {
      email_otp: {
        icon: '📧',
        label: 'Email OTP',
        color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
      },
      google_oauth: {
        icon: '🔐',
        label: 'Google OAuth',
        color: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
      },
      invite: {
        icon: '📨',
        label: 'Invite Link',
        color: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300'
      },
    };

    const m = methods[method] || methods.email_otp;
    return m;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending' || r.status === 'verified').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Requests</p>
          <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{stats.total}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 dark:text-gray-400">Pending Review</p>
          <p className="text-2xl font-bold mt-1 text-yellow-600 dark:text-yellow-400">{stats.pending}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 dark:text-gray-400">Approved</p>
          <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">{stats.approved}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 dark:text-gray-400">Rejected</p>
          <p className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">{stats.rejected}</p>
        </Card>
      </div>

      {/* Approval link display (DEV MODE) */}
      {approvalLink && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-green-900 dark:text-green-300 mb-2">✓ Audit Approved!</h3>
              <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                Setup link has been copied to clipboard. Share this with the founder:
              </p>
              <div className="bg-white dark:bg-gray-950 rounded border border-green-200 dark:border-green-800 p-3 font-mono text-xs break-all text-gray-700 dark:text-gray-300">
                {approvalLink.url}
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(approvalLink.url);
                addToast({ type: 'info', message: 'Link copied!' });
              }}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium text-sm whitespace-nowrap"
            >
              Copy Again
            </button>
            <button
              onClick={() => setApprovalLink(null)}
              className="px-2 py-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Filter buttons */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'verified', 'approved', 'rejected'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Requests table */}
      <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading audit requests...</div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No audit requests found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Company</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Method</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Submitted</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {requests.map((req) => {
                  const statusBadge = getStatusBadge(req.status, req.email_verified_at);
                  const methodBadge = getMethodBadge(req.submission_method);
                  const isPending = req.status === 'pending' || req.status === 'verified';

                  return (
                    <tr
                      key={req.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {req.company_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        <div className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded w-fit">
                          {req.email}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${methodBadge.color}`}>
                          {methodBadge.icon} {methodBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                        {formatDate(req.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isPending && (
                          <div className="flex gap-2 justify-end">
                            <Button
                              onClick={() => handleApprove(req.id)}
                              disabled={actionLoading === req.id}
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              {actionLoading === req.id ? '...' : 'Approve'}
                            </Button>
                            <Button
                              onClick={() => handleReject(req.id)}
                              disabled={actionLoading === req.id}
                              size="sm"
                              variant="secondary"
                              className="text-red-600 border-red-200 dark:border-red-800"
                            >
                              {actionLoading === req.id ? '...' : 'Reject'}
                            </Button>
                          </div>
                        )}
                        {req.status === 'approved' && req.setup_url && (
                          <Button
                            onClick={async () => {
                              await navigator.clipboard.writeText(req.setup_url!);
                              addToast({
                                type: 'info',
                                message: 'Setup link copied to clipboard!',
                              });
                            }}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            📋 Copy Link
                          </Button>
                        )}
                        {!isPending && req.status !== 'approved' && (
                          <span className="text-xs text-gray-400">
                            {req.reviewed_at ? `Reviewed: ${formatDate(req.reviewed_at)}` : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
