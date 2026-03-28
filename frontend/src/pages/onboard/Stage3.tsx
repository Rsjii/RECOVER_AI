import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useNotification } from '../../hooks/useNotification';

export const Stage3: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const { addToast } = useNotification();
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.post('/api/auth/logout');
      // Clear SessionStorage
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

  // Load from SessionStorage on mount (only if same token)
  useEffect(() => {
    const storedToken = sessionStorage.getItem('current-token');

    // Only load if same token
    if (storedToken === token) {
      const saved = sessionStorage.getItem('stage-3-data');
      if (saved) {
        const { companyName: cn } = JSON.parse(saved);
        if (cn) setCompanyName(cn);
      }
    }
  }, [token]);

  // Save to SessionStorage on change
  useEffect(() => {
    sessionStorage.setItem('stage-3-data', JSON.stringify({ companyName }));
  }, [companyName]);

  // Load current company name from session
  useEffect(() => {
    const loadCompany = async () => {
      // Block chrome back button from going before this stage
      window.history.replaceState(null, '', window.location.href);

      try {
        const res: any = await api.get('/api/audits/check-stage');
        if (res?.company_name) setCompanyName(res.company_name);
        // Only redirect forward if past stage 4 (trial/dashboard)
        // Stage 4 is allowed to navigate back here to edit company name
        if (res?.stage === 0) {
          navigate('/dashboard', { replace: true });
          return;
        }
        if (res?.stage >= 5) {
          navigate(`/onboard/stage-5?token=${token}`, { replace: true });
          return;
        }
      } catch {
        // Cookie expired — redirect to stage 1
        navigate(`/onboard/stage-1?token=${token}`, { replace: true });
        return;
      }
      setInitialLoading(false);
    };

    loadCompany();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!companyName.trim()) {
      setError('Company name is required');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/audits/stage/3/details', { company_name: companyName.trim() });
      navigate(`/onboard/stage-4?token=${token}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-10">
            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">✓</div>
            <span className="text-sm text-gray-500">Account</span>
            <div className="flex-1 h-px bg-green-200 dark:bg-green-800"></div>
            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">✓</div>
            <span className="text-sm text-gray-500">Verify</span>
            <div className="flex-1 h-px bg-blue-200 dark:bg-blue-800"></div>
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Details</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 text-gray-500 rounded-full flex items-center justify-center text-sm">4</div>
            <span className="text-sm text-gray-500">Connect</span>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Your Company</h1>
            <p className="text-gray-600 dark:text-gray-400">Confirm or update your company name</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Company Name *
              </label>
              <Input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., Acme Corp"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                This is shown to your customers in recovery emails
              </p>
            </div>

            <div className="space-y-3 mt-6">
              <Button type="submit" fullWidth disabled={loading || !companyName.trim()}>
                {loading ? 'Saving...' : 'Continue →'}
              </Button>
            </div>
          </form>

          <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-6">
            Your data is encrypted and secure
          </p>

          {/* Logout button */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              disabled={loggingOut}
              className="w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 font-medium py-2 transition"
            >
              ← Exit onboarding
            </button>
          </div>

          {/* Logout confirmation modal */}
          {showLogoutConfirm && (
            <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Exit onboarding?</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Your progress will be saved. You can continue later using the same link.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowLogoutConfirm(false)}
                    disabled={loggingOut}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium text-sm transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition disabled:opacity-50"
                  >
                    {loggingOut ? 'Exiting...' : 'Exit'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
