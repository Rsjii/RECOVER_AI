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

  // Enforce onboarding flow: ONLY allow dashboard access after trial starts
  // New CashOS flow: Signup → OTP → Integrations → GenerateAudit → Trial → Dashboard
  if (_requireEmailVerification) {
    const stage = company?.onboardingStage;
    const isAdmin = user?.role === 'admin' || user?.role === 'owner';

    // Dashboard is ONLY accessible after trial is active
    // Admins/owners skip the flow
    if (!isAdmin && stage !== 'trial_active' && stage !== 'paid_active') {
      // Redirect to where they actually are in the pipeline
      if (!stage || stage === 'pending') {
        return <Navigate to="/signup" replace />;
      } else if (stage === 'integrations') {
        return <Navigate to="/integrations" replace />;
      } else if (stage === 'audit_report' || stage === 'trial_offer') {
        return <Navigate to="/generate-audit" replace />;
      }
      return <Navigate to="/signup" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
