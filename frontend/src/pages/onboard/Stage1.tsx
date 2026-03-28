import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

type AuthMethod = 'email' | 'google';

export const Stage1: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Load from SessionStorage on mount (only if same token)
  useEffect(() => {
    const storedToken = sessionStorage.getItem('current-token');

    // Different token = new invite link, clear all SessionStorage
    if (storedToken && storedToken !== token) {
      sessionStorage.removeItem('stage-1-data');
      sessionStorage.removeItem('stage-2-data');
      sessionStorage.removeItem('stage-3-data');
      sessionStorage.removeItem('current-token');
      return;
    }

    // Store current token
    if (token) {
      sessionStorage.setItem('current-token', token);
    }

    // Load Stage 1 data only if token matches
    const saved = sessionStorage.getItem('stage-1-data');
    if (saved && storedToken === token) {
      const { authMethod: am, email: e, password: p } = JSON.parse(saved);
      setAuthMethod(am || 'email');
      setEmail(e || '');
      setPassword(p || '');
    }
  }, [token]);

  // Save to SessionStorage on change
  useEffect(() => {
    sessionStorage.setItem('stage-1-data', JSON.stringify({ authMethod, email, password }));
  }, [authMethod, email, password]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);

  useEffect(() => {
    const init = async () => {
      // Block chrome back button from going before this stage
      window.history.replaceState(null, '', window.location.href);

      // 1. Check if user already has a valid session → resume from correct stage
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
        // Not authenticated — proceed with token validation below
      }

      // 2. Validate invite token
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

  const handleSubmit = async (e: React.FormEvent) => {
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

      // Google → account created, go to details
      if (authMethod === 'google' && res?.user) {
        navigate(`/onboard/stage-3?token=${token}`);
        return;
      }

      // Email+PW → OTP sent
      if (res?.requires_otp_verification) {
        navigate(`/onboard/stage-2?token=${token}&email=${encodeURIComponent(email)}`);
        return;
      }

      navigate(`/onboard/stage-3?token=${token}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to process');
      setLoading(false);
    }
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

  if (error && !email) {
    const alreadyUsed = error.includes('already been used');
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="text-4xl mb-4">{alreadyUsed ? '🔑' : '❌'}</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {alreadyUsed ? 'Account Already Created' : 'Invalid Link'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          {alreadyUsed && (
            <a
              href="/login"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Sign In →
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-10">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Account</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 text-gray-500 rounded-full flex items-center justify-center text-sm">2</div>
            <span className="text-sm text-gray-500">Details</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 text-gray-500 rounded-full flex items-center justify-center text-sm">3</div>
            <span className="text-sm text-gray-500">Connect</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 text-gray-500 rounded-full flex items-center justify-center text-sm">4</div>
            <span className="text-sm text-gray-500">Analysis</span>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Create Your Account</h1>
            {expiresInDays !== null && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Invite valid for {expiresInDays} more days</p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Auth method tabs */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAuthMethod('email')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                  authMethod === 'email'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Email + Password
              </button>
              <button
                type="button"
                onClick={() => setAuthMethod('google')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                  authMethod === 'google'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Google
              </button>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email *
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                disabled={loading}
              />
            </div>

            {/* Password (email method only) */}
            {authMethod === 'email' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password (8+ characters) *
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
            )}

            <Button type="submit" fullWidth disabled={loading} className="mt-6">
              {loading
                ? (authMethod === 'email' ? 'Sending code...' : 'Creating account...')
                : (authMethod === 'email' ? 'Continue →' : 'Sign up with Google →')}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            Already have an account?{' '}
            <a href="/login" className="text-blue-600 hover:underline font-medium">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
};
