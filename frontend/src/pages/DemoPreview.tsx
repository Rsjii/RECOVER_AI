import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useNotification } from '../hooks/useNotification';
import { useAuth } from '../hooks/useAuth';

interface DemoPreviewData {
  emailsWouldQueue: number;
  plansWouldOffer: number;
  invoicesScanned: number;
  estimatedRecoveryUsd: number;
  previews: Array<{
    invoiceId: string;
    customerName: string;
    recipientEmail: string;
    amount: number;
    daysOverdue: number;
    emailType: string;
    riskScore: number;
  }>;
}

const RISK_COLOR = (score: number) =>
  score >= 80 ? 'text-red-600 bg-red-50 dark:bg-red-900/20'
    : score >= 50 ? 'text-orange-600 bg-orange-50 dark:bg-orange-900/20'
      : 'text-green-600 bg-green-50 dark:bg-green-900/20';

const DemoPreview: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useNotification();
  const { isAuthenticated, user, isLoading, setAuthState, logout } = useAuth();
  const [step, setStep] = useState<'loading' | 'preview'>('loading');
  const [preview, setPreview] = useState<DemoPreviewData | null>(null);
  const [error, setError] = useState('');
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const initialized = useRef(false);
  const historyCleanedRef = useRef(false);

  useEffect(() => {
    document.title = 'See RecoverAI in Action';

    // Clean history: when user presses back from /demo-preview, logout and go to landing
    // Must call logout API before navigating to clear auth completely
    if (!historyCleanedRef.current) {
      historyCleanedRef.current = true;
      const handlePopState = async () => {
        try {
          await logout();
          // Force hard navigation to landing (not React Router navigate) to ensure clean reload
          window.location.href = '/';
        } catch (err) {
          // Even if logout fails, redirect to landing
          window.location.href = '/';
        }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [logout]);

  // Wait for auth context to finish restoring session before doing anything
  useEffect(() => {
    if (isLoading) return;          // Auth still restoring cookies — wait
    if (initialized.current) return; // Already ran once this mount
    initialized.current = true;

    if (isAuthenticated && user?.email === 'demo@recoverai.com') {
      // Already logged in as demo — skip preview, go straight to dashboard
      navigate('/dashboard', { replace: true });
    } else {
      doInitialDemoLogin();
    }
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const doInitialDemoLogin = async () => {
    try {
      setStep('loading');
      // Login and get user/company back directly — no page reload needed
      const result = await api.post<{ user: any; company: any }>('/api/demo/login');
      localStorage.setItem('isDemo', 'true');
      // ✅ Update AuthContext directly — instant, no reload
      setAuthState(result.user, result.company);
      // Load preview now that we're authenticated
      await loadPreviewData();
    } catch (err: any) {
      setError(err.message || 'Failed to start demo');
      setStep('preview');
      addToast({ type: 'error', message: 'Failed to start demo' });
    }
  };

  const loadPreviewData = async () => {
    try {
      setStep('loading');
      setError('');
      const res = await api.post<DemoPreviewData>('/api/demo/preview');
      setPreview(res);
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'Failed to load demo preview');
      setStep('preview');
      addToast({ type: 'error', message: 'Failed to load demo preview' });
    }
  };

  const handleExploreDashboard = async () => {
    setLoadingDashboard(true);
    try {
      // ✅ User is authenticated (page was reloaded after demo login)
      // Just navigate directly
      navigate('/dashboard', { replace: true });
    } finally {
      setLoadingDashboard(false);
    }
  };

  const handleStartWithMyData = async () => {
    // logout() clears cookie server-side; hard navigation forces fresh auth check — avoids
    // the race where isAuthenticated is still true when Signup mounts and redirects to dashboard
    await logout();
    addToast({ type: 'info', message: 'Apply for pilot program to get started', duration: 3000 });
    window.location.href = '/landing';
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-[#09090b]">
        <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center mb-6">
          <span className="text-white font-bold text-lg">R</span>
        </div>
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-600 dark:text-gray-400 text-sm">Loading preview...</p>
      </div>
    );
  }

  if (step === 'preview' && preview) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#09090b] py-12 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-xl">R</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">See RecoverAI in Action</h1>
            <p className="text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
              Watch how our autonomous agent analyzes Acme SaaS's invoices and generates recovery emails.
              <span className="font-medium text-blue-600"> No emails were actually sent.</span>
            </p>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-4 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{preview.invoicesScanned}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Invoices scanned</div>
            </div>
            <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{preview.emailsWouldQueue}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Emails ready</div>
            </div>
            <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{preview.plansWouldOffer}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Payment plans</div>
            </div>
            <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                ${preview.estimatedRecoveryUsd.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Est. recovery (30%)</div>
            </div>
          </div>

          {/* Email Previews */}
          {preview.previews.length > 0 && (
            <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] mb-8">
              <div className="p-4 border-b border-gray-200 dark:border-white/[0.06]">
                <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
                  Sample emails agent would send ({preview.previews.length} total)
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">These are pending your approval</p>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {preview.previews.slice(0, 5).map((item) => (
                  <div key={`${item.invoiceId}-${item.emailType}`} className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{item.customerName}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.recipientEmail}</div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{item.daysOverdue}d overdue</span>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        ${item.amount.toLocaleString()}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RISK_COLOR(item.riskScore)}`}>
                        Risk {item.riskScore}
                      </span>
                    </div>
                  </div>
                ))}
                {preview.previews.length > 5 && (
                  <div className="p-3 text-center text-xs text-gray-500 dark:text-gray-400">
                    +{preview.previews.length - 5} more in dashboard
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CTA Buttons */}
          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={handleExploreDashboard}
              disabled={loadingDashboard}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              {loadingDashboard ? 'Loading...' : 'Explore Full Demo Dashboard →'}
            </button>
            <button
              onClick={handleStartWithMyData}
              className="bg-white dark:bg-[#111113] border border-gray-300 dark:border-white/[0.08] text-gray-900 dark:text-white text-sm font-semibold px-6 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors"
            >
              Start with My Stripe Data →
            </button>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Pilot Program: 14 days free · Custom pricing after · Outcome-based model
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090b] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error || 'Failed to load preview'}</p>
        <button
          onClick={loadPreviewData}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium"
        >
          Try Again
        </button>
      </div>
    </div>
  );
};

export default DemoPreview;
