import React from 'react';
import { Button } from '../ui/Button';

interface BulkActionsProps {
  onSync: () => void;
  onScheduleEmails: () => void;
  syncing?: boolean;
  scheduling?: boolean;
  selectedCount?: number;
  onMarkPaid?: () => void;
  onDeleteSelected?: () => void;
  onClearSelection?: () => void;
  deletingCount?: number;
  markingPaidCount?: number;
}

export const BulkActions: React.FC<BulkActionsProps> = ({
  onSync, onScheduleEmails, syncing, scheduling, selectedCount = 0, onMarkPaid, onDeleteSelected, onClearSelection, deletingCount = 0, markingPaidCount = 0,
}) => {
  const isProcessing = deletingCount > 0 || markingPaidCount > 0;
  const isDemo = typeof window !== 'undefined' && localStorage.getItem('isDemo') === 'true';

  if (selectedCount > 0 || isProcessing) {
    return (
      <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg px-3 py-1.5">
        <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
          {deletingCount > 0 ? `Deleting ${deletingCount}/${selectedCount}...` : markingPaidCount > 0 ? `Marking ${markingPaidCount}/${selectedCount}...` : `${selectedCount} selected`}
        </span>
        <div className="w-px h-4 bg-indigo-300 dark:bg-indigo-600" />
        {/* Demo mode: disable Mark Paid and Delete buttons */}
        <Button size="sm" variant="primary" onClick={onMarkPaid} disabled={isProcessing || isDemo} loading={markingPaidCount > 0}>Mark Paid</Button>
        {onDeleteSelected && <Button size="sm" variant="ghost" onClick={onDeleteSelected} disabled={isProcessing || isDemo} className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50">Delete</Button>}
        <Button size="sm" variant="ghost" onClick={onClearSelection} disabled={isProcessing}>Clear</Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="primary" onClick={onSync} loading={syncing}>Sync Stripe</Button>
      <Button size="sm" variant="secondary" onClick={onScheduleEmails} loading={scheduling}>Run Agent</Button>
    </div>
  );
};
