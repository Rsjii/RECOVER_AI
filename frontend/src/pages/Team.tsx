import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import type { TeamInvitation, TeamMember } from '../types';

const Team: React.FC = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: { members: TeamMember[]; invitations: TeamInvitation[] } }>(API_ENDPOINTS.team.members);
      setMembers(res.data.members || []);
      setInvitations(res.data.invitations || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Team — RecoverAI';
    void load();
  }, []);

  const invite = async () => {
    if (!email.trim()) return;
    await api.post(API_ENDPOINTS.team.invite, { email, role });
    setEmail('');
    await load();
  };

  const changeRole = async (userId: string, nextRole: 'admin' | 'member' | 'viewer') => {
    await api.put(API_ENDPOINTS.team.updateRole(userId), { role: nextRole });
    await load();
  };

  const revoke = async (userId: string) => {
    await api.delete(API_ENDPOINTS.team.revoke(userId));
    await load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Management</h1>
      <Card>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Invite Member</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            className="flex-1 px-3 py-2 border rounded-lg bg-white dark:bg-[#111113] dark:border-white/[0.06]"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'admin' | 'member' | 'viewer')}
            className="px-3 py-2 border rounded-lg bg-white dark:bg-[#111113] dark:border-white/[0.06]"
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>
          <Button onClick={invite}>Send Invite</Button>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Members</h2>
        {loading ? <p className="text-sm text-gray-500">Loading team...</p> : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.user_id} className="p-3 rounded bg-gray-50 dark:bg-[#111113] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{m.email}</p>
                  <p className="text-xs text-gray-500">Role: {m.role}</p>
                </div>
                {m.role !== 'owner' && (
                  <div className="flex items-center gap-2">
                    <select
                      className="px-2 py-1 border rounded bg-white dark:bg-white/[0.03] dark:border-white/[0.08] text-sm"
                      value={m.role}
                      onChange={(e) => changeRole(m.user_id, e.target.value as 'admin' | 'member' | 'viewer')}
                    >
                      <option value="admin">admin</option>
                      <option value="member">member</option>
                      <option value="viewer">viewer</option>
                    </select>
                    <Button variant="danger" size="sm" onClick={() => revoke(m.user_id)}>Revoke</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Pending Invitations</h2>
        <div className="space-y-2">
          {invitations.length === 0 && <p className="text-sm text-gray-500">No pending invitations.</p>}
          {invitations.map((i) => (
            <div key={i.id} className="text-sm p-2 rounded bg-gray-50 dark:bg-[#111113]">
              {i.email} ({i.role}) - expires {new Date(i.expires_at).toLocaleString()}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default Team;


