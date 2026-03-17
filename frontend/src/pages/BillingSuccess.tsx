import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';

const BillingSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'active' | 'pending'>('loading');

  useEffect(() => {
    document.title = 'Subscription Activated — RecoverAI';
    const check = async () => {
      try {
        const res = await api.get<{ data: { status: string } | null }>(API_ENDPOINTS.billing.subscription);
        const sub = (res as any).data;
        setStatus(sub?.status === 'active' ? 'active' : 'pending');
      } catch {
        setStatus('pending');
      }
    };
    check();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {status === 'loading' ? (
          <div className="text-gray-500 dark:text-gray-400">Confirming your subscription...</div>
        ) : status === 'active' ? (
          <>
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">You're all set!</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              Your subscription is active. RecoverAI will start recovering your overdue invoices automatically.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
            >
              Go to Dashboard →
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Processing your subscription</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              This usually takes a few seconds. Your access will be activated automatically.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
            >
              Go to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default BillingSuccess;
