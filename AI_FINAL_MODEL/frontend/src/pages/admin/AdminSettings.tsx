import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../../config/axios';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import {
  Settings, Users, Key, Bell, Plug, AlertTriangle,
  Save, UserPlus, Trash2, ChevronDown, Copy, Eye, EyeOff,
  CheckCircle, Loader2, X, AlertCircle, Github, Link2, Plus, Check,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const inputCls = "w-full bg-[#070c14] border border-slate-800 focus:border-indigo-500/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none transition-colors text-sm";
const sectionCls = "bg-[#0d1424] border border-slate-800 rounded-xl p-6";
const labelCls = "block text-slate-300 text-sm font-medium mb-1.5";

function SaveBar({ pending, saved, onSave }: { pending: boolean; saved: boolean; onSave: () => void }) {
  return (
    <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800">
      {saved
        ? <span className="flex items-center gap-1.5 text-green-400 text-sm"><CheckCircle size={14} /> Saved</span>
        : <span />}
      <button
        onClick={onSave}
        disabled={pending}
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        <Save size={14} />
        {pending ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: General
// ─────────────────────────────────────────────────────────────────────────────

const TIMEZONES = [
  'UTC','America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
  'Europe/London','Europe/Paris','Europe/Berlin','Asia/Kolkata','Asia/Tokyo',
  'Asia/Singapore','Asia/Dubai','Australia/Sydney','Pacific/Auckland',
];

function GeneralTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ github_org_name: '', billing_email: '', timezone: 'UTC', logo_url: '' });
  const [saved, setSaved] = useState(false);

  const { data } = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => axios.get('/api/admin/organization').then(r => r.data.org),
  });

  useEffect(() => {
    if (data) setForm({
      github_org_name: data.github_org_name || '',
      billing_email:   data.billing_email   || '',
      timezone:        data.timezone        || 'UTC',
      logo_url:        data.logo_url        || '',
    });
  }, [data]);

  const mut = useMutation({
    mutationFn: (v: typeof form) => axios.put('/api/admin/organization', v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-settings'] });
      qc.invalidateQueries({ queryKey: ['me'] });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="space-y-5 max-w-xl">
      <div className={sectionCls + ' space-y-5'}>
        <div>
          <label className={labelCls}>Organization Name</label>
          <input value={form.github_org_name} onChange={set('github_org_name')} placeholder="acme-corp" className={inputCls} />
          <p className="text-slate-600 text-xs mt-1">Used as your workspace identifier</p>
        </div>
        <div>
          <label className={labelCls}>Billing Email</label>
          <input type="email" value={form.billing_email} onChange={set('billing_email')} placeholder="billing@company.com" className={inputCls} />
          <p className="text-slate-600 text-xs mt-1">Receives invoices and billing notifications</p>
        </div>
        <div>
          <label className={labelCls}>Timezone</label>
          <select value={form.timezone} onChange={set('timezone')} className={inputCls}>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Logo URL</label>
          <input value={form.logo_url} onChange={set('logo_url')} placeholder="https://company.com/logo.png" className={inputCls} />
          {form.logo_url && (
            <img src={form.logo_url} alt="Logo" className="mt-2 h-10 object-contain rounded border border-slate-800"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          )}
        </div>
        <SaveBar pending={mut.isPending} saved={saved} onSave={() => mut.mutate(form)} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Members
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, string> = {
  admin:     'bg-purple-500/10 text-purple-400 border-purple-500/20',
  reviewer:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  developer: 'bg-slate-700 text-slate-400 border-slate-600',
};
const ROLES = ['developer', 'reviewer', 'admin'] as const;

function RoleDropdown({ memberId, currentRole }: { memberId: string; currentRole: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const change = async (r: string) => {
    if (r === currentRole) { setOpen(false); return; }
    await axios.put(`/api/team/members/${memberId}/role`, { role: r });
    qc.invalidateQueries({ queryKey: ['team'] });
    setOpen(false);
  };
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border cursor-pointer hover:opacity-80 ${ROLE_BADGE[currentRole]}`}>
        {currentRole} <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-7 z-20 bg-[#0d1424] border border-slate-800 rounded-lg py-1 min-w-[120px] shadow-xl">
            {ROLES.map(r => (
              <button key={r} onClick={() => change(r)}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800 transition-colors ${r === currentRole ? 'text-white font-medium' : 'text-slate-400'}`}>
                {r}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MembersTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const [email, setEmail]           = useState('');
  const [role, setRole]             = useState('developer');
  const [inviting, setInviting]     = useState(false);
  const [inviteErr, setInviteErr]   = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['team'],
    queryFn: () => axios.get('/api/team').then(r => r.data),
  });

  const { data: joinLinksData, refetch: refetchLinks } = useQuery({
    queryKey: ['join-links'],
    queryFn: () => axios.get('/api/admin/join-links').then(r => r.data.join_links),
  });

  const removeMut = useMutation({
    mutationFn: (uid: string) => axios.delete(`/api/team/members/${uid}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['team'] }),
  });
  const resendMut = useMutation({
    mutationFn: (id: string) => axios.post(`/api/team/invites/${id}/resend`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['team'] }),
  });
  const revokeMut = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/team/invites/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['team'] }),
  });

  const handleInvite = async () => {
    if (!email.trim()) return;
    setInviting(true); setInviteErr('');
    try {
      await axios.post('/api/team/invites', { email: email.trim(), role });
      setEmail(''); qc.invalidateQueries({ queryKey: ['team'] });
    } catch (e: any) {
      setInviteErr(e.response?.data?.error || 'Failed to send invite');
    } finally { setInviting(false); }
  };

  const createLinkMut = useMutation({
    mutationFn: (role: string) => axios.post('/api/admin/join-links', { role }),
    onSuccess: () => { refetchLinks(); qc.invalidateQueries({ queryKey: ['join-links'] }); },
  });

  const revokeLinkMut = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/admin/join-links/${id}`),
    onSuccess: () => { refetchLinks(); qc.invalidateQueries({ queryKey: ['join-links'] }); },
  });

  const copyUrl = (token: string) => {
    const url = `${window.location.origin}/join/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const members     = data?.members        || [];
  const pending     = data?.pending_invites || [];
  const activeLinks = (joinLinksData || []).filter((l: any) => l.is_active && new Date(l.expires_at) > new Date());

  const roleTooltip = {
    admin:     'Full access: manage repos, team, billing, settings',
    reviewer:  'Can view all PRs, add notes. Cannot manage org.',
    developer: 'Read-only access to PR analysis. Cannot add notes.',
  };

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Email invite form */}
      <div className={sectionCls}>
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><UserPlus size={15} /> Invite via Email</h3>
        <div className="flex gap-3 flex-wrap">
          <input value={email} onChange={e => { setEmail(e.target.value); setInviteErr(''); }}
            onKeyDown={e => e.key === 'Enter' && handleInvite()}
            placeholder="email@company.com"
            className="flex-1 min-w-[200px] bg-[#070c14] border border-slate-800 focus:border-indigo-500/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none text-sm transition-colors" />
          <select value={role} onChange={e => setRole(e.target.value)}
            className="bg-[#070c14] border border-slate-800 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors">
            <option value="developer">Developer</option>
            <option value="reviewer">Reviewer</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={handleInvite} disabled={inviting || !email.trim()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm transition-colors">
            {inviting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            {inviting ? 'Sending...' : 'Send Invite'}
          </button>
        </div>
        {inviteErr && (
          <div className="mt-3 flex items-center gap-2 text-red-300 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle size={13} /> {inviteErr}
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-slate-800">
          <p className="text-slate-600 text-xs mb-2">Role permissions</p>
          <div className="space-y-1">
            {Object.entries(roleTooltip).map(([r, desc]) => (
              <div key={r} className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${ROLE_BADGE[r]} w-20 text-center`}>{r}</span>
                <span className="text-slate-600 text-xs">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Join Links */}
      <div className={sectionCls}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-medium flex items-center gap-2">
              <Link2 size={14} className="text-indigo-400" /> Join Links
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">Share a link so anyone can join your org (expires in 30 days)</p>
          </div>
          <div className="flex gap-2">
            {(['developer', 'reviewer'] as const).map(role => (
              <button
                key={role}
                onClick={() => createLinkMut.mutate(role)}
                disabled={createLinkMut.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors border border-slate-700 capitalize"
              >
                <Plus size={11} /> {role} link
              </button>
            ))}
          </div>
        </div>

        {activeLinks.length === 0 && (
          <p className="text-slate-600 text-sm">No active join links. Generate one above.</p>
        )}

        <div className="space-y-2">
          {activeLinks.map((link: any) => {
            const url = `${window.location.origin}/join/${link.token}`;
            const isCopied = copied === link.token;
            return (
              <div key={link.id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-800">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30 capitalize">{link.role}</span>
                    <span className="text-slate-600 text-xs">Used {link.uses_count}×</span>
                    <span className="text-slate-700 text-xs">Expires {new Date(link.expires_at).toLocaleDateString()}</span>
                  </div>
                  <p className="font-mono text-slate-500 text-xs truncate">{url}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => copyUrl(link.token)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      isCopied ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    }`}
                  >
                    {isCopied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                  </button>
                  <button
                    onClick={() => revokeLinkMut.mutate(link.id)}
                    className="p-1.5 text-slate-600 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Members table */}
      <div className={sectionCls}>
        <h3 className="text-white font-semibold mb-4">{members.length} Member{members.length !== 1 ? 's' : ''}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left pb-3 text-slate-500 font-medium text-xs">Member</th>
                <th className="text-left pb-3 text-slate-500 font-medium text-xs">Role</th>
                <th className="text-left pb-3 text-slate-500 font-medium text-xs hidden sm:table-cell">Joined</th>
                <th className="text-left pb-3 text-slate-500 font-medium text-xs hidden md:table-cell">Last seen</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {members.map((m: any) => (
                <tr key={m.id} className={`hover:bg-slate-800/20 transition-colors ${m.user_id === user?.id ? 'bg-indigo-500/5' : ''}`}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <img src={`https://github.com/${m.github_username}.png?size=32`} className="w-7 h-7 rounded-full" alt="" />
                      <div>
                        <span className="text-white text-sm">{m.github_username}</span>
                        {m.user_id === user?.id && <span className="ml-1.5 text-[10px] text-indigo-400">(you)</span>}
                        {m.email && <p className="text-slate-600 text-xs">{m.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    {m.user_id !== user?.id
                      ? <RoleDropdown memberId={m.user_id} currentRole={m.role} />
                      : <span className={`text-xs px-2 py-0.5 rounded-full border ${ROLE_BADGE[m.role]}`}>{m.role}</span>
                    }
                  </td>
                  <td className="py-3 pr-4 text-slate-500 text-xs hidden sm:table-cell">
                    {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3 pr-4 text-slate-500 text-xs hidden md:table-cell">
                    {m.last_seen_at ? new Date(m.last_seen_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="py-3">
                    {m.user_id !== user?.id && (
                      <button
                        onClick={async () => {
                          const ok = await confirm({ title: 'Remove Member', message: `Remove ${m.github_username} from the team?`, confirmText: 'Remove' });
                          if (ok) removeMut.mutate(m.user_id);
                        }}
                        className="p-1 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      ><Trash2 size={13} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending invites */}
      {pending.length > 0 && (
        <div className={sectionCls}>
          <h3 className="text-white font-semibold mb-4">Pending Invites ({pending.length})</h3>
          <div className="space-y-2">
            {pending.map((inv: any) => {
              const expiresIn = Math.max(0, Math.round((new Date(inv.expires_at).getTime() - Date.now()) / 86400000));
              return (
                <div key={inv.id} className="flex items-center justify-between py-2.5 px-3 bg-slate-800/40 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-200 text-sm">{inv.email}</span>
                    <span className="text-slate-600 text-xs ml-2">· {inv.role}</span>
                    <span className={`text-xs ml-2 ${expiresIn <= 1 ? 'text-red-400' : 'text-slate-600'}`}>
                      · expires in {expiresIn}d
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => resendMut.mutate(inv.id)}
                      disabled={resendMut.isPending}
                      className="text-xs px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {resendMut.isPending ? '...' : 'Resend'}
                    </button>
                    <button
                      onClick={() => revokeMut.mutate(inv.id)}
                      className="text-xs px-2.5 py-1 bg-red-500/10 hover:bg-red-500/15 text-red-400 border border-red-500/20 rounded-lg transition-colors"
                    >Revoke</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Security (API Keys)
// ─────────────────────────────────────────────────────────────────────────────

function SecurityTab() {
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const { toast } = useToast();
  const [name, setName]         = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey]     = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);
  const [showFull, setShowFull] = useState(false);

  const { data } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => axios.get('/api/api-keys').then(r => r.data.keys),
  });

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const r = await axios.post('/api/api-keys', { name: name.trim() });
      setNewKey(r.data.full_key);
      setName('');
      qc.invalidateQueries({ queryKey: ['api-keys'] });
    } catch (e: any) {
      toast(e.response?.data?.error || 'Failed to create key', 'error');
    } finally { setCreating(false); }
  };

  const revoke = async (id: string) => {
    const ok = await confirm({ title: 'Revoke API Key', message: 'Revoke this API key? Apps using it will stop working.', confirmText: 'Revoke' });
    if (!ok) return;
    await axios.delete(`/api/api-keys/${id}`);
    qc.invalidateQueries({ queryKey: ['api-keys'] });
  };

  const copyKey = () => {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const keys = data || [];

  return (
    <div className="space-y-5 max-w-2xl">
      {newKey && (
        <div className="bg-green-500/10 border border-green-500/25 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-400 font-medium text-sm mb-2">
            <CheckCircle size={14} /> API key created — copy it now, it won't be shown again
          </div>
          <div className="flex items-center gap-2 mt-2 font-mono text-xs">
            <code className="flex-1 bg-[#070c14] border border-slate-800 px-3 py-2 rounded-lg text-green-300 truncate">
              {showFull ? newKey : newKey.slice(0, 20) + '•'.repeat(20)}
            </code>
            <button onClick={() => setShowFull(v => !v)} className="p-2 text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg transition-colors">
              {showFull ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button onClick={copyKey} className="p-2 text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg transition-colors">
              {copied ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="mt-3 text-xs text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1">
            <X size={11} /> Dismiss
          </button>
        </div>
      )}

      <div className={sectionCls}>
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Key size={15} /> Create API Key</h3>
        <div className="flex gap-3">
          <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="e.g. CI/CD pipeline"
            className="flex-1 bg-[#070c14] border border-slate-800 focus:border-indigo-500/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none text-sm transition-colors" />
          <button onClick={handleCreate} disabled={creating || !name.trim()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm transition-colors">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
            Create
          </button>
        </div>
        <p className="text-slate-600 text-xs mt-2">Keys grant full read access to your org's PR data via the API.</p>
      </div>

      <div className={sectionCls}>
        <h3 className="text-white font-semibold mb-4">{keys.length} Active Key{keys.length !== 1 ? 's' : ''}</h3>
        {keys.length === 0 ? (
          <p className="text-slate-600 text-sm">No API keys yet. Create one above.</p>
        ) : (
          <div className="space-y-2">
            {keys.map((k: any) => (
              <div key={k.id} className="flex items-center justify-between py-3 px-3 bg-slate-800/40 rounded-lg border border-slate-800">
                <div>
                  <p className="text-white text-sm font-medium">{k.name}</p>
                  <p className="text-slate-500 text-xs mt-0.5 font-mono">{k.key_prefix}••••••••</p>
                  <p className="text-slate-600 text-xs mt-0.5">
                    Created {new Date(k.created_at).toLocaleDateString()}
                    {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                  </p>
                </div>
                <button onClick={() => revoke(k.id)}
                  className="text-xs px-2.5 py-1 bg-red-500/10 hover:bg-red-500/15 text-red-400 border border-red-500/20 rounded-lg transition-colors">
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Notifications
// ─────────────────────────────────────────────────────────────────────────────

function NotificationsTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    email_notifications_enabled: false,
    notify_on_critical: true,
    notify_on_high:     false,
    notify_recipients:  'admins',
  });
  const [saved, setSaved] = useState(false);

  const { data } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => axios.get('/api/admin/integrations').then(r => r.data.integrations),
  });

  useEffect(() => {
    if (data) setForm({
      email_notifications_enabled: data.email_notifications_enabled ?? false,
      notify_on_critical:          data.notify_on_critical          ?? true,
      notify_on_high:              data.notify_on_high              ?? false,
      notify_recipients:           data.notify_recipients           || 'admins',
    });
  }, [data]);

  const mut = useMutation({
    mutationFn: (v: typeof form) => axios.put('/api/admin/integrations', v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    },
  });

  function Toggle({ field, label, desc }: { field: keyof typeof form; label: string; desc?: string }) {
    const enabled = form[field] as boolean;
    return (
      <div className="flex items-start justify-between gap-4 py-3">
        <div>
          <p className="text-white text-sm font-medium">{label}</p>
          {desc && <p className="text-slate-500 text-xs mt-0.5">{desc}</p>}
        </div>
        <button
          onClick={() => setForm(p => ({ ...p, [field]: !p[field] as any }))}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${enabled ? 'bg-indigo-500' : 'bg-slate-700'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : 'translate-x-1'}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-xl">
      <div className={sectionCls}>
        <h3 className="text-white font-semibold mb-1">Email Notifications</h3>
        <p className="text-slate-500 text-sm mb-4">Configure when and who gets notified about risky PRs.</p>
        <div className="divide-y divide-slate-800">
          <Toggle field="email_notifications_enabled" label="Enable email notifications" desc="Master toggle for all PR notification emails" />
          <div className={`${!form.email_notifications_enabled ? 'opacity-40 pointer-events-none' : ''}`}>
            <Toggle field="notify_on_critical" label="Critical risk PRs" desc="Send email when a PR is rated critical" />
            <Toggle field="notify_on_high"     label="High risk PRs"     desc="Send email when a PR is rated high" />
          </div>
        </div>

        <div className={`mt-4 ${!form.email_notifications_enabled ? 'opacity-40 pointer-events-none' : ''}`}>
          <label className={labelCls}>Notify who?</label>
          <select
            value={form.notify_recipients}
            onChange={e => setForm(p => ({ ...p, notify_recipients: e.target.value }))}
            className={inputCls}
          >
            <option value="admins">Admins only</option>
            <option value="reviewers_admins">Reviewers + Admins</option>
            <option value="all">All team members</option>
          </select>
        </div>

        <SaveBar pending={mut.isPending} saved={saved} onSave={() => mut.mutate(form)} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Integrations
// ─────────────────────────────────────────────────────────────────────────────

function IntegrationsTab() {
  const qc = useQueryClient();
  const { org } = useAuth();
  const [searchParams] = useSearchParams();
  const [webhookInput, setWebhookInput] = useState('');
  const [saved, setSaved] = useState(false);
  const [appStatus] = useState(searchParams.get('app'));

  const { data } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => axios.get('/api/admin/integrations').then(r => r.data.integrations),
  });

  const webhooks: string[]   = data?.webhook_endpoints || [];
  const isGitHubConnected    = !!(data?.github_app_installation_id);

  const saveWebhooksMut = useMutation({
    mutationFn: (endpoints: string[]) => axios.put('/api/admin/integrations', { webhook_endpoints: endpoints }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    },
  });

  const addWebhook = () => {
    const url = webhookInput.trim();
    if (!url || !url.startsWith('http')) return;
    if (webhooks.includes(url)) return;
    saveWebhooksMut.mutate([...webhooks, url]);
    setWebhookInput('');
  };

  const removeWebhook = (url: string) =>
    saveWebhooksMut.mutate(webhooks.filter(w => w !== url));

  return (
    <div className="space-y-5 max-w-2xl">
      {/* GitHub App */}
      <div className={sectionCls}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-800 rounded-lg flex items-center justify-center">
              <Github size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold">GitHub App</h3>
              <p className="text-slate-500 text-xs">Grants secure repo access without personal tokens</p>
            </div>
          </div>
          {isGitHubConnected
            ? <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">Connected ✓</span>
            : <span className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1 rounded-full">Not installed</span>
          }
        </div>
        {appStatus === 'installed' && (
          <div className="mb-4 flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 text-green-400 text-sm">
            <CheckCircle size={14} /> GitHub App successfully installed!
          </div>
        )}
        {appStatus === 'uninstalled' && (
          <div className="mb-4 flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 text-yellow-400 text-sm">
            <AlertCircle size={14} /> GitHub App was uninstalled. Re-install to restore access.
          </div>
        )}
        {isGitHubConnected ? (
          <div className="text-slate-500 text-sm">
            <p>Installation active for <strong className="text-white">{org?.github_org_name}</strong>.</p>
            <p className="mt-1">To uninstall, go to <a href="https://github.com/settings/installations" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">GitHub App settings</a>.</p>
          </div>
        ) : (
          <>
            <p className="text-slate-500 text-sm mb-4">
              Installing the GitHub App gives Codebase Memory secure read access to your repos using an app token — not your personal account.
            </p>
            <a href="/api/auth/github-app/install"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-sm font-medium transition-colors">
              <Github size={15} /> Install GitHub App on {org?.github_org_name}
            </a>
          </>
        )}
      </div>

      {/* Slack — Phase 2 */}
      <div className={sectionCls + ' opacity-50'}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-800 rounded-lg flex items-center justify-center text-lg">💬</div>
            <div>
              <h3 className="text-white font-semibold">Slack</h3>
              <p className="text-slate-500 text-xs">Post PR alerts to your Slack channels</p>
            </div>
          </div>
          <span className="text-xs text-slate-500 border border-slate-700 px-2 py-0.5 rounded-full">Coming Phase 2</span>
        </div>
      </div>

      {/* Custom Webhooks */}
      <div className={sectionCls}>
        <h3 className="text-white font-semibold mb-1 flex items-center gap-2"><Plug size={15} /> Custom Webhooks</h3>
        <p className="text-slate-500 text-sm mb-4">Send PR analysis results to your own endpoints as JSON POST requests.</p>

        <div className="flex gap-2 mb-4">
          <input value={webhookInput} onChange={e => setWebhookInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addWebhook()}
            placeholder="https://hooks.example.com/pr-events"
            className="flex-1 bg-[#070c14] border border-slate-800 focus:border-indigo-500/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none text-sm transition-colors" />
          <button onClick={addWebhook}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-sm transition-colors">
            Add
          </button>
        </div>

        {webhooks.length === 0
          ? <p className="text-slate-600 text-sm">No webhooks configured.</p>
          : (
            <div className="space-y-2">
              {webhooks.map((url) => (
                <div key={url} className="flex items-center gap-2 py-2 px-3 bg-slate-800/40 rounded-lg border border-slate-800">
                  <span className="flex-1 text-slate-300 text-sm font-mono truncate">{url}</span>
                  <button onClick={() => removeWebhook(url)} className="p-1 text-slate-600 hover:text-red-400 transition-colors"><X size={13} /></button>
                </div>
              ))}
            </div>
          )}
        {saved && <p className="text-green-400 text-xs mt-2">✓ Saved</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Danger Zone
// ─────────────────────────────────────────────────────────────────────────────

function DangerZoneTab() {
  const { org, logout } = useAuth();
  const [showDelete, setShowDelete] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setError(''); setDeleting(true);
    try {
      await axios.delete('/api/admin/org', { data: { confirm_name: confirmName } });
      await logout();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to delete organization');
    } finally { setDeleting(false); }
  };

  return (
    <div className="max-w-xl space-y-4">
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-red-300 font-semibold">Delete Organization</h3>
            <p className="text-slate-500 text-sm mt-1">
              Permanently deletes all repos, PRs, team members, API keys, and analysis data.
              This cannot be undone.
            </p>
          </div>
        </div>

        {!showDelete ? (
          <button onClick={() => setShowDelete(true)}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/15 text-red-400 border border-red-500/25 rounded-lg text-sm transition-colors">
            Delete organization…
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-slate-400 text-sm">
              Type <strong className="text-white font-mono">{org?.github_org_name}</strong> to confirm:
            </p>
            <input
              value={confirmName}
              onChange={e => { setConfirmName(e.target.value); setError(''); }}
              placeholder={org?.github_org_name}
              className="w-full bg-[#070c14] border border-red-500/30 focus:border-red-500/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-700 focus:outline-none text-sm transition-colors"
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setShowDelete(false); setConfirmName(''); setError(''); }}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || confirmName !== org?.github_org_name}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'general',       label: 'General',       icon: <Settings size={14} /> },
  { id: 'members',       label: 'Members',       icon: <Users size={14} /> },
  { id: 'security',      label: 'Security',      icon: <Key size={14} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={14} /> },
  { id: 'integrations',  label: 'Integrations',  icon: <Plug size={14} /> },
  { id: 'danger',        label: 'Danger Zone',   icon: <AlertTriangle size={14} /> },
];

export default function AdminSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab    = searchParams.get('tab') || 'general';
  const setTab = (t: string) => setSearchParams({ tab: t });

  return (
    <div className="fade-in">
      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>
      <div className="flex gap-8">
        <nav className="w-44 shrink-0">
          <ul className="space-y-0.5">
            {TABS.map(t => (
              <li key={t.id}>
                <button
                  onClick={() => setTab(t.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-left transition-colors ${
                    tab === t.id
                      ? 'bg-indigo-600/15 text-indigo-300'
                      : t.id === 'danger'
                        ? 'text-red-500/70 hover:text-red-400 hover:bg-red-500/5'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex-1 min-w-0">
          {tab === 'general'       && <GeneralTab />}
          {tab === 'members'       && <MembersTab />}
          {tab === 'security'      && <SecurityTab />}
          {tab === 'notifications' && <NotificationsTab />}
          {tab === 'integrations'  && <IntegrationsTab />}
          {tab === 'danger'        && <DangerZoneTab />}
        </div>
      </div>
    </div>
  );
}
