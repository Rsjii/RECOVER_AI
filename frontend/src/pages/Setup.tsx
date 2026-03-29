import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';

const Setup: React.FC = () => {
  useEffect(() => { document.title = 'Setup — CashOS'; }, []);

  const [searchParams] = useSearchParams();
  const { company } = useAuth();
  const { addToast } = useNotification();

  const [stripeConnected, setStripeConnected] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [stripeInputMode, setStripeInputMode] = useState<'oauth' | 'apikey'>('oauth');
  const [manualApiKey, setManualApiKey] = useState('');
  const [savingApiKey, setSavingApiKey] = useState(false);

  // Check if already connected on load
  useEffect(() => {
    const check = async () => {
      try {
        const res = await api.get<{ data: { integrations?: { stripe?: boolean } } }>(API_ENDPOINTS.settings.get);
        if (res.data?.integrations?.stripe) setStripeConnected(true);
      } catch { /* silent */ }
    };
    check();
  }, []);

  // OAuth callback: stripe=connected in URL
  useEffect(() => {
    if (searchParams.get('stripe') === 'connected') {
      setStripeConnected(true);
    }
    const error = searchParams.get('error');
    if (error) {
      const msgs: Record<string, string> = {
        stripe_connection_failed: 'Failed to connect Stripe. Please try again.',
        access_denied: 'Stripe connection was cancelled.',
      };
      addToast({ type: 'error', message: msgs[error] || `Connection error: ${error}` });
    }
  }, [searchParams, addToast]);

  const handleStripeOAuth = () => {
    setConnectingStripe(true);
    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    window.location.href = `${backendUrl}/api/stripe/oauth/authorize`;
  };

  const handleManualApiKey = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!manualApiKey.trim()) return;
    setSavingApiKey(true);
    try {
      await api.post('/api/stripe/connect', { stripe_api_key: manualApiKey.trim() });
      setStripeConnected(true);
      setManualApiKey('');
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Invalid API key. Please try again.' });
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleLaunchDashboard = () => {
    // Full reload so AuthContext re-fetches /me with onboarding_status='active'
    window.location.href = '/dashboard';
  };

  const currentStep = stripeConnected ? 2 : 1; // 0-indexed

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090b] flex items-center justify-center px-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">R</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {stripeConnected ? "You're all set!" : `Welcome, ${company?.name || 'there'}!`}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {stripeConnected
              ? 'Your AI agent is ready to start recovering invoices.'
              : 'Connect your billing tool to start recovering invoices automatically.'}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {['Account', 'Connect', 'Go Live'].map((step, i) => (
            <React.Fragment key={step}>
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  i < currentStep
                    ? 'bg-green-100 text-green-600'
                    : i === currentStep
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-white/[0.03] text-gray-400'
                }`}>
                  {i < currentStep ? '✓' : i + 1}
                </div>
                <span className={`text-sm ${
                  i === currentStep
                    ? 'text-gray-900 dark:text-white font-medium'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {step}
                </span>
              </div>
              {i < 2 && <div className="w-8 h-px bg-gray-300 dark:bg-gray-600" />}
            </React.Fragment>
          ))}
        </div>

        {/* ── STEP 3: GO LIVE (stripe connected) ── */}
        {stripeConnected ? (
          <div className="space-y-4">
            {/* Success card */}
            <div className="bg-white dark:bg-[#111113] rounded-xl border border-green-200 dark:border-green-800 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Stripe connected</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Invoices are syncing in the background</p>
                </div>
              </div>

              {/* What's ready */}
              <div className="space-y-3">
                {[
                  { icon: '📊', label: 'Invoice sync', desc: 'All open invoices being imported' },
                  { icon: '🤖', label: 'AI agent ready', desc: 'Will score and prioritize your AR' },
                  { icon: '✉️', label: 'Email templates loaded', desc: 'Dunning emails ready to review' },
                  { icon: '👁️', label: 'Shadow mode ON', desc: 'Nothing sends without your approval' },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3 py-2 border-b border-gray-100 dark:border-white/[0.04] last:border-0">
                    <span className="text-lg mt-0.5">{item.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                    </div>
                    <div className="ml-auto w-2 h-2 rounded-full bg-green-500 animate-pulse mt-2" />
                  </div>
                ))}
              </div>
            </div>

            {/* Launch CTA */}
            <Button variant="primary" size="lg" onClick={handleLaunchDashboard} className="w-full">
              Launch Dashboard →
            </Button>

            <p className="text-center text-xs text-gray-500 dark:text-gray-400">
              You're in shadow mode — review and approve emails before anything sends.
            </p>
          </div>

        ) : (
          /* ── STEP 2: CONNECT ── */
          <div className="space-y-4">
            {/* Stripe Card */}
            <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <span className="text-purple-600 dark:text-purple-300 font-bold text-lg">S</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Stripe</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Sync invoices automatically</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {/* Mode toggle */}
                <div className="flex gap-1 bg-gray-100 dark:bg-white/[0.04] rounded-lg p-1">
                  <button
                    onClick={() => setStripeInputMode('oauth')}
                    className={`flex-1 text-xs py-1.5 rounded-md transition font-medium ${
                      stripeInputMode === 'oauth'
                        ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    OAuth (Recommended)
                  </button>
                  <button
                    onClick={() => setStripeInputMode('apikey')}
                    className={`flex-1 text-xs py-1.5 rounded-md transition font-medium ${
                      stripeInputMode === 'apikey'
                        ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    API Key
                  </button>
                </div>

                {stripeInputMode === 'oauth' ? (
                  <>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Secure OAuth authorization. No API keys stored.
                    </p>
                    <Button variant="primary" size="sm" loading={connectingStripe} onClick={handleStripeOAuth} className="w-full">
                      {connectingStripe ? 'Connecting...' : 'Connect with Stripe OAuth'}
                    </Button>
                  </>
                ) : (
                  <form onSubmit={handleManualApiKey} className="space-y-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Enter your Stripe secret key (<span className="font-mono">sk_test_...</span> or <span className="font-mono">sk_live_...</span>)
                    </p>
                    <input
                      type="password"
                      value={manualApiKey}
                      onChange={(e) => setManualApiKey(e.target.value)}
                      placeholder="sk_test_..."
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Button variant="primary" size="sm" loading={savingApiKey} type="submit" className="w-full">
                      {savingApiKey ? 'Saving...' : 'Save API Key'}
                    </Button>
                  </form>
                )}
              </div>
            </div>

            {/* QuickBooks */}
            <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6 opacity-60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <span className="text-green-600 dark:text-green-300 font-bold text-lg">QB</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">QuickBooks</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Connect in Settings</p>
                </div>
              </div>
            </div>

            {/* Chargebee */}
            <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6 opacity-60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                  <span className="text-orange-600 dark:text-orange-300 font-bold text-lg">CB</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Chargebee</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Connect in Settings</p>
                </div>
              </div>
            </div>

            <Button variant="ghost" size="lg" onClick={handleLaunchDashboard} className="w-full">
              Skip for now
            </Button>

            <p className="text-center text-xs text-gray-500 dark:text-gray-400">
              Your API keys are encrypted with AES-256-GCM and never stored in plaintext.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Setup;
