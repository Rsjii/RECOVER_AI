import React from 'react';

interface TrialRisksProps {
  trialData: any;
}

const TrialRisks: React.FC<TrialRisksProps> = ({ trialData }) => {
  if (!trialData.risks || trialData.risks.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">⚠️ Top Risks</h2>
      <div className="space-y-3">
        {trialData.risks.map((risk: any, idx: number) => (
          <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-white/[0.02] rounded-lg">
            <div className="mt-0.5">
              {risk.severity === 'critical' && <div className="w-3 h-3 rounded-full bg-red-600" />}
              {risk.severity === 'high' && <div className="w-3 h-3 rounded-full bg-orange-600" />}
              {risk.severity === 'medium' && <div className="w-3 h-3 rounded-full bg-yellow-600" />}
              {risk.severity === 'low' && <div className="w-3 h-3 rounded-full bg-blue-600" />}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-white">{risk.title}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{risk.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrialRisks;
