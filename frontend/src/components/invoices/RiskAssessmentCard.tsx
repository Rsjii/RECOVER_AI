import React from 'react';
import { Card } from '../ui/Card';
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';

interface Props {
  riskScore: number | null;
  daysOverdue: number;
  reliability: number | null;
  isHighRisk?: boolean;
}

export const RiskAssessmentCard: React.FC<Props> = ({ riskScore, daysOverdue, reliability }) => {
  const getRiskColor = (score: number | null) => {
    if (!score) return 'gray';
    if (score >= 80) return 'red';
    if (score >= 50) return 'amber';
    return 'green';
  };

  const color = getRiskColor(riskScore);
  const colorMap = {
    red: 'bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-200 border border-red-200 dark:border-red-800',
    amber: 'bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800',
    green: 'bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-200 border border-green-200 dark:border-green-800',
    gray: 'bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-gray-200 border border-gray-200 dark:border-slate-700',
  };

  const riskFactors = [
    { icon: <AlertTriangle size={18} />, label: 'Days overdue', value: daysOverdue >= 90, condition: daysOverdue >= 90, color: 'red' },
    { icon: <TrendingDown size={18} />, label: 'Declining reliability', value: reliability !== null && reliability < 80, condition: reliability !== null && reliability < 80, color: 'amber' },
    { icon: <TrendingUp size={18} />, label: 'Historical payment record', value: reliability !== null && reliability >= 80, condition: reliability !== null && reliability >= 80, color: 'green' },
  ];

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <AlertTriangle size={20} className="text-blue-600 dark:text-blue-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Risk Assessment</h3>
      </div>

      <div className={`p-6 rounded-xl mb-6 ${colorMap[color]}`}>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-75">Risk Score</p>
        <p className="text-4xl font-bold mt-3">{riskScore ? Math.round(riskScore) : 'N/A'} <span className="text-lg opacity-75">/100</span></p>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Risk Factors</p>
        <ul className="space-y-2">
          {riskFactors.map((factor, idx) => (
            factor.condition && (
              <li key={idx} className={`flex items-start gap-3 p-3 rounded-lg border ${
                factor.color === 'red' ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300' :
                factor.color === 'amber' ? 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300' :
                'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
              }`}>
                <span className="flex-shrink-0 mt-0.5">{factor.icon}</span>
                <span className="text-sm font-medium">
                  {factor.label}
                </span>
              </li>
            )
          ))}
        </ul>
      </div>
    </Card>
  );
};
