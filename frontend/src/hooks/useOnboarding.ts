import { useContext } from 'react';
import { OnboardingContext } from '../contexts/OnboardingContext';
import type { OnboardingContextType } from '../contexts/OnboardingContext';

export const useOnboarding = (): OnboardingContextType => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
