import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useOnboarding } from '../hooks/useOnboarding';
import { useNotification } from '../hooks/useNotification';
import { Button } from '../components/ui/Button';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { formatCurrency } from '../lib/utils';

interface AuditResults {
  source: string;
  generated_at: string;
  total_invoiced: number;
  total_unpaid: number;
  overdue_ar: number;
  avg_days_late: number;
  oldest_unpaid_days: number;

  // Metric 1: Aging Buckets
  aging_buckets: {
    bucket_0_30: { count: number; amount: number; percentage: number };
    bucket_31_60: { count: number; amount: number; percentage: number };
    bucket_61_90: { count: number; amount: number; percentage: number };
    bucket_90plus: { count: number; amount: number; percentage: number };
  };

  // Metric 2: Customer Concentration
  customer_concentration: {
    total_unique_customers: number;
    customers_holding_80_percent: number;
    concentration_ratio_percentage: number;
    note: string;
  };

  // Metric 3: High-Risk Invoices
  high_risk_invoices: {
    count: number;
    total_amount: number;
    percentage_of_unpaid: number;
    note: string;
  };

  // Metric 4: Trend Analysis
  trend: {
    direction: 'improving' | 'worsening' | 'stable';
    percent_change: number;
    months_tracked: number;
    note: string;
  };

