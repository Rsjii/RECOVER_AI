import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { Button } from '../components/ui/Button';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, company, logout, setAuthState } = useAuth();
  const { addToast } = useNotification();

  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    companyName: company?.name || '',
    // PHASE 2: Timezone & Currency — currently hardcoded to UTC/USD globally
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Complete Your Profile — RecoverAI';
  }, []);

  // Prevent access if not in pending_profile status
  useEffect(() => {
    if (user && user.onboardingStatus) {
      // User shouldn't be on /profile page if not in pending_profile status
      if (user.onboardingStatus === 'integrations_pending' || user.onboardingStatus === 'active') {
        navigate('/integrations', { replace: true });
      } else if (user.onboardingStatus !== 'pending_profile') {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, navigate]);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
    if (apiError) setApiError(null);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!form.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!form.companyName.trim()) newErrors.companyName = 'Company name is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setApiError(null);
    setSubmitting(true);
    try {
      // POST /api/auth/onboard/company-info with all profile details
      await api.post('/api/auth/onboard/company-info', {
        firstName: form.firstName,
        lastName: form.lastName,
        company_name: form.companyName,
        // PHASE 2: Timezone & Currency — defaults to UTC/USD
        // timezone: form.timezone,
        // preferred_currency: form.preferredCurrency,
      });

      addToast({ type: 'success', message: 'Profile updated! Proceeding to integrations...' });

      // CRITICAL: Refresh auth state to update onboarding_status to 'integrations_pending'
      // Must do this BEFORE navigate, so ProtectedRoute sees correct status
      const meData = await api.get('/api/auth/me');
      if (meData.user && meData.company) {
        setAuthState(meData.user, meData.company);
      }

      // Redirect to /integrations for Stripe connect
      navigate('/integrations', { replace: true });
    } catch (err: any) {
      setApiError(err.message || 'Failed to save profile');
      addToast({ type: 'error', message: err.message || 'Failed to save profile' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err: any) {
      addToast({ type: 'error', message: 'Logout failed' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090b] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="bg-white dark:bg-[#111113] rounded-xl shadow-sm border border-gray-200 dark:border-white/[0.06] p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Complete Your Profile
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Tell us about yourself and your company
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* API Error Banner */}
            {apiError && (
              <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-700 dark:text-red-400">{apiError}</p>
              </div>
            )}

            {/* Email (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Email (cannot be changed)
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.08] rounded-lg text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/[0.02] cursor-not-allowed"
              />
            </div>

            {/* Name Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  First name
                </label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  placeholder="John"
                  className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors ${
                    errors.firstName ? 'border-red-500' : 'border-gray-300 dark:border-white/[0.08]'
                  }`}
                />
                {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Last name
                </label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  placeholder="Smith"
                  className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors ${
                    errors.lastName ? 'border-red-500' : 'border-gray-300 dark:border-white/[0.08]'
                  }`}
                />
                {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>}
              </div>
            </div>

            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Company name
              </label>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
                placeholder="Acme Corp"
                className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors ${
                  errors.companyName ? 'border-red-500' : 'border-gray-300 dark:border-white/[0.08]'
                }`}
              />
              {errors.companyName && <p className="mt-1 text-xs text-red-500">{errors.companyName}</p>}
            </div>

            {/* PHASE 2: Timezone & Currency — Removed from Phase 1 (hardcoded to UTC/USD globally)
                 Will be added back in Phase 2 when we support multi-currency and timezone-aware scheduling */}

            {/* Submit */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              disabled={submitting}
              className="w-full"
            >
              Continue
            </Button>

            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              You can change these details anytime in settings
            </p>
          </form>

          {/* Logout Button */}
          <div className="mt-4 text-center">
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
