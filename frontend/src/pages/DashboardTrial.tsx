import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { DashboardSkeleton } from '../components/ui/Skeleton';
import { TrialCountdown } from '../components/TrialCountdown';
import { CollapsibleSection } from '../components/dashboard/CollapsibleSection';
import { PayablesTracker } from '../components/dashboard/PayablesTracker';
import { WeeklyUpdateForm } from '../components/dashboard/WeeklyUpdateForm';
import { UpgradeCard } from '../components/dashboard/UpgradeCard';
import TrialCashHero from '../components/dashboard/TrialCashHero';
import TrialBillingIssues from '../components/dashboard/TrialBillingIssues';
import TrialForecastChart from '../components/dashboard/TrialForecastChart';
import TrialRisksAndInsights from '../components/dashboard/TrialRisksAndInsights';

const DashboardTrial: React.FC = () => {
  const navigate = useNavigate();
  const [trialData, setTrialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Dashboard — CashOS';
  }, []);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/api/dashboard/trial-analysis');
        setTrialData(res.data);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!trialData) return null;

  return (
    <div className="bg-white dark:bg-[#09090b] min-h-full">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
      </div>

      <div className="max-w-7xl mx-auto px-6 sm:px-8 pb-12 flex flex-col space-y-6">
        {/* SECTION 1: Trial Countdown Banner */}
        <TrialCountdown trialEndsAt={trialData.trial_ends_at} onUpgrade={() => navigate('/pricing')} />

        {/* SECTION 2: Cash Position Hero */}
        <TrialCashHero trialData={trialData} />

        {/* SECTION 3: Billing Issues (if any) */}
        <TrialBillingIssues billingErrors={trialData.billing_errors} />

        {/* SECTION 4: Payables Tracker */}
        <CollapsibleSection title="💸 Payables & Bills" defaultOpen={true}>
          <PayablesTracker />
        </CollapsibleSection>

        {/* SECTION 5: Weekly Update Form */}
        <CollapsibleSection title="📊 Adjust Forecast" defaultOpen={false}>
          <WeeklyUpdateForm />
        </CollapsibleSection>

        {/* SECTIONS 6 & 7: 13-Week Forecast Chart + Scenarios */}
        <TrialForecastChart
          runwayDays={trialData.runway_days || 0}
          availableCash={trialData.available_cash || 0}
          trend={trialData.trend}
        />

        {/* SECTION 8: Risks & Insights */}
        <TrialRisksAndInsights risks={trialData.risks || []} insights={trialData.insights || []} />

        {/* SECTION 9: Invoice Health (Read-Only) */}
        <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/10 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📋 Invoice Health (Read-Only)</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Invoiced</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                ${Math.round((trialData.total_invoiced || 0) / 1000)}K
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Unpaid AR</div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                ${Math.round((trialData.overdue_ar || 0) / 1000)}K
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Days Sales Outstanding</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {trialData.avg_days_late || 0}d
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Billing Errors</div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                ${Math.round(((trialData.billing_errors?.total_at_risk || 0)) / 1000)}K
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            💡 This is read-only in trial. Upgrade for dunning and collections.
          </p>
        </div>

        {/* SECTION 10: Upgrade Card */}
        <UpgradeCard onUpgrade={() => navigate('/pricing')} />
      </div>
    </div>
  );
};

export default DashboardTrial;
