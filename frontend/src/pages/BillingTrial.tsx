import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { TrialCountdown } from '../components/TrialCountdown';
import { UpgradeCard } from '../components/dashboard/UpgradeCard';

const BillingTrial: React.FC = () => {
  useEffect(() => {
    document.title = 'Billing — CashOS';
  }, []);

  const navigate = useNavigate();
  const { company } = useAuth();

  return (
    <div className="bg-white dark:bg-[#09090b] py-8 px-4 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">Billing</h1>
          <p className="text-base text-gray-600 dark:text-gray-400">
            Your free trial details and upgrade options
          </p>
        </div>

        <div className="space-y-6">
          {/* Trial Countdown Banner */}
          <TrialCountdown
            trialEndsAt={company?.trial_ends_at || undefined}
            onUpgrade={() => navigate('/pricing')}
          />

          {/* What You're Getting Summary */}
          <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Your Free Trial Includes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { icon: '💰', title: 'Cash Visibility', desc: 'Real-time balance updates' },
                { icon: '📊', title: '13-Week Forecast', desc: 'Predict runway & cash needs' },
                { icon: '🎯', title: 'Scenario Testing', desc: 'What-if analysis for growth' },
                { icon: '💸', title: 'Payables Tracker', desc: 'Manage bills & expenses' },
                { icon: '📧', title: 'Daily Email Digest', desc: 'Cash summary each morning' },
              ].map((item) => (
                <div key={item.title} className="p-4 bg-gray-50 dark:bg-white/[0.02] rounded-lg text-center">
                  <div className="text-3xl mb-2">{item.icon}</div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm mb-1">{item.title}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{item.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-6">
              ✅ <strong>No credit card required.</strong> Full access for 14 days. No hidden fees.
            </p>
          </div>

          {/* Upgrade CTA Card */}
          <UpgradeCard onUpgrade={() => navigate('/pricing')} />
        </div>
      </div>
    </div>
  );
};

export default BillingTrial;
