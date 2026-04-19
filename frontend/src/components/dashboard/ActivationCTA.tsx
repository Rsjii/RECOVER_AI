import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import { useNotification } from '../../hooks/useNotification';

interface ActivationCTAProps {
  pilotMode?: string | null;
  totalAR?: number;
  eligibleInvoices?: number;
  onAgentActivated?: () => void;
}

export const ActivationCTA: React.FC<ActivationCTAProps> = ({
  pilotMode,
  totalAR = 0,
  eligibleInvoices = 0,
  onAgentActivated,
}) => {
  const { addToast } = useNotification();
  const [loading, setLoading] = useState(false);

  // Show only if:
  // 1. Pilot mode is 'shadow' (user hasn't activated yet)
  // 2. There are invoices to process
  if (pilotMode !== 'shadow' || eligibleInvoices === 0) {
    return null;
  }

  const handleActivate = async () => {
    setLoading(true);
    try {
      await api.post('/api/dashboard/agent/trigger');
      addToast({
        type: 'success',
        message: '🚀 Agent activated! First emails will be sent in the next 6 hours.',
      });
      if (onAgentActivated) {
        onAgentActivated();
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to activate agent',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            🚀 Ready to recover ${totalAR.toLocaleString()}?
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            You have {eligibleInvoices} eligible invoices waiting. Activate autonomous dunning to start sending AI-powered recovery emails.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <li>✓ AI-generated personalized emails</li>
            <li>✓ Automated every 6 hours</li>
            <li>✓ Full email tracking (opens, clicks)</li>
          </ul>
        </div>
        <Button
          onClick={handleActivate}
          loading={loading}
          disabled={loading}
          size="lg"
          className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
          data-tour="cta-button"
        >
          {loading ? 'Activating...' : 'Activate Agent'}
        </Button>
      </div>
    </div>
  );
};

export default ActivationCTA;
