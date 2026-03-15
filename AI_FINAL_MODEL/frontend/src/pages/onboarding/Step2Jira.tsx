import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from '../../config/axios';
import { CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface Site {
  id: string;
  name: string;
  url: string;
}

interface Project {
  key: string;
  name: string;
}

interface Props {
  onNext: () => void;
  status: { step_jira?: boolean } | undefined;
}

export default function Step2Jira({ onNext, status }: Props) {
  const connected = status?.step_jira;
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ['jira-sites'],
    queryFn: () => axios.get('/api/jira/sites').then(r => r.data),
    enabled: !!connected,
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['jira-projects'],
    queryFn: () => axios.get('/api/jira/projects').then(r => r.data),
    enabled: !!connected,
  });

  const selectProjects = useMutation({
    mutationFn: () => axios.post('/api/jira/projects/select', { projectKeys: selectedProjects }),
    onSuccess: onNext,
  });

  const toggleProject = (key: string) => {
    setSelectedProjects(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white text-lg font-semibold">Connect Jira</h2>
        <p className="text-slate-500 text-sm mt-1">Link your Atlassian Jira to track sprint progress and ticket status alongside your GitHub activity.</p>
      </div>

      <div className={`rounded-xl border p-4 flex items-center justify-between ${
        connected ? 'border-blue-500/30 bg-blue-500/5' : 'border-slate-700 bg-slate-800/30'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-bold">J</div>
          <div>
            <p className="text-slate-200 text-sm font-medium">Atlassian Jira</p>
            <p className="text-slate-500 text-xs">
              {connected
                ? sites[0] ? `Connected to ${sites[0].name}` : 'Connected'
                : 'Not connected'}
            </p>
          </div>
        </div>
        {connected
          ? <CheckCircle size={20} className="text-blue-400" />
          : <XCircle size={20} className="text-slate-600" />}
      </div>

      {!connected && (
        <a
          href={`${API_URL}/api/jira/connect`}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium w-fit"
        >
          <ExternalLink size={14} /> Connect Jira
        </a>
      )}

      {connected && projects.length > 0 && (
        <div>
          <p className="text-slate-300 text-sm font-medium mb-3">Select projects to monitor:</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {projects.map((p: Project) => (
              <label key={p.key} className="flex items-center gap-3 p-3 rounded-lg border border-slate-700 hover:border-slate-600 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={selectedProjects.includes(p.key)}
                  onChange={() => toggleProject(p.key)}
                  className="rounded"
                />
                <div>
                  <p className="text-slate-200 text-sm font-medium">{p.name}</p>
                  <p className="text-slate-500 text-xs">{p.key}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => selectProjects.mutate()}
          disabled={!connected || selectedProjects.length === 0 || selectProjects.isPending}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-700 text-white text-sm font-medium border border-transparent disabled:border-slate-700 transition-colors"
        >
          {selectProjects.isPending && <Loader2 size={14} className="animate-spin" />}
          {connected && selectedProjects.length > 0 ? `Monitor ${selectedProjects.length} project${selectedProjects.length > 1 ? 's' : ''} →` : 'Select projects to continue'}
        </button>
        {connected && projects.length === 0 && (
          <button onClick={onNext} className="px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm">
            Skip →
          </button>
        )}
      </div>
    </div>
  );
}
