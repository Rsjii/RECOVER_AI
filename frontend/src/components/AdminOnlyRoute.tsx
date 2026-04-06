import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { Spinner } from './ui/Spinner';
import { logError } from '../utils/logger';

interface AdminOnlyRouteProps {
  children: React.ReactNode;
}

const AdminOnlyRoute: React.FC<AdminOnlyRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checkLoading, setCheckLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setCheckLoading(false);
      return;
    }

    // Check if user is admin (in ADMIN_EMAILS backend whitelist)
    api.get<{ isAdmin: boolean }>('/api/admin/check')
      .then((res: any) => {
        const admin = res.data?.isAdmin ?? res.isAdmin ?? false;
        setIsAdmin(admin);
        setCheckLoading(false);
      })
      .catch((err: any) => {
        logError('AdminOnlyRoute', 'checkAdmin', 'Failed to check admin status', err);
        setIsAdmin(false);
        setCheckLoading(false);
      });
  }, [isAuthenticated]);

  // Still loading auth or admin check
  if (isLoading || checkLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-[#09090b] px-4">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mb-4">
          <span className="text-white text-xl font-bold">R</span>
        </div>
        <Spinner size="lg" text="Verifying access..." />
      </div>
    );
  }

  // Not authenticated — redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Not admin — show forbidden page
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0 4v2" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3c1.105 0 2.134.14 3.133.41.752.162 1.435.482 2.042.945a6 6 0 00.944 2.042c.463.607.783 1.29.945 2.042" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This area is restricted to authorized administrators only. If you believe you should have access, please contact support.
          </p>
          <a href="/dashboard" className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  // Admin — show the page
  return <>{children}</>;
};

export default AdminOnlyRoute;
