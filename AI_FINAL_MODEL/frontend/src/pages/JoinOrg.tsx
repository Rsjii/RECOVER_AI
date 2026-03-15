import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../config/axios';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, XCircle, Loader2, Zap, Github, Users, AlertCircle } from 'lucide-react';

export default function JoinOrg() {
  const { token }            = useParams<{ token: string }>();
  const { user, refetch }    = useAuth();
  const navigate             = useNavigate();
  const [state, setState]    = useState<'loading' | 'valid' | 'invalid' | 'joined'>('loading');
  const [linkData, setLinkData] = useState<any>(null);
  const [joining, setJoining]   = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    axios.get(`/api/team/join-links/validate/${token}`)
      .then(r => { setLinkData(r.data.join_link); setState('valid'); })
      .catch(() => setState('invalid'));
  }, [token]);

  const handleJoin = async () => {
    if (!user) {
      window.location.href = `/api/auth/github?redirect=/join/${token}`;
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      await axios.post(`/api/team/join-links/accept/${token}`);
      await refetch();
      setState('joined');
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (e: any) {
      setJoinError(e.response?.data?.error || 'Failed to join. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060910] flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-600/8 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-blue-600/8 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6 fade-in">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap size={16} className="text-white" />
          </div>
          <span className="text-white font-bold text-lg">Codebase Memory</span>
        </div>

        <div className="glass rounded-2xl p-8 text-center">
          {state === 'loading' && (
            <div className="py-4">
              <Loader2 size={32} className="animate-spin text-indigo-400 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Verifying link...</p>
            </div>
          )}

          {state === 'invalid' && (
            <>
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                <XCircle size={24} className="text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Link Expired</h2>
              <p className="text-slate-400 text-sm">
                This join link has expired or is no longer valid. Ask your admin to generate a new one.
              </p>
            </>
          )}

          {state === 'valid' && linkData && (
            <>
              <div className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                <Users size={22} className="text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Join Team</h2>
              <p className="text-slate-400 text-sm mb-1">
                Join <strong className="text-white">{linkData.github_org_name}</strong> on Codebase Memory
              </p>
              <p className="text-slate-500 text-sm mb-6">
                You'll join as <span className="text-slate-300 font-medium capitalize">{linkData.role}</span>
              </p>

              {!user && (
                <div className="flex items-center gap-2 justify-center text-yellow-400/80 text-xs mb-4 bg-yellow-500/5 border border-yellow-500/15 rounded-lg p-3">
                  <span>You'll sign in with GitHub first, then be redirected back here.</span>
                </div>
              )}

              {joinError && (
                <div className="flex items-start gap-2 text-left bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 mb-4">
                  <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-300 text-xs">{joinError}</p>
                </div>
              )}

              <button
                onClick={handleJoin}
                disabled={joining}
                className="w-full flex items-center justify-center gap-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                {joining ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : user ? (
                  'Join Team →'
                ) : (
                  <><Github size={15} /> Sign in with GitHub to Join</>
                )}
              </button>
            </>
          )}

          {state === 'joined' && (
            <>
              <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={24} className="text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Welcome!</h2>
              <p className="text-slate-400 text-sm">You've joined the team. Redirecting to dashboard...</p>
              <div className="mt-4 flex justify-center">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
