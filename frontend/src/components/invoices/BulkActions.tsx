import React from 'react';
import { Button } from '../ui/Button';

interface BulkActionsProps {
  onSync: () => void;
  onScheduleEmails: () => void;
  syncing?: boolean;
  scheduling?: boolean;
  selectedCount?: number;
  onMarkPaid?: () => void;
  onClearSelection?: () => void;
}

export const BulkActions: React.FC<BulkActionsProps> = ({
  onSync, onScheduleEmails, syncing, scheduling, selectedCount = 0, onMarkPaid, onClearSelection,
}) => {
  if (selectedCount > 0) {
    return (
      <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg px-3 py-1.5">
        <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">{selectedCount} selected</span>
        <div className="w-px h-4 bg-indigo-300 dark:bg-indigo-600" />
        <Button size="sm" variant="primary" onClick={onMarkPaid}>Mark Paid</Button>
        <Button size="sm" variant="ghost" onClick={onClearSelection}>Clear</Button>
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
