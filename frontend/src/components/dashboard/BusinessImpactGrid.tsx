import React from 'react';
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

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-80 bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {/* Collections (Aging) */}
        <div className="relative bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
          <AgingAnalysisChart buckets={aging?.buckets ?? []} totalAr={aging?.totalAr ?? 0} loading={loading} />
        </div>

        {/* Campaign Performance */}
        <div className="relative bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
          <EmailAnalyticsRow analytics={emailAnalytics} loading={loading} />
        </div>

        {/* Payment Plans */}
        <div className="relative bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
          <PaymentPlansSummary summary={plansSummary} loading={loading} />
        </div>
      </div>
    </>
  );
};

export default BusinessImpactGrid;
