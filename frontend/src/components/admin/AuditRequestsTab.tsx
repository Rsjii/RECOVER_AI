import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { useNotification } from '../../hooks/useNotification';

interface InviteToken {
  id: string;
  token: string;
  email?: string;
  company_name: string;
  company_domain?: string;
  expires_at: string;
  used_at?: string;
  used_by_email?: string;
  created_at: string;
}

export const AuditRequestsTab: React.FC = () => {
  const { addToast } = useNotification();
  const [tokens, setTokens] = useState<InviteToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    try {
      setLoading(true);
      const response: any = await api.get('/api/invites/list');
      if (response?.data && Array.isArray(response.data)) {
        setTokens(response.data);
      }
    } catch (err: any) {
      console.error('Failed to load tokens:', err);
      addToast({
        type: 'error',
        message: 'Failed to load invite links',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateToken = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim()) {
      addToast({
        type: 'error',
        message: 'Company name is required',
      });
      return;
    }

    try {
      setGenerating(true);
      const response: any = await api.post('/api/invites/generate', {
        email: email.trim() || undefined,
        company_name: companyName.trim(),
      });

      if (response?.data?.token) {
        addToast({
          type: 'success',
          message: 'Invite link generated',
        });

        // Copy to clipboard
        const setupUrl = `${window.location.origin}/onboard/stage-1?token=${response.data.token}${response.data.email_locked ? `&email=${encodeURIComponent(email)}` : ''}`;
        await navigator.clipboard.writeText(setupUrl);
        addToast({
          type: 'info',
          message: 'Setup URL copied to clipboard',
        });

        // Reset form
        setEmail('');
        setCompanyName('');
        setShowForm(false);

        // Reload tokens
        await loadTokens();
      }
    } catch (err: any) {
      console.error('Failed to generate token:', err);
      addToast({
        type: 'error',
        message: err?.message || 'Failed to generate invite link',
      });
    } finally {
      setGenerating(false);
    }
  };

  const getTokenStatus = (token: InviteToken) => {
    if (token.used_at) return { label: 'Used', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
    if (new Date(token.expires_at) < new Date()) return { label: 'Expired', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
    return { label: 'Pending', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' };
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const pending = tokens.filter(t => !t.used_at && new Date(t.expires_at) > new Date()).length;
  const used = tokens.filter(t => t.used_at).length;
  const expired = tokens.filter(t => !t.used_at && new Date(t.expires_at) <= new Date()).length;

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 min-w-[150px]">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{pending}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Pending Links</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4 min-w-[150px]">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{used}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Used</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-4 min-w-[150px]">
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{expired}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Expired</div>
          </div>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {showForm ? '✕ Cancel' : '+ Generate Link'}
        </Button>
      </div>

      {/* Form to generate new token */}
      {showForm && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <form onSubmit={handleGenerateToken} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Company Name *
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., TechStartup Inc"
                disabled={generating}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-white/[0.08] bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email (optional - locks email during signup)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ceo@company.com"
                disabled={generating}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-white/[0.08] bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={generating}
                className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
              >
                {generating ? 'Generating...' : 'Generate Invite Link'}
              </Button>
              <Button
                type="button"
                onClick={() => setShowForm(false)}
                variant="secondary"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Token list */}
      <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading invite links...</div>
        ) : tokens.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No invite links yet. Click "Generate Link" to create one.
          </div>
        ) : (
          <div className="overflow-x-auto sm:scrollbar-show">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Company
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Token
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Expires
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {tokens.map((token) => {
                  const status = getTokenStatus(token);
                  return (
                    <tr
                      key={token.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {token.company_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {token.email ? (
                          <>
                            <div className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded w-fit">
                              {token.email}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">locked</div>
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded w-fit max-w-xs truncate">
                          {token.token.substring(0, 16)}...
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(token.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(token.expires_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          onClick={async () => {
                            const setupUrl = `${window.location.origin}/onboard/stage-1?token=${token.token}${token.email ? `&email=${encodeURIComponent(token.email)}` : ''}`;
                            await navigator.clipboard.writeText(setupUrl);
                            addToast({
                              type: 'info',
                              message: 'Link copied!',
                            });
                          }}
                          size="sm"
                          variant="secondary"
                        >
                          Copy Link
                        </Button>
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
