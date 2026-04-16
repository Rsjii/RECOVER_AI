import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { API_ENDPOINTS } from '../../lib/constants';

const EMAIL_TYPES = [
  { value: 'dunning_1', label: 'Email 1 — Friendly reminder (Day 0)' },
  { value: 'dunning_2', label: 'Email 2 — Getting overdue (Day 7)' },
  // ❌ DISABLED: PHASE 2 feature - Payment plan offer
  // { value: 'dunning_3', label: 'Email 3 — Payment plan offer (Day 14)' },
  { value: 'dunning_4', label: 'Email 4 — Formal notice (Day 30)' },
  { value: 'dunning_5', label: 'Email 5 — Escalation (Day 60)' },
];

interface EmailLog {
  id: string;
  email_type: string;
  subject: string;
  body: string;
  sent_at: string;
  status: string;
}

interface EmailPreviewModalProps {
  invoiceId: string;
  emailType?: string;
  riskScore?: number;
  daysOverdue?: number;
  emailLogs?: EmailLog[];
  onClose: () => void;
  onApprove?: () => void;
}

const CONFIDENCE_BY_TYPE: Record<string, number> = {
  dunning_1: 68,
  dunning_2: 55,
  // ❌ DISABLED: PHASE 2 feature - dunning_3: 48,
  dunning_4: 38,
  dunning_5: 28,
  // ❌ DISABLED: PHASE 2 feature - payment_plan_offer: 72,
};

// Helper to recommend dunning type based on days overdue
function getRecommendedType(days: number): string {
  if (days <= 15) return 'dunning_1';
  if (days <= 30) return 'dunning_2';
  // ❌ DISABLED: PHASE 2 - dunning_3 (payment plan offer)
  // if (days <= 60) return 'dunning_3';
  if (days <= 90) return 'dunning_4';
  return 'dunning_5';
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  invoiceId,
  emailType: initialType,
  riskScore,
  daysOverdue = 0,
  emailLogs = [],
  onClose,
  onApprove,
}) => {
  const recommendedType = getRecommendedType(daysOverdue);
  const defaultType = initialType || recommendedType;

  const [selectedType, setSelectedType] = useState(defaultType);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; body: string; tone: string; source?: string; sentAt?: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      setPreview(null);

      // Check if an actual email was already sent for this type
      const actualEmail = emailLogs.find(log => log.email_type === selectedType);
      if (actualEmail) {
        if (!cancelled) {
          setPreview({
            subject: actualEmail.subject,
            body: actualEmail.body,
            tone: actualEmail.email_type.replace('dunning_', ''),
            source: 'actual-sent',
            sentAt: actualEmail.sent_at,
          });
          setLoading(false);
        }
        return;
      }

      // Otherwise generate a preview
      try {
        const res = await api.get<{ data: any }>(
          API_ENDPOINTS.email.preview(invoiceId, selectedType),
          { signal: controller.signal }
        );
        if (!cancelled) {
          setPreview({
            ...res.data,
            source: 'generated-preview',
          });
        }
      } catch (err: any) {
        if (!cancelled && err?.code !== 'ERR_CANCELED') {
          setError(err.message || 'Failed to generate preview');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; controller.abort(); };
  }, [invoiceId, selectedType, emailLogs]);

  const handleApprove = async () => {
    if (!onApprove) return;
    setSending(true);
    try {
      onApprove();
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-[#111113] rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Email Preview</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {preview?.source === 'actual-sent' ? (
                  <span className="text-blue-600 dark:text-blue-400">✓ Actual email sent on {new Date(preview.sentAt || '').toLocaleDateString()}</span>
                ) : (
                  <span>AI-generated preview — select the stage to preview</span>
                )}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Email type selector with recommendation */}
          <div className="space-y-2">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              🔴 <strong>Recommended:</strong> {EMAIL_TYPES.find(t => t.value === recommendedType)?.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {EMAIL_TYPES.map((t) => {
                const isRecommended = t.value === recommendedType;
                const isSelected = selectedType === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => setSelectedType(t.value)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-700'
                        : isRecommended
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30'
                        : 'bg-gray-100 dark:bg-white/[0.03] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    {t.label}
                    {isRecommended && <span className="ml-1">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="text-center py-12 text-gray-500">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Generating AI email preview...
            </div>
          )}
          {error && (
            <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">{error}</div>
          )}
          {preview && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {preview.tone && (
                  <>
                    <span className="text-xs text-gray-500">Tone:</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      preview.tone === 'urgent' ? 'bg-red-100 text-red-700' :
                      preview.tone === 'firm' ? 'bg-orange-100 text-orange-700' :
                      'bg-green-100 text-green-700'
                    }`}>{preview.tone}</span>
                  </>
                )}
                {riskScore !== undefined && (
                  <>
                    <span className="text-xs text-gray-500 ml-2">Risk:</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      riskScore >= 80 ? 'bg-red-100 text-red-700' :
                      riskScore >= 50 ? 'bg-orange-100 text-orange-700' :
                      'bg-green-100 text-green-700'
                    }`}>{riskScore}/100</span>
                  </>
                )}
                <span className="text-xs text-gray-500 ml-2">Recovery confidence:</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
                  ~{CONFIDENCE_BY_TYPE[selectedType] ?? 40}%
                </span>
              </div>
              {onApprove && (
                <div className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2">
                  This email will be sent when you click "Approve &amp; Send" below.
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Subject</label>
                <div className="bg-gray-50 dark:bg-white/[0.03] rounded-lg px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                  {preview.subject}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Body</label>
                <div className="bg-gray-50 dark:bg-white/[0.03] rounded-lg px-4 py-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed border border-gray-200 dark:border-white/[0.06]">
                  {/* Render email body as plain text with whitespace preservation.
                      Email is AI-generated and safe, but we strip HTML to prevent XSS. */}
                  <div className="whitespace-pre-wrap">{preview.body.replace(/<[^>]*>/g, '')}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-white/[0.06] flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {onApprove && preview && (
            <Button onClick={handleApprove} disabled={sending}>
              {sending ? 'Sending...' : 'Approve & Send'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
