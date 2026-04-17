import React, { useEffect, useState } from 'react';

/**
 * DEMO FLOW: Automated walkthrough for cold email video (IMPROVED)
 * - Shows ONE invoice through complete lifecycle
 * - 30 seconds total (not 90)
 * - Real data: actual amounts, days overdue, customer names
 * - Shows agent working: AI reasoning, email generation, payment confirmation
 * - Professional smooth transitions with visual effects
 *
 * Usage: Add <DemoFlow /> to your app, navigate to /demo, hit record
 */

interface DemoStep {
  id: string;
  duration: number;
  title: string;
  narration: string;
  action: () => Promise<void>;
}

// Pre-crafted AI-generated email (realistic)
const DEMO_EMAIL = {
  subject: 'Urgent: €32,000 Invoice Now 48 Days Overdue — Action Required',
  body: `Hi GrowthCo,

I'm reaching out regarding your outstanding invoice of €32,000, which is now 48 days past due.

We value our partnership and want to resolve this quickly. Given your payment history, I'm confident we can find a solution.

Options:
1. Pay in full (reply for payment link)
2. Set up a payment plan (3-4 installments)
3. If there's an issue with the invoice, let me know

Please respond within 48 hours to avoid further escalation.

Best regards,
Acme SaaS`,
};

