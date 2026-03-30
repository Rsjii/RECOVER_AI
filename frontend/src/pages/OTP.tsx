import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '../hooks/useOnboarding';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';

const OTP: React.FC = () => {
  const navigate = useNavigate();
  const { email, accountCreated, updateState, goToStep } = useOnboarding();
  const { company, setAuthState } = useAuth();
  const { addToast } = useNotification();

  useEffect(() => {
    document.title = 'Verify Email — CashOS';

    // If account already created, move to next step
    if (accountCreated) {
      navigate('/integrations', { replace: true });
      return;
    }

    // If backend shows user is past OTP, redirect them forward
    const stage = company?.onboardingStage;
    if (stage && stage !== 'pending') {
      if (stage === 'integrations' || stage === 'audit_report' || stage === 'trial_offer') {
        navigate('/integrations', { replace: true });
        return;
      } else if (stage === 'trial_active') {
        navigate('/dashboard', { replace: true });
        return;
      }
    }

    // Redirect if no email in context (came from /signup)
    if (!email) {
      navigate('/signup', { replace: true });
    }
  }, [email, accountCreated, company?.onboardingStage]);

  const [otp, setOtp] = useState('');
  const [errors, setErrors] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (resendCountdown === 0 && !canResend) {
      setCanResend(true);
    }
  }, [resendCountdown, canResend]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors('');

    if (!otp || otp.length !== 6 || isNaN(Number(otp))) {
      setErrors('Enter a valid 6-digit code');
      return;
    }

    setSubmitting(true);
    try {
      // ✅ Get signup data from localStorage
      const signupDataStr = localStorage.getItem('signupData');
      if (!signupDataStr) {
        setErrors('Session expired. Please sign up again.');
        return;
      }

      const signupData = JSON.parse(signupDataStr);

      // ✅ Call /verify-email to verify OTP + CREATE ACCOUNT
      const response: any = await api.post('/api/auth/verify-email', {
        email,
        otp,
        firstName: signupData.firstName,
        lastName: signupData.lastName,
        company: signupData.company,
        password: signupData.password,
      });

      console.log('Verify email response:', response);

      if (response?.verified && response?.user && response?.company) {
        // ✅ Account created + email verified
        // Set auth state with the new account
        setAuthState(response.user, response.company);

        updateState({ accountCreated: true, otpCode: otp });
        goToStep('integrations');

        // ✅ Clear signup data from localStorage
        localStorage.removeItem('signupData');

        addToast({ type: 'success', message: '✅ Account created! Setting up integrations...' });

        // ✅ Block browser back after account creation
        window.history.replaceState(null, '', window.location.href);
        setTimeout(() => {
          navigate('/integrations', { replace: true });
        }, 0);
      } else {
        setErrors('Unexpected response. Please try again.');
      }
    } catch (err: any) {
      console.error('OTP verification error:', err);
      setErrors(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setCanResend(false);
    setResendCountdown(60);
    try {
      await api.post('/api/auth/resend-otp', { email });
      addToast({ type: 'success', message: 'OTP resent to your email' });
    } catch (err: any) {
      addToast({ type: 'error', message: 'Failed to resend OTP' });
      setCanResend(true);
      setResendCountdown(0);
    }
  };

  const handleGoBack = () => {
    // Allow going back to signup (before account created)
    navigate('/signup', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090b] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Verify your email</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">We sent a code to {email}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Step 2 of 6</p>
        </div>

        <div className="bg-white dark:bg-[#111113] rounded-xl shadow-sm border border-gray-200 dark:border-white/[0.06] p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors && (
              <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-700 dark:text-red-400">{errors}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                6-digit code
              </label>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors border-gray-300 dark:border-white/[0.08] text-center text-lg tracking-widest"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Check your email (or spam folder)</p>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              disabled={submitting}
              className="w-full"
            >
              Verify code
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-white/[0.06]">
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              Didn't receive a code?{' '}
              <button
                type="button"
                onClick={handleResend}
                disabled={!canResend}
                className="text-brand-600 hover:text-blue-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {canResend ? 'Resend' : `Resend in ${resendCountdown}s`}
              </button>
            </p>
          </div>

          {/* Back button (allowed - account not created yet) */}
          <button
            type="button"
            onClick={handleGoBack}
            className="w-full text-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-medium transition py-2 mt-4"
          >
            ← Back to signup
          </button>
        </div>
      </div>
    </div>
  );
};

export default OTP;
