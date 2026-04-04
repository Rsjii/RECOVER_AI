import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

type AuthStep = 'auth' | 'otp' | 'details';
type AuthMethod = 'email' | 'google';

export const Stage1: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  // Auth Step
  const [authStep, setAuthStep] = useState<AuthStep>('auth');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP Step (inline, not separate page)
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpAttemptsLeft, setOtpAttemptsLeft] = useState(5);

  // Details Step (company + first/last name)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');

  // Global state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);

  // Progress indicator
  const progressSteps = ['Account', 'Details'];
  const currentProgressStep = authStep === 'auth' ? 0 : 1;

  // Validate token on mount
  useEffect(() => {
    const init = async () => {
      window.history.replaceState(null, '', window.location.href);

      try {
        const check: any = await api.get('/api/audits/check-stage');
        if (check?.stage) {
          if (check.stage === 0) {
            navigate('/dashboard', { replace: true });
          } else {
            navigate(`/onboard/stage-${check.stage}?token=${token || ''}`, { replace: true });
          }
          return;
        }
      } catch {
        // Not authenticated — proceed
      }

      if (!token) {
        setError('Invalid link — no token found');
        setValidating(false);
        return;
      }

      try {
        const res: any = await api.get(`/api/audits/validate-token?token=${token}`);
        setExpiresInDays(res?.expires_in_days ?? null);
        if (res?.pre_filled_email) {
          setEmail(res.pre_filled_email);
        }
        setValidating(false);
      } catch (err: any) {
        setError(err?.message || 'Link expired or invalid');
        setValidating(false);
      }
    };

    init();
  }, [token]);

  // ===== AUTH STEP: Email/Password or OAuth =====
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.includes('@')) {
      setError('Valid email required');
      return;
    }

    if (authMethod === 'email') {
      if (!password || password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
    }

    setLoading(true);
    try {
      const res: any = await api.post('/api/audits/stage/1', {
        token,
        email,
        password: authMethod === 'email' ? password : undefined,
        oauth_provider: authMethod === 'google' ? 'google' : undefined,
      });

      // Google OAuth: account created, go to details
      if (authMethod === 'google' && res?.user) {
        setFirstName(email.split('@')[0]);
        setLastName('');
        setAuthStep('details');
        setLoading(false);
        return;
      }

      // Email+PW: OTP verification required (inline on same page)
      if (res?.requires_otp_verification) {
        setAuthStep('otp');
        setLoading(false);
        return;
      }

      // Should not reach here, but handle it
      setError('Unexpected response');
      setLoading(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to process');
      setLoading(false);
    }
  };

  // ===== OTP STEP: Verify OTP (inline, not separate page) =====
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');

    if (!otp || otp.length < 6) {
      setOtpError('Enter the 6-digit code');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/audits/stage/1/verify-otp', { email, otp, token });
      // OTP verified, now ask for first/last name
      setFirstName(email.split('@')[0]);
      setLastName('');
      setAuthStep('details');
      setLoading(false);
    } catch (err: any) {
      const attempts = err?.details?.attempts_left;
      if (attempts !== undefined) {
        setOtpAttemptsLeft(attempts);
        setOtpError(`Wrong code. ${attempts} attempt${attempts === 1 ? '' : 's'} remaining.`);
      } else {
        setOtpError(err?.message || 'Failed to verify code');
      }
      setLoading(false);
    }
  };

  // ===== DETAILS STEP: First/Last + Company Name =====
  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!firstName.trim()) {
      setError('First name is required');
      return;
    }
    if (!lastName.trim()) {
      setError('Last name is required');
      return;
    }
    if (!companyName.trim()) {
      setError('Company name is required');
      return;
    }

    setLoading(true);
    try {
      // Update user details (first/last name) - now in stage/1/details
      await api.post('/api/audits/stage/1/details', {
        company_name: companyName.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      navigate(`/onboard/stage-2?token=${token}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
      setLoading(false);
    }
  };

  const handleGoogleOAuth = () => {
    setAuthMethod('google');
    setLoading(true);
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirectUri = `${window.location.origin}/auth/google/callback?token=${token}`;
    const scope = 'openid email profile';
    const responseType = 'code';
    const state = Math.random().toString(36).substring(7);

    sessionStorage.setItem('oauth_state', state);
    sessionStorage.setItem('oauth_token', token || '');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      response_type: responseType,
      state,
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700 dark:text-gray-300">Validating your link...</p>
        </div>
      </div>
    );
  }

  if (error && authStep === 'auth') {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">Invalid Link</h1>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
          </div>
          <Button
            onClick={() => navigate('/landing')}
            className="w-full"
          >
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  // ===== AUTH STEP UI =====
  if (authStep === 'auth') {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-md mx-auto">
            {/* Progress */}
            <div className="flex items-center gap-2 mb-10">
              {progressSteps.map((step, i) => (
                <React.Fragment key={step}>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      i <= currentProgressStep
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {i < currentProgressStep ? '✓' : i + 1}
                  </div>
                  <span
                    className={`text-sm ${
                      i < currentProgressStep
                        ? 'text-green-600 dark:text-green-400'
                        : i === currentProgressStep
                        ? 'font-medium text-gray-900 dark:text-white'
                        : 'text-gray-500'
                    }`}
                  >
                    {step}
                  </span>
                  {i < progressSteps.length - 1 && (
                    <div
                      className={`flex-1 h-px ${
                        i < currentProgressStep
                          ? 'bg-green-200 dark:bg-green-800'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    ></div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Create Account</h1>
              <p className="text-gray-600 dark:text-gray-400">
                {expiresInDays ? `This link expires in ${expiresInDays} day${expiresInDays !== 1 ? 's' : ''}` : 'Sign in with your email or Google'}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Tab Selection */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => { setAuthMethod('email'); setError(''); }}
                className={`flex-1 py-2 rounded-lg font-medium transition ${
                  authMethod === 'email'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Email
              </button>
              <button
                onClick={() => { setAuthMethod('google'); setError(''); }}
                className={`flex-1 py-2 rounded-lg font-medium transition ${
                  authMethod === 'google'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Google
              </button>
            </div>

            {/* Email Form */}
            {authMethod === 'email' ? (
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password (min 8 chars)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-600 dark:text-gray-400"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Processing...' : 'Continue'}
                </Button>
              </form>
            ) : (
              <Button
                onClick={handleGoogleOAuth}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Redirecting...' : '🔓 Sign in with Google'}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===== OTP STEP UI (inline, not separate page) =====
  if (authStep === 'otp') {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-md mx-auto">
            {/* Progress */}
            <div className="flex items-center gap-2 mb-10">
              {progressSteps.map((step, i) => (
                <React.Fragment key={step}>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      i <= currentProgressStep
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {i < currentProgressStep ? '✓' : i + 1}
                  </div>
                  <span
                    className={`text-sm ${
                      i < currentProgressStep
                        ? 'text-green-600 dark:text-green-400'
                        : i === currentProgressStep
                        ? 'font-medium text-gray-900 dark:text-white'
                        : 'text-gray-500'
                    }`}
                  >
                    {step}
                  </span>
                  {i < progressSteps.length - 1 && (
                    <div
                      className={`flex-1 h-px ${
                        i < currentProgressStep
                          ? 'bg-green-200 dark:bg-green-800'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    ></div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Verify Email</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Check your email for a 6-digit code
              </p>
            </div>

            {otpError && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-700 dark:text-red-400 text-sm">{otpError}</p>
              </div>
            )}

            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <Input
                type="text"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                disabled={loading}
                className="text-center tracking-widest"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {otpAttemptsLeft} attempt{otpAttemptsLeft === 1 ? '' : 's'} remaining
              </p>
              <Button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </Button>
              <button
                type="button"
                onClick={() => setAuthStep('auth')}
                className="w-full text-blue-600 dark:text-blue-400 text-sm hover:underline"
              >
                ← Back to Email
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ===== DETAILS STEP UI (First/Last + Company Name) =====
  if (authStep === 'details') {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-md mx-auto">
            {/* Progress */}
            <div className="flex items-center gap-2 mb-10">
              {progressSteps.map((step, i) => (
                <React.Fragment key={step}>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      i <= currentProgressStep
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {i < currentProgressStep ? '✓' : i + 1}
                  </div>
                  <span
                    className={`text-sm ${
                      i < currentProgressStep
                        ? 'text-green-600 dark:text-green-400'
                        : i === currentProgressStep
                        ? 'font-medium text-gray-900 dark:text-white'
                        : 'text-gray-500'
                    }`}
                  >
                    {step}
                  </span>
                  {i < progressSteps.length - 1 && (
                    <div
                      className={`flex-1 h-px ${
                        i < currentProgressStep
                          ? 'bg-green-200 dark:bg-green-800'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    ></div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Tell us about yourself</h1>
              <p className="text-gray-600 dark:text-gray-400">
                We'll use this to personalize your experience
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleDetailsSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={loading}
                />
                <Input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Input
                type="text"
                placeholder="Company Name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={loading}
              />
              <Button
                type="submit"
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Continuing...' : 'Continue to Integrations'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
