import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { Button } from '../components/ui/Button';
import { validateEmail } from '../lib/utils';

const ForgotPassword: React.FC = () => {
  useEffect(() => { document.title = 'Reset Password — RecoverAI'; }, []);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !validateEmail(email)) { setError('Enter a valid email'); return; }
    setSubmitting(true);
    setError('');
    try {
      await api.post(API_ENDPOINTS.auth.forgotPassword, { email });
      setSent(true);
    } catch { setSent(true); /* Always show success for security */ }
    finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">R</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reset your password</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">We'll send you a link to reset it</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Check your email</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                If an account with that email exists, we've sent a password reset link.
              </p>
              <Link to="/login" className="text-blue-600 hover:text-blue-700 text-sm font-medium">← Back to sign in</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@company.com"
                  className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`} />
                {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
              </div>
              <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full">Send reset link</Button>
              <p className="text-center"><Link to="/login" className="text-sm text-blue-600 hover:text-blue-700 font-medium">← Back to sign in</Link></p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

