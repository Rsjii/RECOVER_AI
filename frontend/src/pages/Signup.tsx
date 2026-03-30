import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useOnboarding } from '../hooks/useOnboarding';
import { useNotification } from '../hooks/useNotification';
import { Button } from '../components/ui/Button';
import { validateEmail, validatePassword, getPasswordStrength } from '../lib/utils';
import { api } from '../lib/api';

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { updateState, accountCreated, resetOnboarding } = useOnboarding();
  const { user, company } = useAuth();
  const { addToast } = useNotification();

  useEffect(() => {
    document.title = 'Sign Up — CashOS';

    if (!user) {
      // Not authenticated - stay on signup
      return;
    }

    // If authenticated, check backend onboarding stage and redirect if needed
    const stage = company?.onboardingStage;
    if (stage) {
      if (stage === 'integrations' || stage === 'audit_report' || stage === 'trial_offer') {
        // User is past signup, send to integrations
        navigate('/integrations', { replace: true });
        return;
      } else if (stage === 'trial_active') {
        // User has completed onboarding, go to dashboard
        navigate('/dashboard', { replace: true });
        return;
      } else if (stage === 'pending') {
        // User just created account but hasn't verified OTP yet
        updateState({ accountCreated: false }); // Let them stay on signup or go to OTP
        return;
      }
    }

    // If no user authenticated and accountCreated is somehow true, reset to prevent confusion
    if (!user && accountCreated) {
      resetOnboarding();
      return;
    }

    // If authenticated and account created, move to next step (OTP)
    if (user && accountCreated) {
      navigate('/otp', { replace: true });
    }
  }, [accountCreated, user, company?.onboardingStage]);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    company_name: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (apiError) setApiError(null);
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.firstName.trim()) newErrors.firstName = 'First name required';
    if (!form.lastName.trim()) newErrors.lastName = 'Last name required';
    if (!form.company_name.trim()) newErrors.company_name = 'Company name required';
    if (!form.email) newErrors.email = 'Email required';
    else if (!validateEmail(form.email)) newErrors.email = 'Valid email required';
    if (!form.password) newErrors.password = 'Password required';
    else if (!validatePassword(form.password))
      newErrors.password = 'Min 8 chars, 1 uppercase, 1 number, 1 special char';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setApiError(null);
    setSubmitting(true);

    try {
      // ✅ Call /signup to SEND OTP (account NOT created yet)
      const response: any = await api.post('/api/auth/signup', {
        firstName: form.firstName,
        lastName: form.lastName,
        company: form.company_name,
        email: form.email,
        password: form.password,
      });

      console.log('Signup response:', response);

      // ✅ Store signup data in localStorage for OTP verification
      localStorage.setItem('signupData', JSON.stringify({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        company: form.company_name,
      }));

      updateState({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        companyName: form.company_name,
        authMethod: 'email',
        accountCreated: false, // ⭐ Account NOT created yet
        step: 'otp',
      });

      addToast({ type: 'success', message: 'OTP sent to your email' });

      // Show OTP in dev mode
      if (response?.devOtpCode) {
        addToast({ type: 'info', message: `Dev OTP: ${response.devOtpCode}` });
      }

      // ✅ Navigate to OTP verification page
      navigate('/otp', { replace: true });
    } catch (err: any) {
      console.error('Signup error:', err);
      setApiError(err.message || 'Failed to send OTP');
      addToast({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const strength = form.password ? getPasswordStrength(form.password) : null;
  const strengthColors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400'];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090b] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">See your cash forecast</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">14-day trial, no credit card</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Step 1 of 5</p>
        </div>

        <div className="bg-white dark:bg-[#111113] rounded-xl shadow-sm border border-gray-200 dark:border-white/[0.06] p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {apiError && (
              <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-700 dark:text-red-400">{apiError}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Company name
              </label>
              <input
                type="text"
                value={form.company_name}
                onChange={(e) => handleChange('company_name', e.target.value)}
                placeholder="Acme Corp"
                className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors ${
                  errors.company_name ? 'border-red-500' : 'border-gray-300 dark:border-white/[0.08]'
                }`}
              />
              {errors.company_name && <p className="mt-1 text-xs text-red-500">{errors.company_name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Work email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="john@company.com"
                className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors ${
                  errors.email ? 'border-red-500' : 'border-gray-300 dark:border-white/[0.08]'
                }`}
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="••••••••"
                className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors ${
                  errors.password ? 'border-red-500' : 'border-gray-300 dark:border-white/[0.08]'
                }`}
              />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
              {strength && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[0, 1, 2, 3].map(i => (
                      <div
                        key={i}
                        className={`flex-1 h-1 rounded-full ${i < strength.score ? strengthColors[strength.score - 1] : 'bg-gray-300 dark:bg-gray-700'}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{strength.message}</p>
                </div>
              )}
            </div>

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
          </form>

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <a href="/login" className="text-brand-600 hover:text-blue-700 font-medium">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
