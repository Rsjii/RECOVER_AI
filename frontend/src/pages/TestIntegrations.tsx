import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useOnboarding } from '../hooks/useOnboarding';
import { useNotification } from '../hooks/useNotification';
import { Button } from '../components/ui/Button';
import { ThemeToggle } from '../components/ui/ThemeToggle';

type IntegrationMethod = 'stripe' | 'manual' | null;

export default function Integrations() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { updateState } = useOnboarding();
  const { addToast } = useNotification();

  const [method, setMethod] = useState<IntegrationMethod>(null);
  const [loading, setLoading] = useState(false);
  const [proceeding, setProceeding] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [stripeManualMode, setStripeManualMode] = useState(false);
  const [stripeApiKey, setStripeApiKey] = useState('');
  const [validatingKey, setValidatingKey] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [uploadedInvoices, setUploadedInvoices] = useState<{ count: number; errors?: string[] } | null>(null);

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

  // TEST PAGE - NO GUARDS, NO AUTH REQUIRED
  useEffect(() => {
    document.title = 'Connect Billing — CashOS (TEST)';

    // Test page: works without auth, no guards
    if (user) {
      updateState({ accountCreated: true });
    }
  }, [user]);

  const handleStripeOAuth = async () => {
    setLoading(true);
    try {
      const clientId = import.meta.env.VITE_STRIPE_CLIENT_ID;
      const scope = 'read_write';
      const redirectUri = `${window.location.origin}/audits/stripe/oauth/callback`;
      const state = Math.random().toString(36).substring(7);

      sessionStorage.setItem('oauth_state', state);
      sessionStorage.setItem('returnPath', '/generate-audit');

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        scope,
        redirect_uri: redirectUri,
        state,
        stripe_user: JSON.stringify({ email: user?.email }),
      });

      window.location.href = `https://connect.stripe.com/oauth/v2/authorize?${params.toString()}`;
    } catch (err: any) {
      setStripeError(err.message);
      addToast({ type: 'error', message: 'Failed to connect Stripe' });
      setLoading(false);
    }
  };

  const handleValidateStripeKey = async () => {
    if (!stripeApiKey.trim()) {
      setStripeError('Please enter your Stripe API key');
      return;
    }

    setValidatingKey(true);
    try {
      // Call backend to validate and store the key
      await api.post('/api/audits/test/integrations/validate-stripe-key', {
        stripe_key: stripeApiKey,
      });

      setStripeApiKey('');
      setStripeManualMode(false);
      setStripeError(null);
      setStripeConnected(true);
      addToast({ type: 'success', message: '✅ Stripe connected successfully!' });
    } catch (err: any) {
      setStripeError(err.message || 'Invalid Stripe key');
      addToast({ type: 'error', message: 'Failed to validate Stripe key' });
    } finally {
      setValidatingKey(false);
    }
  };

  const handleCsvUpload = async (file: File) => {
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      addToast({ type: 'error', message: 'Please select a CSV file (.csv only)' });
      return;
    }

    setUploadingCsv(true);
    try {
      // Read file as text
      const fileContent = await file.text();

      // Send CSV content to backend
      const response = await api.post('/api/audits/test/integrations/upload-invoices', {
        csvContent: fileContent,
        fileName: file.name,
      });

      // Show success with count
      setUploadedInvoices({
        count: response.successCount || 0,
        errors: response.errors,
      });

      addToast({
        type: 'success',
        message: `✅ Imported ${response.successCount} invoices${response.errorCount > 0 ? ` (${response.errorCount} errors)` : ''}`,
      });
    } catch (err: any) {
      addToast({ type: 'error', message: 'Failed to upload: ' + (err.message || 'Unknown error') });
    } finally {
      setUploadingCsv(false);
    }
  };

  const downloadSampleCsv = () => {
    const headers = 'customer_name,customer_email,amount,due_date,issued_date,invoice_id,status';
    const sampleRow = 'Acme Corp,billing@acme.com,5000,2026-04-15,2026-04-01,INV-001,unpaid';
    const csv = [headers, sampleRow].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-invoices.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleProceedToAudit = async () => {
    setProceeding(true);
    try {
      // Call backend to proceed (updates onboarding_stage to 'audit_report')
      await api.post('/api/audits/test/integrations/proceed');

      // Update local state
      updateState({ integrationMethod: method || 'manual', auditGenerated: false });

      addToast({ type: 'success', message: 'Integration confirmed! Generating audit...' });

      // Navigate to audit generation - backend has updated stage, context will sync on load
      navigate('/test/generate-audit', { replace: true, state: { fromIntegrations: true } });
    } catch (err: any) {
      console.error('Proceed to audit failed:', err);
      addToast({ type: 'error', message: err.message || 'Failed to proceed to audit' });
      setProceeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      {/* Top Bar */}
      <div className="max-w-2xl mx-auto mb-8 flex items-center justify-between">
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

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Connect Your Billing Data
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Choose how to sync your invoices for the audit analysis
          </p>
        </div>

        {/* Options */}
        <div className="space-y-4">
          {/* Stripe Option */}
          <div
            onClick={() => setMethod(method === 'stripe' ? null : 'stripe')}
            className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
              method === 'stripe'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13.6a3.6 3.6 0 11 0 7.2 3.6 3.6 0 0 0-7.2 0" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Connect Stripe</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Automatically sync all your invoices from Stripe (Recommended)
                </p>
              </div>
              {method === 'stripe' && (
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </div>

            {method === 'stripe' && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                {stripeError && (
                  <div className="text-sm text-red-600 dark:text-red-400 mb-3">{stripeError}</div>
                )}

                {stripeConnected ? (
                  <div className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg text-sm font-medium text-center flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Connected
                  </div>
                ) : !stripeManualMode ? (
                  <>
                    <Button
                      onClick={handleStripeOAuth}
                      loading={loading}
                      className="w-full mb-3"
                    >
                      Connect Stripe Account
                    </Button>
                    <button
                      onClick={() => setStripeManualMode(true)}
                      className="w-full text-sm text-blue-600 dark:text-blue-400 hover:underline py-2"
                    >
                      Or paste your API key manually
                    </button>
                  </>
                ) : (
                  <>
                    <div className="mb-3" onClick={(e) => e.stopPropagation()}>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Stripe API Key (Secret Key)
                      </label>
                      <input
                        type="password"
                        value={stripeApiKey}
                        onChange={(e) => {
                          setStripeApiKey(e.target.value);
                          setStripeError(null);
                        }}
                        placeholder="sk_live_... or sk_test_..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Your key is encrypted and only used to fetch invoice data
                      </p>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        onClick={handleValidateStripeKey}
                        loading={validatingKey}
                        className="flex-1"
                      >
                        Verify & Connect
                      </Button>
                      <button
                        onClick={() => {
                          setStripeManualMode(false);
                          setStripeApiKey('');
                          setStripeError(null);
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Manual Entry Option */}
          <div
            onClick={() => setMethod(method === 'manual' ? null : 'manual')}
            className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
              method === 'manual'
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Manual Entry</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Upload a CSV file or enter invoice details manually
                </p>
              </div>
              {method === 'manual' && (
                <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </div>

            {method === 'manual' && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Upload Invoice Data
                  </label>

                  {uploadedInvoices ? (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <p className="font-medium text-green-900 dark:text-green-200">
                            ✅ {uploadedInvoices.count} invoices imported
                          </p>
                          {uploadedInvoices.errors && uploadedInvoices.errors.length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs text-green-700 dark:text-green-400 cursor-pointer">
                                Show {uploadedInvoices.errors.length} error{uploadedInvoices.errors.length !== 1 ? 's' : ''}
                              </summary>
                              <ul className="text-xs text-red-700 dark:text-red-400 mt-2 space-y-1 ml-3">
                                {uploadedInvoices.errors.map((err, i) => (
                                  <li key={i}>• {err}</li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-green-500 dark:hover:border-green-400 transition-colors cursor-pointer mb-3">
                        <input
                          type="file"
                          accept=".csv"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleCsvUpload(file);
                            }
                          }}
                          disabled={uploadingCsv}
                          className="hidden"
                          id="csv-upload"
                        />
                        <label htmlFor="csv-upload" className="cursor-pointer block">
                          {uploadingCsv ? (
                            <>
                              <svg className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                              </svg>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Uploading...</p>
                            </>
                          ) : (
                            <>
                              <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                <span className="font-medium text-green-600 dark:text-green-400">Click to upload</span> or drag and drop
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">CSV file with invoice data</p>
                            </>
                          )}
                        </label>
                      </div>
                      <button
                        onClick={downloadSampleCsv}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        📥 Download sample CSV format
                      </button>
                    </>
                  )}

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4 text-xs text-blue-800 dark:text-blue-300">
                    <p className="font-medium mb-2">📋 CSV should include:</p>
                    <code className="block text-xs bg-blue-100 dark:bg-blue-900/50 p-2 rounded font-mono overflow-auto">
                      customer_name, customer_email, amount, due_date, issued_date, invoice_id, status
                    </code>
                    <p className="mt-2">Dates in YYYY-MM-DD format. Status: unpaid, paid, arranged, etc.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Plaid Option (Disabled) */}
          <div className="p-6 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 opacity-50">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-500 dark:text-gray-400">Connect Bank Account</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Via Plaid (Coming soon — unlock real-time cash position)
                </p>
              </div>
            </div>
          </div>

          {/* Proceed Button (shows when method selected) */}
          {method && (
            <div className="mt-8 space-y-3">
              <Button
                onClick={handleProceedToAudit}
                loading={proceeding}
                disabled={proceeding}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 font-semibold"
              >
                {proceeding ? 'Preparing audit...' : 'Proceed to Audit Analysis →'}
              </Button>
              <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                Your data is encrypted and secure. You can add more integrations anytime.
              </p>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-12 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">💡 How this works</h4>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
            <li>✓ We analyze your invoice data to find duplicates, payment failures, and risks</li>
            <li>✓ You'll get a detailed report with specific opportunities to recover cash</li>
            <li>✓ All data stays private — we don't store or share anything without permission</li>
            <li>✓ You can add more integrations anytime from Settings</li>
          </ul>
        </div>

      </div>
    </div>
  );
}