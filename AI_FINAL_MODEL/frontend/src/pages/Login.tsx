import { Github, Zap, Shield, GitPullRequest, AlertCircle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const ERROR_MESSAGES: Record<string, string> = {
  oauth_failed:   'GitHub sign-in failed. Please try again.',
  no_token:       'GitHub did not return an access token. Please try again.',
  no_code:        'OAuth flow was interrupted. Please try again.',
  access_denied:  'You cancelled the GitHub authorization.',
};

const features = [
  { icon: <GitPullRequest size={16} />, text: 'Every PR analyzed with full codebase context' },
  { icon: <Shield size={16} />, text: 'Risk scoring across critical, high, medium, low' },
  { icon: <Zap size={16} />, text: 'Instant AI analysis posted as GitHub comments' },
];

export default function Login() {
  const [params] = useSearchParams();
  const errorKey = params.get('error');
  const redirect  = params.get('redirect');

  const errorMsg = errorKey
    ? (ERROR_MESSAGES[errorKey] ?? 'Sign-in failed. Please try again.')
    : null;

  // Pass redirect through to the OAuth flow so user lands where they intended
  const loginUrl = redirect
    ? `${API_URL}/api/auth/github?redirect=${encodeURIComponent(redirect)}`
    : `${API_URL}/api/auth/github`;

  return (
    <div className="min-h-screen bg-[#060910] flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-900/5 blur-3xl" />
      </div>
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <div className="relative z-10 w-full max-w-md px-6 fade-in">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Zap size={20} className="text-white" />
            </div>
            <span className="text-white font-bold text-xl">Codebase Memory</span>
          </div>
        </div>

        {/* OAuth error banner — only shown when GitHub redirects back with ?error= */}
        {errorMsg && (
          <div className="mb-4 flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-300 text-sm">{errorMsg}</p>
          </div>
        )}

        <div className="glass rounded-2xl p-8 glow-blue">
          <h2 className="text-2xl font-bold text-white text-center mb-2">
            Institutional memory<br/>for your codebase
          </h2>
          <p className="text-slate-400 text-center text-sm mb-8">
            Every PR analyzed. Every risk surfaced. Every change contextualized.
          </p>

          <div className="space-y-3 mb-8">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  {f.icon}
                </div>
                <span className="text-slate-300 text-sm">{f.text}</span>
              </div>
            ))}
          </div>

          <a
            href={loginUrl}
            className="flex items-center justify-center gap-3 w-full bg-white hover:bg-slate-100 text-slate-900 font-semibold px-6 py-3.5 rounded-xl transition-all duration-150 shadow-lg hover:shadow-xl text-sm"
          >
            <Github size={18} />
            Continue with GitHub
          </a>

          <p className="text-slate-600 text-xs text-center mt-5">
            We request <code className="text-slate-500">repo</code> and{' '}
            <code className="text-slate-500">admin:repo_hook</code> access to analyze PRs.
          </p>
        </div>
      </div>
    </div>
  );
}
