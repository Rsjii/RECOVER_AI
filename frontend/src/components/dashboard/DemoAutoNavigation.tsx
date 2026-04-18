import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomTour } from './CustomTour';

interface DemoStep {
  page: string;
  waitBeforeShow?: number;
  waitForPopupAnimation?: number;
  duration: number;
  title: string;
  description: string;
  highlightSelector?: string;
  highlightColor?: 'blue' | 'red' | 'green' | 'orange' | 'yellow';
  maxWaitForElement?: number;
  isClickStep?: boolean;
  clickInstruction?: string;
  tooltipPosition?: 'top' | 'right' | 'left' | 'bottom' | 'center';
}

function generateDemoSteps(): DemoStep[] {
  const invoicePage = '/invoices/1359f244-8af1-4bf3-8ea8-d3593fc5084d';

  return [
    // ========== ACT 1: THE PROBLEM (2 slides) ==========
    {
      page: '/dashboard',
      duration: 3,
      title: 'The Reality: Manual Collections Drain Time & Resources',
      description: 'Your team spends 15+ hours weekly chasing unpaid invoices. Manual dunning ties up operations resources and damages customer relationships. There\'s a proven, autonomous solution.',
      highlightSelector: '[data-tour="kpi-banner"]',
      highlightColor: 'blue',
      maxWaitForElement: 2000,
      tooltipPosition: 'right',
    },
    {
      page: '/dashboard',
      duration: 4,
      title: 'Enter RecoverAI: Your Autonomous Collections Agent',
      description: 'RecoverAI autonomously manages your entire collections workflow—risk analysis, personalized outreach, payment recovery—24/7. No manual intervention. No human error. Measurable results.',
      highlightSelector: 'none',
      highlightColor: 'blue',
      maxWaitForElement: 2000,
      tooltipPosition: 'center',
    },

    // ========== ACT 2: AGENT THINKING (2 slides) ==========
    {
      page: '/invoices',
      duration: 4,
      title: 'Step 1: Intelligent Invoice Risk Scoring',
      description: 'The agent analyzes all overdue invoices and assigns risk scores based on payment history. Critical invoices surface first; low-risk ones receive gentle outreach. Perfect prioritization, every time.',
      highlightSelector: '[data-tour="invoices-table"]',
      highlightColor: 'orange',
      maxWaitForElement: 3000,
      tooltipPosition: 'right',
    },
    {
      page: invoicePage,
      waitBeforeShow: 1500,
      waitForPopupAnimation: 0,
      duration: 8,
      title: 'Step 2: AI-Driven Decision Strategy',
      description: 'For every invoice, the agent determines the optimal strategy: communication tone, timing, messaging, and escalation path. All decisions fully transparent, documented, and auditable. You stay in control.',
      highlightSelector: 'none',
      highlightColor: 'blue',
      maxWaitForElement: 3500,
      isClickStep: true,
      tooltipPosition: 'left',
    },

    // ========== ACT 3: AGENT IN ACTION (1 slide) ==========
    {
      page: '/activity',
      waitBeforeShow: 1500,
      duration: 8,
      title: 'Step 3: Real-Time Tracking & Optimization',
      description: 'Every email tracked in real-time: opens, clicks, payment responses. The agent learns from each interaction and optimizes next outreach. Full visibility. Full transparency. Full control—always.',
      highlightSelector: '[data-tour="sent-emails-section"]',
      highlightColor: 'green',
      isClickStep: true,
      tooltipPosition: 'bottom',
    },
    // ========== ACT 4: THE OUTCOME (3 slides) ==========
    {
      page: '/reports?tab=Overview',
      duration: 4,
      title: 'The Results: Real Capital Recovery',
      description: 'Agent recovered $45,200 autonomously. DSO dropped to 35 days. Cash freed for growth, not collections. While your team focused on strategy, the agent crushed collections.',
      highlightSelector: '[data-tour="reports-overview"]',
      highlightColor: 'green',
      maxWaitForElement: 3000,
      tooltipPosition: 'right',
    },
    {
      page: '/reports?tab=Campaigns',
      duration: 4,
      title: 'Why These Communications Work: 76.9% Open Rate',
      description: 'Agent emails achieve 76.9% open rate—3x industry standard. Click rate: 26.9%—10.8x higher than manual dunning. Personalization works. Customers respond when it feels human, contextual, and understanding.',
      highlightSelector: '[data-tour="reports-campaigns"]',
      highlightColor: 'blue',
      maxWaitForElement: 3000,
      tooltipPosition: 'right',
    },
    {
      page: '/reports?tab=Aging',
      duration: 6,
      title: 'Portfolio Health: Proactive, Not Reactive',
      description: '51% current. 18-day average payment time. Escalating engagement on older invoices protects relationships while maximizing recovery. This is smart portfolio management, not aggressive dunning.',
      highlightSelector: '[data-tour="reports-aging"]',
      highlightColor: 'green',
      maxWaitForElement: 3000,
      tooltipPosition: 'right',
    },

    // ========== ACT 5: CLOSE & CTA (2 slides) ==========
    {
      page: '/dashboard',
      duration: 4,
      title: 'Enterprise-Grade Autonomous Collections',
      description: '24/7 autonomous operations without fatigue, error, or inconsistency. Agent learns from every interaction, continuously improving. Your team freed to focus on growth and strategy.',
      highlightSelector: 'none',
      highlightColor: 'blue',
      maxWaitForElement: 2000,
      tooltipPosition: 'center',
    },
    {
      page: '/dashboard',
      duration: 7,
      title: 'Start Your 21-Day Free Trial Today',
      description: 'Full agent access. Real company data. Zero credit card required. By day 21, experience real capital recovery, time saved, and better payment metrics. Start now.',
      highlightSelector: 'none',
      highlightColor: 'green',
      maxWaitForElement: 2000,
      tooltipPosition: 'center',
    },
  ];
}

