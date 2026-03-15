import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';

const Setup: React.FC = () => {
  useEffect(() => {
    document.title = 'Setup — RecoverAI';
  }, []);
  const navigate = useNavigate();
  const { company } = useAuth();
  const { addToast } = useNotification();

  const [connectingStripe, setConnectingStripe] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [, setChecklist] = useState({
    stripeConnected: false,
    planSelected: false,
    policyReviewed: false,
  });

  useEffect(() => {
    const checkSettings = async () => {
      try {
        const res = await api.get<{ data: { integrations?: { stripe?: boolean } } }>(API_ENDPOINTS.settings.get);
        const connected = Boolean(res.data?.integrations?.stripe);
        setStripeConnected(connected);
        setChecklist((prev) => ({ ...prev, stripeConnected: connected }));
      } catch {
        // silent: setup screen can still function without this
      }
    };
    checkSettings();
  }, []);

  const handleStripeOAuth = () => {
    setConnectingStripe(true);
    const STRIPE_CLIENT_ID = import.meta.env.VITE_STRIPE_CLIENT_ID;
    if (!STRIPE_CLIENT_ID) {
      addToast({ type: 'error', message: 'Stripe Client ID not configured' });
      setConnectingStripe(false);
      return;
    }

    const params = new URLSearchParams({
      client_id: STRIPE_CLIENT_ID,
      response_type: 'code',
      scope: 'read_write',
      redirect_uri: `${window.location.origin}/stripe/oauth/callback`,
      state: 'security_token',
    });

    window.location.href = `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
  };

  const handlePlanSelect = async (plan: 'starter' | 'growth' | 'enterprise') => {
    setCheckoutLoading(true);
    try {
      const res = await api.post('/billing/checkout', { plan });
      if (res.data?.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
      } else {
        addToast({ type: 'error', message: 'Failed to create checkout' });
      }
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Checkout failed' });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleSkip = () => {
    navigate('/');
  };

  const handleGoToDashboard = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">R</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome, {company?.name || 'there'}!
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Connect your billing tool to start recovering invoices automatically.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {['Account', 'Connect', 'Go Live'].map((step, i) => (
            <React.Fragment key={step}>
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === 0
                      ? 'bg-green-100 text-green-600'
                      : i === 1
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                  }`}
                >
                  {i === 0 ? '✓' : i + 1}
                </div>
                <span
                  className={`text-sm ${
                    i === 1
                      ? 'text-gray-900 dark:text-white font-medium'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {step}
                </span>
              </div>
              {i < 2 && <div className="w-8 h-px bg-gray-300 dark:bg-gray-600" />}
            </React.Fragment>
          ))}
        </div>

        {/* Integration Cards */}
        <div className="space-y-4">
          {/* Stripe Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
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
              {stripeConnected && (
                <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded-full font-medium">
                  Connected
                </span>
              )}
            </div>

            {!stripeConnected ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  We use OAuth for secure authorization. No API keys stored.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  loading={connectingStripe}
                  onClick={handleStripeOAuth}
                  className="w-full"
                >
                  {connectingStripe ? 'Connecting...' : 'Connect with Stripe OAuth'}
                </Button>
              </div>
            ) : (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-sm text-green-700 dark:text-green-300">
                Stripe connected! Your invoices are syncing in the background.
              </div>
            )}
          </div>

          {/* QuickBooks Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 opacity-60">
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

          {/* Chargebee Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 opacity-60">
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
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          {stripeConnected ? (
            <Button variant="primary" size="lg" onClick={handleGoToDashboard} className="flex-1">
              Go to Dashboard
            </Button>
          ) : (
            <>
              <Button variant="secondary" size="lg" onClick={handleSkip} className="flex-1">
                Skip for now
              </Button>
              <Button variant="ghost" size="lg" onClick={handleGoToDashboard}>
                Go to Dashboard
              </Button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4">
          Your API keys are encrypted with AES-256-GCM and never stored in plaintext.
        </p>

        {stripeConnected && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Choose Your Plan</h3>
            <div className="space-y-3">
              {[
                { id: 'starter', name: 'Starter', price: '$99/mo', desc: 'Up to 500 invoices' },
                { id: 'growth', name: 'Growth', price: '$299/mo', desc: 'Unlimited invoices', popular: true },
                { id: 'enterprise', name: 'Enterprise', price: 'Custom', desc: 'Custom integrations' },
              ].map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => handlePlanSelect(plan.id as 'starter' | 'growth' | 'enterprise')}
                  disabled={checkoutLoading}
                  className={`w-full text-left p-4 rounded-lg border-2 transition ${
                    plan.popular
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{plan.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{plan.desc}</p>
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-white">{plan.price}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Setup;
