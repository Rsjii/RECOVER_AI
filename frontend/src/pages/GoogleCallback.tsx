import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';

const GoogleCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { addToast } = useNotification();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        addToast({ type: 'error', message: `Google login failed: ${error}` });
        navigate('/login');
        return;
      }

      if (!code) {
        addToast({ type: 'error', message: 'No authorization code received' });
        navigate('/login');
        return;
      }

      try {
        // Call backend OAuth callback endpoint
        const response = await api.post('/api/auth/oauth/google/callback', { code, state });

        if (response.data && response.data.user) {
          addToast({ type: 'success', message: 'Welcome!' });
          navigate('/dashboard');
        }
      } catch (err: any) {
        addToast({ type: 'error', message: err.message || 'Google login failed' });
        navigate('/login');
      }
    };

    handleCallback();
  }, [searchParams, navigate, login, addToast]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090b] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Signing in with Google...</p>
      </div>
    </div>
  );
};

export default GoogleCallback;
