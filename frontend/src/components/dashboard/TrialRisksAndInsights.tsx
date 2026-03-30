import React from 'react';
import { CollapsibleSection } from './CollapsibleSection';

interface Risk {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
}

interface TrialRisksAndInsightsProps {
  risks: Risk[];
  insights: string[];
}

const TrialRisksAndInsights: React.FC<TrialRisksAndInsightsProps> = ({ risks, insights }) => {
  if (!risks || risks.length === 0) {
    if (!insights || insights.length === 0) {
      return null;
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#dc2626';
      case 'high':
        return '#ea580c';
      case 'medium':
        return '#ca8a04';
      default:
        return '#2563eb';
    }
  };

  const getSeverityEmoji = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '🔴';
      case 'high':
        return '🟠';
      case 'medium':
        return '🟡';
      default:
        return '🔵';
    }
  };

  return (
    <CollapsibleSection title="⚠️ Top Risks & Insights" defaultOpen={true}>
      <div className="space-y-4">
        {/* Risks */}
        {risks && risks.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Risks Found</p>
            <div className="space-y-2">
              {risks.map((risk, idx) => (
                <div
                  key={idx}
                  className="bg-gray-50 dark:bg-slate-900 rounded-lg p-3 border-l-4"
                  style={{ borderColor: getSeverityColor(risk.severity) }}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg mt-0.5">{getSeverityEmoji(risk.severity)}</span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{risk.title}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{risk.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Insights */}
        {insights && insights.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">💡 AI Insights</p>
            <div className="space-y-2">
              {insights.map((insight, idx) => (
                <div key={idx} className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="text-gray-400 dark:text-gray-500">→</span>
                  <p>{insight}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};

export default TrialRisksAndInsights;
