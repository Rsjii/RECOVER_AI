import React from 'react';
import { useTheme } from '../../hooks/useTheme';

interface AgentDecisionProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  riskScore: number;
  invoiceAmount: number;
  daysOverdue: number;
  paymentPattern: {
    onTimeRate: number;
    avgDaysLate: number;
    totalInvoices: number;
    totalPaid: number;
  };
  agentDecision: {
    dunningTier: string;
    tone: string;
    reasoning: string;
  };
  nextAction: string;
}

export const AgentDecisionModal: React.FC<AgentDecisionProps> = ({
  isOpen,
  onClose,
  companyName,
  riskScore,
  invoiceAmount,
  daysOverdue,
  paymentPattern,
  agentDecision,
  nextAction,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (!isOpen) return null;

  const riskLevel = riskScore >= 80 ? 'CRITICAL' : riskScore >= 60 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW';
  const riskColor = riskScore >= 80 ? 'text-red-600 dark:text-red-400' :
                    riskScore >= 60 ? 'text-orange-600 dark:text-orange-400' :
                    riskScore >= 40 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400';
  const riskBg = riskScore >= 80 ? 'bg-red-50 dark:bg-red-950' :
                 riskScore >= 60 ? 'bg-orange-50 dark:bg-orange-950' :
                 riskScore >= 40 ? 'bg-yellow-50 dark:bg-yellow-950' : 'bg-green-50 dark:bg-green-950';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col`}>
        {/* Header - Compact */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-xl flex-shrink-0">🤖</div>
            <div className="min-w-0">
              <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Agent Decision
              </h2>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} truncate`}>
                {companyName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-lg transition-colors flex-shrink-0 ml-2 ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Risk Assessment - Compact */}
          <div className={`${riskBg} rounded-lg p-3`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>📊 Risk Assessment</h3>
              <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${riskColor}`}>
                {riskLevel}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Risk Score</p>
                <p className={`text-lg font-bold ${riskColor}`}>{riskScore}/100</p>
              </div>
              <div>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Days Late</p>
                <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{daysOverdue}d</p>
              </div>
              <div>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Amount</p>
                <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>${(invoiceAmount / 1000).toFixed(0)}K</p>
              </div>
            </div>
          </div>

          {/* Customer Pattern - Compact */}
          <div>
            <h3 className={`text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>💼 Payment Pattern</h3>
            <div className="grid grid-cols-4 gap-2">
              <div className={`p-2 rounded-lg text-center ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>On-Time</p>
                <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{paymentPattern.onTimeRate}%</p>
              </div>
              <div className={`p-2 rounded-lg text-center ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Avg Late</p>
                <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{paymentPattern.avgDaysLate}d</p>
              </div>
              <div className={`p-2 rounded-lg text-center ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Invoices</p>
                <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{paymentPattern.totalInvoices}</p>
              </div>
              <div className={`p-2 rounded-lg text-center ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total</p>
                <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>${(paymentPattern.totalPaid / 1000).toFixed(0)}K</p>
              </div>
            </div>
          </div>

          {/* Agent Decision - Compact */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
            <h3 className={`text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>⚡ Agent Decision</h3>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className={`text-xs font-semibold uppercase ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Tier</p>
                  <p className={`font-bold text-blue-600 dark:text-blue-400`}>{agentDecision.dunningTier}</p>
                </div>
                <div>
                  <p className={`text-xs font-semibold uppercase ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Tone</p>
                  <p className={`font-bold capitalize ${isDark ? 'text-white' : 'text-gray-900'}`}>{agentDecision.tone}</p>
                </div>
              </div>
              <div>
                <p className={`text-xs font-semibold uppercase ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-1`}>Why</p>
                <p className={`text-xs leading-snug ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {agentDecision.reasoning}
                </p>
              </div>
            </div>
          </div>

          {/* Next Action - Compact */}
          <div className={`${isDark ? 'bg-blue-950 border-blue-800' : 'bg-blue-50 border-blue-200'} border rounded-lg p-2`}>
            <p className={`text-xs font-semibold uppercase ${isDark ? 'text-blue-400' : 'text-blue-600'} mb-1`}>📅 Next</p>
            <p className={`text-xs ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>
              {nextAction}
            </p>
          </div>
        </div>

        {/* Footer - Compact */}
        <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} p-3 flex justify-end`}>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
