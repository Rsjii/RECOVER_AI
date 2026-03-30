import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface SkippedDetail {
  stripeInvoiceId: string;
  customerName?: string;
  amount?: number;
  reason: 'NO_EMAIL' | 'ZERO_AMOUNT';
}

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  skippedDetails: SkippedDetail[];
}

interface SyncResultModalProps {
  result: SyncResult;
  onClose: () => void;
}

const REASON_LABEL: Record<string, string> = {
  NO_EMAIL: 'No customer email',
  ZERO_AMOUNT: 'Zero amount',
};

const REASON_FIX: Record<string, string> = {
  NO_EMAIL: 'Add email to this customer in Stripe Dashboard',
  ZERO_AMOUNT: 'Zero-amount invoices are not collected by RecoverAI',
};

export const SyncResultModal: React.FC<SyncResultModalProps> = ({ result, onClose }) => {
  const [skippedExpanded, setSkippedExpanded] = useState(result.skipped > 0);

  const total = result.created + result.updated + result.skipped;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Stripe Sync Complete"
      size="lg"
      footer={
        <div className="flex justify-end">
          <Button variant="primary" size="sm" onClick={onClose}>Done</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Summary badges */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-2 rounded-lg text-sm font-medium">
            <span>✅</span>
            <span>{result.created} Created</span>
          </div>
          <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-2 rounded-lg text-sm font-medium">
            <span>↻</span>
            <span>{result.updated} Updated</span>
          </div>
          {result.skipped > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-3 py-2 rounded-lg text-sm font-medium">
              <span>⚠️</span>
              <span>{result.skipped} Skipped</span>
            </div>
          )}
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{total} invoices processed</span>
        </div>

        {/* Skipped details accordion */}
        {result.skipped > 0 && (
          <div className="border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setSkippedExpanded(!skippedExpanded)}
              className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-sm font-medium hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
            >
              <span>⚠️ {result.skipped} invoice{result.skipped > 1 ? 's' : ''} skipped — see why & how to fix</span>
              <span className="text-xs">{skippedExpanded ? '▲' : '▼'}</span>
            </button>

            {skippedExpanded && (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {result.skippedDetails.map((item) => (
                  <div key={item.stripeInvoiceId} className="px-4 py-3 bg-white dark:bg-[#111113]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.customerName && (
                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {item.customerName}
                            </span>
                          )}
                          {item.amount !== undefined && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              ${item.amount.toFixed(2)}
                            </span>
                          )}
                          <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded">
                            {REASON_LABEL[item.reason]}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {REASON_FIX[item.reason]}
                        </p>
                      </div>
                      {item.reason === 'NO_EMAIL' && (
                        <a
                          href={`https://dashboard.stripe.com/invoices/${item.stripeInvoiceId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                        >
                          Fix in Stripe →
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-1 font-mono">{item.stripeInvoiceId}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {result.skipped === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            All invoices were synced successfully. No issues found.
          </p>
        )}
      </div>
    </Modal>
  );
};
