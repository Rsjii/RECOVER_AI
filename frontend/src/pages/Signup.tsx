import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { Button } from '../components/ui/Button';
import { validateEmail, validatePassword, getPasswordStrength } from '../lib/utils';

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { signup, isAuthenticated, isLoading } = useAuth();
  const { addToast } = useNotification();

  useEffect(() => { document.title = 'Sign Up — CashOS'; }, []);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    company_name: '',
  });
  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    company_name?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (apiError) setApiError(null);
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!form.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!form.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!form.company_name.trim()) newErrors.company_name = 'Company name is required';
    if (!form.email) newErrors.email = 'Email is required';
    else if (!validateEmail(form.email)) newErrors.email = 'Enter a valid email';
    if (!form.password) newErrors.password = 'Password is required';
    else if (!validatePassword(form.password))
      newErrors.password = 'Min 8 chars, 1 uppercase, 1 number';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGoogleSignup = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const scope = 'openid email profile';
    const responseType = 'code';
    const state = Math.random().toString(36).substring(7);

    sessionStorage.setItem('oauth_state', state);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      response_type: responseType,
      state,
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setApiError(null);
    setSubmitting(true);
    try {
      await signup(form.email, form.password, form.company_name, form.firstName, form.lastName, 'phase_0');
      addToast({ type: 'success', message: 'Account created! Verify your email to continue.' });
      // Use replace: true to remove signup page from history
      navigate('/verify-email', { replace: true });
    } catch (err: any) {
      setApiError(err.message || 'Signup failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const strength = form.password ? getPasswordStrength(form.password) : null;
  const strengthColors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400'];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090b] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">R</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Start recovering revenue</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">14-day pilot program, no credit card</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-[#111113] rounded-xl shadow-sm border border-gray-200 dark:border-white/[0.06] p-8">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* API Error Banner */}
            {apiError && (
              <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-700 dark:text-red-400">{apiError}</p>
              </div>
            )}

            {/* Name Row */}
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

            {/* Company Name */}
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

            {/* Email */}
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

            {/* Password */}
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
              {strength && form.password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full ${
                          i < strength.score ? strengthColors[strength.score - 1] : 'bg-gray-200 dark:bg-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{strength.message}</p>
                </div>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              disabled={submitting}
              className="w-full"
            >
              Create account
            </Button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-white/[0.06]" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-2 text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-[#111113]">OR</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignup}
            >
              Continue with Google
            </Button>

            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              By signing up, you agree to our{' '}
              <Link to="/terms" className="text-brand-600 hover:underline">Terms</Link> and{' '}
              <Link to="/privacy" className="text-brand-600 hover:underline">Privacy Policy</Link>
            </p>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-600 hover:text-blue-700 font-medium">Sign in</Link>
          </p>

          {/* Back Button */}
          <button
            onClick={() => navigate('/landing', { replace: true })}
            className="w-full text-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-medium transition py-2 mt-3"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default Signup;
