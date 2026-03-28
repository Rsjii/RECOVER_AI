import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const Stage2: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';
  const navigate = useNavigate();

  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(5);

  // Load OTP from SessionStorage on mount (only if same token)
  React.useEffect(() => {
    const storedToken = sessionStorage.getItem('current-token');

    // Only load if same token
    if (storedToken === token) {
      const saved = sessionStorage.getItem('stage-2-data');
      if (saved) {
        const { otp: savedOtp } = JSON.parse(saved);
        if (savedOtp) setOtp(savedOtp);
      }
    }
  }, [token]);

  // Save OTP to SessionStorage on change
  React.useEffect(() => {
    sessionStorage.setItem('stage-2-data', JSON.stringify({ otp }));
  }, [otp]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!otp || otp.length < 6) {
      setError('Enter the 6-digit code');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/audits/stage/1/verify-otp', { email, otp, token });
      // Use replace to remove Stage 2 from history (block chrome back)
      navigate(`/onboard/stage-3?token=${token}`, { replace: true });
    } catch (err: any) {
      const attempts = err?.details?.attempts_left;
      if (attempts !== undefined) {
        setAttemptsLeft(attempts);
        setError(`Wrong code. ${attempts} attempt${attempts === 1 ? '' : 's'} remaining.`);
      } else {
        setError(err?.message || 'Failed to verify code');
      }
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(`/onboard/stage-1?token=${token}`);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-10">
            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">✓</div>
            <span className="text-sm text-gray-500">Account</span>
            <div className="flex-1 h-px bg-blue-200 dark:bg-blue-800"></div>
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">Verify</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 text-gray-500 rounded-full flex items-center justify-center text-sm">3</div>
            <span className="text-sm text-gray-500">Details</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 text-gray-500 rounded-full flex items-center justify-center text-sm">4</div>
            <span className="text-sm text-gray-500">Connect</span>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Check Your Email</h1>
            <p className="text-gray-600 dark:text-gray-400">
              We sent a 6-digit code to <strong>{email}</strong>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Verification Code *
              </label>
              <Input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                disabled={loading}
                className="text-center font-mono text-2xl tracking-widest"
              />
              {attemptsLeft <= 2 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  Warning: {attemptsLeft} attempt{attemptsLeft === 1 ? '' : 's'} remaining
                </p>
              )}
            </div>

            <div className="space-y-3 mt-6">
              <Button type="submit" fullWidth disabled={loading || otp.length < 6}>
                {loading ? 'Verifying...' : 'Verify & Continue →'}
              </Button>

              <Button type="button" variant="secondary" fullWidth onClick={handleBack} disabled={loading}>
                ← Back
              </Button>
            </div>
          </form>

          <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-6">
            Didn't receive it?{' '}
            <button
              type="button"
              onClick={handleBack}
              className="text-blue-600 hover:underline font-medium"
            >
              Resend code
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
