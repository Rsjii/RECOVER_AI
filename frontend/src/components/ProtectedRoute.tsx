import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Spinner } from './ui/Spinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireEmailVerification?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireEmailVerification: _requireEmailVerification = false }) => {
  const { isAuthenticated, isLoading, company, user } = useAuth();
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

  // Enforce onboarding flow: block dashboard access if not completed
  // BUT: Skip for admin/owner users (they don't go through onboarding)
  // Users must complete: stage-1 → stage-2 → stage-3 → stage-4 → dashboard
  if (_requireEmailVerification) {
    const stage = company?.onboarding_stage;
    const isAdmin = user?.role === 'admin' || user?.role === 'owner';

    // Allow if onboarding is complete OR if user is admin
    if (!isAdmin && stage !== 'trial_active' && stage !== 'paid_active') {
      // Redirect to appropriate onboarding stage based on current progress
      const stageMap: Record<string, string> = {
        pending: '/onboard/stage-1',
        create_account: '/onboard/stage-3',  // Account created, do company details
        details_form: '/onboard/stage-3',     // Company details form, stay on stage-3
        integrations: '/onboard/stage-4',     // Connecting integrations
        audit_report: '/onboard/stage-5',     // Showing analysis
        trial_offer: '/onboard/stage-5',      // Trial offer page
      };

      const redirectTo = stageMap[stage || 'pending'] || '/onboard/stage-1';
      return <Navigate to={redirectTo} replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
