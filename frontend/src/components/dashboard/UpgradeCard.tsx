import React from 'react';
import { Button } from '../ui/Button';

interface UpgradeCardProps {
  onUpgrade?: () => void;
}

export const UpgradeCard: React.FC<UpgradeCardProps> = ({ onUpgrade }) => {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-8">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          🚀 Ready to Go Deeper?
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Unlock QuickBooks integration, team access, and advanced reporting
        </p>

        {/* Features */}
        <div className="space-y-3 mb-8">
          <div className="flex items-start gap-3">
            <span className="text-green-600 dark:text-green-400 mt-0.5">✅</span>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">QB Sync</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Auto-sync payables from QuickBooks</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-green-600 dark:text-green-400 mt-0.5">✅</span>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Team Access</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Invite CFO or co-founder to collaborate</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-green-600 dark:text-green-400 mt-0.5">✅</span>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Advanced Reports</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Custom dates, PDF export, and scheduling</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-green-600 dark:text-green-400 mt-0.5">✅</span>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Email Dunning</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Payment reminders and invoice tracking</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-green-600 dark:text-green-400 mt-0.5">✅</span>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">API Access</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Build custom integrations and automations</p>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white dark:bg-white/5 rounded-lg p-4 mb-6 text-center">
          <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
            $3,500<span className="text-lg text-gray-600 dark:text-gray-400">/month</span>
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Or <strong>$1,000 for first month</strong> if you commit 3 months
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
          <Button
            variant="primary"
            onClick={onUpgrade}
            className="w-full sm:w-auto"
          >
            Upgrade to SEED Tier →
          </Button>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            30-min setup call available (free)
          </p>
        </div>
      </div>
    </div>
  );
};

export default UpgradeCard;
