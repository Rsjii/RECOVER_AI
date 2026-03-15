import { useQuery, keepPreviousData } from '@tanstack/react-query';
import axios from '../../config/axios';
import { useState } from 'react';
import { History, ChevronLeft, ChevronRight, X } from 'lucide-react';

const ACTIVITY_COLORS: Record<string, string> = {
  settings_updated:     'text-blue-400 bg-blue-500/10 border-blue-500/20',
  integrations_updated: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  api_key_created:      'text-green-400 bg-green-500/10 border-green-500/20',
  api_key_revoked:      'text-red-400 bg-red-500/10 border-red-500/20',
  plan_changed:         'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  repo_added:           'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  repo_removed:         'text-orange-400 bg-orange-500/10 border-orange-500/20',
  member_invited:       'text-teal-400 bg-teal-500/10 border-teal-500/20',
  member_removed:       'text-red-400 bg-red-500/10 border-red-500/20',
};

const ACTIVITY_TYPES = [
  'settings_updated', 'integrations_updated', 'api_key_created', 'api_key_revoked',
  'plan_changed', 'repo_added', 'repo_removed', 'member_invited', 'member_removed',
];

function formatTs(ts: string) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

interface ActivityResponse {
  activities: any[];
  total: number;
}

const inputCls = "bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-indigo-500 transition-colors";

export default function AdminActivity() {
  const [page, setPage]         = useState(1);
  const [type, setType]         = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');
  const LIMIT = 25;

  const hasFilters = type || fromDate || toDate;

  const { data, isLoading } = useQuery<ActivityResponse>({
    queryKey: ['activity', page, type, fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (type)     params.set('type',      type);
      if (fromDate) params.set('from_date', fromDate);
      if (toDate)   params.set('to_date',   toDate);
      const response = await axios.get<ActivityResponse>(`/api/admin/activity?${params}`);
      return response.data;
    },
    placeholderData: keepPreviousData,
  });

  const activities: any[] = data?.activities || [];
  const total: number     = data?.total || 0;
  const totalPages        = Math.ceil(total / LIMIT);

  const resetFilters = () => { setType(''); setFromDate(''); setToDate(''); setPage(1); };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-white">Activity Log</h1>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <select
          value={type}
          onChange={e => { setType(e.target.value); setPage(1); }}
          className={inputCls}
        >
          <option value="">All Activity</option>
          {ACTIVITY_TYPES.map(t => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <span className="text-slate-600 text-xs">From</span>
          <input
            type="date"
            value={fromDate}
            onChange={e => { setFromDate(e.target.value); setPage(1); }}
            className={inputCls}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-600 text-xs">To</span>
          <input
            type="date"
            value={toDate}
            onChange={e => { setToDate(e.target.value); setPage(1); }}
            className={inputCls}
          />
        </div>

        {hasFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 px-3 py-2 text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs transition-colors"
          >
            <X size={12} /> Clear
          </button>
        )}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading activity...</div>
        ) : activities.length === 0 ? (
          <div className="p-8 text-center">
            <History size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">
              {hasFilters ? 'No activity matching your filters' : 'No activity yet'}
            </p>
            <p className="text-slate-600 text-xs mt-1">
              {hasFilters
                ? 'Try adjusting the date range or activity type.'
                : 'Actions like settings changes, repo adds, and key generation appear here.'}
            </p>
            {hasFilters && (
              <button onClick={resetFilters} className="mt-3 text-indigo-400 hover:text-indigo-300 text-xs transition-colors">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {activities.map((a: any) => {
              const colorCls = ACTIVITY_COLORS[a.activity_type] || 'text-slate-400 bg-slate-700 border-slate-600';
              return (
                <div key={a.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-700/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${colorCls}`}>
                        {a.activity_type.replace(/_/g, ' ')}
                      </span>
                      {a.github_username && (
                        <span className="text-slate-500 text-xs">by {a.github_username}</span>
                      )}
                    </div>
                    <p className="text-slate-300 text-sm mt-1">{a.description}</p>
                  </div>
                  <span className="text-slate-600 text-xs shrink-0 mt-0.5">{formatTs(a.created_at)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
            <span className="text-slate-500 text-xs">{total} total events</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-700 rounded transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-slate-400 text-xs">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-700 rounded transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
