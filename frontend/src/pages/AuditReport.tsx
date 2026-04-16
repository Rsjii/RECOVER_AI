import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ReportSkeleton } from '../components/ui/Skeleton';
import { logError } from '../utils/logger';
import { useNotification } from '../hooks/useNotification';

interface Analysis {
  source: string;
  total_invoiced: number;
  total_unpaid: number;
  overdue_ar: number;
  avg_days_late: number;
  oldest_unpaid_days: number;
  aging_buckets?: {
    bucket_0_30: { count: number; amount: number; percentage: number };
    bucket_31_60: { count: number; amount: number; percentage: number };
    bucket_61_90: { count: number; amount: number; percentage: number };
    bucket_90plus: { count: number; amount: number; percentage: number };
  };
  customer_concentration?: {
    total_unique_customers: number;
    customers_holding_80_percent: number;
    concentration_ratio_percentage: number;
    note: string;
  };
  high_risk_invoices?: {
    count: number;
    total_amount: number;
    percentage_of_unpaid: number;
    note: string;
  };
  trend?: {
    direction: 'improving' | 'worsening' | 'stable';
    percent_change: number;
    months_tracked: number;
    note: string;
  };
  billing_errors: {
    duplicates: { count: number; estimated_value: number };
    spikes: { count: number; estimated_value: number };
    total_at_risk: number;
  };
  next_steps: string[];
  plaid_unlocks: {
    cash_balance: string;
    cash_runway: string;
    burn_rate: string;
    payables: string;
  };
}

export const AuditReport: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useNotification();

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const res: any = await api.get('/api/audits/stage/3/analysis');
        setAnalysis(res);
      } catch (err: any) {
        if (err?.status === 401) {
          navigate(`/login`, { replace: true });
          return;
        }
        logError('AuditReport', 'fetchAnalysis', err?.message || 'unknown');
        setError(err?.message || 'Failed to generate analysis');
      }
      setLoading(false);
    };

    fetchAnalysis();
  }, []);

  const handleStartTrial = async () => {
    setStarting(true);
    try {
      await api.post('/api/audits/stage/3/start-trial');
      addToast({ type: 'success', message: '✓ Trial started! Redirecting...' });
      setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
    } catch (err: any) {
      logError('AuditReport', 'handleStartTrial', err?.message || 'unknown');
      setError(err?.message || 'Failed to start trial');
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <ReportSkeleton />
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center px-4">
        <Card className="max-w-md w-full bg-white dark:bg-slate-900 p-8 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Analysis Failed</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">{error || 'Unable to load analysis'}</p>
          <div className="space-y-3">
            <Button onClick={() => window.location.reload()} className="w-full" variant="primary">
              Try Again
            </Button>
            <Button onClick={() => navigate('/integrations')} className="w-full" variant="secondary">
              Go Back to Integrations
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-2">
              Your Cash Operations Snapshot
            </h1>
            <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base">
              Based on Stripe invoice data
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* AR Picture Section */}
        <div className="mb-12 sm:mb-16">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span>📊</span> Your AR Picture
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-white dark:bg-slate-900 p-4 sm:p-6 border-l-4 border-blue-500">
              <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Total Invoiced</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                ${(analysis.total_invoiced / 1000).toFixed(1)}K
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">All time</p>
            </Card>

            <Card className="bg-white dark:bg-slate-900 p-4 sm:p-6 border-l-4 border-purple-500">
              <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Currently Unpaid</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                ${(analysis.total_unpaid / 1000).toFixed(1)}K
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">Outstanding</p>
            </Card>

            <Card className="bg-white dark:bg-slate-900 p-4 sm:p-6 border-l-4 border-orange-500">
              <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Overdue AR</p>
              <p className="text-2xl sm:text-3xl font-bold text-orange-600 dark:text-orange-400">
                ${(analysis.overdue_ar / 1000).toFixed(1)}K
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">Past due</p>
            </Card>

            <Card className="bg-white dark:bg-slate-900 p-4 sm:p-6 border-l-4 border-emerald-500">
              <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Collection Velocity</p>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{analysis.avg_days_late}d</p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">Average days late</p>
            </Card>
          </div>
          {analysis.oldest_unpaid_days > 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded">
              ⚠️ Oldest unpaid invoice: <strong>{analysis.oldest_unpaid_days} days overdue</strong>
            </p>
          )}
        </div>

        {/* Billing Errors Detection */}
        {analysis.billing_errors && analysis.billing_errors.total_at_risk > 0 && (
          <div className="mb-12 sm:mb-16">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span>🚨</span> Billing Errors Detected: ${Math.round(analysis.billing_errors.total_at_risk / 1000)}K
            </h2>
            <Card className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {analysis.billing_errors.duplicates.count > 0 && (
                  <div>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {analysis.billing_errors.duplicates.count}
                    </p>
                    <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">Duplicate Invoices</p>
                    <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                      ~${Math.round(analysis.billing_errors.duplicates.estimated_value / 1000)}K estimated
                    </p>
                  </div>
                )}
                {analysis.billing_errors.spikes.count > 0 && (
                  <div>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {analysis.billing_errors.spikes.count}
                    </p>
                    <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">Revenue Spikes (Anomalies)</p>
                    <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                      ~${Math.round(analysis.billing_errors.spikes.estimated_value / 1000)}K estimated
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* CTA Section */}
        <div className="text-center py-8 sm:py-12 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg px-4 sm:px-8 mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-3">
            Ready to Automate Cash Recovery?
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base mb-8 max-w-2xl mx-auto">
            Our AI agent handles collections and dunning — 24/7. No manual work needed. (Payment plans coming Phase 2)
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <Button
              onClick={handleStartTrial}
              size="lg"
              variant="primary"
              loading={starting}
              disabled={starting}
              className="px-6 sm:px-8 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {starting ? 'Setting up...' : '🎯 Start 14-Day Free Trial'}
            </Button>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            No credit card. Auto-login on start. Upgrade anytime if you need advanced features.
          </p>
        </div>
      </div>
    </div>
  );
};
