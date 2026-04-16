/**
 * ModeSwitchDialog Component
 * Modal for switching between SHADOW and AUTO modes with pending email handling
 */

import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { api } from '../lib/api';

interface ModeSwitchDialogProps {
  currentMode: 'shadow' | 'auto';
  onClose: () => void;
  onSwitch: (newMode: 'shadow' | 'auto', action: 'approve' | 'reject' | 'delete') => Promise<void>;
}

export const ModeSwitchDialog: React.FC<ModeSwitchDialogProps> = ({ currentMode, onClose, onSwitch }) => {
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedAction, setSelectedAction] = useState<'approve' | 'reject' | null>(null);
  const [switching, setSwitching] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const res = await api.get<{ data: { pendingCount: number; mode: string } }>('/api/settings/email-mode');
        if (res?.data?.pendingCount !== undefined) {
          setPendingCount(res.data.pendingCount);
        }
      } catch (err) {
        console.error('Failed to fetch pending count:', err);
        setPendingCount(0); // Default to 0 on error
      }
    };

    fetchPendingCount();
  }, []);

  const newMode = currentMode === 'shadow' ? 'auto' : 'shadow';

  const handleSelectAction = () => {
    // If no pending emails, just switch directly (no action needed)
    if (pendingCount === 0) {
      handleDirectSwitch();
      return;
    }
    // If pending emails, need to select an action first
    if (selectedAction) {
      setShowConfirmation(true);
    }
  };

  const handleDirectSwitch = async () => {
    setSwitching(true);
    try {
      // When no pending emails, use 'approve' as dummy action (not used by backend)
      await onSwitch(newMode, 'approve');
    } finally {
      setSwitching(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedAction) return;
    setSwitching(true);
    try {
      await onSwitch(newMode, selectedAction);
    } finally {
      setSwitching(false);
    }
  };

  const handleBack = () => {
    setShowConfirmation(false);
  };

  if (showConfirmation && selectedAction) {
    const actionDescriptions = {
      approve: {
        icon: '✅',
        title: 'Approve All Pending Emails',
        description: `All ${pendingCount} pending email${pendingCount !== 1 ? 's' : ''} will be sent immediately, then mode will switch to ${newMode === 'shadow' ? 'SHADOW (Review)' : 'AUTO (Autonomous)'}`,
        warning: 'This action cannot be undone. Emails will be sent to your customers.',
      },
      reject: {
        icon: '🚫',
        title: 'Reject All Pending Emails',
        description: `All ${pendingCount} pending email${pendingCount !== 1 ? 's' : ''} will be rejected and blocked for 7 days. You can approve them again after 7 days.`,
        warning: 'Your customers will not receive these emails. The mode will switch to ' + (newMode === 'shadow' ? 'SHADOW (Review)' : 'AUTO (Autonomous)'),
      },
    };

    const action = actionDescriptions[selectedAction];

    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full shadow-xl">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {action.icon} {action.title}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">
              Please confirm this action
            </p>
          </div>

          <div className="p-6 space-y-5">
            {/* Action Description */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-900/40">
              <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">
                {action.description}
              </p>
            </div>

            {/* Warning */}
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-900/40">
              <p className="text-sm font-bold text-red-700 dark:text-red-400">
                ⚠️ Warning
              </p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-2">
                {action.warning}
              </p>
            </div>
          </div>

          <div className="p-6 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
            <Button variant="outline" onClick={handleBack} disabled={switching}>
              Back
            </Button>
            <Button variant="primary" onClick={handleConfirm} disabled={switching} className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800">
              {switching ? 'Processing...' : `Yes, ${selectedAction === 'approve' ? 'approve & switch' : 'reject & switch'}`}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full shadow-xl">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Switch Email Mode</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            Currently in {currentMode === 'shadow' ? '🔒 SHADOW' : '🤖 AUTO'} mode
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Mode Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              {newMode === 'shadow'
                ? '🔒 SHADOW MODE: You will review and approve each email before sending'
                : '🤖 AUTO MODE: Agent will generate and send emails automatically every 6 hours'}
            </p>
          </div>

          {/* Pending Emails Warning */}
          {pendingCount > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-900/40">
              <p className="text-sm font-bold text-yellow-700 dark:text-yellow-400">
                ⚠️ You have {pendingCount} pending email{pendingCount !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-2">
                You must choose what to do with them before switching:
              </p>
            </div>
          )}

          {/* Action Selection - NO DEFAULT */}
          {pendingCount > 0 && (
            <div className="space-y-3">
              <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                selectedAction === 'approve'
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-green-300'
              }`}>
                <input
                  type="radio"
                  value="approve"
                  checked={selectedAction === 'approve'}
                  onChange={(e) => setSelectedAction(e.target.value as any)}
                  className="mr-3"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">✅ Approve All & Switch</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Send all {pendingCount} email{pendingCount !== 1 ? 's' : ''} now</p>
                </div>
              </label>

              <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                selectedAction === 'reject'
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-orange-300'
              }`}>
                <input
                  type="radio"
                  value="reject"
                  checked={selectedAction === 'reject'}
                  onChange={(e) => setSelectedAction(e.target.value as any)}
                  className="mr-3"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">🚫 Reject All & Switch</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Block for 7 days (can re-approve later)</p>
                </div>
              </label>

            </div>
          )}

          {pendingCount === 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-green-700 dark:text-green-400 text-sm font-medium">
              ✅ No pending emails to handle
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={switching}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSelectAction}
            disabled={(pendingCount > 0 && !selectedAction) || switching}
            className={(pendingCount > 0 && !selectedAction) ? 'opacity-50 cursor-not-allowed' : ''}
          >
            {switching ? 'Switching...' : (pendingCount === 0 ? `Switch to ${newMode === 'shadow' ? 'SHADOW' : 'AUTO'}` : 'Next: Confirm Action')}
          </Button>
        </div>
      </div>
    </div>
  );
};
