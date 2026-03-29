import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface DemoPreview {
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

const EMAIL_TYPE_LABELS: Record<string, string> = {
  dunning_1: 'Friendly reminder',
  dunning_2: 'Overdue notice',
  dunning_3: 'Urgent — payment plan offered',
  dunning_4: 'Formal notice',
  dunning_5: 'Final escalation',
  payment_plan_offer: 'Payment plan offer',
};

const RISK_COLOR = (score: number) =>
  score >= 80 ? 'text-red-600 bg-red-50 dark:bg-red-900/20'
  : score >= 50 ? 'text-orange-600 bg-orange-50 dark:bg-orange-900/20'
  : 'text-green-600 bg-green-50 dark:bg-green-900/20';

const DemoLaunch: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'choose' | 'loading' | 'preview'>('choose');
  const [preview, setPreview] = useState<DemoPreview | null>(null);
  const [error, setError] = useState('');
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    document.title = 'Try CashOS Demo';
  }, []);

  const handleSampleDemo = async () => {
    setLaunching(true);
    setError('');
    setStep('loading');
    try {
      await api.post('/api/demo/login');
      // Mark as demo in localStorage so Dashboard can detect it even after re-renders
      localStorage.setItem('isDemo', 'true');
      // Then load preview so they see what agent would do
      const res = await api.post<DemoPreview>('/api/demo/preview');
      setPreview(res);
      setStep('preview');
    } catch (err: any) {
      setError(err.message || 'Failed to load demo');
      setStep('choose');
    } finally {
      setLaunching(false);
    }
  };

  const handleEnterDashboard = () => {
    // Navigate to dashboard with replace to clear demo-launch from history
    navigate('/dashboard', { replace: true });
  };

  const handleSignup = () => {
    navigate('/signup');
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-[#09090b]">
        <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center mb-6">
          <span className="text-white font-bold text-lg">R</span>
        </div>
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-600 dark:text-gray-400 text-sm">Setting up demo + running agent preview...</p>
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Agent Preview — Acme SaaS Demo</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              This is what CashOS's agent would send if you approved it now.
              <span className="font-medium text-blue-600"> No emails were sent.</span>
            </p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-4 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{preview.invoicesScanned}</div>
              <div className="text-xs text-gray-500 mt-1">Invoices scanned</div>
            </div>
            <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{preview.emailsWouldQueue}</div>
              <div className="text-xs text-gray-500 mt-1">Emails ready to send</div>
            </div>
            <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{preview.plansWouldOffer}</div>
              <div className="text-xs text-gray-500 mt-1">Payment plans offered</div>
            </div>
            <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                ${preview.estimatedRecoveryUsd.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-1">Est. recovery (30%)</div>
            </div>
          </div>

          {/* Preview list */}
          {preview.previews.length > 0 && (
            <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] mb-8">
              <div className="p-4 border-b border-gray-200 dark:border-white/[0.06]">
                <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
                  Emails agent would send ({preview.previews.length})
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">These are pending your approval — nothing sent yet</p>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {preview.previews.slice(0, 8).map((item) => (
                  <div key={`${item.invoiceId}-${item.emailType}`} className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{item.customerName}</div>
                      <div className="text-xs text-gray-500 truncate">{item.recipientEmail}</div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-gray-500">{item.daysOverdue}d overdue</span>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        ${item.amount.toLocaleString()}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RISK_COLOR(item.riskScore)}`}>
                        Risk {item.riskScore}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-white/[0.03] text-gray-600 dark:text-gray-300">
                        {EMAIL_TYPE_LABELS[item.emailType] || item.emailType}
                      </span>
                    </div>
                  </div>
                ))}
                {preview.previews.length > 8 && (
                  <div className="p-3 text-center text-xs text-gray-500">
                    +{preview.previews.length - 8} more in dashboard
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CTA section */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-6 text-center">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Want to see the full dashboard?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Explore live charts, risk scores, invoice detail, and recovery reports with Acme SaaS demo data.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleEnterDashboard}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
              >
                Explore Demo Dashboard →
              </button>
              <button
                onClick={handleSignup}
                className="bg-white dark:bg-[#111113] border border-gray-300 dark:border-white/[0.08] text-gray-700 dark:text-gray-300 text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors"
              >
                Start with my Stripe data
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Beta pilot: $500 for 2 weeks · Full: $2,500/mo + 1% recovery ·{' '}
            <a href="/pricing" className="underline hover:text-gray-600">See pricing</a>
          </p>
        </div>
      </div>
    );
  }

  // Default: choose screen
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090b] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mb-6">
        <span className="text-white font-bold text-xl">R</span>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 text-center">
        See CashOS in action
      </h1>
      <p className="text-gray-500 dark:text-gray-400 text-center mb-10 max-w-md">
        Autonomous AR agent for SaaS — recovers unpaid invoices with zero manual work.
      </p>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm px-4 py-3 rounded-lg max-w-sm text-center">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 w-full max-w-2xl">
        {/* Option A: Sample Demo */}
        <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🎭</span>
            <span className="font-semibold text-gray-900 dark:text-white">Sample Data Demo</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 flex-1 mb-4">
            Explore Acme SaaS — a pre-built company with 8 customers, 23 invoices, and real agent output.
            Instant. No signup needed.
          </p>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5 mb-6">
            <li className="flex items-center gap-1.5"><span className="text-green-500">✓</span> Risk scores + overdue breakdown</li>
            <li className="flex items-center gap-1.5"><span className="text-green-500">✓</span> Email previews (AI-generated)</li>
            <li className="flex items-center gap-1.5"><span className="text-green-500">✓</span> Recovery timeline chart</li>
            <li className="flex items-center gap-1.5"><span className="text-green-500">✓</span> Agent preview (what would send)</li>
          </ul>
          <button
            onClick={handleSampleDemo}
            disabled={launching}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            {launching ? 'Loading...' : 'Try Sample Demo →'}
          </button>
        </div>

        {/* Option B: Real Data */}
        <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🔗</span>
            <span className="font-semibold text-gray-900 dark:text-white">Preview My Data</span>
            <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 px-2 py-0.5 rounded-full font-medium">Beta</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 flex-1 mb-4">
            Connect your Stripe account. We'll analyse your unpaid invoices and show exactly what the agent
            would send — before touching anything.
          </p>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5 mb-6">
            <li className="flex items-center gap-1.5"><span className="text-green-500">✓</span> Your real invoices + customers</li>
            <li className="flex items-center gap-1.5"><span className="text-green-500">✓</span> AI risk scoring on your data</li>
            <li className="flex items-center gap-1.5"><span className="text-green-500">✓</span> Zero emails sent until you approve</li>
            <li className="flex items-center gap-1.5"><span className="text-blue-500">→</span> $500 pilot to activate sending</li>
          </ul>
          <button
            onClick={handleSignup}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            Connect Stripe →
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-8 text-center">
        Pricing: $2,500/mo base + 1% recovery · No setup fee ·{' '}
        <a href="/pricing" className="underline hover:text-gray-600">Full pricing</a>
      </p>
    </div>
  );
};

export default DemoLaunch;
