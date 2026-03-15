import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../config/axios';
import { useAuth } from '../contexts/AuthContext';
import { Zap, BookOpen, Users, CreditCard, ArrowRight, Check } from 'lucide-react';

const STEPS = ['Create Workspace', 'You\'re Ready'];

export default function Setup() {
  const [step, setStep]     = useState(1);
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const { refetch }         = useAuth();
  const navigate            = useNavigate();

  const handleCreate = async () => {
    if (!orgName.trim()) return;
    setError('');
    setLoading(true);
    try {
      await axios.post('/api/team/setup', { github_org_name: orgName.trim() });
      await refetch();
      setStep(2);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to create workspace. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060910] flex items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-600/8 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-blue-600/8 blur-3xl" />
      </div>
      <div className="absolute inset-0 opacity-[0.025]" style={{
        backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
        backgroundSize: '64px 64px',
      }} />

      <div className="relative z-10 w-full max-w-lg px-6 fade-in">
        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap size={18} className="text-white" />
          </div>
          <span className="text-white font-bold text-xl">Codebase Memory</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                i + 1 < step ? 'text-green-400' :
                i + 1 === step ? 'text-indigo-300' : 'text-slate-600'
              }`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center border text-[10px] font-bold ${
                  i + 1 < step ? 'bg-green-500/20 border-green-500/40 text-green-400' :
                  i + 1 === step ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' :
                  'bg-slate-800 border-slate-700 text-slate-600'
                }`}>
                  {i + 1 < step ? <Check size={10} /> : i + 1}
                </div>
                {s}
              </div>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-slate-800" />}
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="glass rounded-2xl p-8 glow-blue">
            <h2 className="text-xl font-bold text-white mb-1">Create your workspace</h2>
            <p className="text-slate-400 text-sm mb-6">
              Enter your GitHub org or company name. This becomes your team's workspace.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 font-medium mb-1.5 uppercase tracking-wide">Workspace Name</label>
                <input
                  value={orgName}
                  onChange={e => { setOrgName(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="acme-corp"
                  autoFocus
                  className="w-full bg-[#0d1424] border border-slate-800 focus:border-indigo-500/50 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none transition-colors text-sm"
                />
                {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
              </div>

              <button
                onClick={handleCreate}
                disabled={loading || !orgName.trim()}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Create Workspace <ArrowRight size={15} /></>
                )}
              </button>
            </div>

            {/* Invited user hint */}
            <div className="mt-5 pt-4 border-t border-slate-800 text-center">
              <p className="text-slate-600 text-xs">
                Joining an existing team?{' '}
                <span className="text-slate-500">Check your email for an invite link — don't create a workspace.</span>
              </p>
            </div>
          </div>
        )}

        {/* Step 2 — Success */}
        {step === 2 && (
          <div className="glass rounded-2xl p-8 glow-blue fade-in">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center">
                <Check size={18} className="text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Workspace created!</h2>
                <p className="text-slate-500 text-sm">Complete the steps below to go live.</p>
              </div>
            </div>

            <div className="space-y-2.5 mb-6">
              {[
                {
                  icon: <BookOpen size={16} />,
                  title: 'Add Repositories',
                  desc: 'Connect your GitHub repos. Indexing takes 2–6 hours.',
                  action: () => navigate('/admin/repos'),
                  cta: 'Add Repos →',
                  primary: true,
                },
                {
                  icon: <Users size={16} />,
                  title: 'Invite Your Team',
                  desc: 'Add developers and reviewers to your workspace.',
                  action: () => navigate('/admin/settings?tab=members'),
                  cta: 'Invite Team →',
                  primary: false,
                },
                {
                  icon: <CreditCard size={16} />,
                  title: 'Choose a Plan',
                  desc: 'Upgrade for dashboard access, more repos, and team features.',
                  action: () => navigate('/admin/billing'),
                  cta: 'View Plans →',
                  primary: false,
                },
              ].map((item, i) => (
                <div
                  key={i}
                  onClick={item.action}
                  className="flex items-center gap-4 p-4 rounded-xl border border-slate-800 hover:border-slate-700 bg-[#0d1424] hover:bg-[#111827] cursor-pointer transition-all group"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    item.primary ? 'bg-indigo-500/15 border border-indigo-500/25 text-indigo-400' : 'bg-slate-800 border border-slate-700 text-slate-400'
                  }`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${item.primary ? 'text-white' : 'text-slate-300'}`}>{item.title}</p>
                    <p className="text-slate-600 text-xs mt-0.5">{item.desc}</p>
                  </div>
                  <span className={`text-xs font-medium shrink-0 group-hover:translate-x-0.5 transition-transform ${item.primary ? 'text-indigo-400' : 'text-slate-500'}`}>
                    {item.cta}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-2.5 text-slate-500 hover:text-slate-300 text-sm transition-colors text-center"
            >
              Skip for now → Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
