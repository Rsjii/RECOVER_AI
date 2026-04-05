import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useNotification } from '../../hooks/useNotification';

interface AutomationSectionProps {
  pilotMode?: string;
  onPilotModeChange?: (mode: string) => void;
}

export const AutomationSection: React.FC<AutomationSectionProps> = ({
  pilotMode = 'auto',
  onPilotModeChange,
}) => {
  const navigate = useNavigate();
  const { addToast } = useNotification();
  const [selectedMode, setSelectedMode] = useState(pilotMode);
  const [isSaving, setIsSaving] = useState(false);

  const handleModeChange = async (mode: string) => {
    setSelectedMode(mode);
    setIsSaving(true);
    try {
      await api.put('/api/settings/pilot-mode', { pilot_mode: mode });
      addToast({ message: `Mode changed to ${mode}`, type: 'success' });
      onPilotModeChange?.(mode);
    } catch (error) {
      addToast({ message: 'Failed to update automation mode', type: 'error' });
      setSelectedMode(pilotMode);
    } finally {
      setIsSaving(false);
    }
  };

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

      {/* Automation Mode Selection */}
      <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Agent Mode
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Choose how the AI agent handles dunning emails. In shadow mode, all emails queue for your review before sending.
        </p>

        <div className="space-y-3">
          {/* Auto Mode */}
          <label className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 dark:border-white/[0.06] cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
            <input
              type="radio"
              name="pilot_mode"
              value="auto"
              checked={selectedMode === 'auto'}
              onChange={(e) => handleModeChange(e.target.value)}
              disabled={isSaving}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 dark:text-white">✨ Auto Mode</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Agent automatically sends all dunning emails without manual approval
              </div>
            </div>
          </label>

          {/* Shadow Mode */}
          <label className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 dark:border-white/[0.06] cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
            <input
              type="radio"
              name="pilot_mode"
              value="shadow"
              checked={selectedMode === 'shadow'}
              onChange={(e) => handleModeChange(e.target.value)}
              disabled={isSaving}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 dark:text-white">🔍 Shadow Mode (Review)</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                All emails queue for your review. Approve or reject before sending
              </div>
            </div>
          </label>

          {/* Paused Mode */}
          <label className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 dark:border-white/[0.06] cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
            <input
              type="radio"
              name="pilot_mode"
              value="paused"
              checked={selectedMode === 'paused'}
              onChange={(e) => handleModeChange(e.target.value)}
              disabled={isSaving}
              className="mt-1"
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 dark:text-white">⏸ Paused</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Pause all agent actions temporarily. No emails or SMS will be sent
              </div>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};
