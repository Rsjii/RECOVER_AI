import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TrialCountdown } from '../TrialCountdown';

interface TrialBannerSectionProps {
  trialEndsAt?: string;
}

export const TrialBannerSection: React.FC<TrialBannerSectionProps> = ({ trialEndsAt }) => {
  const navigate = useNavigate();

  if (!trialEndsAt) return null;

  return (
    <TrialCountdown
      trialEndsAt={trialEndsAt}
      onUpgrade={() => navigate('/pricing')}
    />
  );
};
