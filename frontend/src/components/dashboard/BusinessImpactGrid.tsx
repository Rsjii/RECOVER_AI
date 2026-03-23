import React, { useState } from 'react';
import AgingAnalysisChart from './AgingAnalysisChart';
import EmailAnalyticsRow from './EmailAnalyticsRow';
import PaymentPlansSummary from './PaymentPlansSummary';

interface BusinessImpactGridProps {
  aging?: any;
  emailAnalytics?: any;
  plansSummary?: any;
  loading?: boolean;
}

export const BusinessImpactGrid: React.FC<BusinessImpactGridProps> = ({
  aging,
  emailAnalytics,
  plansSummary,
  loading = false,
}) => {
  const [expandedSections, setExpandedSections] = useState({
    aging: true,
    campaign: true,
    plans: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-3 md:gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-80 bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* A/R Aging */}
      <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('aging')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
        >
          <div className="text-left">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">A/R Aging</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Unpaid invoices by days outstanding</p>
          </div>
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.aging ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
        {expandedSections.aging && <AgingAnalysisChart buckets={aging?.buckets ?? []} totalAr={aging?.totalAr ?? 0} loading={loading} hideHeader={true} />}
      </div>

      {/* Campaign Performance */}
      <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('campaign')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors border-b border-gray-200 dark:border-white/[0.06]"
        >
          <div className="text-left">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Dunning Campaign Performance</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Email engagement metrics</p>
          </div>
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.campaign ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
        {expandedSections.campaign && <div className="px-4 pb-4"><EmailAnalyticsRow analytics={emailAnalytics} loading={loading} hideHeader={true} /></div>}
      </div>

      {/* Payment Plans */}
      <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('plans')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors border-b border-gray-200 dark:border-white/[0.06]"
        >
          <div className="text-left">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Payment Plans</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Active, completed, and defaulted plans</p>
          </div>
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandedSections.plans ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
        {expandedSections.plans && <div className="px-4 pb-4"><PaymentPlansSummary summary={plansSummary} loading={loading} hideHeader={true} /></div>}
      </div>
    </>
  );
};

export default BusinessImpactGrid;
