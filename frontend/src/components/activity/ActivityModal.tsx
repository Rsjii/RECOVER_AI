import React, { useState } from 'react';
import { formatDate } from '../../lib/utils';
import { Button } from '../ui/Button';

interface ActivityModalProps {
  isOpen: boolean;
  state: 'pending' | 'sent' | 'paused' | 'stopped';
  item: any;
  onClose: () => void;
  onApprove?: (id: string) => Promise<void>;
  onEdit?: (id: string) => void;
  onResend?: (id: string) => Promise<void>;
  onNavigateToInvoice?: (invoiceId: string) => void;
  onResume?: (invoiceId: string) => Promise<void>;
}

export const ActivityModal: React.FC<ActivityModalProps> = ({
  isOpen,
  state,
  item,
  onClose,
  onApprove,
  onEdit,
  onResend,
  onNavigateToInvoice,
  onResume,
}) => {
  const [approving, setApproving] = useState(false);
  const [resending, setResending] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);

  if (!isOpen || !item) return null;

  const handleApprove = async () => {
    if (!onApprove) return;
    setApproving(true);
    try {
      await onApprove(item.id);
      onClose();
    } finally {
      setApproving(false);
    }
  };

  const handleResend = async () => {
    if (!onResend) return;
    setResending(true);
    try {
      await onResend(item.id);
      onClose();
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-[#09090b] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-[#09090b] border-b border-gray-200 dark:border-white/10 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {item.customer_name || 'Unknown'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Invoice {item.invoice_id} | €{item.invoice_amount?.toLocaleString() || '0'} | {item.days_overdue}d overdue
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* PENDING STATE */}
          {state === 'pending' && (
            <>
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                    ⏳ Pending Your Approval
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Queued: {formatDate(item.created_at || item.queued_at || new Date())}
                  </p>
                </div>

                {item.type === 'sms' ? (
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">SMS Message Preview:</p>
                    <div className="p-3 bg-gray-50 dark:bg-white/5 rounded border border-gray-200 dark:border-white/10">
                      <p className="text-sm text-gray-900 dark:text-white">
                        {item.message_full || item.message_preview || 'No message content'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Subject:</p>
                      <div className="p-3 bg-gray-50 dark:bg-white/5 rounded border border-gray-200 dark:border-white/10">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {showFullPreview ? item.subject : item.subject?.substring(0, 60)}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Body Preview:</p>
                      <div className="p-3 bg-gray-50 dark:bg-white/5 rounded border border-gray-200 dark:border-white/10 max-h-32 overflow-y-auto">
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {showFullPreview ? item.body : item.body?.substring(0, 200)}
                          {!showFullPreview && item.body?.length > 200 && '...'}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Recipient Info */}
              <div className="pt-3 border-t border-gray-200 dark:border-white/10">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  {item.type === 'sms' ? 'Phone Number' : 'Email Address'}:
                </p>
                <p className="text-sm font-mono text-gray-900 dark:text-white">
                  {item.type === 'sms'
                    ? `${item.phone_number?.slice(0, -4)}****`
                    : item.recipient_email || item.email || 'N/A'
                  }
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-white/10">
                {!showFullPreview && item.subject && (
                  <button
                    onClick={() => setShowFullPreview(true)}
                    className="text-xs px-3 py-2 rounded bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20"
                  >
                    👁️ Expand
                  </button>
                )}
                {item.type === 'email' && onEdit && (
                  <button
                    onClick={() => {
                      onEdit(item.id);
                      onClose();
                    }}
                    className="text-xs px-3 py-2 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50"
                  >
                    ✏️ Edit
                  </button>
                )}
                <div className="flex-1" />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApprove}
                  loading={approving}
                >
                  ✓ Approve
                </Button>
              </div>

              {onNavigateToInvoice && (
                <button
                  onClick={() => {
                    onNavigateToInvoice(item.invoice_id);
                    onClose();
                  }}
                  className="w-full text-xs px-3 py-2 rounded bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-700"
                >
                  → View Full Invoice Details
                </button>
              )}
            </>
          )}


          {/* SENT STATE */}
          {state === 'sent' && (
            <>
              <div className="space-y-3">
                <div className={`p-3 rounded-lg border ${
                  ['opened', 'clicked', 'delivered'].includes(item.status)
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                    : ['bounced', 'failed'].includes(item.status)
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                    : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10'
                }`}>
                  <p className={`text-sm font-medium ${
                    ['opened', 'clicked', 'delivered'].includes(item.status)
                      ? 'text-green-900 dark:text-green-200'
                      : ['bounced', 'failed'].includes(item.status)
                      ? 'text-red-900 dark:text-red-200'
                      : 'text-gray-900 dark:text-gray-200'
                  }`}>
                    {item.status === 'opened' || item.status === 'clicked' ? '✅ Opened' :
                     item.status === 'delivered' ? '✅ Delivered' :
                     item.status === 'bounced' ? '❌ Bounced' :
                     item.status === 'failed' ? '❌ Failed' :
                     item.status === 'sent' ? '📧 Sent' : item.status}
                  </p>
                  <p className={`text-xs mt-1 ${
                    ['opened', 'clicked', 'delivered'].includes(item.status)
                      ? 'text-green-700 dark:text-green-300'
                      : ['bounced', 'failed'].includes(item.status)
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    Sent: {formatDate(item.sent_at)}
                    {item.delivery_timestamp && ` | {item.status === 'opened' || item.status === 'clicked' ? 'Opened' : 'Delivered'}: ${formatDate(item.delivery_timestamp)}`}
                  </p>
                  {item.failure_reason && (
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      Reason: {item.failure_reason}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                    {item.type === 'sms' ? 'Phone Number' : 'Email Address'}:
                  </p>
                  <p className="text-sm font-mono text-gray-900 dark:text-white">
                    {item.type === 'sms'
                      ? `${item.recipient?.slice(0, -4)}****`
                      : item.recipient || item.email || 'N/A'
                    }
                  </p>
                </div>

                {item.type === 'sms' ? (
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Message:</p>
                    <div className="p-3 bg-gray-50 dark:bg-white/5 rounded border border-gray-200 dark:border-white/10">
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {item.message_preview || item.message_full || 'N/A'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Subject:</p>
                      <div className="p-3 bg-gray-50 dark:bg-white/5 rounded border border-gray-200 dark:border-white/10">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {item.message_preview || item.subject || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-white/10">
                <button
                  onClick={() => setShowFullPreview(!showFullPreview)}
                  className="text-xs px-3 py-2 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                >
                  👁️ Preview Full
                </button>
                {['failed', 'bounced'].includes(item.status) && onResend && (
                  <button
                    onClick={handleResend}
                    disabled={resending}
                    className="text-xs px-3 py-2 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50"
                  >
                    🔄 Resend
                  </button>
                )}
              </div>

              {onNavigateToInvoice && (
                <button
                  onClick={() => {
                    onNavigateToInvoice(item.invoice_id);
                    onClose();
                  }}
                  className="w-full text-xs px-3 py-2 rounded bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-700"
                >
                  → View Full Invoice Details
                </button>
              )}
            </>
          )}

          {/* PAUSED STATE */}
          {state === 'paused' && (
            <>
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                    ⏸️ Paused Until {formatDate(item.paused_until)}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Customer negotiating or arranging payment
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Customer:</p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {item.customer_name}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Invoice Amount:</p>
                  <p className="text-sm font-mono text-gray-900 dark:text-white">
                    €{item.invoice_amount?.toLocaleString() || '0'}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-white/10">
                {onResume && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onResume(item.id).then(onClose).catch(() => {})}
                    loading={resending}
                  >
                    ▶️ Resume Now
                  </Button>
                )}
              </div>

              {onNavigateToInvoice && (
                <button
                  onClick={() => {
                    onNavigateToInvoice(item.id);
                    onClose();
                  }}
                  className="w-full text-xs px-3 py-2 rounded bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-700"
                >
                  → View Full Invoice Details
                </button>
              )}
            </>
          )}

          {/* STOPPED STATE */}
          {state === 'stopped' && (
            <>
              <div className="space-y-3">
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
                  <p className="text-sm font-medium text-red-900 dark:text-red-200">
                    🛑 Stopped Permanently
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                    This invoice will not receive any dunning communications
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Customer:</p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {item.customer_name}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Invoice Amount:</p>
                  <p className="text-sm font-mono text-gray-900 dark:text-white">
                    €{item.invoice_amount?.toLocaleString() || '0'}
                  </p>
                </div>
              </div>

              {onNavigateToInvoice && (
                <button
                  onClick={() => {
                    onNavigateToInvoice(item.id);
                    onClose();
                  }}
                  className="w-full text-xs px-3 py-2 rounded bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-700"
                >
                  → View Full Invoice Details
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
