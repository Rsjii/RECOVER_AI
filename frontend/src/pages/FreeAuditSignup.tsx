import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

const FreeAuditSignup: React.FC = () => {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');

  const [step, setStep] = useState<'invite_invalid' | 'email' | 'otp' | 'connecting' | 'analyzing'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [pendingOAuthUrl, setPendingOAuthUrl] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(5);

  // Validate invite token on mount
  useEffect(() => {
    const validateInvite = async () => {
      if (!inviteToken) {
        // No invite token provided - public form
        setLoading(false);
        return;
      }

      try {
        console.log('🔍 Validating invite token...');
        const response = await api.get('/api/audits/validate-invite', {
          params: { token: inviteToken },
        });

        console.log('✅ Invite validation result:', response);

        if (!response.valid) {
          if (response.expired) {
            setError('This audit link has expired. Please request a new one.');
          } else {
            setError('Invalid or used audit link.');
          }
          setStep('invite_invalid');
        } else {
          // Valid invite - pre-fill email if available
          if (response.email) {
            setEmail(response.email);
          }
        }
      } catch (err: any) {
        console.error('❌ Invite validation error:', err);
        setError('Failed to validate audit link');
        setStep('invite_invalid');
      } finally {
        setLoading(false);
      }
    };

    validateInvite();
  }, [inviteToken]);

  const handleSendOtp = async () => {
    if (!email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('🔍 Sending OTP...');
      const response = await api.post('/api/audits/send-otp', { email });

      console.log('✅ OTP sent successfully:', response);

      setVerifyToken(response.verifyToken);

      // In dev mode, show the OTP code
      if (response.devCode) {
        setError(`Dev mode: OTP is ${response.devCode}`);
      }

      setStep('otp');
    } catch (err: any) {
      console.error('❌ OTP send error:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to send OTP';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setOtpLoading(true);
    setError('');

    try {
      console.log('🔍 Verifying OTP...');
      const response = await api.post('/api/audits/verify-otp', {
        verifyToken,
        code: otp,
      });

      console.log('✅ OTP verified successfully:', response);

      // Check for Stripe configuration error
      if (response.needs_config) {
        setError('Audit feature not available. Please try again later.');
        setOtpLoading(false);
        return;
      }

      if (!response.stripeAuthUrl) {
        throw new Error('No OAuth URL returned from server');
      }

      setPendingOAuthUrl(response.stripeAuthUrl);
      setShowPermissionModal(true);
    } catch (err: any) {
      console.error('❌ OTP verification error:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to verify OTP';
      setError(errorMsg);

      // Extract attempts left from error message if available
      const match = errorMsg.match(/(\d+) attempt/);
      if (match) {
        setAttemptsLeft(parseInt(match[1]));
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleConfirmOAuth = () => {
    setShowPermissionModal(false);
    setStep('connecting');
    window.location.href = pendingOAuthUrl;
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-[#09090b] dark:to-[#111113] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center">
            <div className="w-10 h-10 rounded-lg bg-brand-600 flex items-center justify-center mb-3 mx-auto">
              <span className="text-white font-bold">R</span>
            </div>
            <div className="text-gray-500 dark:text-gray-400">Loading audit...</div>
          </div>
        </div>
      </div>
    );
  }

  // Show invalid invite state
  if (step === 'invite_invalid') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-[#09090b] dark:to-[#111113] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-xl">✕</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Audit Link Invalid
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {error}
            </p>
          </div>

          <div className="bg-white dark:bg-[#111113] rounded-xl shadow-lg border border-gray-200 dark:border-white/[0.06] p-8">
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Please request a new audit link or contact support for assistance.
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={() => window.location.href = '/audit-request'}
                className="w-full"
              >
                Request New Link
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-[#09090b] dark:to-[#111113] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">R</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Cash Operations Audit
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            See how much working capital you can free up in 90 days
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-[#111113] rounded-xl shadow-lg border border-gray-200 dark:border-white/[0.06] p-8">

          {step === 'email' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Work Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendOtp()}
                  placeholder="you@company.com"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex gap-2">
                    <div className="text-red-600 dark:text-red-400 font-bold">⚠️</div>
                    <div>
                      <p className="text-sm font-medium text-red-900 dark:text-red-200">{error}</p>
                      <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                        Check your email, try again, or <a href="mailto:support@recoverai.com" className="underline">contact support</a>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                onClick={handleSendOtp}
                loading={loading}
                disabled={!email || loading}
                className="w-full"
              >
                Send Verification Code
              </Button>

              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                We'll send a code to verify your email, then connect to your
                Stripe account (read-only) to analyze your invoices.
              </p>
            </div>
          )}

          {step === 'otp' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Enter 6-Digit Code
                </label>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  We sent a code to <strong>{email}</strong>
                </p>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                  onKeyPress={(e) => e.key === 'Enter' && handleVerifyOtp()}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex gap-2">
                    <div className="text-red-600 dark:text-red-400 font-bold">⚠️</div>
                    <div>
                      <p className="text-sm font-medium text-red-900 dark:text-red-200">{error}</p>
                      {attemptsLeft < 5 && (
                        <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                          {attemptsLeft === 0 ? 'Try again in 1 hour' : `${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                onClick={handleVerifyOtp}
                loading={otpLoading}
                disabled={otp.length !== 6 || otpLoading || attemptsLeft === 0}
                className="w-full"
              >
                Verify Code
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setStep('email');
                  setOtp('');
                  setError('');
                }}
                className="w-full"
              >
                Back
              </Button>

              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                Didn't receive the code? Check spam or <a href="mailto:support@recoverai.com" className="underline">contact support</a>
              </p>
            </div>
          )}

          {step === 'connecting' && (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Connecting to Stripe...
              </p>
            </div>
          )}

          {step === 'analyzing' && (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Analyzing your cash operations...
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                This takes 48 hours. We'll email you the results.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-6">
          Your data is secure. We use read-only access and never store your
          financial information.
        </p>
      </div>

      {/* Permission Explainer Modal */}
      <Modal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        size="md"
        title="Connect your Stripe account (read-only)"
      >
        <div className="space-y-6">
          {/* What we can do */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">
              What RecoverAI can access:
            </h4>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Read invoices (amounts, dates, customers)
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Read customers (names, emails, payment history)
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  See payment history (which invoices are paid)
                </span>
              </div>
            </div>
          </div>

          {/* What we cannot do */}
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">
              What RecoverAI cannot do:
            </h4>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-red-600 dark:text-red-400 font-bold">✕</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Charge customers or move funds
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-red-600 dark:text-red-400 font-bold">✕</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Access your bank account or credentials
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-red-600 dark:text-red-400 font-bold">✕</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Modify or delete invoices/charges
                </span>
              </div>
            </div>
          </div>

          {/* Footer with buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowPermissionModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleConfirmOAuth}
              className="flex-1"
            >
              Connect Stripe
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default FreeAuditSignup;
