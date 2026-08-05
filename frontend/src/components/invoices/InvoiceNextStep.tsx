import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { formatDate } from '../../lib/utils';
import { CheckCircle, AlertCircle, StopCircle } from 'lucide-react';
import type { DunningStatus } from '../../types';

interface AgentDecision {
  id: string;
  decision_type: string;
  metadata?: Record<string, any>;
  created_at: string;
  reason?: string;
}

interface Props {
  dunningStatus: DunningStatus;
  agentDecisions: AgentDecision[];
  onApprove?: () => void;
  onSendSMS?: () => void;
  loading?: boolean;
}

export const InvoiceNextStep: React.FC<Props> = ({
  dunningStatus,
  agentDecisions,
  onApprove,
  onSendSMS,
  loading = false,
}) => {
  const lastDecision = agentDecisions?.[0];
  const isPaused = dunningStatus?.isPaused;
  const isStopped = dunningStatus?.isStopped;

  if (isStopped) {
    return (
      <Card className="p-6 mb-6 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 border-l-4 border-red-500">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
            <StopCircle size={24} className="text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg text-red-900 dark:text-red-200">Collection Stopped</h3>
            <p className="text-sm text-red-800 dark:text-red-300 mt-1">No further recovery attempts will be made for this invoice.</p>
          </div>
        </div>
      </Card>
    );
  }

  if (isPaused) {
    return (
      <Card className="p-6 mb-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-l-4 border-amber-500">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
            <AlertCircle size={24} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg text-amber-900 dark:text-amber-200">Collection Paused</h3>
            <p className="text-sm text-amber-800 dark:text-amber-300 mt-2">
              Resumes on <span className="font-semibold">{dunningStatus.pausedUntil ? formatDate(new Date(dunningStatus.pausedUntil)) : 'scheduled date'}</span>
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (!dunningStatus.nextEmailType && !dunningStatus.nextScheduledDate) {
    return (
      <Card className="p-6 mb-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-l-4 border-green-500">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
            <CheckCircle size={24} className="text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg text-green-900 dark:text-green-200">All Actions Complete</h3>
            <p className="text-sm text-green-800 dark:text-green-300 mt-1">No further dunning attempts are scheduled for this invoice.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 mb-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-l-4 border-blue-500">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-2">Recommended Action</p>
            <h3 className="text-2xl font-bold text-blue-900 dark:text-blue-200">
              {dunningStatus.nextEmailType?.replace(/_/g, ' ')}
            </h3>
          </div>
          {dunningStatus.nextScheduledDate && (
            <div className="text-right">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">Scheduled</p>
              <p className="text-sm font-bold text-blue-900 dark:text-blue-200">
                Tomorrow 9:00 AM
              </p>
            </div>
          )}
        </div>

        {/* Decision Rationale */}
        {lastDecision?.metadata && (
          <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-3">Why This Action</p>
            <div className="space-y-2">
              {lastDecision.metadata.emails_sent !== undefined && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-900 dark:text-blue-200">Emails sent so far</span>
                  <span className="font-bold text-blue-900 dark:text-blue-200">
                    {lastDecision.metadata.emails_sent}
                    {lastDecision.metadata.avg_emails_needed && ` / ${lastDecision.metadata.avg_emails_needed}`}
                  </span>
                </div>
              )}
              {lastDecision.metadata.gap_days && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-900 dark:text-blue-200">Days since last attempt</span>
                  <span className="font-bold text-blue-900 dark:text-blue-200">{lastDecision.metadata.gap_days} days</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            variant="primary"
            onClick={onApprove}
            disabled={loading}
            className="flex items-center justify-center gap-2"
          >
            <CheckCircle size={18} />
            Approve & Send
          </Button>
          <Button
            variant="secondary"
            onClick={onSendSMS}
            disabled={loading}
            className="flex items-center justify-center gap-2"
          >
            Send SMS Instead
          </Button>
        </div>
      </div>
    </Card>
  );
};
