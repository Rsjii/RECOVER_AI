import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

const Unsubscribe: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'idle'>('idle');
  const [message, setMessage] = useState('');
  const token = searchParams.get('token');

  useEffect(() => {
    document.title = 'Unsubscribe — RecoverAI';
  }, []);

  const handleUnsubscribe = async () => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid unsubscribe link. Please contact support.');
      return;
    }
    setStatus('loading');
    try {
      const res = await api.post<{ message: string }>('/api/customers/unsubscribe', { token });
      setStatus('success');
      setMessage(res.message || 'You have been unsubscribed.');
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        {status === 'idle' && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Unsubscribe from emails</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              You will no longer receive payment reminder emails. This cannot be undone from here — contact the sender to resubscribe.
            </p>
            <button
              onClick={handleUnsubscribe}
              className="w-full px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              Confirm Unsubscribe
            </button>
          </>
        )}

        {status === 'loading' && (
          <>
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-300">Processing...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Unsubscribed</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Something went wrong</h2>
            <p className="text-sm text-red-500 mb-4">{message}</p>
            <button
              onClick={handleUnsubscribe}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg text-sm hover:bg-gray-300"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
