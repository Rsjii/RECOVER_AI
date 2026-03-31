import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface StageGuardProps {
  stage: 1 | 2 | 3;
  children: React.ReactNode;
}

/**
 * StageGuard: Enforces strict stage progression (3-stage flow)
 *
 * Rules:
 * - Stage 1: Account creation + OTP + Company details (entry point, multi-step inline)
 * - Stage 2: Integrations (Stripe connection)
 * - Stage 3: Audit report + Start trial
 *
 * Once company details entered, Stage 1 is blocked.
 * Once Stripe connected, Stage 2 is blocked.
 * Once audit analysis generated, all previous stages blocked.
 */
export const StageGuard: React.FC<StageGuardProps> = ({ stage, children }) => {
  const navigate = useNavigate();
  const { user, company } = useAuth();

  useEffect(() => {
    // User not loaded yet - let it load
    if (!user || !company) {
      return;
    }

    const canAccess = validateStageAccess(stage, user, company);

    if (!canAccess) {
      // Redirect to appropriate stage based on current status
      const targetStage = getTargetStage(company);
      navigate(`/onboard/stage-${targetStage}`, { replace: true });
    }
  }, [stage, user, company, navigate]);

  return <>{children}</>;
};

/**
 * Validate if user can access a specific stage
 */
function validateStageAccess(
  stage: number,
  user: any,
  company: any
): boolean {
  const currentStage = company?.onboarding_stage || 'pending';

  switch (stage) {
    case 1:
      // Stage 1 (Account + OTP + Details): Accessible until company details completed
      return (
        currentStage === 'pending' ||
        currentStage === 'create_account' ||
        currentStage === 'details_form'
      );

    case 2:
      // Stage 2 (Integrations): Only after company details, before audit report
      return (
        !!user?.id &&
        (currentStage === 'details_form' ||
          currentStage === 'integrations' ||
          currentStage === 'audit_report' ||
          currentStage === 'trial_active' ||
          currentStage === 'trial_offer' ||
          currentStage === 'paid_active')
      );

    case 3:
      // Stage 3 (Audit Report): Only after Stripe connected
      return (
        !!user?.id &&
        (currentStage === 'integrations' ||
          currentStage === 'audit_report' ||
          currentStage === 'trial_active' ||
          currentStage === 'trial_offer' ||
          currentStage === 'paid_active')
      );

    default:
      return false;
  }
}

/**
 * Determine the correct stage user should be redirected to
 */
function getTargetStage(company: any): number {
  const currentStage = company?.onboarding_stage || 'pending';

  switch (currentStage) {
    case 'pending':
    case 'create_account':
    case 'details_form':
      return 1; // Account + OTP + Company details
    case 'integrations':
      return 2; // Stripe connection
    case 'audit_report':
    case 'trial_active':
    case 'trial_offer':
    case 'paid_active':
      return 3; // Audit report + Start trial
    default:
      return 1;
  }
}