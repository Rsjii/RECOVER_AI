import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { logError } from '../../utils/logger';
import { useNotification } from '../../hooks/useNotification';

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

export const Stage5: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const { addToast } = useNotification();

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.post('/api/auth/logout');
      sessionStorage.removeItem('stage-1-data');
      sessionStorage.removeItem('stage-2-data');
      sessionStorage.removeItem('stage-3-data');
      sessionStorage.removeItem('current-token');
      navigate('/');
    } catch (err: any) {
      addToast({ type: 'error', message: 'Logout failed' });
      setLoggingOut(false);
    }
  };

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const res: any = await api.get('/api/audits/stage/5/analysis');
        setAnalysis(res);
      } catch (err: any) {
        if (err?.status === 401) {
          navigate(`/onboard/stage-1?token=${token}`, { replace: true });
          return;
        }
        logError('Stage5', 'fetchAnalysis', err?.message || 'unknown');
        setError(err?.message || 'Failed to generate analysis');
      }
      setLoading(false);
    };

    fetchAnalysis();

    // Prevent browser back button from Stage 5 in PRODUCTION only
    // Dev mode (import.meta.env.DEV): Allow back navigation to Stage 4
    // Prod mode: Lock Stage 5, prevent going back
    const isDev = import.meta.env.DEV;

    if (!isDev) {
      // Production: Block back button
      window.history.pushState({ stage5: true }, '', window.location.href);

      const preventBack = () => {
        // Any attempt to go back gets immediately blocked
        window.history.pushState({ stage5: true }, '', window.location.href);
      };

      window.addEventListener('popstate', preventBack);

      // Cleanup: Remove event listener on unmount
      return () => window.removeEventListener('popstate', preventBack);
    }

    // Dev mode: No back button prevention, allow normal navigation
  }, []);


  const handleStartTrial = async () => {
    setStarting(true);
    try {
      await api.post('/api/audits/stage/5/start-trial');
      sessionStorage.removeItem('stage-1-data');
      sessionStorage.removeItem('stage-2-data');
      sessionStorage.removeItem('stage-3-data');
      addToast({ type: 'success', message: '✓ Trial started! Redirecting...' });
      setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
    } catch (err: any) {
      logError('Stage5', 'handleStartTrial', err?.message || 'unknown');
      setError(err?.message || 'Failed to start trial');
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center px-4">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-slate-600 dark:text-slate-400">Analyzing your cash position...</p>
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
          <Button onClick={() => window.location.reload()} className="w-full" variant="primary">
            Try Again
          </Button>
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

        {/* Advanced Metrics Section */}
        {(analysis.aging_buckets || analysis.customer_concentration || analysis.high_risk_invoices || analysis.trend) && (
          <div className="mb-12 sm:mb-16">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span>📈</span> Deeper Insights
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Aging Buckets */}
              {analysis.aging_buckets && (
                <Card className="bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Invoice Aging Breakdown</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-emerald-600 dark:text-emerald-400">0-30 days:</span>
                      <span className="font-medium text-slate-900 dark:text-white">{analysis.aging_buckets.bucket_0_30.count} invoices ({analysis.aging_buckets.bucket_0_30.percentage}%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-yellow-600 dark:text-yellow-400">31-60 days:</span>
                      <span className="font-medium text-slate-900 dark:text-white">{analysis.aging_buckets.bucket_31_60.count} invoices ({analysis.aging_buckets.bucket_31_60.percentage}%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-orange-600 dark:text-orange-400">61-90 days:</span>
                      <span className="font-medium text-slate-900 dark:text-white">{analysis.aging_buckets.bucket_61_90.count} invoices ({analysis.aging_buckets.bucket_61_90.percentage}%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-600 dark:text-red-400">90+ days:</span>
                      <span className="font-medium text-slate-900 dark:text-white">{analysis.aging_buckets.bucket_90plus.count} invoices ({analysis.aging_buckets.bucket_90plus.percentage}%)</span>
                    </div>
                  </div>
                </Card>
              )}

              {/* Customer Concentration */}
              {analysis.customer_concentration && (
                <Card className="bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Risk Concentration</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                        {analysis.customer_concentration.customers_holding_80_percent}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        of {analysis.customer_concentration.total_unique_customers} customers hold 80% of risk
                      </p>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded">
                      {analysis.customer_concentration.note}
                    </p>
                  </div>
                </Card>
              )}

              {/* High-Risk Invoices */}
              {analysis.high_risk_invoices && analysis.high_risk_invoices.count > 0 && (
                <Card className="bg-white dark:bg-slate-900 p-6 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Phone Call Candidates</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                        {analysis.high_risk_invoices.count}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        Invoices 30+ days late AND &gt;= $50K
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                      ${(analysis.high_risk_invoices.total_amount / 1000).toFixed(0)}K ({analysis.high_risk_invoices.percentage_of_unpaid}% of unpaid)
                    </p>
                    <p className="text-xs text-slate-700 dark:text-slate-300">
                      {analysis.high_risk_invoices.note}
                    </p>
                  </div>
                </Card>
              )}

              {/* Trend Analysis */}
              {analysis.trend && (
                <Card className="bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-4">AR Trend</h3>
                  <div className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <p className={`text-3xl font-bold ${
                        analysis.trend.direction === 'improving' ? 'text-emerald-600 dark:text-emerald-400' :
                        analysis.trend.direction === 'worsening' ? 'text-red-600 dark:text-red-400' :
                        'text-slate-600 dark:text-slate-400'
                      }`}>
                        {analysis.trend.percent_change > 0 ? '+' : ''}{analysis.trend.percent_change}%
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{analysis.trend.direction}</p>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Last {analysis.trend.months_tracked} months
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-2 rounded">
                      {analysis.trend.note}
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Next Steps & What's Coming */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-12 sm:mb-16">
          {/* Next Steps */}
          {analysis.next_steps && analysis.next_steps.length > 0 && (
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span>📋</span> Next Steps
              </h2>
              <Card className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 p-6 sm:p-8">
                <ul className="space-y-3">
                  {analysis.next_steps.map((step: string, idx: number) => (
                    <li key={idx} className="flex gap-3">
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold flex-shrink-0">
                        {idx + 1}.
                      </span>
                      <span className="text-slate-700 dark:text-slate-300 text-sm sm:text-base">
                        {step}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}

          {/* Plaid Integration Unlock */}
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span>🔓</span> Coming Soon: Connect Your Bank
            </h2>
            <Card className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-6 sm:p-8">
              <ul className="space-y-3">
                <li className="flex gap-3">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Real Cash Balance</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Your actual bank position, not estimated</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Cash Runway</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Days until you run out of cash</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Burn Rate</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Actual monthly spending trends</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Payables</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Bills you owe (from QuickBooks)</p>
                  </div>
                </li>
              </ul>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center py-8 sm:py-12 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg px-4 sm:px-8 mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-3">
            Ready to Automate Cash Recovery?
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base mb-8 max-w-2xl mx-auto">
            Our AI agent handles collections, payment plans, and forecasting — 24/7. No manual work needed.
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

        {/* Exit button */}
        <div className="text-center pt-6 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            disabled={starting || loggingOut}
            className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 font-medium py-2 transition"
          >
            ← Exit Onboarding
          </button>
        </div>
      </div>

      {/* Exit Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50">
          <Card className="bg-white dark:bg-slate-900 p-6 max-w-sm w-full">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Exit Onboarding?</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Your progress will be saved. You can continue later using the same link.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowLogoutConfirm(false)}
                disabled={loggingOut}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleLogout}
                disabled={loggingOut}
                variant="primary"
                className="flex-1 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
              >
                {loggingOut ? 'Exiting...' : 'Exit'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