  // Metrics 5-6: Billing Errors
  billing_errors: {
    duplicates: {
      count: number;
      estimated_value: number;
    };
    spikes: {
      count: number;
      estimated_value: number;
    };
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

export default function GenerateAudit() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, company, logout } = useAuth();
  const { updateState } = useOnboarding();
  const { addToast } = useNotification();

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<AuditResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startingTrial, setStartingTrial] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      // Complete logout before navigating
      await logout();
    } catch {
      // Logout failed, but continue to navigate
    }
    navigate('/landing', { replace: true });
  };

  // Hard block back button
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const onPop = () => window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Auth + pipeline guard + auto-generate
  useEffect(() => {
    document.title = 'Your Cash Audit — CashOS';

    if (!user) {
      navigate('/landing', { replace: true });
      return;
    }

    // Backend is source of truth — redirect if not at audit_report or trial_offer stage
    // UNLESS we're coming from integrations (stage might not be synced yet)
    const stage = company?.onboardingStage;
    const fromIntegrations = (location.state as any)?.fromIntegrations;

    if (stage) {
      if (stage === 'pending' || stage === 'details_form') {
        navigate('/signup', { replace: true });
        return;
      }
      if (stage === 'integrations' && !fromIntegrations) {
        navigate('/integrations', { replace: true });
        return;
      }
      if (stage === 'trial_active' || stage === 'paid_active') {
        navigate('/dashboard', { replace: true });
        return;
      }
      if (stage === 'audit_report' || stage === 'trial_offer') {
        updateState({ accountCreated: true, auditGenerated: true });
      }
    }

    // Auto-generate audit on page load
    generateAudit();
  }, [user, company?.onboardingStage, location.state]);

  const generateAudit = async () => {
    setLoading(true);
    setError(null);

    try {
      // Call backend endpoint to generate audit analysis with 6 metrics
      const res = await api.get<AuditResults>('/api/audits/audit/generate');

      if (res) {
        setResults(res);
        // Mark audit as generated in onboarding context
        updateState({ auditGenerated: true });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate audit');
      addToast({
        type: 'error',
        message: 'Could not analyze your data. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrial = async () => {
    setStartingTrial(true);

    try {
      // Start 14-day free trial
      const res = await api.post('/api/audits/trial/start');

      if (res) {
        // Mark trial as started in onboarding context
        updateState({ trialStarted: true });

        addToast({
          type: 'success',
          message: '🎉 Trial activated! Welcome to CashOS.',
        });

        // Redirect to dashboard
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 1500);
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to start trial',
      });
      setStartingTrial(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4 py-12">
        {/* Top Bar */}
        <div className="max-w-4xl mx-auto mb-8 flex items-center justify-between">
          <div></div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loggingOut ? 'Logging out...' : 'Sign out'}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[calc(100vh-120px)]">
          <div className="text-center">
            <div className="inline-block">
              <svg className="w-12 h-12 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-6 mb-2">
              Analyzing Your Data
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              This usually takes 10-30 seconds...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4 py-12">
        {/* Top Bar */}
        <div className="max-w-4xl mx-auto mb-8 flex items-center justify-between">
          <div></div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loggingOut ? 'Logging out...' : 'Sign out'}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[calc(100vh-120px)]">
          <div className="max-w-md w-full text-center">
            <svg className="w-12 h-12 text-red-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0 0a9 9 0 11-9-9m0 0a9 9 0 119 9" />
            </svg>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              Oops, something went wrong
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
            <Button onClick={generateAudit} className="w-full">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!results) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      {/* Top Bar */}
      <div className="max-w-4xl mx-auto mb-8 flex items-center justify-between">
        <div></div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loggingOut ? 'Logging out...' : 'Sign out'}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Your Cash Health Audit
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Here's what we found in your billing data
          </p>
        </div>

        {/* Cash Health Overview */}
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-gray-800 p-8 mb-6">
          <div className="flex items-start gap-8">
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                Cash Health Overview
              </h2>
              <div className="space-y-4">
                {/* Trend Analysis */}
                {results.trend ? (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Trend Analysis</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                      {results.trend.direction === 'improving' ? '📈' : results.trend.direction === 'worsening' ? '📉' : '➡️'} {results.trend.direction.charAt(0).toUpperCase() + results.trend.direction.slice(1)}
                    </p>
                    <p className="text-xs text-gray-500">{results.trend.note || '-'}</p>
                  </div>
                ) : null}

                {/* Customer Concentration */}
                {results.customer_concentration ? (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Customer Concentration</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {results.customer_concentration.customers_holding_80_percent} of {results.customer_concentration.total_unique_customers} customers hold 80% of revenue
                    </p>
                    <p className="text-xs text-gray-500">{results.customer_concentration.note || '-'}</p>
                  </div>
                ) : null}

                {/* High-Risk Invoices */}
                {results.high_risk_invoices ? (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">High-Risk Invoices</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {results.high_risk_invoices.count} invoices ({results.high_risk_invoices.percentage_of_unpaid?.toFixed(1) || '0'}% of unpaid)
                    </p>
                    <p className="text-xs text-gray-500">{formatCurrency(results.high_risk_invoices.total_amount || 0)} at risk</p>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Status</div>
              <div className="text-4xl mb-2">
                {results.overdue_ar > 0
                  ? '⚠️'
                  : '✓'}
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {results.overdue_ar > 0
                  ? 'Action Required'
                  : 'Good Standing'}
              </p>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Invoiced</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(results.total_invoiced)}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Unpaid</div>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(results.total_unpaid)}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Overdue AR</div>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(results.overdue_ar)}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Avg Days Late</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{Math.round(results.avg_days_late)} days</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Duplicates Found</div>
            <div className="text-2xl font-bold text-red-600">{results.billing_errors?.duplicates?.count || 0}</div>
            <div className="text-xs text-gray-500">{formatCurrency(results.billing_errors?.duplicates?.estimated_value || 0)} risk</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Billing Spikes</div>
            <div className="text-2xl font-bold text-red-600">{results.billing_errors?.spikes?.count || 0}</div>
            <div className="text-xs text-gray-500">{formatCurrency(results.billing_errors?.spikes?.estimated_value || 0)} risk</div>
          </div>
        </div>

        {/* Billing Errors at Risk */}
        {results.billing_errors?.total_at_risk > 0 && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              🚨 Billing Errors Detected: {formatCurrency(results.billing_errors.total_at_risk)}
            </h3>
            <div className="space-y-3">
              {results.billing_errors?.duplicates?.count > 0 && (
                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {results.billing_errors.duplicates.count} Duplicate Invoices
                  </p>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    {formatCurrency(results.billing_errors.duplicates.estimated_value)} at risk
                  </p>
                </div>
              )}
              {results.billing_errors?.spikes?.count > 0 && (
                <div className="p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {results.billing_errors.spikes.count} Revenue Anomalies Detected
                  </p>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    {formatCurrency(results.billing_errors.spikes.estimated_value)} at risk
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Next Steps */}
        {results.next_steps && results.next_steps.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📋 Next Steps</h3>
            <ul className="space-y-2">
              {results.next_steps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                  <span className="text-blue-600 dark:text-blue-400 mt-0.5 font-bold">{idx + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Ready to improve your cash position?
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Start your 14-day free trial of CashOS. No credit card required. Unlock forecasting, payables tracking, and more.
          </p>
          <Button
            onClick={handleStartTrial}
            size="lg"
            loading={startingTrial}
            disabled={startingTrial}
            className="mx-auto"
          >
            Start 14-Day Free Trial →
          </Button>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            You can always explore the full report in your trial dashboard
          </p>
        </div>
      </div>
    </div>
  );
}
