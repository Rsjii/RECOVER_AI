import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface StageGuardProps {
  stage: 1 | 2 | 3 | 4 | 5;
  children: React.ReactNode;
}

/**
 * StageGuard: Enforces strict stage progression
 *
 * Rules:
 * - Stage 1: Always accessible (entry point)
 * - Stage 2: Only if email entered OR account being created
 * - Stage 3: Only if account created (user exists)
 * - Stage 4: Only if company details entered + stripe_api_key_encrypted
 * - Stage 5: Only if analysis not yet generated, OR if already passed stage 5
 *
 * Once account is created, stages 1-2 are blocked.
 * Once Stage 5 analysis succeeds, all previous stages blocked.
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
      const targetStage = getTargetStage(user, company);
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
      // Stage 1: Only accessible if account not yet created
      // If user exists, they've passed stage 1
      return !user?.id || currentStage === 'pending' || currentStage === 'create_account';

    case 2:
      // Stage 2: Only if account being created (create_account stage)
      // Can go back to Stage 1 from here to change email
      return currentStage === 'create_account' || currentStage === 'pending';

    case 3:
      // Stage 3: Only if account created (user exists) and not yet in integrations
      // Block if still in create_account, allow if details_form or beyond
      return (
        !!user?.id &&
        (currentStage === 'details_form' ||
          currentStage === 'integrations' ||
          currentStage === 'audit_report' ||
          currentStage === 'trial_active' ||
          currentStage === 'trial_offer' ||
          currentStage === 'paid_active')
      );

    case 4:
      // Stage 4: Only if company details entered and not yet in audit_report
      return (
        !!user?.id &&
        (currentStage === 'integrations' ||
          currentStage === 'audit_report' ||
          currentStage === 'trial_active' ||
          currentStage === 'trial_offer' ||
          currentStage === 'paid_active')
      );

    case 5:
      // Stage 5: Only if in integrations (Stripe connected) or audit_report
      // Once in audit_report, stay there. Can't go back.
      return (
        !!user?.id &&
        (currentStage === 'integrations' || currentStage === 'audit_report' || currentStage === 'trial_active' || currentStage === 'trial_offer' || currentStage === 'paid_active')
      );

    default:
      return false;
  }
}

/**
 * Determine the correct stage user should be redirected to
 */
function getTargetStage(user: any, company: any): number {
  const currentStage = company?.onboarding_stage || 'pending';

  if (!user?.id) {
    return 1; // Not authenticated, go to stage 1
  }

  switch (currentStage) {
    case 'pending':
    case 'create_account':
      return 1; // Still creating account
    case 'details_form':
      return 3; // In company details
    case 'integrations':
      return 4; // In Stripe connection
    case 'audit_report':
    case 'trial_active':
    case 'trial_offer':
    case 'paid_active':
      return 5; // In or past audit report
    default:
      return 1;
  }
}