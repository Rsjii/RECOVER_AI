import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';

interface VoiceStats {
  calls_this_month: number;
  acceptance_rate: number;
  avg_duration_seconds: number;
  operator_transfers: number;
  no_answers: number;
  failed_calls: number;
}

interface RecentCall {
  id: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  outcome: string;
  duration_seconds: number | null;
  created_at: string;
}

export const VoiceStatsCard: React.FC = () => {
  const [stats, setStats] = useState<VoiceStats | null>(null);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVoiceStats = async () => {
      try {
        setLoading(true);
        const response = await api.get<{ data: { stats: VoiceStats; recent_calls: RecentCall[] } }>(
          '/api/dashboard/voice-stats'
        );
        setStats(response.data.stats);
        setRecentCalls(response.data.recent_calls);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch voice stats:', err);
        setError('Failed to load voice stats');
      } finally {
        setLoading(false);
      }
    };

    fetchVoiceStats();
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6 animate-pulse">
        <div className="h-6 w-40 bg-gray-200 dark:bg-white/[0.06] rounded mb-4" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-4 w-20 bg-gray-200 dark:bg-white/[0.06] rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">{error || 'No voice data available'}</p>
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    if (!seconds) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
        <span className="text-2xl">🎙️</span>
        Voice Calling Performance
      </h3>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-50 dark:bg-white/[0.03] rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Calls This Month</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.calls_this_month}</p>
        </div>

        <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">Acceptance Rate</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.acceptance_rate}%</p>
        </div>

        <div className="bg-gray-50 dark:bg-white/[0.03] rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Avg Duration</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white text-sm">
            {formatDuration(stats.avg_duration_seconds)}
          </p>
        </div>

        <div className="bg-orange-50 dark:bg-orange-500/10 rounded-lg p-4">
          <p className="text-sm text-orange-700 dark:text-orange-300">Operator Transfers</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.operator_transfers}</p>
        </div>

        <div className="bg-gray-50 dark:bg-white/[0.03] rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">No Answer</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.no_answers}</p>
        </div>

        <div className="bg-red-50 dark:bg-red-500/10 rounded-lg p-4">
          <p className="text-sm text-red-700 dark:text-red-300">Failed</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.failed_calls}</p>
        </div>
      </div>

      {/* Recent Calls */}
      {recentCalls.length > 0 && (
        <div className="border-t border-gray-200 dark:border-white/[0.06] pt-6">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Recent Calls</h4>
          <div className="space-y-2">
            {recentCalls.map((call) => (
              <div
                key={call.id}
                className="flex items-center justify-between bg-gray-50 dark:bg-white/[0.03] rounded-lg p-3 text-sm"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{call.customer_name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    INV #{call.invoice_number} • ${call.amount.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium">
                    {call.outcome === 'accepted_plan' && (
                      <span className="text-green-600 dark:text-green-400">✓ Accepted</span>
                    )}
                    {call.outcome === 'operator_transfer' && (
                      <span className="text-orange-600 dark:text-orange-400">↗ Transferred</span>
                    )}
                    {call.outcome === 'no_answer' && (
                      <span className="text-gray-600 dark:text-gray-400">— No answer</span>
                    )}
                    {call.outcome === 'failed' && (
                      <span className="text-red-600 dark:text-red-400">✕ Failed</span>
                    )}
                    {call.outcome === 'declined' && (
                      <span className="text-red-600 dark:text-red-400">✕ Declined</span>
                    )}
                  </p>
                  {call.duration_seconds && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formatDuration(call.duration_seconds)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentCalls.length === 0 && stats.calls_this_month === 0 && (
        <div className="border-t border-gray-200 dark:border-white/[0.06] pt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No voice calls yet. Tier 4 customers 90+ days overdue will receive automated calls.
          </p>
        </div>
      )}
    </div>
  );
};

export default VoiceStatsCard;
