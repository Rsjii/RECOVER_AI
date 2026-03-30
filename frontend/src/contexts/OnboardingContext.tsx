import React, { createContext, useState, useCallback, useEffect } from 'react';

export type OnboardingStep = 'signup' | 'otp' | 'integrations' | 'audit' | 'trial-complete' | 'done';

export interface OnboardingState {
  step: OnboardingStep;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
  authMethod: 'email' | 'google'; // 'email' = OTP, 'google' = skip OTP
  otpCode: string;
  accountCreated: boolean;
  integrationMethod: 'stripe' | 'manual' | null;
  auditGenerated: boolean;
  trialStarted: boolean;
}

export interface OnboardingContextType extends OnboardingState {
  setStep: (step: OnboardingStep) => void;
  updateState: (updates: Partial<OnboardingState>) => void;
  canGoBack: () => boolean; // Can user go back from this step?
  goToStep: (step: OnboardingStep) => void; // Enforces one-way progression
  resetOnboarding: () => void;
  syncWithBackend: (backendStage: string) => void; // Sync local state with backend
}

const initialState: OnboardingState = {
  step: 'signup',
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  companyName: '',
  authMethod: 'email',
  otpCode: '',
  accountCreated: false,
  integrationMethod: null,
  auditGenerated: false,
  trialStarted: false,
};

export const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const STORAGE_KEY = 'cashos_onboarding_state';

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<OnboardingState>(() => {
    // Load from localStorage on mount
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : initialState;
    } catch {
      return initialState;
    }
  });

  // Persist to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Block browser back button after account created
  useEffect(() => {
    if (state.accountCreated) {
      window.history.replaceState(null, '', window.location.href);
    }
  }, [state.accountCreated]);

  const setStep = useCallback((step: OnboardingStep) => {
    setState(prev => ({ ...prev, step }));
  }, []);

  const updateState = useCallback((updates: Partial<OnboardingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const canGoBack = useCallback((): boolean => {
    // Can only go back during signup and OTP steps (before account creation)
    // If account created, user is locked in forward path
    return !state.accountCreated && (state.step === 'signup' || state.step === 'otp');
  }, [state.accountCreated, state.step]);

  const goToStep = useCallback((targetStep: OnboardingStep) => {
    // Define allowed transitions (one-way progression)
    const stepOrder: OnboardingStep[] = ['signup', 'otp', 'integrations', 'audit', 'trial-complete', 'done'];
    const currentIndex = stepOrder.indexOf(state.step);
    const targetIndex = stepOrder.indexOf(targetStep);

    // Allow backward only during signup/OTP (before account creation)
    if (targetIndex < currentIndex && !canGoBack()) {
      console.warn(`Cannot go back from step "${state.step}" - account already created`);
      return;
    }

    // Allow forward or backward (if allowed)
    if (targetIndex >= currentIndex || canGoBack()) {
      setState(prev => ({ ...prev, step: targetStep }));
    } else {
      console.warn(`Cannot skip steps - must follow order: ${stepOrder.join(' → ')}`);
    }
  }, [state.step, canGoBack]);

  const resetOnboarding = useCallback(() => {
    setState(initialState);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const syncWithBackend = useCallback((backendStage: string) => {
    // Map backend onboarding_stage to frontend step
    const stageToStepMap: Record<string, OnboardingStep> = {
      'pending': 'signup',
      'details_form': 'signup',
      'integrations': 'integrations',
      'audit_report': 'audit',
      'trial_offer': 'audit',
      'trial_active': 'trial-complete',
      'paid_active': 'done',
    };

    const frontendStep = stageToStepMap[backendStage] || 'signup';

    setState(prev => ({
      ...prev,
      step: frontendStep,
      // Mark account as created if stage is beyond 'integrations'
      accountCreated: ['integrations', 'audit_report', 'trial_offer', 'trial_active', 'paid_active'].includes(backendStage),
      // Mark audit as generated if stage is beyond 'integrations'
      auditGenerated: ['audit_report', 'trial_offer', 'trial_active', 'paid_active'].includes(backendStage),
      // Mark trial as started if stage is 'trial_active' or beyond
      trialStarted: ['trial_active', 'paid_active'].includes(backendStage),
    }));
  }, []);

  return (
    <OnboardingContext.Provider value={{
      ...state,
      setStep,
      updateState,
      canGoBack,
      goToStep,
      resetOnboarding,
      syncWithBackend,
    }}>
      {children}
    </OnboardingContext.Provider>
  );
};