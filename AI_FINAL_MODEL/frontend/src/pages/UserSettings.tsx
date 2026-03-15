import { useAuth } from '../contexts/AuthContext';
import { Github, LogOut, Mail, User, Shield } from 'lucide-react';

export default function UserSettings() {
  const { user, org, tier, logout } = useAuth();

  return (
    <div className="max-w-2xl fade-in">
      <h1 className="text-2xl font-bold text-white mb-6">Your Profile</h1>

      {/* Identity card */}
      <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-6 mb-4">
        <div className="flex items-center gap-4 mb-6">
          <img
            src={`https://github.com/${user?.github_username}.png?size=64`}
            className="w-16 h-16 rounded-2xl ring-2 ring-slate-700"
            alt=""
          />
          <div>
            <h2 className="text-white text-lg font-semibold">{user?.github_username}</h2>
            <p className="text-slate-500 text-sm">{user?.email || 'No email on file'}</p>
            <span className="inline-flex items-center gap-1 mt-1.5 text-xs px-2 py-0.5 rounded-full border capitalize
              bg-indigo-500/10 border-indigo-500/20 text-indigo-300">
              <Shield size={10} /> {user?.role}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
            <Github size={15} className="text-slate-400 shrink-0" />
            <div>
              <p className="text-slate-400 text-xs">GitHub Account</p>
              <p className="text-white text-sm font-medium">@{user?.github_username}</p>
            </div>
            <span className="ml-auto text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
              Connected ✓
            </span>
          </div>

          {user?.email && (
            <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
              <Mail size={15} className="text-slate-400 shrink-0" />
              <div>
                <p className="text-slate-400 text-xs">Email</p>
                <p className="text-white text-sm">{user.email}</p>
              </div>
            </div>
          )}

          {org && (
            <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
              <User size={15} className="text-slate-400 shrink-0" />
              <div>
                <p className="text-slate-400 text-xs">Workspace</p>
                <p className="text-white text-sm font-medium">{org.github_org_name}</p>
              </div>
              <span className="ml-auto text-xs text-slate-500 uppercase font-bold tracking-wider">{tier}</span>
            </div>
          )}
        </div>
      </div>

      {/* GitHub re-auth */}
      <div className="bg-[#0d1424] border border-slate-800 rounded-xl p-5 mb-4">
        <h3 className="text-white font-medium mb-1">Reconnect GitHub</h3>
        <p className="text-slate-500 text-sm mb-4">
          If your GitHub token expired or permissions changed, re-authenticate to refresh it.
        </p>
        <a
          href="/api/auth/github"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-sm transition-colors"
        >
          <Github size={14} /> Reconnect GitHub Account
        </a>
      </div>

      {/* Sign out */}
      <div className="bg-[#0d1424] border border-red-500/10 rounded-xl p-5">
        <h3 className="text-white font-medium mb-1">Sign Out</h3>
        <p className="text-slate-500 text-sm mb-4">You'll need to sign in again with GitHub.</p>
        <button
          onClick={logout}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-400 rounded-lg text-sm transition-colors"
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </div>
  );
}
