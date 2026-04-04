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
  // Users must complete: signup → verify-email → integrations → dashboard
  if (_requireEmailVerification) {
    const stage = company?.onboarding_stage;
    // Platform admin (role='admin') skips onboarding entirely
    // Owner must complete integrations first — stage check enforces this
    const isAdmin = user?.role === 'admin';

    // Stages that still need to complete integrations
    const needsIntegrations = !isAdmin && stage !== 'trial_active' && stage !== 'paid_active';

    // If on /integrations route, allow create_account and integrations stages through
    const isIntegrationsPage = location.pathname === '/integrations' || location.pathname === '/audit-report';

    if (needsIntegrations && !isIntegrationsPage) {
      // Not yet at dashboard stage — send to integrations
      return <Navigate to="/integrations" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
