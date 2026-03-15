import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../config/axios';
import { useAuth } from '../contexts/AuthContext';
import { GitPullRequest, Loader2 } from 'lucide-react';

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading, refetch } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState<{ org_name: string; role: string } | null>(null);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    axios.get(`/api/admin/join-link/${token}/info`)
      .then(r => setInfo(r.data))
      .catch(() => setError('This join link is invalid or has expired.'));
  }, [token]);

  const handleJoin = async () => {
    if (!user) {
      // Use OAuth state param so GitHub redirects back to this join page after auth
      window.location.href = `/api/auth/github?redirect=${encodeURIComponent(`/join/${token}`)}`;
      return;
    }
    setJoining(true);
    try {
      await axios.post(`/api/admin/join-link/${token}/accept`);
      // Refresh auth context so org_id is populated before navigating
      await refetch();
      setDone(true);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to join. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  if (authLoading) return (
    <div className="min-h-screen bg-[#080f1e] flex items-center justify-center">
      <Loader2 className="animate-spin text-indigo-400" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#080f1e] flex items-center justify-center p-4">
      <div className="bg-[#0d1424] border border-slate-800 rounded-2xl p-8 max-w-sm w-full text-center">
        <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center mx-auto mb-5">
          <GitPullRequest className="text-indigo-400" size={22} />
        </div>

        {error ? (
          <div>
            <h1 className="text-white font-bold text-lg mb-2">Invalid Link</h1>
            <p className="text-slate-400 text-sm">{error}</p>
            <a href="/login" className="mt-4 inline-block text-indigo-400 hover:text-indigo-300 text-sm transition-colors">
              Go to login →
            </a>
          </div>
        ) : done ? (
          <div>
            <h1 className="text-white font-bold text-lg mb-2">Joined!</h1>
            <p className="text-slate-400 text-sm">Redirecting to dashboard...</p>
          </div>
        ) : info ? (
          <div>
            <h1 className="text-white font-bold text-xl mb-2">Join {info.org_name}</h1>
            <p className="text-slate-400 text-sm mb-6">
              You've been invited as a <span className="text-indigo-400 font-medium capitalize">{info.role}</span>
            </p>
            {!user && (
              <p className="text-slate-500 text-xs mb-4">You'll need to sign in with GitHub first</p>
            )}
            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              {joining && <Loader2 size={16} className="animate-spin" />}
              {user ? `Join as ${info.role}` : 'Sign in with GitHub to Join'}
            </button>
          </div>
        ) : (
          <Loader2 className="animate-spin text-indigo-400 mx-auto" />
        )}
      </div>
    </div>
  );
}
