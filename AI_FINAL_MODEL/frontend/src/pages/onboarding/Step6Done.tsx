import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import axios from '../../config/axios';
import { CheckCircle, Loader2 } from 'lucide-react';

export default function Step6Done() {
  const navigate = useNavigate();

  const complete = useMutation({
    mutationFn: () => axios.post('/api/onboarding/complete'),
    onSuccess: () => navigate('/dashboard', { replace: true }),
  });

  return (
    <div className="text-center space-y-6 py-4">
      <div className="flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center">
          <CheckCircle size={32} className="text-green-400" />
        </div>
      </div>

      <div>
        <h2 className="text-white text-xl font-semibold">You're all set!</h2>
        <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
          EngineeringOS is now connected to your GitHub and Jira. We're building your 180-day historical index in the background — this typically takes 10–15 minutes.
        </p>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 text-left max-w-sm mx-auto">
        <p className="text-slate-300 text-xs font-semibold uppercase tracking-widest mb-3">What happens next</p>
        <div className="space-y-2 text-xs text-slate-400">
          <div className="flex items-start gap-2">
            <span className="text-indigo-400 mt-0.5">1.</span>
            <span>Historical data is indexed in the background (180 days of PRs, commits, Jira tickets)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-indigo-400 mt-0.5">2.</span>
            <span>Pattern detection runs tonight at 11pm UTC</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-indigo-400 mt-0.5">3.</span>
            <span>Your first brief arrives tomorrow morning at your configured delivery time</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-indigo-400 mt-0.5">4.</span>
            <span>Click "Generate Now" on the dashboard for an immediate preview</span>
          </div>
        </div>
      </div>

      <button
        onClick={() => complete.mutate()}
        disabled={complete.isPending}
        className="flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold mx-auto"
      >
        {complete.isPending && <Loader2 size={14} className="animate-spin" />}
        Go to Dashboard →
      </button>
    </div>
  );
}