interface DemoAutoNavigationProps {
  onComplete?: () => void;
}

const waitForElement = (selector: string, maxWaitMs: number = 3000): Promise<boolean> => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const pollInterval = 100;

    const poll = () => {
      if (document.querySelector(selector)) {
        resolve(true);
        return;
      }

      if (Date.now() - startTime >= maxWaitMs) {
        resolve(false);
        return;
      }

      setTimeout(poll, pollInterval);
    };

    poll();
  });
};


export const DemoAutoNavigation: React.FC<DemoAutoNavigationProps> = ({ onComplete }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('/dashboard');
  const [demoSteps, setDemoSteps] = useState<DemoStep[]>([]);
  const [stepStarted, setStepStarted] = useState<number | null>(null);

  useEffect(() => {
    const steps = generateDemoSteps();
    setDemoSteps(steps);
  }, []);

  const getCurrentTourStep = () => {
    const step = demoSteps[currentStep];
    if (!step) return null;
    return {
      id: `demo-${currentStep}`,
      title: step.title,
      description: step.isClickStep && step.clickInstruction
        ? `${step.clickInstruction}\n\n${step.description}`
        : step.description,
      target: step.highlightSelector,
      position: (step.tooltipPosition || 'top') as 'top' | 'right' | 'left' | 'bottom',
    };
  };

  // Separate effect for demo completion
  useEffect(() => {
    if (demoSteps.length && currentStep >= demoSteps.length) {
      setIsOpen(false);
      onComplete?.();
    }
  }, [currentStep, demoSteps.length, onComplete]);

  // Main step progression effect
  useEffect(() => {
    if (!demoSteps.length || currentStep >= demoSteps.length) {
      return;
    }

    // Prevent running the same step twice
    if (stepStarted === currentStep) {
      return;
    }
    setStepStarted(currentStep);

    const step = demoSteps[currentStep];
    let navigationTimer: ReturnType<typeof setTimeout> | null = null;
    let clickWaitTimer: ReturnType<typeof setTimeout> | null = null;
    let displayTimer: ReturnType<typeof setTimeout> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const startStep = async () => {
      // Navigate if needed - give EXTRA time for page to fully load
      if (step.page !== currentPage) {
        navigate(step.page);
        setCurrentPage(step.page);
        // Critical: Wait longer for new pages to fully render
        // This prevents premature step advancement
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // For click steps on pages with modals, give extra time for modal to appear
      if (step.isClickStep && step.highlightSelector?.includes('dialog')) {
        // Wait a bit more for modal to mount
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // Wait for target element to exist (but skip for modals that may not be loaded yet)
      if (step.highlightSelector && step.highlightSelector !== 'none' && !step.highlightSelector.includes('dialog')) {
        await waitForElement(step.highlightSelector, step.maxWaitForElement || 3000);
      }

      // If this is a click-based step, show instruction and wait
      if (step.isClickStep) {
        clickWaitTimer = setTimeout(() => {
          setIsOpen(true);

          displayTimer = setTimeout(() => {
            setIsOpen(false);
            setCurrentStep(prev => prev + 1);
          }, step.duration * 1000);
        }, step.waitBeforeShow || 1500);
      } else {
        // Regular auto-progress slide - wait before showing
        displayTimer = setTimeout(() => {
          setIsOpen(true);
          hideTimer = setTimeout(() => {
            setIsOpen(false);
            setCurrentStep(prev => prev + 1);
          }, step.duration * 1000);
        }, step.waitBeforeShow || 0);
      }
    };

    startStep();

    return () => {
      if (navigationTimer) clearTimeout(navigationTimer);
      if (clickWaitTimer) clearTimeout(clickWaitTimer);
      if (displayTimer) clearTimeout(displayTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [currentStep, demoSteps]);

  if (!demoSteps.length || currentStep >= demoSteps.length) {
    return null;
  }

  const tourStep = getCurrentTourStep();
  if (!tourStep) return null;

  return (
    <CustomTour
      steps={[tourStep]}
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onComplete={() => setCurrentStep(currentStep + 1)}
      autoProgress={true}
    />
  );
};

export default DemoAutoNavigation;