const DEMO_STEPS: DemoStep[] = [
  {
    id: 'hook',
    duration: 4,
    title: 'HOOK: The Problem',
    narration: 'One unpaid invoice. €32,000. 48 days overdue.',
    action: async () => {
      // Navigate to invoices page
      window.location.href = '/invoices?status=unpaid';
      await new Promise(r => setTimeout(r, 800));

      // Create demo highlight for this invoice
      // Wait for invoices to load, then highlight our demo invoice
      let attempts = 0;
      const findAndHighlight = () => {
        const rows = document.querySelectorAll('[role="row"]');
        if (rows.length > 0) {
          const firstRow = rows[1] as HTMLElement; // Skip header
          if (firstRow) {
            firstRow.classList.add('demo-highlight-red', 'ring-2', 'ring-red-500');
            firstRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else if (attempts < 5) {
          attempts++;
          setTimeout(findAndHighlight, 200);
        }
      };
      findAndHighlight();
    }
  },

  {
    id: 'agent-analyzes',
    duration: 4,
    title: 'Agent Analyzes',
    narration: 'Agent analyzes in milliseconds. Customer history: 3 late payments. High risk.',
    action: async () => {
      // Show AI reasoning card
      const firstRow = document.querySelector('[role="row"]');
      if (firstRow && !document.querySelector('.demo-ai-reasoning')) {
        const reasoningCard = document.createElement('div');
        reasoningCard.className = 'demo-ai-reasoning animate-fadeIn';
        reasoningCard.innerHTML = `
          <div class="fixed bottom-40 left-6 bg-red-50 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700 rounded-lg p-4 shadow-lg w-80 z-40">
            <div class="font-bold text-red-700 dark:text-red-400 mb-2">🔴 HIGH RISK (Score: 85)</div>
            <ul class="text-sm text-red-600 dark:text-red-300 space-y-1">
              <li>• 48 days overdue</li>
              <li>• Payment history: Late 3 of 5 times</li>
              <li>• Average delay: 12 days</li>
              <li>• Recommended: Aggressive dunning</li>
            </ul>
          </div>
        `;
        document.body.appendChild(reasoningCard);
      }
    }
  },

  {
    id: 'email-generation',
    duration: 5,
    title: 'Email Generation',
    narration: 'Generates personalized email. Matches your tone. Takes 200ms.',
    action: async () => {
      // Show email preview with typing effect
      const emailBox = document.createElement('div');
      emailBox.className = 'demo-email-preview fixed bottom-40 right-6 w-96 z-40 animate-fadeIn';
      emailBox.innerHTML = `
        <div class="bg-white dark:bg-gray-800 border-2 border-blue-400 rounded-lg p-4 shadow-lg">
          <div class="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2">📧 AI Generated Email</div>
          <div class="text-sm space-y-2">
            <div><span class="font-semibold text-gray-700 dark:text-gray-300">Subject:</span></div>
            <div id="demo-subject" class="text-xs text-gray-600 dark:text-gray-400 font-mono min-h-4">▌</div>
            <div class="border-t border-gray-200 dark:border-gray-700 my-2"></div>
            <div class="text-xs text-gray-600 dark:text-gray-400 font-mono" id="demo-body">▌</div>
          </div>
        </div>
      `;
      document.body.appendChild(emailBox);

      // Typing effect
      const subjectEl = document.getElementById('demo-subject');
      const bodyEl = document.getElementById('demo-body');

      const totalDuration = 4500; // 4.5 seconds
      const startTime = Date.now();

      while (Date.now() - startTime < totalDuration) {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / totalDuration, 1);

        // Type subject first (40% of text)
        const subjectChars = Math.floor(progress * DEMO_EMAIL.subject.length);
        if (subjectEl) {
          subjectEl.textContent = DEMO_EMAIL.subject.substring(0, subjectChars) + (subjectChars < DEMO_EMAIL.subject.length ? '▌' : '');
        }

        // Then type body (60% of text)
        if (progress > 0.3) {
          const bodyChars = Math.floor((progress - 0.3) / 0.7 * DEMO_EMAIL.body.length);
          if (bodyEl) {
            bodyEl.textContent = DEMO_EMAIL.body.substring(0, bodyChars) + (bodyChars < DEMO_EMAIL.body.length ? '▌' : '');
          }
        }

        await new Promise(r => setTimeout(r, 16)); // 60fps
      }

      // Final state
      if (subjectEl) subjectEl.textContent = DEMO_EMAIL.subject;
      if (bodyEl) bodyEl.textContent = DEMO_EMAIL.body;
    }
  },

  {
    id: 'approval',
    duration: 3,
    title: 'One-Click Approval',
    narration: 'Review. Approve. Send.',
    action: async () => {
      // Navigate to activity to show approval
      window.location.href = '/activity';
      await new Promise(r => setTimeout(r, 800));

      // Clean up demo elements
      document.querySelectorAll('.demo-ai-reasoning, .demo-email-preview').forEach(el => el.remove());

      // Highlight send button
      let attempts = 0;
      const findSendBtn = () => {
        const sendBtn = document.querySelector('[data-testid="bulk-approve-btn"]') ||
                       document.querySelector('button:has-text("Approve")') ||
                       Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Approve'));
        if (sendBtn && !sendBtn.classList.contains('demo-send-glow')) {
          sendBtn.classList.add('demo-send-glow', 'ring-2', 'ring-blue-500', 'ring-offset-2');
          sendBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Show toast
          const toast = document.createElement('div');
          toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-fadeIn z-50';
          toast.textContent = '✓ Email sent to accounting@growthco.com';
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 2000);
        } else if (attempts < 5) {
          attempts++;
          setTimeout(findSendBtn, 200);
        }
      };
      findSendBtn();
    }
  },

  {
    id: 'payment-received',
    duration: 4,
    title: 'Payment Received',
    narration: 'Payment arrives in 3 days. Autonomously tracked. Invoice status updates.',
    action: async () => {
      // Navigate back to invoices
      window.location.href = '/invoices?status=paid';
      await new Promise(r => setTimeout(r, 800));

      // Simulate invoice status change
      const firstRow = document.querySelector('[role="row"]');
      if (firstRow) {
        // Change styling to show paid
        firstRow.classList.remove('demo-highlight-red', 'ring-red-500');
        firstRow.classList.add('demo-highlight-green', 'ring-2', 'ring-green-500', 'animate-pulse');

        // Show status change animation
        const statusCell = firstRow.querySelector('td:nth-child(6)') || firstRow.querySelector('td');
        if (statusCell) {
          statusCell.innerHTML = '<span class="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded text-sm">✓ PAID</span>';
        }
      }
    }
  },

  {
    id: 'dashboard-results',
    duration: 4,
    title: 'Dashboard Results',
    narration: '€32,000 recovered. Zero hours invested. Agent running 24/7.',
    action: async () => {
      // Navigate to dashboard
      window.location.href = '/dashboard';
      await new Promise(r => setTimeout(r, 800));

      // Update KPI display
      const arCard = document.querySelector('[data-testid="total-ar-card"]');
      if (arCard) {
        const valueEl = arCard.querySelector('div:nth-child(1)');
        if (valueEl) {
          valueEl.textContent = '€139,000 → €107,000';
          valueEl.classList.add('text-green-600', 'dark:text-green-400');
        }
      }
    }
  },

  {
    id: 'cta',
    duration: 2,
    title: 'Call To Action',
    narration: 'Free 21-day trial. Autonomous. Book a call.',
    action: async () => {
      // Show CTA with glow
      const ctaSection = document.querySelector('[data-testid="cta-section"]');
      if (ctaSection) {
        ctaSection.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
        ctaSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }
];

export const DemoFlow: React.FC = () => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);

  // Calculate total demo time
  useEffect(() => {
    const total = DEMO_STEPS.reduce((sum, step) => sum + step.duration, 0);
    setTotalTime(total);
  }, []);

  // Auto-play through steps
  useEffect(() => {
    if (!isPlaying || currentStepIndex >= DEMO_STEPS.length) return;

    const currentStep = DEMO_STEPS[currentStepIndex];
    let secondsLeft = currentStep.duration;
    setTimeLeft(secondsLeft);

    // Execute step action
    currentStep.action().catch(console.error);

    // Countdown timer
    const timer = setInterval(() => {
      secondsLeft--;
      setTimeLeft(secondsLeft);

      if (secondsLeft <= 0) {
        clearInterval(timer);
        setCurrentStepIndex(prev => prev + 1);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying, currentStepIndex]);

  // Auto-end when all steps done
  useEffect(() => {
    if (currentStepIndex >= DEMO_STEPS.length && isPlaying) {
      setIsPlaying(false);
    }
  }, [currentStepIndex, isPlaying]);

  const currentStep = DEMO_STEPS[currentStepIndex];
  const progress = (currentStepIndex / DEMO_STEPS.length) * 100;

  return (
    <>
    <style>{`
      /* Demo Flow Animations & Effects */
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .animate-fadeIn {
        animation: fadeIn 0.3s ease-out;
      }

      .demo-highlight-red {
        background-color: rgba(239, 68, 68, 0.05) !important;
        box-shadow: inset 0 0 0 2px #ef4444 !important;
      }

      .demo-highlight-green {
        background-color: rgba(16, 185, 129, 0.05) !important;
        box-shadow: inset 0 0 0 2px #10b981 !important;
      }

      .demo-send-glow {
        box-shadow: 0 0 20px rgba(59, 130, 246, 0.6) !important;
      }

      .demo-ai-reasoning {
        box-shadow: 0 10px 40px rgba(239, 68, 68, 0.2);
      }

      .demo-email-preview {
        box-shadow: 0 10px 40px rgba(59, 130, 246, 0.2);
      }
    `}</style>
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
      {/* DEMO HEADER */}
      <div className="bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">
            🎬 DEMO FLOW: Cold Email Video ({totalTime}s)
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {isPlaying ? '▶️ RECORDING IN PROGRESS' : '⏸️ Ready to record'}
          </p>
        </div>

        <div className="text-right">
          <p className="text-3xl font-bold text-white tabular-nums">
            {Math.floor(timeLeft)}s
          </p>
          <p className="text-xs text-gray-400">
            Step {currentStepIndex + 1} / {DEMO_STEPS.length}
          </p>
        </div>
      </div>

      {/* DEMO CONTENT (Fullscreen app) */}
      <div className="flex-1 overflow-hidden">
        {/* Content renders behind this, you'll see the actual app */}
      </div>

      {/* NARRATION OVERLAY */}
      <div className="bg-gray-900 border-t border-gray-700 px-6 py-4 max-h-32 overflow-y-auto">
        <p className="text-lg text-white font-semibold leading-relaxed">
          {currentStep?.narration || 'Demo complete!'}
        </p>
      </div>

      {/* PROGRESS BAR */}
      <div className="h-2 bg-gray-800">
        <div
          className="h-full bg-blue-600 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* CONTROLS */}
      <div className="bg-gray-900 border-t border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex gap-4">
          <button
            onClick={() => {
              setIsPlaying(!isPlaying);
            }}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors text-lg"
          >
            {isPlaying ? '⏸️ PAUSE' : '▶️ START DEMO'}
          </button>

          <button
            onClick={() => {
              setCurrentStepIndex(0);
              setIsPlaying(false);
              setTimeLeft(0);
            }}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors"
          >
            🔄 RESTART
          </button>

          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
          >
            ❌ EXIT DEMO
          </button>
        </div>

        <div className="text-gray-400 text-sm">
          <p>💡 Tip: Start screen recording BEFORE hitting START</p>
          <p>⏱️ Total demo time: {totalTime}s (~1:30)</p>
        </div>
      </div>

      {/* STEP INDICATOR */}
      <div className="bg-gray-900 border-t border-gray-700 px-6 py-3">
        <div className="grid grid-cols-8 gap-1 overflow-x-auto">
          {DEMO_STEPS.map((step, idx) => (
            <div
              key={step.id}
              className={`p-3 rounded text-xs text-center transition-all whitespace-nowrap ${
                idx === currentStepIndex
                  ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                  : idx < currentStepIndex
                  ? 'bg-green-600/30 text-green-300'
                  : 'bg-gray-700 text-gray-400'
              }`}
            >
              <p className="font-bold text-xs">{idx + 1}. {step.id}</p>
              <p className="text-xs">{step.duration}s</p>
            </div>
          ))}
        </div>
      </div>
    </div>
    </>
  );
};

export default DemoFlow;
