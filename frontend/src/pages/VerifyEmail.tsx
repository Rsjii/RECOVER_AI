import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNotification } from '../hooks/useNotification';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useNotification();
  const { setUser } = useAuth();
  const fromLocation = (location.state as any)?.from;
  const from = typeof fromLocation === 'string' ? fromLocation : fromLocation?.pathname || '/dashboard';
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown === 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleDigitChange = (index: number, value: string) => {
    // Only allow digits
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);

    // Auto-advance to next input if digit entered
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      // Auto-focus previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otp = digits.join('');
    if (otp.length !== 6) {
      addToast({ type: 'error', message: 'Please enter all 6 digits' });
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/verify-email', { otp });

      addToast({ type: 'success', message: 'Email verified successfully!' });

      // Refresh auth context so emailVerified = true before navigating
      try {
        const meData = await api.get('/api/auth/me');
        if (meData.user) setUser(meData.user);
      } catch {
        // Non-critical — navigate anyway
      }

      navigate(from, { replace: true });
    } catch (err: any) {
      const msg = err.message || 'Invalid or expired OTP';
      const isExpired = msg.toLowerCase().includes('expired');
      addToast({
        type: 'error',
        message: isExpired ? 'Code expired — click Resend to get a new one' : msg,
      });
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;

    setLoading(true);
    try {
      let email: string | undefined;
      try {
        const meData = await api.get('/api/auth/me');
        email = meData.user?.email;
      } catch {
        // Not authenticated — email param will be used if available
      }

      await api.post('/api/auth/resend-otp', { email });

      addToast({ type: 'success', message: 'OTP sent to your email' });
      setResendCooldown(60);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to resend OTP. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Verify Your Email
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              We sent a 6-digit code to your email
            </p>
          </div>

          {/* OTP Input Grid */}
          <div className="flex justify-center gap-3 mb-8">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                placeholder="0"
                className="w-12 h-12 text-center text-xl font-bold border-2 border-gray-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none transition"
              />
            ))}
          </div>

          {/* Verify Button */}
          <button
            onClick={handleVerify}
            disabled={loading || digits.join('').length !== 6}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition mb-4"
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>

          {/* Resend OTP */}
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
              Didn't receive the code?
            </p>
            <button
              onClick={handleResendOtp}
              disabled={resendCooldown > 0 || loading}
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-semibold disabled:text-gray-400"
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
            </button>
          </div>

          {/* Info Text */}
          <p className="text-center text-xs text-gray-500 dark:text-gray-500 mt-6">
            Code valid for 15 minutes
          </p>
          {import.meta.env.DEV && (
            <p className="text-center text-xs text-blue-500 mt-2">
              Dev mode: use code <strong>123456</strong>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
