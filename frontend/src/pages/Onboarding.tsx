import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { useNotification } from '../hooks/useNotification';

const STEPS = [
  { id: 1, title: 'Connect Stripe', desc: 'Sync your invoices' },
  { id: 2, title: 'Review Invoices', desc: 'See what needs recovery' },
  { id: 3, title: 'Configure Dunning', desc: 'Set email strategy' },
  { id: 4, title: 'Enable Agent', desc: 'Start autonomous recovery' },
  { id: 5, title: 'Set up Slack', desc: 'Get daily updates' },
];

const Onboarding: React.FC = () => {
  useEffect(() => { document.title = 'Get Started — RecoverAI'; }, []);
  const navigate = useNavigate();
  const { addToast } = useNotification();

  const [step, setStep] = useState(1);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [invoiceCount, setInvoiceCount] = useState<number | null>(null);
  const [dunningEmails, setDunningEmails] = useState(5);
  const [agentEnabled, setAgentEnabled] = useState(false);
  const [slackWebhook, setSlackWebhook] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if Stripe already connected
    api.get<{ data: { integrations?: { stripe?: boolean } } }>(API_ENDPOINTS.settings.get)
      .then((res) => {
        if (res.data?.integrations?.stripe) {
          setStripeConnected(true);
        }
      }).catch(() => {});
  }, []);

  const handleStripeConnect = () => {
    const STRIPE_CLIENT_ID = import.meta.env.VITE_STRIPE_CLIENT_ID;
    if (!STRIPE_CLIENT_ID) {
      addToast({ type: 'error', message: 'Stripe Client ID not configured' });
      return;
    }
    const params = new URLSearchParams({
      client_id: STRIPE_CLIENT_ID,
      response_type: 'code',
      scope: 'read_write',
      redirect_uri: 'http://localhost:3000/api/stripe/oauth/exchange',
      state: 'onboarding',
    });
    window.location.href = `https://connect.stripe.com/oauth/v2/authorize?${params.toString()}`;
  };

  const handleSyncAndNext = async () => {
    setLoading(true);
    try {
      await api.post(API_ENDPOINTS.stripe.sync);
      const res = await api.get<{ total: number }>(API_ENDPOINTS.invoices.list);
      setInvoiceCount((res as any).total || 0);
      setStep(2);
    } catch {
      addToast({ type: 'error', message: 'Failed to sync invoices' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDunning = async () => {
    setLoading(true);
    try {
      await api.put(API_ENDPOINTS.settings.dunning, { num_emails: dunningEmails });
      setStep(4);
    } catch {
      addToast({ type: 'error', message: 'Failed to save dunning settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleEnableAgent = async () => {
    setLoading(true);
    try {
      // Agent runs on cron — enabling just confirms the user wants it
      setAgentEnabled(true);
      addToast({ type: 'success', message: 'Agent is now active! It runs every 6 hours.' });
      setTimeout(() => setStep(5), 800);
    } catch {
      addToast({ type: 'error', message: 'Failed to enable agent' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSlack = async () => {
    if (!slackWebhook.trim()) { setStep(5); navigate('/dashboard'); return; }
    setLoading(true);
    try {
      await api.put(API_ENDPOINTS.settings.slack, { webhookUrl: slackWebhook });
      addToast({ type: 'success', message: 'Slack connected!' });
      navigate('/dashboard');
    } catch {
      addToast({ type: 'error', message: 'Invalid Slack webhook URL' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold">R</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Set up RecoverAI</h1>
          <p className="text-sm text-gray-500 mt-1">Complete setup to start recovering invoices automatically</p>
        </div>

        {/* Step Progress */}
        <div className="flex items-center justify-between mb-8 px-2">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  s.id < step
                    ? 'bg-green-500 text-white'
                    : s.id === step
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                }`}>
                  {s.id < step ? '✓' : s.id}
                </div>
                <span className={`text-xs mt-1 hidden sm:block ${s.id === step ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                  {s.title}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-1 ${s.id < step ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8">

          {/* Step 1: Connect Stripe */}
          {step === 1 && (
            <div>
              <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900 flex items-center justify-center mb-4">
                <span className="text-purple-600 font-bold text-xl">S</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Connect Stripe</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                We'll pull all your unpaid invoices and start tracking them. Takes 30 seconds.
              </p>
              {!stripeConnected ? (
                <Button onClick={handleStripeConnect} className="w-full mb-3">
                  Connect with Stripe OAuth
                </Button>
              ) : (
                <div className="mb-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg p-3 text-sm">
                  Stripe is already connected!
                </div>
              )}
              {stripeConnected && (
                <Button onClick={handleSyncAndNext} className="w-full" loading={loading}>
                  Sync invoices and continue
                </Button>
              )}
              <button onClick={() => setStep(2)} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 mt-3">
                Skip — I'll connect later
              </button>
            </div>
          )}

          {/* Step 2: Review Invoices */}
          {step === 2 && (
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-4 text-2xl">
                📊
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Review your invoices</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                {invoiceCount !== null
                  ? `We found ${invoiceCount} invoices. The agent will prioritize by risk score.`
                  : 'The agent will scan your invoices and assign risk scores 0-100.'}
              </p>
              <div className="space-y-3 mb-6">
                {[
                  { label: 'Risk scoring', desc: 'AI assigns 0-100 score per invoice', done: true },
                  { label: 'Customer history', desc: 'Analyzes payment patterns', done: true },
                  { label: 'Priority queue', desc: 'High-risk invoices first', done: true },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="text-green-500 font-bold text-sm">{item.done ? '✓' : '○'}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button onClick={() => setStep(3)} className="w-full">Continue to email setup</Button>
              <button onClick={() => navigate('/invoices')} className="w-full text-center text-sm text-blue-600 hover:underline mt-3">
                View all invoices
              </button>
            </div>
          )}

          {/* Step 3: Configure Dunning */}
          {step === 3 && (
            <div>
              <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900 flex items-center justify-center mb-4 text-2xl">
                ✉️
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Configure dunning emails</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                How many emails should the agent send per invoice before escalating?
              </p>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Number of dunning emails: <span className="text-blue-600 font-bold">{dunningEmails}</span>
                </label>
                <input
                  type="range" min={2} max={7} value={dunningEmails}
                  onChange={(e) => setDunningEmails(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>2 (minimal)</span>
                  <span>5 (recommended)</span>
                  <span>7 (aggressive)</span>
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6 text-sm text-blue-700 dark:text-blue-300">
                <strong>Recommended:</strong> 5 emails — friendly reminder, overdue notice, payment plan offer, formal notice, final escalation.
              </div>
              <Button onClick={handleSaveDunning} className="w-full" loading={loading}>
                Save and continue
              </Button>
              <button onClick={() => setStep(4)} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 mt-3">
                Use default settings
              </button>
            </div>
          )}

          {/* Step 4: Enable Agent */}
          {step === 4 && (
            <div>
              <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4 text-2xl">
                🤖
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Enable the agent</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                The RecoverAI agent runs every 6 hours, scans all unpaid invoices, and autonomously sends the right email at the right time.
              </p>
              <div className="space-y-3 mb-6">
                {[
                  'Scans all unpaid invoices every 6 hours',
                  'Sends personalized emails based on risk score',
                  'Auto-offers payment plans to high-risk customers',
                  'Stops automatically when invoice is paid',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="text-green-500">✓</span> {item}
                  </div>
                ))}
              </div>
              {!agentEnabled ? (
                <Button onClick={handleEnableAgent} className="w-full" loading={loading}>
                  Enable autonomous agent
                </Button>
              ) : (
                <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg p-4 text-sm text-center font-medium">
                  Agent is active! First cycle starts within 6 hours.
                </div>
              )}
              <button onClick={() => setStep(5)} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 mt-3">
                Skip — I'll enable later
              </button>
            </div>
          )}

          {/* Step 5: Slack */}
          {step === 5 && (
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-4 text-2xl">
                💬
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Connect Slack (optional)</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                Get daily recovery digests and real-time payment alerts in your Slack channel.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Slack Webhook URL
                </label>
                <input
                  type="url"
                  value={slackWebhook}
                  onChange={(e) => setSlackWebhook(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Create a webhook at api.slack.com/apps → Incoming Webhooks
                </p>
              </div>
              <Button onClick={handleSaveSlack} className="w-full" loading={loading}>
                {slackWebhook.trim() ? 'Connect Slack and finish' : 'Skip and go to dashboard'}
              </Button>
            </div>
          )}
        </div>

        {/* Bottom skip */}
        {step < 5 && (
          <p className="text-center mt-4">
            <button onClick={() => navigate('/dashboard')} className="text-sm text-gray-400 hover:text-gray-600">
              Skip setup — go straight to dashboard
            </button>
          </p>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
