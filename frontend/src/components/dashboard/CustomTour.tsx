import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TourStep {
  id: string;
  title: string;
  description: string;
  target?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface CustomTourProps {
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onBackdropClick?: () => void;
}

export const CustomTour: React.FC<CustomTourProps> = ({
  steps,
  isOpen,
  onClose,
  onComplete,
  onBackdropClick,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [isDark, setIsDark] = useState(false);

  const step = steps[currentStep];

  // Detect dark mode
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isOpen || !step?.target) {
      setTargetRect(null);
      return;
    }

    const element = document.querySelector(step.target);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
      }, 500);
    }
  }, [isOpen, step?.target, currentStep]);

  useEffect(() => {
    const padding = 16;
    const tooltipWidth = 380;
    const tooltipHeight = 320;

    if (!targetRect || targetRect.width === 0 || targetRect.height === 0) {
      setTooltipPos({
        top: window.innerHeight / 2 - tooltipHeight / 2,
        left: window.innerWidth / 2 - tooltipWidth / 2,
      });
      return;
    }

    let top = targetRect.bottom + padding;
    let left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;

    if (left + tooltipWidth > window.innerWidth) {
      left = window.innerWidth - tooltipWidth - padding;
    }
    if (left < padding) {
      left = padding;
    }
    if (top + tooltipHeight > window.innerHeight) {
      top = targetRect.top - tooltipHeight - padding;
    }
    if (top < padding) {
      top = padding;
    }

    setTooltipPos({ top, left });
  }, [targetRect]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    // Mark as completed even if skipped
    onComplete();
  };

  const handleBackdropClick = () => {
    // Close tour but don't mark as completed
    // This allows user to resume from Settings without forcing auto-restart
    onClose();
    if (onBackdropClick) {
      onBackdropClick();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Overlay - Sexy dark background */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/35 to-black/40"
        onClick={handleBackdropClick}
      />

      {/* Highlight Box with glow */}
      {targetRect && targetRect.width > 0 && targetRect.height > 0 && (
        <div
          className="absolute pointer-events-none transition-all duration-300"
          style={{
            top: targetRect.top - 12,
            left: targetRect.left - 12,
            width: targetRect.width + 24,
            height: targetRect.height + 24,
            border: '2px solid',
            borderColor: isDark ? 'rgb(59, 130, 246)' : 'rgb(37, 99, 235)',
            borderRadius: '12px',
            boxShadow: isDark
              ? '0 0 0 9999px rgba(0, 0, 0, 0.35), 0 0 20px rgba(59, 130, 246, 0.4)'
              : '0 0 0 9999px rgba(0, 0, 0, 0.35), 0 0 20px rgba(37, 99, 235, 0.3)',
          }}
        />
      )}

      {/* Sexy Tooltip Card */}
      <div
        className={`absolute rounded-3xl shadow-2xl p-7 max-w-sm backdrop-blur-xl transition-all duration-300 ${
          isDark
            ? 'bg-gray-900/95 border border-gray-700 text-gray-100'
            : 'bg-white/98 border border-gray-200 text-gray-900'
        }`}
        style={{
          top: `${tooltipPos.top}px`,
          left: `${tooltipPos.left}px`,
          width: '380px',
          zIndex: 9999,
        }}
      >
        {/* Close Button - Sexy */}
        <button
          onClick={handleClose}
          className={`absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:scale-110 ${
            isDark
              ? 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header - Bold Typography */}
        <div className="mb-5">
          <h3 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {step.title}
          </h3>
          <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            {step.description}
          </p>
        </div>

        {/* Progress Dots - Sexy Animation */}
        <div className="flex gap-2 mb-7 mt-6">
          {steps.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStep(idx)}
              className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                idx === currentStep
                  ? isDark
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 w-7 shadow-lg shadow-blue-500/50'
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 w-7 shadow-lg shadow-blue-500/40'
                  : isDark
                  ? 'bg-gray-700 hover:bg-gray-600 w-2'
                  : 'bg-gray-300 hover:bg-gray-400 w-2'
              }`}
              title={`Step ${idx + 1}`}
            />
          ))}
        </div>

        {/* Button Section - Premium styling */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className={`flex-1 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                currentStep === 0
                  ? isDark
                    ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : isDark
                  ? 'bg-gray-800 text-gray-200 hover:bg-gray-700 active:scale-95'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95'
              }`}
            >
              ← Back
            </button>
            <div className={`text-xs font-bold px-3 py-2 rounded-lg whitespace-nowrap ${
              isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
            }`}>
              {currentStep + 1}/{steps.length}
            </div>
            <button
              onClick={handleNext}
              className={`flex-1 px-4 py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 active:scale-95 ${
                isDark
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/30'
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/25'
              }`}
            >
              {currentStep === steps.length - 1 ? '✓ Done' : 'Next →'}
            </button>
          </div>

          {/* Skip Link */}
          <button
            onClick={handleClose}
            className={`w-full text-xs font-medium py-2 rounded-lg transition-all ${
              isDark
                ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
            }`}
          >
            Skip tour
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
