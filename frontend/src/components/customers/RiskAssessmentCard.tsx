import React from 'react';

interface RiskFactor {
  icon: string;
  reason: string;
  severity: 'high' | 'medium' | 'low';
}

interface RiskTrend {
  current: number;
  previous: number;
  direction: 'up' | 'down' | 'stable';
  points: number;
}

interface RiskAssessmentCardProps {
  riskScore: number;
  riskFactors: RiskFactor[];
  riskTrend: RiskTrend;
}

const getSeverityColor = (severity: 'high' | 'medium' | 'low') => {
  switch (severity) {
    case 'high':
      return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800';
    case 'medium':
      return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800';
    case 'low':
      return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800';
  }
};

const getRiskLevelColor = (score: number) => {
  if (score >= 75) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950';
  return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950';
};

const getRiskLevel = (score: number): string => {
  if (score >= 75) return 'High';
  if (score >= 50) return 'Medium';
  return 'Low';
};

export const RiskAssessmentCard: React.FC<RiskAssessmentCardProps> = ({
  riskScore,
  riskFactors,
  riskTrend,
}) => {
  if (riskScore === 0 && riskFactors.length === 0) {
    return null; // Don't show if no risk
  }

  return (
    <div className="px-6 py-6 border-t border-gray-200 dark:border-gray-700">
      <div className="max-w-4xl">
        {/* Score Badge */}
        <div className={`inline-block rounded-lg p-4 mb-6 ${getRiskLevelColor(riskScore)}`}>
          <div className="text-2xl font-bold">{riskScore}/100</div>
          <div className="text-sm font-medium mt-1">{getRiskLevel(riskScore)} Risk</div>
        </div>

        {/* Risk Factors */}
        {riskFactors.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              Risk Factors
            </h3>
            <div className="space-y-2">
              {riskFactors.map((factor, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg p-3 border flex items-start gap-3 ${getSeverityColor(factor.severity)}`}
                >
                  <span className="text-lg mt-0.5">{factor.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{factor.reason}</p>
                    <p className="text-xs opacity-75 capitalize">{factor.severity} severity</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trend */}
        {riskTrend.previous > 0 && (
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="flex-1">
                <p className="text-gray-600 dark:text-gray-400">
                  Risk trend: <span className="font-semibold text-gray-900 dark:text-white">{riskTrend.previous}</span> →{' '}
                  <span className="font-semibold text-gray-900 dark:text-white">{riskTrend.current}</span>
                </p>
                {riskTrend.direction === 'up' && (
                  <p className="text-red-600 dark:text-red-400 text-xs mt-1 flex items-center gap-1">
                    <span>↗️</span>
                    Getting riskier (+{riskTrend.points} points)
                  </p>
                )}
                {riskTrend.direction === 'down' && (
                  <p className="text-green-600 dark:text-green-400 text-xs mt-1 flex items-center gap-1">
                    <span>↘️</span>
                    Improving ({riskTrend.points} points)
                  </p>
                )}
                {riskTrend.direction === 'stable' && (
                  <p className="text-blue-600 dark:text-blue-400 text-xs mt-1">Stable (no change)</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
