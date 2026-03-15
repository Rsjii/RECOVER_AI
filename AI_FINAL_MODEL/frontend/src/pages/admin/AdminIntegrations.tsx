import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../../config/axios';
import { useState } from 'react';
import { Github, Mail, Slack, Webhook, Plus, Trash2, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';

function SectionCard({ icon, title, badge, children }: {
  icon: React.ReactNode; title: string; badge?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="text-slate-400">{icon}</span>
        <h2 className="text-white font-semibold text-sm">{title}</h2>
        {badge && (
          <span className="text-[10px] font-bold bg-slate-700 text-slate-500 border border-slate-600 px-1.5 py-0.5 rounded ml-auto">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export default function AdminIntegrations() {
  const qc = useQueryClient();
  const { org } = useAuth();
  const { toast } = useToast();
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [addingWebhook, setAddingWebhook] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => axios.get('/api/admin/integrations').then(r => r.data.integrations),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, any>) => axios.put('/api/admin/integrations', payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
      const key = Object.keys(vars)[0];
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    },
  });

  const toggleEmail = () => {
    updateMutation.mutate({ email_notifications_enabled: !data?.email_notifications_enabled });
  };

  const webhooks: string[] = data?.webhook_endpoints || [];

  const addWebhook = async () => {
    if (!newWebhookUrl.trim()) return;
    try { new URL(newWebhookUrl); } catch { toast('Invalid URL', 'error'); return; }
    const updated = [...webhooks, newWebhookUrl.trim()];
    updateMutation.mutate({ webhook_endpoints: updated });
    setNewWebhookUrl('');
    setAddingWebhook(false);
  };

  const removeWebhook = (url: string) => {
    updateMutation.mutate({ webhook_endpoints: webhooks.filter(w => w !== url) });
  };

  if (isLoading) return <div className="text-slate-400 py-8">Loading integrations...</div>;

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold text-white mb-6">Integrations</h1>

      {/* GitHub */}
      <SectionCard icon={<Github size={16} />} title="GitHub">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-300 text-sm">Connected as <span className="text-white font-medium">{org?.github_org_name}</span></p>
            <p className="text-slate-500 text-xs mt-0.5">Webhooks are automatically managed per repository</p>
          </div>
          <span className="flex items-center gap-1.5 text-green-400 text-xs font-medium bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
            <Check size={11} /> Connected
          </span>
        </div>
      </SectionCard>

      {/* Email Notifications */}
      <SectionCard icon={<Mail size={16} />} title="Email Notifications">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-300 text-sm">PR analysis notifications</p>
            <p className="text-slate-500 text-xs mt-0.5">Send email alerts for high and critical risk PRs</p>
          </div>
          <div className="flex items-center gap-2">
            {saved === 'email_notifications_enabled' && (
              <span className="text-green-400 text-xs">Saved</span>
            )}
            <button
              onClick={toggleEmail}
              disabled={updateMutation.isPending}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                data?.email_notifications_enabled ? 'bg-blue-600' : 'bg-slate-600'
              }`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                data?.email_notifications_enabled ? 'left-6' : 'left-1'
              }`} />
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Slack - Coming soon */}
      <SectionCard icon={<Slack size={16} />} title="Slack" badge="PHASE 2">
        <div className="flex items-center justify-between opacity-50">
          <div>
            <p className="text-slate-300 text-sm">Post alerts to a Slack channel</p>
            <p className="text-slate-500 text-xs mt-0.5">Critical PR alerts, daily digests, and more</p>
          </div>
          <button disabled className="bg-slate-700 text-slate-400 px-3 py-1.5 rounded-lg text-sm cursor-not-allowed">
            Coming Soon
          </button>
        </div>
      </SectionCard>

      {/* Custom Webhooks */}
      <SectionCard icon={<Webhook size={16} />} title="Custom Webhooks">
        <p className="text-slate-500 text-xs mb-4">
          POST PR analysis results to your own endpoints on every analysis completion.
        </p>

        <div className="space-y-2 mb-3">
          {webhooks.length === 0 && (
            <p className="text-slate-600 text-sm">No webhooks configured</p>
          )}
          {webhooks.map((url) => (
            <div key={url} className="flex items-center justify-between bg-slate-700/50 rounded-lg px-3 py-2">
              <span className="text-slate-300 text-sm font-mono truncate flex-1 mr-3">{url}</span>
              <button
                onClick={() => removeWebhook(url)}
                className="p-1 text-slate-500 hover:text-red-400 transition-colors shrink-0"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        {addingWebhook ? (
          <div className="flex gap-2">
            <input
              autoFocus
              value={newWebhookUrl}
              onChange={e => setNewWebhookUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addWebhook()}
              placeholder="https://your-server.com/webhook"
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
            />
            <button onClick={addWebhook} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm transition-colors">
              Add
            </button>
            <button onClick={() => { setAddingWebhook(false); setNewWebhookUrl(''); }} className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded-lg text-sm transition-colors">
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingWebhook(true)}
            className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm transition-colors"
          >
            <Plus size={14} /> Add Webhook URL
          </button>
        )}
      </SectionCard>
    </div>
  );
}
