import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../../config/axios';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface Mapping {
  id: string;
  github_login: string;
  jira_display_name: string | null;
  jira_account_id: string | null;
  is_confirmed: boolean;
}

interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
}

interface Props {
  onNext: () => void;
}

export default function Step3TeamMapping({ onNext }: Props) {
  const qc = useQueryClient();

  const { data: mappings = [], isLoading } = useQuery<Mapping[]>({
    queryKey: ['team-mappings'],
    queryFn: () => axios.get('/api/team-mapping').then(r => r.data),
  });

  const { data: jiraUsers = [] } = useQuery<JiraUser[]>({
    queryKey: ['jira-users'],
    queryFn: () => axios.get('/api/team-mapping/jira-users').then(r => r.data),
  });

  const confirm = useMutation({
    mutationFn: (githubLogin: string) => axios.post('/api/team-mapping/confirm', { githubLogin }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-mappings'] }),
  });

  const setMapping = useMutation({
    mutationFn: ({ githubLogin, jiraAccountId }: { githubLogin: string; jiraAccountId: string }) =>
      axios.post('/api/team-mapping/set', { githubLogin, jiraAccountId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-mappings'] }),
  });

  const autoMap = useMutation({
    mutationFn: () => axios.post('/api/team-mapping/auto'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-mappings'] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  const confirmedCount = mappings.filter(m => m.is_confirmed).length;
  const unmatchedCount = mappings.filter(m => !m.jira_account_id).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white text-lg font-semibold">Map Your Team</h2>
        <p className="text-slate-500 text-sm mt-1">
          Match GitHub accounts to Jira users so EngineeringOS can correlate activity across both tools.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => autoMap.mutate()}
          disabled={autoMap.isPending}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm border border-slate-600"
        >
          {autoMap.isPending && <Loader2 size={14} className="animate-spin" />}
          Auto-map by email
        </button>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1"><CheckCircle size={12} className="text-green-400" /> {confirmedCount} confirmed</span>
          {unmatchedCount > 0 && <span className="flex items-center gap-1"><AlertCircle size={12} className="text-yellow-400" /> {unmatchedCount} unmatched</span>}
        </div>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto">
        {mappings.map(m => (
          <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-700 bg-slate-800/30">
            <img src={`https://github.com/${m.github_login}.png?size=24`} className="w-6 h-6 rounded-full" alt="" />
            <span className="text-slate-300 text-sm w-32 truncate">{m.github_login}</span>
            <span className="text-slate-600">→</span>

            {m.jira_account_id ? (
              <div className="flex items-center gap-2 flex-1">
                <span className="text-slate-300 text-sm flex-1 truncate">{m.jira_display_name}</span>
                {m.is_confirmed ? (
                  <CheckCircle size={14} className="text-green-400" />
                ) : (
                  <button
                    onClick={() => confirm.mutate(m.github_login)}
                    className="text-xs px-2 py-1 rounded bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20"
                  >
                    Confirm
                  </button>
                )}
              </div>
            ) : (
              <select
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-300"
                onChange={e => {
                  if (e.target.value) setMapping.mutate({ githubLogin: m.github_login, jiraAccountId: e.target.value });
                }}
                defaultValue=""
              >
                <option value="" disabled>Select Jira user...</option>
                {jiraUsers.map((u: JiraUser) => (
                  <option key={u.accountId} value={u.accountId}>{u.displayName}</option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
      >
        Continue → ({confirmedCount}/{mappings.length} mapped)
      </button>
    </div>
  );
}
