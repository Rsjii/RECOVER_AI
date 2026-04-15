/**
 * ModeSwitchDialog Component
 * Modal for switching between SHADOW and AUTO modes with pending email handling
 */

import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';

interface ModeSwitchDialogProps {
  currentMode: 'shadow' | 'auto';
  onClose: () => void;
  onSwitch: (newMode: 'shadow' | 'auto', action: 'approve' | 'reject' | 'delete') => Promise<void>;
}

export const ModeSwitchDialog: React.FC<ModeSwitchDialogProps> = ({ currentMode, onClose, onSwitch }) => {
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedAction, setSelectedAction] = useState<'approve' | 'reject' | 'delete'>('delete');
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const res = await fetch('/api/settings/email-mode');
        if (res.ok) {
          const data = await res.json();
          setPendingCount(data.data.pendingCount);
        }
      } catch (err) {
        console.error('Failed to fetch pending count:', err);
      }
    };

    fetchPendingCount();
  }, []);

  const newMode = currentMode === 'shadow' ? 'auto' : 'shadow';

  const handleSwitch = async () => {
    setSwitching(true);
    try {
      await onSwitch(newMode, selectedAction);
    } finally {
      setSwitching(false);
    }
  };

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
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                ⚠️ You have {pendingCount} pending email{pendingCount !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                Choose what to do with them:
              </p>
            </div>
          )}

          {/* Action Selection */}
          {pendingCount > 0 && (
            <div className="space-y-3">
              <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                <input
                  type="radio"
                  value="delete"
                  checked={selectedAction === 'delete'}
                  onChange={(e) => setSelectedAction(e.target.value as any)}
                  className="mr-3"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">❌ Delete & Switch</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Remove all pending emails</p>
                </div>
              </label>

              <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                <input
                  type="radio"
                  value="reject"
                  checked={selectedAction === 'reject'}
                  onChange={(e) => setSelectedAction(e.target.value as any)}
                  className="mr-3"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">🚫 Reject & Switch</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Reject for 7 days (can approve again later)</p>
                </div>
              </label>

              <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                <input
                  type="radio"
                  value="approve"
                  checked={selectedAction === 'approve'}
                  onChange={(e) => setSelectedAction(e.target.value as any)}
                  className="mr-3"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">✅ Approve All & Switch</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Send all pending emails now, then switch mode</p>
                </div>
              </label>
            </div>
          )}

          {pendingCount === 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-green-700 dark:text-green-400 text-sm">
              ✅ No pending emails to handle
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={switching}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSwitch} disabled={switching}>
            {switching ? 'Switching...' : `Switch to ${newMode === 'shadow' ? 'SHADOW' : 'AUTO'}`}
          </Button>
        </div>
      </div>
    </div>
  );
};
