import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { logError } from '../utils/logger';
import { Button } from '../components/ui/Button';
import { useNotification } from '../hooks/useNotification';
import GoogleAuthButton from '../components/GoogleAuthButton';

type OnboardStep = 'email' | 'company' | 'stripe' | 'success';

interface InviteInfo {
  token: string;
  email?: string;
  company_name: string;
  company_domain?: string;
  expires_at: string;
  is_expired: boolean;
  is_used: boolean;
  email_locked: boolean;
}

export default function Onboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToast } = useNotification();

  const token = searchParams.get('token');
  const email_param = searchParams.get('email');

  const [step, setStep] = useState<OnboardStep>('email');
  const [loading, setLoading] = useState(true);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Email step state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Company step state
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) {
      setError('No invite token provided');
      setLoading(false);
      return;
    }

    try {
      const res = await api.get<any>(`/api/invites/${token}`);

      // Response structure: api returns response.data which is { data: { token, email, company_name, ... } }
      // So we need to unwrap one level
      let info = res?.data || res;
      if (info?.data && !info?.company_name && typeof info.data === 'object') {
        info = info.data; // Unwrap one more level if needed
      }

      if (!info?.company_name) {
        logError('Component', 'handler', 'Missing company_name in response:', { res, info });
        setError('Invalid invite data received from server');
        setLoading(false);
        return;
      }

      if (info.is_expired || info.is_used) {
        setError('This invite link has expired or has already been used');
        setLoading(false);
        return;
      }

      setInviteInfo(info);
      setEmail(info.email || email_param || '');
      setCompanyName(info.company_name);
      setLoading(false);
    } catch (err: any) {
      logError('Component', 'handler', 'Token validation error:', err);
      setError(err?.response?.data?.error || 'Invalid or expired invite link');
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !firstName || !lastName) {
      setError('All fields are required');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/onboard-with-token', {
        token,
        email: email.toLowerCase(),
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });

      addToast({ type: 'success', message: 'Account created! Please complete your company information.' });
      setStep('company');
    } catch (err: any) {
      const message = err.error || err.message || 'Failed to create account';
      setError(message);
      addToast({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  };

  const handleCompanyForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim()) {
      setError('Company name is required');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/onboard/company-info', {
        company_name: companyName.trim(),
      });

      addToast({ type: 'success', message: 'Account ready! Now connect your Stripe account.' });
      // Full page reload to /setup so AuthContext refreshes with the new session cookie
      window.location.href = '/setup';
    } catch (err: any) {
      const message = err.error || err.message || 'Failed to save company information';
      setError(message);
      addToast({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  };

  const handleStripeConnect = () => {
    // Redirect to backend Stripe OAuth authorize endpoint
    // Must use full backend URL, not relative path
    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    window.location.href = `${backendUrl}/api/stripe/oauth/authorize`;
  };

  if (loading && step === 'email') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-4">Invalid Invite</h1>
          <p className="text-gray-300 mb-6">{error}</p>
          <Button
            onClick={() => navigate('/')}
            variant="primary"
            className="w-full"
          >
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">RecoverAI</h1>
          <p className="text-gray-400">Complete your setup</p>
        </div>

        {/* Email & Authentication Step */}
        {step === 'email' && inviteInfo && (
          <form onSubmit={handleEmailSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={inviteInfo.email_locked}
                className={`w-full px-4 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  inviteInfo.email_locked ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                placeholder="your@email.com"
              />
              {inviteInfo.email_locked && (
                <p className="text-xs text-gray-400 mt-1">Email locked to invitation</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="John"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Smith"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-300"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Min 8 characters</p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Continue'}
            </Button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-800 text-gray-400">or</span>
              </div>
            </div>

            <GoogleAuthButton />
          </form>
        )}

        {/* Company Form Step */}
        {step === 'company' && (
          <form onSubmit={handleCompanyForm} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Company Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your Company"
              />
              <p className="text-xs text-gray-400 mt-1">
                This is shown to your customers in dunning emails
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Continue to Stripe'}
            </Button>
          </form>
        )}

        {/* Stripe Connection Step */}
        {step === 'stripe' && (
          <div className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p className="text-blue-300 text-sm">
                Connect your Stripe account to start tracking payments and revenue recovery.
              </p>
            </div>

            <Button
              onClick={handleStripeConnect}
              variant="primary"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Connecting...' : '🔗 Connect Stripe'}
            </Button>

            <p className="text-xs text-gray-400 text-center mt-4">
              We'll retrieve your invoices and customers (read-only access)
            </p>
          </div>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <div className="text-center space-y-4">
            <div className="text-6xl">🎉</div>
            <h2 className="text-2xl font-bold text-white">Setup Complete!</h2>
            <p className="text-gray-300">
              Your AR recovery system is now live. Check your dashboard to see your invoices and start optimizing collection.
            </p>
            <Button
              onClick={() => navigate('/dashboard')}
              variant="primary"
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
