import { useState, useCallback } from 'react';

export interface TourConfig {
  id: string;
  title: string;
  steps: Array<{
    id: string;
    title: string;
    description: string;
    target?: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
  }>;
}

export const useCustomTour = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTour, setCurrentTour] = useState<TourConfig | null>(null);

  const startTour = useCallback((tour: TourConfig) => {
    setCurrentTour(tour);
    setIsOpen(true);
  }, []);

  const closeTour = useCallback(() => {
    setIsOpen(false);
    setCurrentTour(null);
  }, []);

  const completeTour = useCallback((tourId: string) => {
    localStorage.setItem(`tour_${tourId}_completed`, 'true');
    closeTour();
  }, [closeTour]);

  const markTourStarted = useCallback((tourId: string) => {
    // Mark as "started" so auto-restart won't trigger again
    // But don't mark as "completed" - user can restart from Settings
    localStorage.setItem(`tour_${tourId}_started`, 'true');
  }, []);

  const isTourCompleted = (tourId: string): boolean => {
    return localStorage.getItem(`tour_${tourId}_completed`) === 'true';
  };

  const isTourStarted = (tourId: string): boolean => {
    return localStorage.getItem(`tour_${tourId}_started`) === 'true';
  };

  const resetTour = (tourId: string) => {
    localStorage.removeItem(`tour_${tourId}_completed`);
    localStorage.removeItem(`tour_${tourId}_started`);
  };

  return {
    isOpen,
    currentTour,
    startTour,
    closeTour,
    completeTour,
    markTourStarted,
    isTourCompleted,
    isTourStarted,
    resetTour,
  };
};

// Main dashboard tour config
export const mainDashboardTour: TourConfig = {
  id: 'main_onboarding',
  title: 'RecoverAI Dashboard Tour',
  steps: [
    {
      id: 'welcome',
      title: '🎉 Welcome to RecoverAI',
      description:
        'Your autonomous AR recovery agent is ready. We\'ll help you recover unpaid invoices with AI-generated dunning emails. Let\'s explore the dashboard.',
    },
    {
      id: 'kpi',
      title: '📊 Key Metrics',
      description:
        'Track your recovery performance: AR Recovered, Invoices At Risk, Cash Position, and anomalies detected. These numbers update as the agent works.',
      target: '[data-tour="kpi-banner"]',
    },
    {
      id: 'activity',
      title: '📋 Recent Activity',
      description:
        'See real-time actions: emails sent, payments received, stage transitions. This is your agent\'s transparency log.',
      target: '[data-tour="activity-section"]',
    },
    {
      id: 'invoices',
      title: '💰 Invoices',
      description:
        'View all invoices, status, and AI risk scores. Click any invoice to see email history and payment plans offered.',
      target: '[data-tour="sidebar-invoices"]',
    },
    {
      id: 'customers',
      title: '👥 Customers',
      description:
        'See customer profiles, payment history, and risk assessments. You can pause recovery for specific customers.',
      target: '[data-tour="sidebar-customers"]',
    },
    {
      id: 'settings',
      title: '⚙️ Settings',
      description:
        'Customize dunning tone (friendly/professional/aggressive), enable aggressive mode, and manage email settings.',
      target: '[data-tour="sidebar-settings"]',
    },
    {
      id: 'done',
      title: '🚀 You\'re All Set!',
      description:
        'RecoverAI is now monitoring your invoices 24/7. Check back in a few days to see recovery progress. You can restart this tour anytime from Settings → Tours.',
    },
  ],
};
