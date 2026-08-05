import React from 'react';
import { Card } from '../ui/Card';
import { formatDate } from '../../lib/utils';

interface AgentDecision {
  id: string;
  decision_type: string;
  email_type?: string;
  dunning_tier?: string;
  escalation_reason?: string;
  metadata?: Record<string, any>;
  created_at: string;
  reason?: string;
}

interface Props {
  decisions: AgentDecision[];
}

export const AgentDecisionsSection: React.FC<Props> = ({ decisions }) => {
  if (!decisions || decisions.length === 0) {
    return null;
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">🤖 Agent Decisions (Last {decisions.length})</h3>
      <div className="space-y-3">
        {decisions.map((decision) => (
          <div key={decision.id} className="p-4 border dark:border-gray-700 rounded-lg">
            <div className="flex items-start justify-between mb-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {decision.decision_type.replace(/_/g, ' ').toUpperCase()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(decision.created_at)}</p>
            </div>

            {decision.email_type && (
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">Email: {decision.email_type}</p>
            )}

            {decision.reason && (
              <p className="text-sm text-gray-600 dark:text-gray-400">{decision.reason}</p>
            )}

            {decision.metadata && Object.keys(decision.metadata).length > 0 && (
              <details className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                <summary className="cursor-pointer font-semibold">Metadata</summary>
                <pre className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded overflow-x-auto text-xs">
                  {JSON.stringify(decision.metadata, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};
