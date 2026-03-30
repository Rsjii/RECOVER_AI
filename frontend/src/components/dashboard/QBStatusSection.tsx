import React from 'react';

interface QBStatusSectionProps {
  isConnected?: boolean;
  lastSyncedAt?: string;
  syncedInvoiceCount?: number;
}

export const QBStatusSection: React.FC<QBStatusSectionProps> = ({
  isConnected = false,
  lastSyncedAt = '',
  syncedInvoiceCount = 0,
}) => {
  return (
    <div className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">🔄 QB Integration Status</h2>
        <span
          className={`text-xs font-semibold px-3 py-1 rounded-full ${
            isConnected
              ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
              : 'bg-gray-100 dark:bg-white/[0.08] text-gray-700 dark:text-gray-300'
          }`}
        >
          {isConnected ? '✅ Connected' : '⚪ Not Connected'}
        </span>
      </div>

      {isConnected ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-white/[0.02] rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Status</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">Syncing Active</p>
            </div>
            <div className="bg-gray-50 dark:bg-white/[0.02] rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Last Synced</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                {lastSyncedAt || 'Just now'}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-white/[0.02] rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Synced Payables</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">{syncedInvoiceCount}</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
            💡 QB payables are syncing automatically. Your bills and expenses are kept in sync.
          </p>
        </div>
      ) : (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Connect QuickBooks to auto-sync your payables and get more accurate cash forecasts.
          </p>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
            Connect QB
          </button>
        </div>
      )}
    </div>
  );
};
