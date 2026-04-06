import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Spinner } from './ui/Spinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireEmailVerification?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireEmailVerification: _requireEmailVerification = false }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-[#09090b] px-4">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mb-4">
          <span className="text-white text-xl font-bold">R</span>
        </div>
        <Spinner size="lg" text="Preparing your workspace..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Enforce strict onboarding pipeline using user.onboardingStatus
  // Pipeline: pending_profile → integrations_pending → active
  if (_requireEmailVerification) {
    const status = user?.onboardingStatus;
    const currentPath = location.pathname;

    // Admin users skip onboarding
    const isAdmin = user?.role === 'admin';

    if (!isAdmin && status === 'pending_profile') {
      // User MUST be on /profile — cannot access any other page
      if (currentPath !== '/profile') {
        return <Navigate to="/profile" replace />;
      }
    } else if (!isAdmin && status === 'integrations_pending') {
      // User MUST be on /integrations or /audit-report — cannot access dashboard yet
      if (currentPath !== '/integrations' && currentPath !== '/audit-report') {
        return <Navigate to="/integrations" replace />;
      }
    }
    // If status === 'active', user can access all pages
  }

  return <>{children}</>;
};

export default ProtectedRoute;
