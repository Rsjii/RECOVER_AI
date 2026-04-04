import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { useNotification } from '../hooks/useNotification';

type SelectedPlan = 'phase_0' | 'growth';

const PlanSelection: React.FC = () => {
  useEffect(() => {
    document.title = 'Choose Your Plan — RecoverAI';
  }, []);

  const navigate = useNavigate();
  const { addToast } = useNotification();

  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan>('phase_0');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    setLoading(true);
    try {
      // Update user's plan preference in backend
      await api.post(API_ENDPOINTS.settings.get, {
        planCode: selectedPlan,
      }).catch(() => {
        // If endpoint doesn't exist, that's fine - proceed anyway
      });

      // Redirect to onboarding
      navigate('/onboarding', { replace: true });
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err?.response?.data?.error || 'Failed to save plan selection',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Skip plan selection, proceed with free trial
    navigate('/onboarding', { replace: true });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">R</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Welcome to RecoverAI
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Choose your plan and start recovering revenue
          </p>
        </div>

        {/* Trial Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <span className="font-semibold">Pilot Program:</span> You have 14 days free access. No credit card charged. After that, we'll discuss custom pricing based on your results.
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Phase 0 - Free Trial */}
          <div
            onClick={() => setSelectedPlan('phase_0')}
            className={`relative rounded-2xl border-2 p-8 cursor-pointer transition-all ${
              selectedPlan === 'phase_0'
                ? 'border-brand-600 bg-brand-50 dark:bg-brand-600/10'
                : 'border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#111113] hover:border-gray-300 dark:hover:border-white/[0.15]'
            }`}
          >
            {selectedPlan === 'phase_0' && (
              <div className="absolute top-0 right-6 -translate-y-1/2">
                <span className="bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Selected
                </span>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Pilot Program
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">14 days free to explore</p>
            </div>

            <div className="mb-6">
              <div className="text-4xl font-bold text-gray-900 dark:text-white">$0</div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">14 days free (pilot)</p>
            </div>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-3">
                <span className="text-emerald-600 dark:text-emerald-400 text-lg">✓</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">AI-powered dunning emails</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-600 dark:text-emerald-400 text-lg">✓</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">Risk scoring & analytics</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-600 dark:text-emerald-400 text-lg">✓</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">Stripe integration</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-600 dark:text-emerald-400 text-lg">✓</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">Up to 200 invoices/month</span>
              </li>
            </ul>

            <div
              className={`text-sm font-medium text-center p-3 rounded-lg transition-colors ${
                selectedPlan === 'phase_0'
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 dark:bg-white/[0.05] text-gray-700 dark:text-gray-300'
              }`}
            >
              {selectedPlan === 'phase_0' ? '✓ Selected' : 'Select Plan'}
            </div>
          </div>

          {/* Growth Plan */}
          <div
            onClick={() => setSelectedPlan('growth')}
            className={`relative rounded-2xl border-2 p-8 cursor-pointer transition-all ring-2 ring-brand-600/20 ${
              selectedPlan === 'growth'
                ? 'border-brand-600 bg-brand-50 dark:bg-brand-600/10'
                : 'border-brand-600/50 bg-white dark:bg-[#111113] hover:border-brand-600'
            }`}
          >
            {selectedPlan === 'growth' && (
              <div className="absolute top-0 right-6 -translate-y-1/2">
                <span className="bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Selected
                </span>
              </div>
            )}

            {selectedPlan !== 'growth' && (
              <div className="absolute top-0 right-6 -translate-y-1/2">
                <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Most Popular
                </span>
              </div>
            )}

            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Growth
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">For scaling teams</p>
            </div>

            <div className="mb-6">
              <div className="text-4xl font-bold text-gray-900 dark:text-white">
                $2,500<span className="text-lg font-normal text-gray-600 dark:text-gray-400">/mo</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">+ 1-5% on recovery</p>
            </div>

            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-3">
                <span className="text-emerald-600 dark:text-emerald-400 text-lg">✓</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">Everything in Free Trial</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-600 dark:text-emerald-400 text-lg">✓</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">SMS dunning messages</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-600 dark:text-emerald-400 text-lg">✓</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">Payment plan offers</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-600 dark:text-emerald-400 text-lg">✓</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">QuickBooks sync</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-600 dark:text-emerald-400 text-lg">✓</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">Priority support</span>
              </li>
            </ul>

            <div
              className={`text-sm font-medium text-center p-3 rounded-lg transition-colors ${
                selectedPlan === 'growth'
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 dark:bg-white/[0.05] text-gray-700 dark:text-gray-300'
              }`}
            >
              {selectedPlan === 'growth' ? '✓ Selected' : 'Select Plan'}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            variant="primary"
            size="lg"
            onClick={handleContinue}
            loading={loading}
            disabled={loading}
            className="w-full"
          >
            Continue with {selectedPlan === 'phase_0' ? 'Free Trial' : 'Growth'}
          </Button>
          <button
            onClick={handleSkip}
            className="w-full text-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-medium transition py-2"
          >
            Decide later
          </button>
        </div>

        {/* Footer */}
        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-8">
          You can change your plan anytime in Settings → Billing
        </p>
      </div>
    </div>
  );
};

export default PlanSelection;
