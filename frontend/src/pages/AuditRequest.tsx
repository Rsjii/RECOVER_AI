import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useNotification } from '../hooks/useNotification';

type Step = 'form' | 'verify' | 'success';

interface FormData {
  email: string;
  company_name: string;
  industry?: string;
}

const AuditRequest: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useNotification();

  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    email: '',
    company_name: '',
    industry: '',
  });
  const [otp, setOtp] = useState('');
  const [requestId, setRequestId] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  // STEP 1: Submit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate
      if (!formData.email || !formData.company_name) {
        addToast({
          type: 'error',
          message: 'Please fill in email and company name',
        });
        setLoading(false);
        return;
      }

      // Submit form
      const res: any = await api.post('/api/audits/requests/submit', {
        email: formData.email,
        company_name: formData.company_name,
        industry: formData.industry || undefined,
      });

      setRequestId(res.requestId || res.id);
      addToast({
        type: 'success',
        message: '✓ OTP sent to your email',
      });
      setStep('verify');
    } catch (err: any) {
      console.error('Form submission error:', err);
      addToast({
        type: 'error',
        message: err?.message || 'Failed to submit form',
      });
    } finally {
      setLoading(false);
    }
  };

  // STEP 1B: Google OAuth
  const handleGoogleOAuth = () => {
    setGoogleLoading(true);
    // Redirect to Google OAuth - backend will handle and auto-approve
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const scope = 'openid profile email';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=audit-request`;
    window.location.href = authUrl;
  };

  // STEP 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!otp || otp.length !== 6) {
        addToast({
          type: 'error',
          message: 'Please enter a valid 6-digit OTP',
        });
        setLoading(false);
        return;
      }

      await api.post('/api/audits/requests/verify-email', {
        requestId,
        otp,
      });

      addToast({
        type: 'success',
        message: '✓ Email verified! Admin will review your request soon.',
      });
      setStep('success');
    } catch (err: any) {
      console.error('OTP verification error:', err);
      addToast({
        type: 'error',
        message: err?.message || 'Invalid OTP',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Free AR Audit
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            See billing errors costing you money. No credit card required.
          </p>
        </div>

        {/* STEP 1: Form */}
        {step === 'form' && (
          <Card className="bg-white dark:bg-gray-800 p-8 max-w-md mx-auto">
            <form onSubmit={handleSubmitForm} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  placeholder="Acme Inc"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Industry (Optional)
                </label>
                <select
                  value={formData.industry || ''}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select industry</option>
                  <option value="SaaS">SaaS</option>
                  <option value="Fintech">Fintech</option>
                  <option value="E-commerce">E-commerce</option>
                  <option value="Marketplace">Marketplace</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <Button
                type="submit"
                disabled={loading || googleLoading}
                loading={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg"
              >
                {loading ? 'Sending OTP...' : 'Send OTP to Email'}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                    or
                  </span>
                </div>
              </div>

              <Button
                type="button"
                disabled={googleLoading || loading}
                loading={googleLoading}
                onClick={handleGoogleOAuth}
                variant="secondary"
                className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 font-semibold py-3 rounded-lg"
              >
                <svg className="w-5 h-5 mr-2 inline-block" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.7035 0 12.0003 0C7.31028 0 3.25527 2.69 1.3253 6.48998L5.9603 9.6C6.87527 7.215 9.27028 4.75 12.0003 4.75Z" fill="#EA4335"/>
                  <path d="M23.49 12.26C23.49 11.7399 23.422 11.25 23.291 10.79H12V14.51H18.47C18.185 15.99 17.45 17.15 16.404 17.86V20.62H20.094C21.9779 18.715 23.49 15.9695 23.49 12.26Z" fill="#4285F4"/>
                  <path d="M5.84 14.09C5.287 13.54 4.9 12.84 4.9 12C4.9 11.16 5.287 10.46 5.84 9.91L1.3253 6.48998C0.5553 7.9099 0.2003 9.4899 0.2003 12C0.2003 14.51 0.5553 16.09 1.3253 17.51L5.84 14.09Z" fill="#FBBC04"/>
                  <path d="M12.0003 23.75C15.7035 23.75 17.9502 22.5 19.7452 20.62H16.404V17.86C15.3945 18.5699 14.1795 19.0199 12.9995 19.0199C10.4765 19.0199 8.3035 17.4799 7.65028 15.335L4.07477 18.51C5.21477 21.44 8.87028 23.75 12.0003 23.75Z" fill="#34A853"/>
                </svg>
                Continue with Google
              </Button>

              <p className="text-xs text-center text-gray-600 dark:text-gray-400 mt-4">
                No OTP needed with Google OAuth - auto-approved
              </p>
            </form>
          </Card>
        )}

        {/* STEP 2: Verify OTP */}
        {step === 'verify' && (
          <Card className="bg-white dark:bg-gray-800 p-8 max-w-md mx-auto">
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="text-center mb-6">
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Enter the 6-digit code sent to <br />
                  <span className="font-semibold text-gray-900 dark:text-white">{formData.email}</span>
                </p>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center text-2xl tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                disabled={loading || otp.length !== 6}
                loading={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg"
              >
                {loading ? 'Verifying...' : 'Verify & Submit'}
              </Button>

              <button
                type="button"
                onClick={() => setStep('form')}
                className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Back to form
              </button>
            </form>
          </Card>
        )}

        {/* STEP 3: Success */}
        {step === 'success' && (
          <Card className="bg-white dark:bg-gray-800 p-8 max-w-md mx-auto text-center">
            <div className="text-5xl mb-4">✓</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Request Submitted!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Thanks for applying. Our team will review your request and send you an audit link within 24-48 hours.
            </p>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                <strong>What happens next:</strong>
                <br />
                We'll analyze your Stripe data and send you a detailed billing audit showing duplicate invoices, billing errors, and recovery opportunities.
              </p>
            </div>

            <Button
              onClick={() => navigate('/landing')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg"
            >
              Back to Home
            </Button>
          </Card>
        )}

        {/* Footer Info */}
        <div className="mt-12 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            🔒 Your data is encrypted and never shared. | Check your spam folder if you don't see the OTP.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuditRequest;