import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../../config/axios';
import { useState } from 'react';
import { Key, Plus, Trash2, Copy, Check, AlertTriangle } from 'lucide-react';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="p-1.5 text-slate-500 hover:text-slate-200 transition-colors rounded"
      title="Copy"
    >
      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
    </button>
  );
}

export default function AdminAPIKeys() {
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState<{ full_key: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => axios.get('/api/api-keys').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (n: string) => axios.post('/api/api-keys', { name: n }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['api-keys'] });
      setNewKey(res.data.key);
      setName('');
      setShowCreate(false);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => axios.delete(`/api/api-keys/${keyId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  const keys = data?.keys || [];

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">API Keys</h1>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Plus size={14} /> Generate Key
          </button>
        )}
      </div>

      {/* New key revealed */}
      {newKey && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-yellow-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-white font-medium text-sm mb-1">
                Copy your API key now — it won't be shown again
              </p>
              <p className="text-slate-400 text-xs mb-3">Key name: <strong>{newKey.name}</strong></p>
              <div className="flex items-center gap-2 bg-slate-900 rounded-lg px-3 py-2">
                <code className="text-green-300 text-xs flex-1 break-all">{newKey.full_key}</code>
                <CopyButton text={newKey.full_key} />
              </div>
            </div>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="mt-3 text-slate-500 hover:text-slate-300 text-xs transition-colors ml-7"
          >
            I've saved this key — dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
          <h2 className="text-white font-semibold mb-3 text-sm">Generate New API Key</h2>
          <div className="flex gap-3">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && name.trim() && createMutation.mutate(name)}
              placeholder="e.g. CI/CD Pipeline, Local Dev"
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
            />
            <button
              onClick={() => createMutation.mutate(name)}
              disabled={!name.trim() || createMutation.isPending}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setName(''); }}
              className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Keys table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
        ) : keys.length === 0 ? (
          <div className="p-8 text-center">
            <Key size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No API keys yet</p>
            <p className="text-slate-600 text-xs mt-1">Generate a key to authenticate API requests</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-slate-400 text-sm font-medium">Name</th>
                <th className="text-left px-4 py-3 text-slate-400 text-sm font-medium">Key Prefix</th>
                <th className="text-left px-4 py-3 text-slate-400 text-sm font-medium">Created</th>
                <th className="text-left px-4 py-3 text-slate-400 text-sm font-medium">Last Used</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {keys.map((k: any) => (
                <tr key={k.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                  <td className="px-4 py-3 text-white text-sm">{k.name}</td>
                  <td className="px-4 py-3">
                    <code className="text-slate-400 text-xs bg-slate-700 px-2 py-0.5 rounded">
                      cm_live_{k.key_prefix}...
                    </code>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-sm">
                    {new Date(k.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-sm">
                    {k.last_used ? new Date(k.last_used).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={async () => {
                        const ok = await confirm({ message: 'Revoke this API key? Apps using it will stop working.', confirmText: 'Revoke' });
                        if (ok) {
                          revokeMutation.mutate(k.id, { onSuccess: () => toast('API key revoked', 'success') });
                        }
                      }}
                      className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-slate-600 text-xs mt-3">
        Pass your API key as a Bearer token: <code className="text-slate-500">Authorization: Bearer cm_live_...</code>
      </p>
    </div>
  );
}
