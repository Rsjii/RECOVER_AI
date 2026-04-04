import React from 'react';
import { Button } from '../ui/Button';
import { useNavigate } from 'react-router-dom';

export const AutomationSection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Automation & Advanced
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Manage email queue, automation workflows, and advanced settings.
        </p>
      </div>

      {/* Email Queue Card */}
      <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Email Queue
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Review, approve, or reject pending dunning emails before they're sent. Manage the approval workflow for your company's outreach.
            </p>
            <div className="text-sm text-gray-500 dark:text-gray-500 space-y-1">
              <p>✓ Preview emails before sending</p>
              <p>✓ Batch approve or reject</p>
              <p>✓ Track pending & sent emails</p>
            </div>
          </div>
          <Button
            onClick={() => navigate('/email-queue')}
            className="shrink-0 whitespace-nowrap"
          >
            View Email Queue
          </Button>
        </div>
      </div>

      {/* Placeholder for future automation features */}
      <div className="bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6 text-center">
        <svg className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">
          More automation features coming soon
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-500">
          Webhook triggers, custom workflows, and advanced integrations.
        </p>
      </div>
    </div>
  );
};
