import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '../../config/axios';
import { useState } from 'react';
import { UserPlus, Trash2, ChevronDown } from 'lucide-react';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';

const ROLE_BADGE: Record<string, string> = {
  admin:     'bg-purple-500/10 text-purple-400 border-purple-500/20',
  reviewer:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  developer: 'bg-slate-700 text-slate-400 border-slate-600',
};

const ROLES = ['developer', 'reviewer', 'admin'] as const;

function RoleDropdown({ memberId, currentRole }: { memberId: string; currentRole: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const changeRole = async (newRole: string) => {
    if (newRole === currentRole) { setOpen(false); return; }
    await axios.put(`/api/team/members/${memberId}/role`, { role: newRole });
    qc.invalidateQueries({ queryKey: ['team'] });
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border cursor-pointer hover:opacity-80 transition-opacity ${ROLE_BADGE[currentRole]}`}
      >
        {currentRole}
        <ChevronDown size={11} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-7 z-20 bg-slate-800 border border-slate-700 rounded-lg py-1 min-w-[120px] shadow-lg">
            {ROLES.map(r => (
              <button
                key={r}
                onClick={() => changeRole(r)}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700 transition-colors ${r === currentRole ? 'text-white font-medium' : 'text-slate-400'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminTeam() {
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('developer');
  const [inviting, setInviting] = useState(false);

  const { data } = useQuery({
    queryKey: ['team'],
    queryFn: () => axios.get('/api/team').then(r => r.data),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => axios.delete(`/api/team/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  });

  const handleInvite = async () => {
    if (!email.trim()) return;
    setInviting(true);
    try {
      await axios.post('/api/team/invites', { email, role });
      setEmail('');
      qc.invalidateQueries({ queryKey: ['team'] });
    } catch (e: any) {
      toast(e.response?.data?.error || 'Failed to send invite', 'error');
    } finally {
      setInviting(false);
    }
  };

  const members = data?.members || [];
  const pendingInvites = data?.pending_invites || [];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-6">Team Members</h1>

      {/* Invite */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
        <h2 className="text-white font-semibold mb-4">Invite Member</h2>
        <div className="flex gap-3">
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleInvite()}
            placeholder="email@company.com"
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
          />
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none"
          >
            <option value="developer">Developer</option>
            <option value="reviewer">Reviewer</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={handleInvite}
            disabled={inviting || !email.trim()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors text-sm"
          >
            <UserPlus size={14} />{inviting ? 'Sending...' : 'Invite'}
          </button>
        </div>
      </div>

      {/* Role legend */}
      <div className="flex gap-4 mb-3">
        <p className="text-slate-500 text-xs">Click a role badge to change it.</p>
        <div className="flex gap-2">
          {Object.entries(ROLE_BADGE).map(([r, cls]) => (
            <span key={r} className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>{r}</span>
          ))}
        </div>
      </div>

      {/* Members table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400 text-sm font-medium">Member</th>
              <th className="text-left px-4 py-3 text-slate-400 text-sm font-medium">Role</th>
              <th className="text-left px-4 py-3 text-slate-400 text-sm font-medium">Email</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {members.map((m: any) => (
              <tr key={m.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <img src={`https://github.com/${m.github_username}.png?size=32`} className="w-7 h-7 rounded-full" alt="" />
                    <span className="text-white text-sm">{m.github_username}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <RoleDropdown memberId={m.user_id} currentRole={m.role} />
                </td>
                <td className="px-4 py-3 text-slate-400 text-sm">{m.email || '—'}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={async () => {
                      const ok = await confirm({ message: `Remove ${m.github_username} from the team?`, confirmText: 'Remove' });
                      if (ok) removeMutation.mutate(m.user_id);
                    }}
                    className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500 text-sm">No members yet</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <div className="border-t border-slate-700 p-4">
            <p className="text-slate-500 text-xs mb-3 font-medium uppercase tracking-wide">Pending Invites</p>
            <div className="space-y-2">
              {pendingInvites.map((i: any) => (
                <div key={i.id} className="flex items-center justify-between py-1">
                  <div>
                    <span className="text-slate-300 text-sm">{i.email}</span>
                    <span className="text-slate-600 text-xs ml-2">· {i.role}</span>
                  </div>
                  <span className="text-xs text-yellow-500 border border-yellow-500/20 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                    Invited ⏳
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
