import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { api } from '../../lib/api';
import type { Invoice } from '../../types';

interface Props {
  invoice: Invoice;
  onUpdate: () => void;
  loading?: boolean;
}

export const InvoiceDunningControls: React.FC<Props> = ({
  invoice,
  onUpdate,
  loading = false,
}) => {
  const { addToast } = useNotification();
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseDays, setPauseDays] = useState('7');
  const [pausing, setPausing] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  const handlePause = async () => {
    if (!pauseDays || parseInt(pauseDays) < 1) {
      addToast({ type: 'error', message: 'Please enter a valid number of days' });
      return;
    }

    setPausing(true);
    try {
      await api.post(`/api/invoices/${invoice.id}/dunning/pause`, {
        days: parseInt(pauseDays),
      });
      addToast({ type: 'success', message: `Dunning paused for ${pauseDays} days` });
      setShowPauseModal(false);
      setPauseDays('7');
      onUpdate();
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to pause dunning' });
    } finally {
      setPausing(false);
    }
  };

  const handleResume = async () => {
    setResuming(true);
    try {
      await api.post(`/api/invoices/${invoice.id}/dunning/resume`, {});
      addToast({ type: 'success', message: 'Dunning resumed' });
      onUpdate();
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to resume dunning' });
    } finally {
      setResuming(false);
    }
  };

  const handleStop = async () => {
    setStopping(true);
    try {
      await api.delete(`/api/invoices/${invoice.id}/dunning`);
      addToast({ type: 'success', message: 'Dunning stopped permanently' });
      setShowStopConfirm(false);
      onUpdate();
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to stop dunning' });
    } finally {
      setStopping(false);
    }
  };

  // Dunning stopped permanently
  if ((invoice as any).dunning_stopped) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
        <p className="text-sm font-semibold text-red-900 dark:text-red-200">
          🛑 Dunning Stopped Permanently
        </p>
        <p className="text-xs text-red-800 dark:text-red-300 mt-1">
          This invoice will not receive any dunning communications.
        </p>
      </div>
    );
  }

  // Dunning paused
  const pausedUntil = (invoice as any).dunning_paused_until;
  if (pausedUntil && new Date(pausedUntil) > new Date()) {
    const formatDate = (date: string) => {
      return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    };

    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
              ⏸️ Paused Until {formatDate(pausedUntil)}
            </p>
            <p className="text-xs text-blue-800 dark:text-blue-300 mt-1">
              Dunning will resume automatically on this date.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleResume}
            loading={resuming}
            disabled={loading}
          >
            ▶️ Resume Now
          </Button>
        </div>
      </div>
    );
  }

  // Dunning active - show pause/stop controls
  return (
    <div className="space-y-3 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
      <p className="text-sm font-medium text-gray-900 dark:text-white">Dunning Controls</p>

      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowPauseModal(true)}
          disabled={loading}
          className="w-full"
        >
          ⏸️ Pause
        </Button>

        <Button
          variant="danger"
          size="sm"
          onClick={() => setShowStopConfirm(true)}
          disabled={loading}
          className="w-full"
        >
          🛑 Stop
        </Button>
      </div>

      {/* Pause Modal */}
      {showPauseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#09090b] rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Pause Dunning
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pause for how many days?
                </label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={pauseDays}
                  onChange={(e) => setPauseDays(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="7"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Between 1 and 180 days
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowPauseModal(false)}
                  disabled={pausing}
                  className="flex-1 px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  Cancel
                </button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handlePause}
                  loading={pausing}
                  disabled={!pauseDays || parseInt(pauseDays) < 1}
                  className="flex-1"
                >
                  Pause
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stop Confirmation Modal */}
      {showStopConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#09090b] rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Stop Dunning Permanently?
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              This invoice will not receive any dunning communications. This action cannot be undone.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowStopConfirm(false)}
                disabled={stopping}
                className="flex-1 px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleStop}
                loading={stopping}
                className="flex-1"
              >
                Stop Dunning
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
