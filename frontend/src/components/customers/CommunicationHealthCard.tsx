import React from 'react';

interface CommunicationHealthData {
  emailStatus: 'working' | 'bouncing' | 'unknown';
  emailBounceRate: number;
  smsOptedIn: boolean;
  phone: string | null;
  lastEmailDate: string | null;
  lastSmsDate: string | null;
  canReach: boolean;
}

interface CommunicationHealthCardProps {
  communicationHealth: CommunicationHealthData;
}

const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
};

export const CommunicationHealthCard: React.FC<CommunicationHealthCardProps> = ({
  communicationHealth,
}) => {
  if (!communicationHealth.lastEmailDate && !communicationHealth.smsOptedIn) {
    return null; // Don't show if no contact info
  }

  return (
    <div className="px-6 py-6 border-t border-gray-200 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Communication Health</h3>

      <div className="space-y-3">
        {/* Email Status */}
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-lg">
              {communicationHealth.emailStatus === 'working' && <span>✅</span>}
              {communicationHealth.emailStatus === 'bouncing' && <span>⚠️</span>}
              {communicationHealth.emailStatus === 'unknown' && <span>❌</span>}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <span>📧</span>
                Email
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {communicationHealth.emailStatus === 'working' &&
                  `✓ Working (${communicationHealth.emailBounceRate}% bounce rate)`}
                {communicationHealth.emailStatus === 'bouncing' &&
                  `⚠ Bouncing (${communicationHealth.emailBounceRate}% bounce rate)`}
                {communicationHealth.emailStatus === 'unknown' && 'No email activity'}
              </p>
              {communicationHealth.lastEmailDate && (
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Last email: {formatDate(communicationHealth.lastEmailDate)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* SMS Status */}
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-lg">
              {communicationHealth.smsOptedIn && <span>✅</span>}
              {!communicationHealth.smsOptedIn && <span>❌</span>}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <span>📱</span>
                SMS
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {communicationHealth.smsOptedIn && communicationHealth.phone
                  ? `✓ Opted in (${communicationHealth.phone})`
                  : '✗ Not opted in or no phone number'}
              </p>
            </div>
          </div>
        </div>

        {/* Overall Reach Status */}
        {communicationHealth.canReach && (
          <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-3">
            <p className="text-xs text-green-700 dark:text-green-300 font-medium">
              ✓ Can reach via email or SMS
            </p>
          </div>
        )}
        {!communicationHealth.canReach && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-3">
            <p className="text-xs text-red-700 dark:text-red-300 font-medium">
              ⚠ Cannot reach reliably (email bouncing, SMS not available)
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
