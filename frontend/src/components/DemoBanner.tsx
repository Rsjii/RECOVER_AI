import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const DEMO_EMAIL = 'demo@recoverai.com';

export const DemoBanner: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user || user.email !== DEMO_EMAIL) return null;

  return (
    <div className="bg-amber-400 text-amber-900 text-sm font-medium px-4 py-2 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base flex-shrink-0">🎭</span>
        <span className="truncate">
          <strong>Demo mode</strong> — Acme SaaS. Emails are <strong>not sent</strong>. Use "Preview Agent" to see what would happen.
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => navigate('/demo')}
          className="bg-amber-700 text-amber-50 text-xs font-semibold px-3 py-1 rounded-lg hover:bg-amber-600 transition-colors whitespace-nowrap"
        >
          Try with my data →
        </button>
        <button
          onClick={() => navigate('/signup')}
          className="bg-amber-900 text-amber-50 text-xs font-semibold px-3 py-1 rounded-lg hover:bg-amber-800 transition-colors whitespace-nowrap"
        >
          Sign up
        </button>
      </div>
    </div>
  );
};
