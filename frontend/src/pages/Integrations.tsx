import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { useNotification } from '../hooks/useNotification';
import { useAuth } from '../hooks/useAuth';
import { CSVUploadModal } from '../components/invoices/CSVUploadModal';
import { logError } from '../utils/logger';

const API_BASE = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

interface IntegrationStatus {
  stripe_connected: boolean;
  csv_connected: boolean;
  qb_connected: boolean;
  company_name: string;
}

export const Integrations: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useNotification();
  const { setAuthState, logout, company, user } = useAuth();

  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState<'stripe' | 'qb' | null>(null);
  const [proceeding, setProceeding] = useState(false);
  const [stripeManualMode, setStripeManualMode] = useState(false);
  const [stripeApiKey, setStripeApiKey] = useState('');
  const [validatingKey, setValidatingKey] = useState(false);
  const shouldNavigateToDashboard = useRef(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [csvImportJobId, setCSVImportJobId] = useState<string | null>(null);
  const [csvImportStatus, setCSVImportStatus] = useState<{ status: 'processing' | 'done' | 'error'; created: number; skipped: number; duplicates: number; total: number; error?: string } | null>(null);

  useEffect(() => {
    document.title = 'Connect Your Billing — RecoverAI';
  }, []);

  // STRICT PIPELINE: Enforce integrations_pending status only (redirect if status changes)
  useEffect(() => {
    if (user?.onboardingStatus) {
      if (user.onboardingStatus === 'pending_profile') {
        navigate('/profile', { replace: true });
      } else if (user.onboardingStatus === 'active') {
        navigate('/dashboard', { replace: true });
      }
      // If integrations_pending, user is in correct place, allow
    }
  }, [user?.onboardingStatus, navigate]);

  // Watch for auth state update after proceed — navigate only after state is committed
  useEffect(() => {
    if (shouldNavigateToDashboard.current &&
        (company?.onboarding_stage === 'trial_active' || company?.onboarding_stage === 'paid_active')) {
      shouldNavigateToDashboard.current = false;
      navigate('/dashboard', { replace: true });
    }
  }, [company?.onboarding_stage, navigate]);

  // Poll for CSV import status
  useEffect(() => {
    if (!csvImportJobId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await api.get(`/api/invoices/csv-import-status/${csvImportJobId}`);
        const importStatus = res.data;
        setCSVImportStatus(importStatus);

        if (importStatus.status === 'done' || importStatus.status === 'error') {
          clearInterval(pollInterval);
          if (importStatus.status === 'done') {
            addToast({
              type: 'success',
              message: `✅ Import complete: ${importStatus.created} invoices imported${importStatus.duplicates > 0 ? `, ${importStatus.duplicates} duplicates skipped` : ''}`
            });
            // Refresh status from backend so csv_connected reflects reality
            try {
              const refreshed: any = await api.get('/api/audit-stages/stage/2');
              setStatus(refreshed);
            } catch { /* non-blocking */ }
          } else {
            addToast({ type: 'error', message: `Import failed: ${importStatus.error}` });
          }
          setTimeout(() => {
            setCSVImportJobId(null);
            setCSVImportStatus(null);
            setShowCSVModal(false);
          }, 1500);
        }
      } catch (err: any) {
        logError('Component', 'handler', 'Failed to poll CSV import status:', err);
      }
    }, 1000);

    return () => clearInterval(pollInterval);
  }, [csvImportJobId, addToast]);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res: any = await api.get('/api/audit-stages/stage/2');
        setStatus(res);
      } catch (err: any) {
        if (err?.status === 401) {
          navigate(`/login`, { replace: true });
          return;
        }
        setError(err?.message || 'Failed to load integrations');
      }
      setLoading(false);
    };

    fetchStatus();
  }, [navigate]);

  const handleConnectStripe = () => {
    setConnecting('stripe');
    window.location.replace(`${API_BASE}/api/stripe/oauth/authorize`);
  };

  const handleNext = async () => {
    if (!status?.stripe_connected && !status?.csv_connected && !status?.qb_connected && !import.meta.env.DEV) {
      setError('Connect a billing source (Stripe, CSV, or QuickBooks) to continue');
      return;
    }

    setProceeding(true);
    try {
      addToast({
        type: 'info',
        message: '⏳ Processing invoices...',
      });

      const response: any = await api.post(`/api/audit-stages/stage/2/proceed`);

      const syncSummary = response.syncSummary || { imported: 0, skipped: 0 };
      const syncedIntegration = response.syncedIntegration || 'Stripe';
      addToast({
        type: 'success',
        message: `✅ Synced ${syncSummary.imported} ${syncedIntegration} invoices${syncSummary.skipped > 0 ? ` | ⏭️ Skipped ${syncSummary.skipped}` : ''}`,
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      shouldNavigateToDashboard.current = true;
      const meData = await api.get('/api/auth/me');
      if (meData.user && meData.company) {
        setAuthState(meData.user, meData.company);
      }
    } catch (err: any) {
      shouldNavigateToDashboard.current = false;
      setError(err?.message || 'Failed to proceed');
      addToast({
        type: 'error',
        message: 'Invoice sync failed. Please try again.',
      });
      setProceeding(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err: any) {
      addToast({ type: 'error', message: 'Logout failed' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#09090b] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading integrations...</p>
        </div>
      </div>
    );
  }

  const canProceed = !!(status?.stripe_connected || status?.csv_connected || status?.qb_connected);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090b] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">R</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Connect your billing</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">We need access to your invoices so the agent can start recovering AR</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-[#111113] rounded-xl shadow-sm border border-gray-200 dark:border-white/[0.06] p-6 sm:p-8">
          {/* Progress — stepper */}
          <div className="flex items-center gap-2 mb-8">
            <div className="flex items-center gap-2 flex-1">
              <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">Account</span>
            </div>
            <div className="flex-1 h-px bg-green-300 dark:bg-green-800/50" />
            <div className="flex items-center gap-2 flex-1 justify-center">
              <div className="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                2
              </div>
              <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white hidden sm:inline">Integrations</span>
            </div>
            <div className="flex-1 h-px bg-gray-200 dark:bg-white/[0.08]" />
            <div className="flex items-center gap-2 flex-1 justify-end">
              <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-white/[0.06] text-gray-500 dark:text-gray-500 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                3
              </div>
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">Dashboard</span>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 flex items-start gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
              <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Stripe Card — PRIMARY OPTION */}
          <div className={`mb-4 p-5 rounded-lg border transition-colors ${
            status?.stripe_connected
              ? 'border-green-300 dark:border-green-800/60 bg-green-50/50 dark:bg-green-900/10'
              : 'border-blue-200 dark:border-blue-800/40 bg-brand-50/50 dark:bg-blue-900/10'
          }`}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-brand-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-brand-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Stripe</h3>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:text-blue-300 bg-brand-100 dark:bg-blue-900/40 px-2 py-0.5 rounded">Recommended</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Read-only access to your invoices and customers. Takes about 30 seconds.
                </p>

                {status?.stripe_connected ? (
                  <div className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-[#0a0a0c] border border-green-200 dark:border-green-800/60 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">Connected</span>
                    </div>
                    <button
                      onClick={() => {
                        setStripeManualMode(false);
                        setStripeApiKey('');
                      }}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      Change
                    </button>
                  </div>
                ) : stripeManualMode ? (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    setValidatingKey(true);
                    setError('');
                    try {
                      await api.post('/api/stripe/connect', { stripe_api_key: stripeApiKey.trim() });
                      setStatus(prev => prev ? { ...prev, stripe_connected: true } : null);
                      setStripeManualMode(false);
                      setStripeApiKey('');
                      addToast({ type: 'success', message: 'Stripe connected!' });
                    } catch (err: any) {
                      setError(err?.message || 'Invalid API key');
                    } finally {
                      setValidatingKey(false);
                    }
                  }} className="space-y-3">
                    <input
                      type="password"
                      placeholder="sk_live_... or sk_test_..."
                      value={stripeApiKey}
                      onChange={(e) => setStripeApiKey(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.08] rounded-lg text-gray-900 dark:text-white bg-white dark:bg-white/[0.03] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      disabled={validatingKey}
                      autoComplete="off"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={validatingKey || !stripeApiKey}
                        className="flex-1"
                      >
                        {validatingKey ? 'Validating...' : 'Validate key'}
                      </Button>
                      <button
                        type="button"
                        onClick={() => {
                          setStripeManualMode(false);
                          setStripeApiKey('');
                        }}
                        className="px-4 py-2 border border-gray-300 dark:border-white/[0.08] rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-2">
                    <Button
                      onClick={handleConnectStripe}
                      disabled={connecting === 'stripe'}
                      className="w-full"
                    >
                      {connecting === 'stripe' ? 'Redirecting...' : 'Connect Stripe'}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setStripeManualMode(true)}
                      className="w-full text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors py-1"
                    >
                      Use API key instead (advanced)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* QuickBooks Card */}
          <div className={`mb-4 p-5 rounded-lg border transition-colors ${
            status?.qb_connected
              ? 'border-green-300 dark:border-green-800/60 bg-green-50/50 dark:bg-green-900/10'
              : 'border-gray-200 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02]'
          }`}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">📊</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">QuickBooks Online</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Connect your QB account to sync invoices automatically.
                </p>

                {status?.qb_connected ? (
                  <div className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-[#0a0a0c] border border-green-200 dark:border-green-800/60 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">Connected</span>
                    </div>
                    <button
                      onClick={() => setConnecting(null)}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <Button
                    onClick={() => {
                      setConnecting('qb');
                      window.location.replace(`${API_BASE}/api/quickbooks/oauth/authorize`);
                    }}
                    variant="outline"
                    disabled={connecting === 'qb'}
                    className="w-full"
                  >
                    {connecting === 'qb' ? 'Redirecting...' : 'Connect QuickBooks'}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Divider with OR */}
          <div className="relative py-2 mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-white/[0.06]" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-[#111113]">OR</span>
            </div>
          </div>

          {/* CSV Import Card — ALTERNATIVE OPTION */}
          <div className={`mb-6 p-5 rounded-lg border transition-colors ${
            status?.csv_connected
              ? 'border-green-300 dark:border-green-800/60 bg-green-50/50 dark:bg-green-900/10'
              : 'border-gray-200 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02]'
          }`}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">CSV upload</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Import invoices from a file if you don't use Stripe.
                </p>

                {csvImportStatus?.status === 'processing' ? (
                  <div className="flex items-center gap-2 p-3 bg-white dark:bg-[#0a0a0c] border border-blue-200 dark:border-blue-800/60 rounded-lg">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-brand-700 dark:text-blue-400">
                      Importing... {csvImportStatus.created}/{csvImportStatus.total}
                    </span>
                  </div>
                ) : status?.csv_connected ? (
                  <div className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-[#0a0a0c] border border-green-200 dark:border-green-800/60 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">Imported</span>
                    </div>
                    <button
                      onClick={() => setShowCSVModal(true)}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      Import again
                    </button>
                  </div>
                ) : (
                  <Button
                    onClick={() => setShowCSVModal(true)}
                    variant="outline"
                    className="w-full"
                  >
                    Upload CSV file
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Continue Button */}
          <Button
            onClick={handleNext}
            disabled={proceeding || !canProceed}
            loading={proceeding}
            size="lg"
            className="w-full"
          >
            {proceeding ? 'Setting up your dashboard...' : 'Continue to dashboard'}
          </Button>

          <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
            Read-only access. You can disconnect anytime from settings.
          </p>

          {/* Logout Button */}
          <div className="mt-3 text-center">
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              Sign out
            </button>
          </div>

          {/* CSV Upload Modal */}
          <CSVUploadModal
            isOpen={showCSVModal}
            onClose={() => setShowCSVModal(false)}
            setImportJobId={setCSVImportJobId}
          />
        </div>
      </div>
    </div>
  );
};
