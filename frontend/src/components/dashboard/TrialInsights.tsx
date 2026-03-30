import React from 'react';

interface TrialInsightsProps {
  trialData: any;
}

const TrialInsights: React.FC<TrialInsightsProps> = ({ trialData }) => {
  if (!trialData.insights || trialData.insights.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">💡 AI Insights</h2>
      <ul className="space-y-2">
        {trialData.insights.map((insight: string, idx: number) => (
          <li key={idx} className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
            <span className="text-blue-600 dark:text-blue-400 mt-0.5">→</span>
            <span>{insight}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TrialInsights;
