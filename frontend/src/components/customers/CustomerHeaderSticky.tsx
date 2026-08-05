import React from 'react';
import { Trash2, TrendingUp, DollarSign } from 'lucide-react';

interface CustomerHeaderStickyProps {
  customerName: string;
  companyName: string;
  totalAR: number;
  riskScore: number;
  onDelete?: () => void;
}

export const CustomerHeaderSticky: React.FC<CustomerHeaderStickyProps> = ({
  companyName,
  totalAR,
  riskScore,
  onDelete,
}) => {

  return (
    <div className="sticky top-0 z-40 bg-white dark:bg-slate-950 border-b border-gray-200 dark:border-slate-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex items-center justify-between gap-6">
          {/* Left: Company Name */}
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex-shrink-0">{companyName}</h1>

          {/* Right: Metrics */}
          <div className="flex items-center gap-4 flex-shrink-0">
              {/* Total AR Metric */}
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-blue-25 dark:from-blue-950 dark:to-blue-900 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm">
                <div className="flex-shrink-0 p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded">
                  <DollarSign size={16} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Total AR</div>
                  <div className="text-lg font-bold text-blue-900 dark:text-blue-200">€{totalAR.toLocaleString()}</div>
                </div>
              </div>

              {/* Risk Score Metric */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border shadow-sm bg-gradient-to-r ${
                riskScore >= 75
                  ? 'from-red-50 to-red-25 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800'
                  : riskScore >= 50
                  ? 'from-amber-50 to-amber-25 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800'
                  : 'from-green-50 to-green-25 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800'
              }`}>
                <div className={`flex-shrink-0 p-1.5 rounded ${
                  riskScore >= 75
                    ? 'bg-red-100 dark:bg-red-900/50'
                    : riskScore >= 50
                    ? 'bg-amber-100 dark:bg-amber-900/50'
                    : 'bg-green-100 dark:bg-green-900/50'
                }`}>
                  <TrendingUp size={16} className={
                    riskScore >= 75
                      ? 'text-red-600 dark:text-red-400'
                      : riskScore >= 50
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-green-600 dark:text-green-400'
                  } />
                </div>
                <div>
                  <div className={`text-xs font-semibold uppercase tracking-wide ${
                    riskScore >= 75
                      ? 'text-red-600 dark:text-red-400'
                      : riskScore >= 50
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}>Risk Score</div>
                  <div className={`text-lg font-bold ${
                    riskScore >= 75
                      ? 'text-red-900 dark:text-red-200'
                      : riskScore >= 50
                      ? 'text-amber-900 dark:text-amber-200'
                      : 'text-green-900 dark:text-green-200'
                  }`}>{riskScore}/100</div>
                </div>
              </div>
            </div>

          {/* Right: Delete Button */}
          <button
            onClick={onDelete}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition border border-transparent hover:border-red-200 dark:hover:border-red-800 flex-shrink-0"
            title="Delete customer"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
