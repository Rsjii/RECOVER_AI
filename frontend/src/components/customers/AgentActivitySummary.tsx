import React from 'react';
import { useNavigate } from 'react-router-dom';

interface AgentActivityData {
  emailsSent30d: number;
  emailsOpened: number;
  emailsBounced: number;
  smsSent30d: number;
  smsDelivered: number;
  lastActionDate: string | null;
  lastActionType: 'email' | 'sms' | null;
}

interface AgentActivitySummaryProps {
  agentActivity: AgentActivityData;
  customerId: string;
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

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subtext?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subtext }) => (
  <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4 text-center">
    <div className="flex justify-center mb-2 text-lg">{icon}</div>
    <p className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">{label}</p>
    <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    {subtext && <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">{subtext}</p>}
  </div>
);

export const AgentActivitySummary: React.FC<AgentActivitySummaryProps> = ({ agentActivity, customerId }) => {
  const navigate = useNavigate();

  const emailOpenRate =
    agentActivity.emailsSent30d > 0
      ? Math.round((agentActivity.emailsOpened / agentActivity.emailsSent30d) * 100)
      : 0;

  const hasActivity = agentActivity.emailsSent30d > 0 || agentActivity.smsSent30d > 0;

  if (!hasActivity) {
    return (
      <div className="px-6 py-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Agent Activity (Last 30 Days)</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">No agent activity yet</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Agent Activity (Last 30 Days)</h3>
        <button
          onClick={() => navigate(`/activity?customer=${customerId}`)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
        >
          View Full
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon="📧"
          label="Emails Sent"
          value={agentActivity.emailsSent30d}
          subtext={`${agentActivity.emailsBounced} bounced`}
        />

        <StatCard
          icon="👁️"
          label="Open Rate"
          value={`${emailOpenRate}%`}
          subtext={`${agentActivity.emailsOpened} opened`}
        />

        <StatCard
          icon="💬"
          label="SMS Sent"
          value={agentActivity.smsSent30d}
          subtext={`${agentActivity.smsDelivered} delivered`}
        />

        <StatCard
          icon="🕐"
          label="Last Action"
          value={formatDate(agentActivity.lastActionDate)}
          subtext={agentActivity.lastActionType ? `Via ${agentActivity.lastActionType.toUpperCase()}` : undefined}
        />
      </div>

      {/* Insights */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4">
        <p className="text-xs font-medium text-blue-900 dark:text-blue-200">
          {agentActivity.emailsSent30d > 0 && agentActivity.smsSent30d > 0
            ? `Agent sent ${agentActivity.emailsSent30d + agentActivity.smsSent30d} messages (${agentActivity.emailsSent30d} email, ${agentActivity.smsSent30d} SMS) over the last 30 days.`
            : agentActivity.emailsSent30d > 0
              ? `Agent sent ${agentActivity.emailsSent30d} dunning emails over the last 30 days.`
              : `Agent sent ${agentActivity.smsSent30d} SMS messages over the last 30 days.`}
        </p>
      </div>
    </div>
  );
};
