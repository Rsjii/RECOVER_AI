import React from 'react';
import { Button } from '../ui/Button';

interface BulkActionsProps {
  onSync: () => void;
  onScheduleEmails: () => void;
  syncing?: boolean;
  scheduling?: boolean;
}

export const BulkActions: React.FC<BulkActionsProps> = ({ onSync, onScheduleEmails, syncing, scheduling }) => (
  <div className="flex gap-2">
    <Button size="sm" variant="primary" onClick={onSync} loading={syncing}>Sync Stripe</Button>
    <Button size="sm" variant="secondary" onClick={onScheduleEmails} loading={scheduling}>Run Agent</Button>
  </div>
);