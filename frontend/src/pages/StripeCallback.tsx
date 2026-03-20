import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

const StripeCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setErrorMsg(error === 'access_denied' ? 'Stripe connection was cancelled.' : `Stripe error: ${error}`);
      setStatus('error');
      return;
    }

    if (!code) {
      setErrorMsg('No authorization code received from Stripe.');
      setStatus('error');
      return;
    }

    api.post('/api/stripe/oauth/exchange', { code, state })
      .then(() => {
        setStatus('success');
        const redirectTo = state === 'onboarding' ? '/onboarding' : '/settings';
        setTimeout(() => navigate(redirectTo, { replace: true }), 2000);
      })
      .catch((err: any) => {
        setErrorMsg(err.message || 'Failed to connect Stripe account.');
        setStatus('error');
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#09090b]">
      <div className="text-center max-w-md px-6">
        {status === 'loading' && (
          <>
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Connecting Stripe...</h2>
            <p className="text-sm text-gray-500 mt-2">Please wait while we securely connect your account.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Stripe Connected!</h2>
            <p className="text-sm text-gray-500 mt-2">Redirecting you back...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Connection Failed</h2>
            <p className="text-sm text-red-500 mt-2">{errorMsg}</p>
            <button
              onClick={() => navigate('/settings', { replace: true })}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              Back to Settings
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default StripeCallback;
