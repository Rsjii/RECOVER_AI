import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { useNotification } from '../hooks/useNotification';
import { useAuth } from '../hooks/useAuth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface IntegrationStatus {
  stripe_connected: boolean;
  qb_connected: boolean;
  company_name: string;
}

export const Integrations: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useNotification();
  const { setAuthState, company } = useAuth();

  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState<'stripe' | 'qb' | null>(null);
  const [proceeding, setProceeding] = useState(false);
  const [stripeManualMode, setStripeManualMode] = useState(false);
  const [stripeApiKey, setStripeApiKey] = useState('');
  const [validatingKey, setValidatingKey] = useState(false);
  const shouldNavigateToDashboard = useRef(false);

  // Watch for auth state update after proceed — navigate only after state is committed
  useEffect(() => {
    if (shouldNavigateToDashboard.current &&
        (company?.onboarding_stage === 'trial_active' || company?.onboarding_stage === 'paid_active')) {
      shouldNavigateToDashboard.current = false;
      navigate('/dashboard', { replace: true });
    }
  }, [company?.onboarding_stage, navigate]);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        // Use audit-stages endpoint for new flow
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
    window.location.href = `${API_BASE}/api/stripe/oauth/authorize`;
  };

  const handleNext = async () => {
    if (!status?.stripe_connected && !import.meta.env.DEV) {
      setError('Connect Stripe to continue');
      return;
    }

    setProceeding(true);
    try {
      await api.post(`/api/audit-stages/stage/2/proceed`);
      // Set flag BEFORE updating auth state — useEffect will navigate once state commits
      shouldNavigateToDashboard.current = true;
      const meData = await api.get('/api/auth/me');
      if (meData.user && meData.company) {
        setAuthState(meData.user, meData.company);
      }
    } catch (err: any) {
      shouldNavigateToDashboard.current = false;
      setError(err?.message || 'Failed to proceed');
      setProceeding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700 dark:text-gray-300">Loading integrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-lg mx-auto">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-10">
            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">✓</div>
            <span className="text-sm text-gray-500">Account</span>
            <div className="flex-1 h-px bg-green-200 dark:bg-green-800"></div>
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Integrations</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 text-gray-500 rounded-full flex items-center justify-center text-sm">3</div>
            <span className="text-sm text-gray-500">Report</span>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Connect Your Billing</h1>
            <p className="text-gray-600 dark:text-gray-400">
              We need access to your invoices to generate the audit report
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Stripe Card */}
          <div className="mb-6 p-6 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <span className="text-lg">🔗</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Stripe</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Read-only access to your invoices</p>
              </div>
            </div>

            {status?.stripe_connected ? (
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <span className="text-sm font-medium text-green-700 dark:text-green-400">✓ Connected</span>
                <button
                  onClick={() => {
                    setStripeManualMode(false);
                    setStripeApiKey('');
                  }}
                  className="text-xs text-green-600 dark:text-green-400 hover:underline"
                >
                  Change
                </button>
              </div>
            ) : stripeManualMode ? (
              <form onSubmit={async (e) => {
                e.preventDefault();
                setValidatingKey(true);
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white"
                  disabled={validatingKey}
                />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={validatingKey || !stripeApiKey}
                    className="flex-1"
                  >
                    {validatingKey ? 'Validating...' : 'Validate Key'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setStripeManualMode(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <Button
                  onClick={handleConnectStripe}
                  disabled={connecting === 'stripe'}
                  className="w-full"
                >
                  {connecting === 'stripe' ? 'Redirecting...' : '🔓 Connect with Stripe'}
                </Button>
                <button
                  type="button"
                  onClick={() => setStripeManualMode(true)}
                  className="w-full text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Or paste API key manually
                </button>
              </div>
            )}
          </div>

          {/* Next Button */}
          <Button
            onClick={handleNext}
            disabled={proceeding || !status?.stripe_connected}
            className="w-full mb-4"
          >
            {proceeding ? 'Setting up...' : 'Go to Dashboard'}
          </Button>
        </div>
      </div>
    </div>
  );
};
