import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { Button } from '../components/ui/Button';
import { validateEmail } from '../lib/utils';
import { api } from '../lib/api';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading } = useAuth();
  const { addToast } = useNotification();

  useEffect(() => {
    document.title = 'Sign In — RecoverAI';
    // Redirect authenticated users to dashboard
    if (isAuthenticated && !isLoading) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Clear API error when user starts typing again
  const handleChange = (field: 'email' | 'password', value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (apiError) setApiError(null);
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const handleGoogleLogin = () => {
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

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!form.email) newErrors.email = 'Email is required';
    else if (!validateEmail(form.email)) newErrors.email = 'Enter a valid email';
    if (!form.password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setApiError(null);
    setSubmitting(true);
    try {
      const result = await login(form.email, form.password);

      // Check if user has an in-progress audit
      if (result?.auditResume) {
        const { status, token } = result.auditResume;

        if (status === 'analysis_in_progress') {
          // Redirect to analyzing page
          navigate(`/audit-analyzing/${token}`, { replace: true });
          return;
        } else if (status === 'otp_verified' || status === 'email_entered') {
          // Redirect back to OTP/email step
          navigate(`/audit`, { replace: true, state: { resumeToken: token } });
          return;
        } else if (status === 'stripe_started' || status === 'stripe_connected') {
          // Redirect to Stripe OAuth or results
          navigate(`/audit-results/${token}`, { replace: true });
          return;
        }
      }

      // Check if user is mid-onboarding (after exiting and logging back in)
      try {
        const check: any = await api.get('/api/audits/check-stage');
        if (check?.stage && check.stage > 0) {
          // User is mid-onboarding, resume from that stage
          addToast({ type: 'success', message: 'Resuming your onboarding...' });
          navigate(`/onboard/stage-${check.stage}`, { replace: true });
          return;
        }
      } catch {
        // Not in onboarding, proceed to dashboard
      }

      addToast({ type: 'success', message: 'Welcome back!' });
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err: any) {
      if (err.code === 'USE_GOOGLE') {
        setApiError('You signed up with Google. Please continue with Google above.');
        addToast({ type: 'info', message: 'Use the Google button to sign in.' });
      } else {
        setApiError(err.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090b] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">R</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">RecoverAI</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-[#111113] rounded-xl shadow-sm border border-gray-200 dark:border-white/[0.06] p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* API Error Banner */}
            {apiError && (
              <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-700 dark:text-red-400">{apiError}</p>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="john@company.com"
                className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors ${
                  errors.email
                    ? 'border-red-500'
                    : 'border-gray-300 dark:border-white/[0.08]'
                }`}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-500">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-brand-600 hover:text-blue-700 font-medium"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  placeholder="••••••••"
                  className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors pr-10 ${
                    errors.password
                      ? 'border-red-500'
                      : 'border-gray-300 dark:border-white/[0.08]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-14-14zM10 4.5C5.304 4.5 1.477 7.29.458 10a9.002 9.002 0 0015.084 5.099l-2.89-2.89a4 4 0 00-5.656-5.656l-2.89-2.89.327-.327A7.986 7.986 0 0110 4.5zm-8.066 4.73l2.96 2.96a4 4 0 005.656 5.656l2.96 2.96A8.999 8.999 0 001.934 9.23z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-500">{errors.password}</p>
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
              Sign in
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
              onClick={handleGoogleLogin}
            >
              Continue with Google
            </Button>
          </form>

          {/* Signup Link */}
          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            New to RecoverAI?{' '}
            <Link
              to="/signup"
              className="text-brand-600 hover:text-blue-700 font-medium"
            >
              Sign up here
            </Link>
          </p>

          {/* Back Button */}
          <button
            onClick={() => navigate('/landing', { replace: true })}
            className="w-full text-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-medium transition py-2"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
