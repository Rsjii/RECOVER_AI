import { CheckCircle, XCircle, ExternalLink } from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface Props {
  onNext: () => void;
  status: { step_github?: boolean } | undefined;
}

export default function Step1GitHub({ onNext, status }: Props) {
  const connected = status?.step_github;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white text-lg font-semibold">Connect GitHub</h2>
        <p className="text-slate-500 text-sm mt-1">Install the EngineeringOS GitHub App on your organization to start monitoring PRs and commits.</p>
      </div>

      <div className={`rounded-xl border p-4 flex items-center justify-between ${
        connected ? 'border-green-500/30 bg-green-500/5' : 'border-slate-700 bg-slate-800/30'
      }`}>
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          <div>
            <p className="text-slate-200 text-sm font-medium">GitHub App</p>
            <p className="text-slate-500 text-xs">{connected ? 'Installed and active' : 'Not installed'}</p>
          </div>
        </div>
        {connected
          ? <CheckCircle size={20} className="text-green-400" />
          : <XCircle size={20} className="text-slate-600" />}
      </div>

      {!connected && (
        <div className="bg-slate-800/50 rounded-lg p-4 text-sm text-slate-400 space-y-2">
          <p className="font-medium text-slate-300">How to connect:</p>
          <ol className="list-decimal ml-4 space-y-1 text-xs">
            <li>Click "Install GitHub App" below</li>
            <li>Select your organization</li>
            <li>Choose repositories to monitor (or all repos)</li>
            <li>Return here — this page will auto-update</li>
          </ol>
        </div>
      )}

      <div className="flex gap-3">
        {!connected && (
          <a
            href={`${API_URL}/api/auth/github-app/install`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium border border-slate-600"
          >
            <ExternalLink size={14} /> Install GitHub App
          </a>
        )}
        <button
          onClick={onNext}
          disabled={!connected}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-700 text-white text-sm font-medium border border-transparent disabled:border-slate-700 transition-colors"
        >
          {connected ? 'Continue →' : 'Waiting for GitHub...'}
        </button>
      </div>
    </div>
  );
}
