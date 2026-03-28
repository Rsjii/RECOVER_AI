import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface IntegrationStatus {
  stripe_connected: boolean;
  qb_connected: boolean;
  company_name: string;
}

export const Stage4: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const { addToast } = useNotification();

  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState<'stripe' | 'qb' | null>(null);
  const [proceeding, setProceeding] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [stripeManualMode, setStripeManualMode] = useState(false);
  const [stripeApiKey, setStripeApiKey] = useState('');
  const [validatingKey, setValidatingKey] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.post('/api/auth/logout');
      sessionStorage.removeItem('stage-1-data');
      sessionStorage.removeItem('stage-2-data');
      sessionStorage.removeItem('stage-3-data');
      sessionStorage.removeItem('current-token');
      navigate('/');
    } catch (err: any) {
      addToast({ type: 'error', message: 'Logout failed' });
      setLoggingOut(false);
    }
  };

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res: any = await api.get('/api/audits/stage/4');
        setStatus(res);
      } catch (err: any) {
        // If 401, redirect back to stage 1
        if (err?.status === 401) {
          navigate(`/onboard/stage-1?token=${token}`, { replace: true });
          return;
        }
        setError(err?.message || 'Failed to load integrations');
      }
      setLoading(false);
    };

    fetchStatus();
  }, []);

  const handleConnectStripe = () => {
    setConnecting('stripe');
    window.location.href = `${API_BASE}/api/stripe/oauth/authorize`;
  };

  const handleConnectQB = () => {
    setConnecting('qb');
    window.location.href = `${API_BASE}/api/quickbooks/oauth/authorize`;
  };

  const handleNext = async () => {
    if (!status?.stripe_connected && !import.meta.env.DEV) {
      setError('Connect Stripe to continue');
      return;
    }
    setProceeding(true);
    try {
      await api.post('/api/audits/stage/4/next');
      navigate(`/onboard/stage-5?token=${token}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to proceed');
      setProceeding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-10">
            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">✓</div>
            <span className="text-sm text-gray-500">Account</span>
            <div className="flex-1 h-px bg-green-200 dark:bg-green-800"></div>
            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">✓</div>
            <span className="text-sm text-gray-500">Verify</span>
            <div className="flex-1 h-px bg-green-200 dark:bg-green-800"></div>
            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">✓</div>
            <span className="text-sm text-gray-500">Details</span>
            <div className="flex-1 h-px bg-blue-200 dark:bg-blue-800"></div>
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Connect</span>
          </div>

          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Connect Your Data</h1>
            <p className="text-gray-600 dark:text-gray-400">Stripe is required. QuickBooks is optional.</p>
          </div>

          {/* Integration cards */}
          <div className="grid gap-6 md:grid-cols-2 mb-8">
            {/* Stripe */}
            <div className={`border rounded-xl p-6 transition ${
              status?.stripe_connected
                ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                : 'border-gray-200 dark:border-gray-700'
            }`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Stripe</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Invoices & payment data</p>
                </div>
                {status?.stripe_connected && <span className="text-xl">✅</span>}
              </div>

              {status?.stripe_connected ? (
                <div className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-3 py-2 rounded-lg text-sm font-medium text-center">
                  Connected
                </div>
              ) : (
                <>
                  {/* OAuth Button */}
                  <Button onClick={handleConnectStripe} disabled={!!connecting || stripeManualMode} fullWidth size="sm">
                    {connecting === 'stripe' ? 'Connecting...' : '1️⃣ Authorize via OAuth'}
                  </Button>

                  {/* OR Divider */}
                  <div className="flex items-center gap-2 my-3">
                    <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">OR</span>
                    <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                  </div>

                  {/* Manual API Key */}
                  {!stripeManualMode ? (
                    <button
                      onClick={() => setStripeManualMode(true)}
                      className="w-full px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                    >
                      2️⃣ Paste API Key (Advanced)
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="password"
                        placeholder="sk_live_... or sk_test_..."
                        value={stripeApiKey}
                        onChange={(e) => setStripeApiKey(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={async () => {
                            setValidatingKey(true);
                            try {
                              await api.post('/api/stripe/validate-key', { apiKey: stripeApiKey });
                              addToast({ type: 'success', message: 'Stripe API key validated!' });
                              setStatus({ ...status!, stripe_connected: true });
                              setStripeManualMode(false);
                              setStripeApiKey('');
                            } catch (err: any) {
                              addToast({ type: 'error', message: 'Invalid API key' });
                            }
                            setValidatingKey(false);
                          }}
                          disabled={!stripeApiKey || validatingKey}
                          size="sm"
                          className="flex-1"
                        >
                          {validatingKey ? 'Validating...' : 'Validate'}
                        </Button>
                        <Button
                          onClick={() => {
                            setStripeManualMode(false);
                            setStripeApiKey('');
                          }}
                          size="sm"
                          variant="outline"
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Get your API key from <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Stripe Dashboard</a>
                      </p>
                    </div>
                  )}
                </>
              )}

              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                Read-only access — we cannot charge anyone
              </p>
            </div>

            {/* QuickBooks */}
            <div className={`border rounded-xl p-6 transition ${
              status?.qb_connected
                ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                : 'border-gray-200 dark:border-gray-700'
            }`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">QuickBooks</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Bills & payables (optional)</p>
                </div>
                {status?.qb_connected && <span className="text-xl">✅</span>}
              </div>

              {status?.qb_connected ? (
                <div className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-3 py-2 rounded-lg text-sm font-medium text-center">
                  Connected
                </div>
              ) : (
                <Button onClick={handleConnectQB} disabled={!!connecting} fullWidth variant="secondary" size="sm">
                  {connecting === 'qb' ? 'Connecting...' : 'Connect QB'}
                </Button>
              )}

              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                Add later from settings anytime
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            <Button
              onClick={handleNext}
              fullWidth
              disabled={(!status?.stripe_connected && !import.meta.env.DEV) || proceeding}
            >
              {proceeding ? 'Loading analysis...' : 'See Your Cash Position →'}
            </Button>

            {import.meta.env.DEV && !status?.stripe_connected && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-center">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-mono">
                  DEV MODE — Stripe optional. Click above to skip.
                </p>
              </div>
            )}

            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => navigate(`/onboard/stage-3?token=${token}`)}
              disabled={proceeding}
            >
              ← Back
            </Button>
          </div>

          <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4">
            You can skip QuickBooks and connect it later from settings
          </p>

          {/* Logout button */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              disabled={loggingOut}
              className="w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium py-2 transition"
            >
              ← Exit onboarding
            </button>
          </div>

          {/* Logout confirmation modal */}
          {showLogoutConfirm && (
            <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Exit onboarding?</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Your progress will be saved. You can continue later using the same link.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowLogoutConfirm(false)}
                    disabled={loggingOut}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium text-sm transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition disabled:opacity-50"
                  >
                    {loggingOut ? 'Exiting...' : 'Exit'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
