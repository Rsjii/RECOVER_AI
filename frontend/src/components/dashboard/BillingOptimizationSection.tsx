import React, { useState } from 'react';
import { CollapsibleSection } from './CollapsibleSection';
import type { BillingAnomaly } from '../../types/invoice';

interface BillingOptimizationSectionProps {
  anomalies: BillingAnomaly[];
  loading?: boolean;
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
}

const severityBadge = (severity: BillingAnomaly['severity']) => {
  switch (severity) {
    case 'high':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
    case 'medium':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-400';
  }
};

const anomalyTypeLabel: Record<BillingAnomaly['anomalyType'], string> = {
  potential_duplicate: 'Potential Duplicate',
  amount_spike: 'Amount Spike',
  billing_gap: 'Billing Gap',
  failed_payment_cluster: 'Failed Payment Cluster',
};

const TYPE_FILTERS: { value: string; label: string; type?: BillingAnomaly['anomalyType'] }[] = [
  { value: 'all', label: 'All' },
  { value: 'potential_duplicate', label: 'Duplicates', type: 'potential_duplicate' },
  { value: 'amount_spike', label: 'Amount Spikes', type: 'amount_spike' },
  { value: 'billing_gap', label: 'Billing Gaps', type: 'billing_gap' },
  { value: 'failed_payment_cluster', label: 'Failed Clusters', type: 'failed_payment_cluster' },
];

export const BillingOptimizationSection: React.FC<BillingOptimizationSectionProps> = ({
  anomalies,
  loading,
  onConfirm,
  onDismiss,
}) => {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');

  const filteredAnomalies = typeFilter === 'all'
    ? [...anomalies].sort((a, b) => b.estimatedImpactUsd - a.estimatedImpactUsd)
    : [...anomalies].filter(a => a.anomalyType === typeFilter).sort((a, b) => b.estimatedImpactUsd - a.estimatedImpactUsd);

  const pendingAnomalies = anomalies.filter((a) => a.status === 'pending');
  const totalImpact = pendingAnomalies.reduce((sum, a) => sum + a.estimatedImpactUsd, 0);
  const lastScan = anomalies.length > 0 ? anomalies[0].detectedAt : null;

  const handleConfirm = async (id: string) => {
    setPendingAction(id);
    await onConfirm(id);
    setPendingAction(null);
  };

  const handleDismiss = async (id: string) => {
    setPendingAction(id);
    await onDismiss(id);
    setPendingAction(null);
  };

  const badge = pendingAnomalies.length > 0 ? (
    <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
      {pendingAnomalies.length} issue{pendingAnomalies.length !== 1 ? 's' : ''} · ${Math.round(totalImpact).toLocaleString()} impact
    </span>
  ) : undefined;

  return (
    <CollapsibleSection
      title="Billing Optimization"
      subtitle="AI-detected invoice anomalies and billing gaps"
      defaultOpen={pendingAnomalies.length > 0}
      badge={badge}
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      }
    >
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 dark:bg-white/[0.04] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : anomalies.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-2xl mb-2">✅</div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No billing anomalies detected</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Agent runs weekly — next scan Sunday 02:00 UTC</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Type filter pills */}
          <div className="flex gap-1.5 flex-wrap">
            {TYPE_FILTERS.map(f => (
              <button key={f.value} onClick={() => setTypeFilter(f.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  typeFilter === f.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/[0.1]'
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[80px_1fr_120px_100px_100px] gap-3 px-3 pb-1 text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wide">
            <span>Severity</span>
            <span>Details</span>
            <span>Customer</span>
            <span className="text-right">Impact</span>
            <span className="text-right">Actions</span>
          </div>

          {filteredAnomalies.map((anomaly) => {
            const isActing = pendingAction === anomaly.id;

            return (
              <div
                key={anomaly.id}
                className={`bg-gray-50 dark:bg-white/[0.02] border rounded-lg p-3 transition-opacity ${
                  anomaly.status !== 'pending' ? 'opacity-50' : ''
                } ${
                  anomaly.severity === 'high'
                    ? 'border-rose-200 dark:border-rose-900/40'
                    : anomaly.severity === 'medium'
                    ? 'border-amber-200 dark:border-amber-900/30'
                    : 'border-gray-200 dark:border-white/[0.05]'
                }`}
              >
                {/* Mobile layout */}
                <div className="sm:hidden space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded capitalize ${severityBadge(anomaly.severity)}`}>
                          {anomaly.severity}
                        </span>
                        <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                          {anomalyTypeLabel[anomaly.anomalyType]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{anomaly.description}</p>
                      {anomaly.customerName && (
                        <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 font-medium">{anomaly.customerName}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        ${anomaly.estimatedImpactUsd.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {anomaly.status === 'pending' && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleConfirm(anomaly.id)}
                        disabled={isActing}
                        className="flex-1 text-xs py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-50"
                      >
                        {isActing ? '…' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => handleDismiss(anomaly.id)}
                        disabled={isActing}
                        className="flex-1 text-xs py-1.5 bg-gray-200 dark:bg-white/[0.08] text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-white/[0.12] transition-colors disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                  {anomaly.status !== 'pending' && (
                    <span className={`inline-block text-xs px-2 py-0.5 rounded capitalize ${
                      anomaly.status === 'confirmed'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-gray-200 text-gray-500 dark:bg-white/[0.08] dark:text-gray-500'
                    }`}>
                      {anomaly.status}
                    </span>
                  )}
                </div>

                {/* Desktop layout */}
                <div className="hidden sm:grid grid-cols-[80px_1fr_120px_100px_100px] gap-3 items-center">
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded capitalize w-fit ${severityBadge(anomaly.severity)}`}>
                    {anomaly.severity}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200">{anomalyTypeLabel[anomaly.anomalyType]}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{anomaly.description}</p>
                  </div>
                  <p className="text-xs text-gray-700 dark:text-gray-300 truncate">
                    {anomaly.customerName ?? '—'}
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white text-right">
                    ${anomaly.estimatedImpactUsd.toLocaleString()}
                  </p>
                  <div className="flex gap-1 justify-end">
                    {anomaly.status === 'pending' ? (
                      <>
                        <button
                          onClick={() => handleConfirm(anomaly.id)}
                          disabled={isActing}
                          className="text-xs px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-50"
                        >
                          {isActing ? '…' : '✓'}
                        </button>
                        <button
                          onClick={() => handleDismiss(anomaly.id)}
                          disabled={isActing}
                          className="text-xs px-2 py-1 bg-gray-200 dark:bg-white/[0.08] text-gray-600 dark:text-gray-400 rounded hover:bg-gray-300 dark:hover:bg-white/[0.12] transition-colors disabled:opacity-50"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded capitalize ${
                        anomaly.status === 'confirmed'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-gray-200 text-gray-500 dark:bg-white/[0.08] dark:text-gray-500'
                      }`}>
                        {anomaly.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          </div>

          {/* Last scan footer */}
          <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">
            {lastScan
              ? `Last scan: ${new Date(lastScan).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
              : 'Next scan: Sunday 02:00 UTC'}
          </p>
        </div>
      )}
    </CollapsibleSection>
  );
};

export default BillingOptimizationSection;
